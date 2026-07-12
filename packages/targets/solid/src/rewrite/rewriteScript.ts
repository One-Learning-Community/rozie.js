/**
 * rewriteRozieIdentifiers — Solid target (P2 complete implementation).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into Solid-idiomatic identifier shapes.
 *
 * Mappings:
 *   - `$props.x` (any prop) read   → `local.x`   (splitProps result)
 *   - `$props.x = v` (model write) → `setX(v)` or `setX(prev => prev OP v)` for compound
 *   - `$data.x` read               → `x()`        (signal getter call)
 *   - `$data.x = v`                → `setX(v)`    (signal setter call)
 *   - `$data.x += n`               → `setX(prev => prev + n)` (compound updater)
 *   - `$refs.foo` read             → `fooRef`     (plain variable set via ref callback)
 *   - `$emit('event', args)`       → `_props.onEvent?.(args)` (optional-chain call)
 *   - `$onMount`, `$onUnmount`, `$onUpdate` — NOT mutated; consumed structurally from ir.lifecycle
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type { File } from '@babel/types';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { portalKey } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { isInTypePosition } from '../../../../core/src/ast/typePosition.js';
import {
  deconflictGeneratedSymbols,
  deconflictReservedClassFields,
  type GeneratedSymbolGroup,
} from '../../../../core/src/rewrite/deconflict.js';
import {
  SOLID_EMITTER_LOCALS,
  SOLID_IMPORT_NAMES,
} from '../../../../core/src/rewrite/reservedNames.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';
import { renderType } from '../emit/emitPropsInterface.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * 260712-a09 (Pattern D) — options threaded into `rewriteRozieIdentifiers` /
 * `rewriteRozieExpressionNode` from a specific call site (currently: the
 * `$onMount` setup-body rewrite in emitScript.ts). `nonNullRefCallArgs: true`
 * scopes a non-null assertion to DOM ref reads used as a DIRECT call argument
 * (the mount-time engine-init shape: `useSortableJS($refs.listEl, {...})`),
 * mirroring the `__rozieRoot` rationale already applied above (a ref read
 * inside a lifecycle hook is guaranteed assigned once mount has run). Ref
 * reads elsewhere (member access, template bindings, non-call positions) are
 * UNCHANGED — this is intentionally narrow, not a blanket ref-typing change.
 */
export interface RewriteScriptOptions {
  nonNullRefCallArgs?: boolean;
}

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
}

/** Convert an event name to a `_props.onX` field name. */
function toSolidEventPropName(eventName: string): string {
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return 'on' + camel;
}

/** Capitalize first letter. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map of compound-assignment operator → matching binary operator. */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%', '**=': '**',
  '<<=': '<<', '>>=': '>>', '>>>=': '>>>', '&=': '&', '|=': '|', '^=': '^',
};

/**
 * Build a signal setter call for assignment. For simple `=` emit `setX(rhs)`;
 * for compound operators emit `setX(prev => prev OP rhs)` (functional updater).
 */
function buildSetterCall(
  varName: string,
  operator: string,
  rhs: t.Expression,
): t.CallExpression {
  const setterName = 'set' + capitalize(varName);
  if (operator === '=') {
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    // Fallback for unsupported operators — simple setter
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  // Use setX(x() + rhs) instead of setX(prev => prev + rhs).
  // The functional-updater form (prev =>) triggers solid/reactivity lint warnings when
  // the rhs contains reactive values (e.g. local.step from splitProps) inside an arrow
  // that is not a tracked scope. Using the current getter value directly avoids this
  // and is equivalent in Solid's synchronous execution model.
  return t.callExpression(
    t.identifier(setterName),
    [t.binaryExpression(binOp, t.callExpression(t.identifier(varName), []), rhs)],
  );
}

/**
 * Phase 18 (Req 2) — normalize the producer-side two-way-write sigil `$model`
 * to `$props` across a cloned File, in place. See the call-site comment in
 * `rewriteRozieIdentifiers` for the full contract; `$model.X` is model-only and
 * always a member-expression object, so the object-Identifier rename routes
 * read/write through the IDENTICAL `$props.<modelProp>` lowering. Reuse, not
 * reimplement.
 */
function normalizeModelAccessor(file: File): void {
  traverse(file, {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path: NodePath<t.OptionalMemberExpression>) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });
}

/** True for `$props.X` where X is in `polymorphicModelProps`. */
function isPolymorphicModelRead(node: t.Node, polymorphicModelProps: Set<string>): boolean {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object) &&
    node.object.name === '$props' &&
    t.isIdentifier(node.property) &&
    polymorphicModelProps.has(node.property.name)
  );
}

/**
 * When `test` is `typeof $props.X === '<lit>'` (or `!==`) or `'<lit>' in
 * $props.X`, for X in `polymorphicModelProps`, returns X. Otherwise null.
 */
function matchesPolymorphicModelGuard(
  test: t.Expression,
  polymorphicModelProps: Set<string>,
): string | null {
  // A compound guard (`typeof $props.X === 'string' && $props.X.length > 0`)
  // still narrows once the reads are bound to a local — recurse into both sides
  // of a `&&`/`||` and hoist for the first branch that carries the guard
  // (Spike-012 BUG-4, `logical-guard` context).
  if (t.isLogicalExpression(test)) {
    return (
      matchesPolymorphicModelGuard(test.left, polymorphicModelProps) ??
      matchesPolymorphicModelGuard(test.right, polymorphicModelProps)
    );
  }
  if (!t.isBinaryExpression(test)) return null;
  const { operator, left, right } = test;
  if (operator === '===' || operator === '!==') {
    if (
      t.isUnaryExpression(left) &&
      left.operator === 'typeof' &&
      isPolymorphicModelRead(left.argument, polymorphicModelProps) &&
      t.isStringLiteral(right)
    ) {
      return (left.argument as t.MemberExpression & { property: t.Identifier }).property.name;
    }
    if (
      t.isUnaryExpression(right) &&
      right.operator === 'typeof' &&
      isPolymorphicModelRead(right.argument, polymorphicModelProps) &&
      t.isStringLiteral(left)
    ) {
      return (right.argument as t.MemberExpression & { property: t.Identifier }).property.name;
    }
    return null;
  }
  if (operator === 'in' && isPolymorphicModelRead(right, polymorphicModelProps)) {
    return (right as t.MemberExpression & { property: t.Identifier }).property.name;
  }
  return null;
}

/**
 * Emitter-hardening backlog item #11 (project_solid_polymorphic_model_typeof_narrow_gap,
 * 73-02 Task 2). `$props.X` lowers to a Solid accessor CALL (`X()`); TS does not
 * narrow a `typeof`/`in` guard across two SEPARATE calls to that accessor the
 * way it narrows a plain variable/property read. When a `ConditionalExpression`
 * guards on `typeof $props.X === '<lit>'` / `'<lit>' in $props.X` (X a
 * polymorphic/unknown model prop) AND re-reads `$props.X` again inside the
 * conditional, hoist ONE local binding before the guard and route every
 * `$props.X` read inside the conditional through it — mirroring the hand-
 * authored `const v = $props.value; return typeof v === 'string' ? v : ''`
 * workaround this replaces (DatePicker.rozie, commit bf3766b5).
 *
 * Gated to two known-safe shapes so this never mis-hoists into the wrong scope:
 *   1. the conditional IS an arrow function's own concise body — converted to
 *      a block body wrapping `const v = ...; return <conditional>;`
 *   2. the conditional sits inside a statement that lives in a statement LIST
 *      (block body, switch-case consequent, program body) — including
 *      statements nested inside control-flow blocks (`if`/`for`/`while`/
 *      `switch`/`try`). The local is inserted right before that statement, in
 *      the same block as the guarded reads (Spike-012 BUG-4).
 * A conditional not in either shape (e.g. a bare single-statement `if (x)
 * return …;` with no block) is left alone (falsify-to-no-op, never a wrong fix).
 *
 * Runs on the raw (pre-$props-rewrite) Program, before the main
 * `rewriteRozieIdentifiers` traversal — the injected `$props.X` reference is
 * left for that later pass to lower to the normal `X()` accessor call.
 */
function hoistPolymorphicModelGuards(cloned: File, polymorphicModelProps: Set<string>): void {
  if (polymorphicModelProps.size === 0) return;

  traverse(cloned, {
    ConditionalExpression(path: NodePath<t.ConditionalExpression>) {
      const propName = matchesPolymorphicModelGuard(path.node.test, polymorphicModelProps);
      if (!propName) return;

      // Count occurrences of `$props.<propName>` in test+consequent+alternate;
      // need at least 2 (the guard's own occurrence + at least one re-read) to
      // be worth hoisting.
      let occurrences = 0;
      path.traverse({
        MemberExpression(inner: NodePath<t.MemberExpression>) {
          if (
            isPolymorphicModelRead(inner.node, polymorphicModelProps) &&
            (inner.node.property as t.Identifier).name === propName
          ) {
            occurrences++;
          }
        },
      });
      if (occurrences < 2) return;

      // CR-01 fix (project_solid_polymorphic_model_typeof_narrow_gap review
      // finding, 73-10 gap-closure): determine which shape (if any) applies
      // FIRST — no mutation yet. The two shapes below are the ONLY ones this
      // hoist is safe for; every other nesting (guard one level inside an
      // `if`/`for`/`try`/`switch`, etc.) must be a TRUE no-op, matching the
      // falsify-to-no-op contract this function's docstring already
      // promises. Computing this before any replacement prevents the bug
      // where the tree was mutated to reference an undeclared local (`v`)
      // even when neither shape matched.
      const parentPath = path.parentPath;
      const isConciseArrowBody =
        parentPath.isArrowFunctionExpression() && parentPath.node.body === path.node;

      // Shape 2 (generalized — 73-10 CR-01 → Spike-012 BUG-4): the conditional
      // sits inside a statement that lives in a statement LIST (a block body,
      // switch-case consequent, program body), INCLUDING statements nested
      // inside control-flow blocks (`if`/`for`/`while`/`switch`/`try`). The
      // `const v` is inserted immediately before that statement via
      // `insertBefore`, landing in the SAME block as the guarded reads, so it is
      // always in scope for them. This was previously gated to a DIRECT child of
      // the function body only — the identical guard one level deeper (inside an
      // `if`, etc.) was left un-narrowed and failed strict tsc (Solid TS2322).
      // The shape is still computed BEFORE any mutation (the CR-01 invariant:
      // never leave the tree referencing an undeclared local when no insertion
      // point applies).
      const stmtPath = path.getStatementParent();
      const canInsertBeforeStmt = !!stmtPath && stmtPath.inList;

      if (!isConciseArrowBody && !canInsertBeforeStmt) return; // true no-op, nothing touched

      // Pick a local name, defaulting to `v` (mirrors the hand-authored
      // pattern) — fall back to a generated uid on the rare collision.
      const localName = path.scope.hasBinding('v')
        ? path.scope.generateUidIdentifier('v').name
        : 'v';

      // Replace every `$props.<propName>` read inside the conditional
      // (including the guard itself) with a bare reference to the local.
      // Safe now — a matching shape is guaranteed, so the declaration below
      // always lands in scope for this replacement.
      path.traverse({
        MemberExpression(inner: NodePath<t.MemberExpression>) {
          if (
            isPolymorphicModelRead(inner.node, polymorphicModelProps) &&
            (inner.node.property as t.Identifier).name === propName
          ) {
            inner.replaceWith(t.identifier(localName));
            inner.skip();
          }
        },
      });

      const varDecl = t.variableDeclaration('const', [
        t.variableDeclarator(
          t.identifier(localName),
          t.memberExpression(t.identifier('$props'), t.identifier(propName)),
        ),
      ]);

      // Shape 1: the conditional IS the arrow function's own concise body.
      if (isConciseArrowBody) {
        parentPath.node.body = t.blockStatement([varDecl, t.returnStatement(path.node)]);
        return;
      }

      // Shape 2: the conditional sits inside a statement that is a direct
      // child of its nearest enclosing function's own block body.
      stmtPath!.insertBefore(varDecl);
    },
  });
}

/**
 * Rewrite $props/$data/$refs in a single expression node (cloned from IR).
 *
 * Used by emitScript.ts to rewrite computed body expressions that live in
 * ir.computed[i].body — these are Babel AST nodes separate from the main
 * script body, so they need their own rewrite pass. The node is cloned first
 * to avoid mutating the shared IR.
 *
 * @experimental — shape may change before v1.0
 */
export function rewriteRozieExpressionNode(
  expr: t.Expression | t.BlockStatement,
  ir: IRComponent,
  options?: RewriteScriptOptions,
): t.Expression | t.BlockStatement {
  // For BlockStatements, wrap body statements directly in the program.
  // For Expressions, wrap as an ExpressionStatement.
  let programBody: t.Statement[];
  const isBlock = t.isBlockStatement(expr);
  if (isBlock) {
    programBody = t.cloneNode(expr as t.BlockStatement, true, false).body;
  } else {
    programBody = [t.expressionStatement(t.cloneNode(expr as t.Expression, true, false))];
  }

  // Wrap in a File/Program so traverse() has a root to walk.
  const wrapped: File = {
    type: 'File',
    program: {
      type: 'Program',
      body: programBody,
      directives: [],
      sourceType: 'module',
    },
    comments: [],
  };
  const result = rewriteRozieIdentifiers(wrapped, ir, options);
  const body = result.rewrittenProgram.program.body;

  if (isBlock) {
    return t.blockStatement(body);
  }
  // Fast path: a single ExpressionStatement — the rewrite left the shape
  // unchanged (no prelude injected). Return the bare expression (byte-identical
  // to the pre-hoist behaviour for every non-poly-guard computed body).
  if (body.length === 1 && t.isExpressionStatement(body[0])) {
    return (body[0] as t.ExpressionStatement).expression;
  }
  // Spike-012 R7: a rewrite pass (`hoistPolymorphicModelGuards`) injected a
  // `const v = $props.X` prelude BEFORE the guarded expression, so the program
  // body is now `[VarDecl…, ExpressionStatement(expr)]`. The old single-statement
  // extraction read `body[0]` (the VarDecl), failed the ExpressionStatement
  // guard, and fell back to returning the ORIGINAL un-rewritten `expr` — leaking
  // a raw `$props.value` (free ident, TS2552 + runtime ReferenceError). Preserve
  // the hoisted prelude by returning a BlockStatement whose trailing statement
  // `return`s the rewritten expression; emitScript renders it as a `() => { … }`
  // block-body computed arrow. This only triggers when a prelude exists — the
  // fast path above keeps every prelude-free body byte-identical.
  const last = body[body.length - 1];
  if (last && t.isExpressionStatement(last)) {
    return t.blockStatement([
      ...body.slice(0, -1),
      t.returnStatement((last as t.ExpressionStatement).expression),
    ]);
  }
  // Fallback: return original (unreachable for the computed-body path — a
  // prelude always precedes a trailing ExpressionStatement).
  return expr;
}

/**
 * Full Solid identifier rewrite pass. Replaces all $props/$data/$refs/$emit
 * references with their Solid-idiomatic equivalents.
 */
export function rewriteRozieIdentifiers(
  cloned: File,
  ir: IRComponent,
  options?: RewriteScriptOptions,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];
  const nonNullRefCallArgs = options?.nonNullRefCallArgs === true;

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  // Model props whose declared `type` resolves to `unknown` (i.e. `type: null`)
  // — their `createControllableSignal<unknown>` accessor returns `unknown`. A
  // member read off the accessor (`value().length`, `value()[0]`) is TS2339 on
  // `unknown`, and a control-flow guard (`Array.isArray(value()) && value().length`)
  // does NOT narrow across two separate accessor CALLS the way React's stable
  // destructured local does. Wrapping the accessor read `(value() as any)` when
  // it is the OBJECT of a member access defeats the `unknown` exactly as
  // `typeNeutralizeScript` wraps a `for...of` iterable `as any` (Phase 9 WR-05)
  // — a pure type assertion, byte-runtime-neutral, gated to the unknown-typed
  // model accessor only so the typed-prop corpus stays untouched.
  const unknownModelProps = new Set(
    ir.props
      .filter((p) => p.isModel && renderType(p.typeAnnotation) === 'unknown')
      .map((p) => p.name),
  );
  // Emitter-hardening backlog item #11 (project_solid_polymorphic_model_typeof_narrow_gap,
  // 73-02 Task 2): a model prop widened to a UNION (`type: [String, Object]`,
  // rendering `string | Record<string, any>`) OR to `unknown` (`type: null`,
  // above) is read via a fresh accessor CALL each time (`value()`), and TS does
  // NOT narrow a `typeof`/`in` guard across two SEPARATE calls the way it
  // narrows a plain variable/property read (React/Vue/Lit). Superset of
  // `unknownModelProps` — feeds `hoistPolymorphicModelGuards` below, which binds
  // ONE local before the guard so the narrowing holds. A monomorphic
  // (single-identifier-type) model prop is NEVER in this set, so that corpus is
  // untouched.
  const polymorphicModelProps = new Set(
    ir.props
      .filter(
        (p) =>
          p.isModel &&
          (p.typeAnnotation.kind === 'union' || renderType(p.typeAnnotation) === 'unknown'),
      )
      .map((p) => p.name),
  );
  const dataNames = new Set(ir.state.map((s) => s.name));
  const computedNames = new Set(ir.computed.map((c) => c.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => portalKey(s)),
  );
  const allSlotNames = new Set(ir.slots.map((s) => s.name));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X`.
  // `$model` is model-only by contract: Wave 1's core semantic pass already
  // rejected `$model.<nonModelProp>` (ROZ205) / `$model.<nonExistent>` (ROZ113)
  // BEFORE lowering, so every `$model.X` reaching the emitter is a declared
  // model prop. `$model` is always a member-expression object (D-03), so we
  // normalize the accessor `$model` → `$props` in a single pre-pass; every
  // downstream write/read site then routes through the IDENTICAL
  // `$props.<modelProp>` lowering (same createControllableSignal setter on
  // write, same `value()` accessor on read) → byte-identical emit. Reuse, not
  // reimplement (SPEC Req 2).
  normalizeModelAccessor(cloned);

  // Emitter-hardening backlog item #11 (73-02 Task 2) — hoist a local binding
  // before a `typeof`/`in` guard on a polymorphic/unknown model-prop accessor
  // read, so Solid's TS narrowing holds across the guard + the re-read it
  // guards. Must run on the raw (pre-rewrite) Program, same as
  // `normalizeModelAccessor` above — the injected `$props.X` reference is left
  // for the main traversal below to lower to the normal accessor call.
  hoistPolymorphicModelGuards(cloned, polymorphicModelProps);

  // UNIFIED DECONFLICTION PASS (Phase 46 ITEM-5 / D-02) — net-new Solid wiring.
  // Solid lowers `$props.X` / `$data.X` to bare signal-accessor reads `X()` and
  // mints `setX` setters; a user local/param shadowing a signal accessor name or
  // a setter name captures the rewritten bare identifier the same way React/Svelte
  // are exposed. Gated only-on-collision (accessor read for props/data; pure
  // binding for setters) so the non-colliding Solid corpus stays byte-identical.
  // Runs on the freshly-cloned, not-yet-mutated Program (scope cache valid) BEFORE
  // the bare-accessor rewrite below.
  // NOT `$data` keys here — a `$data` key colliding with an `$expose` verb is
  // renamed at the GENERATED-state level by the shared deconflictStateExposeCollision
  // IR pass (uniform across all 6 targets). PUBLIC-CONTRACT guard: $expose verbs +
  // prop names are never renamed.
  const solidSetters = new Set<string>();
  for (const s of ir.state) solidSetters.add('set' + capitalize(s.name));
  for (const p of ir.props) if (p.isModel) solidSetters.add('set' + capitalize(p.name));
  const solidProps = new Set<string>([...modelProps, ...nonModelProps]);
  // Protected = $expose verbs ONLY (prop names are the collision target, not the
  // renameable side — see the React/Svelte rationale).
  const solidProtected = new Set<string>((ir.expose ?? []).map((e) => e.name));

  const solidGroups: GeneratedSymbolGroup[] = [
    { names: solidProps, trigger: { kind: 'accessor', accessor: '$props' } },
    { names: solidSetters, trigger: { kind: 'binding' } },
  ];
  deconflictGeneratedSymbols(cloned, solidGroups, solidProtected);

  // Phase 61 Plan 06 (SC-2, collision-solid §"NEW risks" 1/2) — a USER TOP-LEVEL
  // `<script>` const/let/function whose name equals a Solid emitter LOCAL
  // (`local`/`attrs`/`_merged`/`resolved`/`portals`/…), a bare solid-js / runtime
  // IMPORT (`children`/`on`/`For`/`createSignal`/…), or the `<name>Ref` ref local
  // collides with the emitter-minted COMPONENT-SCOPE binding → auto-rename to
  // `X$local`. The reserved set comes from reservedNames.ts (single source of
  // truth). Solid is a FUNCTION target: NO DOM/Object.prototype/CVA names here
  // (collision-solid §4).
  //
  // PROGRAM-LEVEL ONLY (via `deconflictReservedClassFields`, whose mechanism is
  // target-agnostic despite the name): only a COMPONENT-SCOPE binding actually
  // shadows the import / emitter-local at its use site. A NESTED arrow PARAM named
  // `on`/`attrs` (`(on) => …`, `(attrs) => …`, common in engine-wrapper helpers)
  // is block-scoped and HARMLESS — it must NOT be renamed (the `binding`-trigger
  // `deconflictGeneratedSymbols` would over-rename it at any depth → corpus drift).
  //
  // The GENERATED `<data>`/`$computed`/`$refs` NAMES themselves (minted from the IR
  // by emitScript as string lines, NOT user declarators in this clone) collide with
  // imports / emitter-locals / each other at the IR level — those are renamed by
  // `deconflictSolidGeneratedNames(ir, …)` in emitSolid BEFORE this per-target
  // rewrite runs, so `dataNames`/`computedNames` are NOT user-binding groups here.
  const refNamesSuffixed = new Set<string>([...refNames].map((n) => n + 'Ref'));
  const solidReservedBindings = new Set<string>([
    ...SOLID_EMITTER_LOCALS,
    ...SOLID_IMPORT_NAMES,
    ...refNamesSuffixed,
  ]);
  deconflictReservedClassFields(cloned, solidReservedBindings, solidProtected);

  traverse(cloned, {
    // Rewrite bare computed-memo references to getter calls: canIncrement → canIncrement().
    // User-authored <script> code references $computed-derived names by bare identifier;
    // after compilation they become createMemo() Accessors that must be invoked.
    Identifier(path: NodePath<t.Identifier>) {
      const name = path.node.name;

      // WR-02 (Phase 9) — skip identifiers in TypeScript type position. A
      // `<script lang="ts">` Program carries `TS*` nodes and @babel/traverse
      // descends into them; without this guard a type reference (`let x:
      // someComputed`) whose name collides with a `$computed` memo would be
      // rewritten to `someComputed()` INSIDE the type annotation, producing
      // invalid TS. Mirrors the identical guard in core's computeDeps.
      if (isInTypePosition(path)) return;

      // Spike 001 B2 — script-context `$el` lowers to
      // `MemberExpression($refs, __rozieRoot)`. The IR pass `lowerRootElementRef`
      // already appended `RefDecl { name: '__rozieRoot' }` to `ir.refs` when a
      // free `$el` read was detected, so the synthesised MemberExpression
      // naturally flows into the existing `$refs.X` handler below and lowers
      // to `__rozieRootRef` (Solid's callback-ref idiom).
      if (name === '$el') {
        const parentPath = path.parentPath;
        if (!parentPath) return;
        if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
        if (
          parentPath.isMemberExpression() &&
          parentPath.node.property === path.node &&
          !parentPath.node.computed
        ) {
          return;
        }
        if (
          parentPath.isObjectProperty() &&
          parentPath.node.key === path.node &&
          !parentPath.node.computed
        ) {
          return;
        }
        if (parentPath.isFunction()) {
          const params = (parentPath.node as { params: t.Node[] }).params;
          if (params.includes(path.node)) return;
        }
        path.replaceWith(
          t.memberExpression(t.identifier('$refs'), t.identifier('__rozieRoot')),
        );
        // Do NOT path.skip() — let the visitor re-visit the synthesised
        // MemberExpression so the `$refs.X` handler downstream lowers it to
        // the Solid-side ref accessor.
        return;
      }

      if (!computedNames.has(name)) return;

      const parentPath = path.parentPath;
      if (!parentPath) return;

      // Skip: already a call expression callee → canIncrement()
      if (parentPath.isCallExpression() && parentPath.node.callee === path.node) return;
      // Skip: optional call expression callee
      if (parentPath.isOptionalCallExpression() && parentPath.node.callee === path.node) return;
      // Skip: property key (non-computed) in member expression
      if (parentPath.isMemberExpression() && parentPath.node.property === path.node && !parentPath.node.computed) return;
      // Skip: property key in object expression
      if (parentPath.isObjectProperty() && parentPath.node.key === path.node && !parentPath.node.computed) return;
      // Skip: variable declaration (const canIncrement = createMemo(...)) — the definition itself
      if (parentPath.isVariableDeclarator() && parentPath.node.id === path.node) return;
      // Skip: function parameter (e.g. (canIncrement) => ...)
      if (parentPath.isFunction() && (parentPath.node as { params: unknown[] }).params.includes(path.node)) return;

      path.replaceWith(t.callExpression(t.identifier(name), []));
      path.skip();
    },

    // Handle assignment expressions: $data.x = v → setX(v)
    // $data.x += n → setX(prev => prev + n)
    // $props.x = v (model) → setX(v)
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;
      if (!t.isMemberExpression(left) || left.computed) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;

      if (obj.name === '$data' && dataNames.has(prop.name)) {
        const setterCall = buildSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        return;
      }
      if (obj.name === '$props' && modelProps.has(prop.name)) {
        const setterCall = buildSetterCall(prop.name, node.operator, node.right);
        path.replaceWith(setterCall);
        return;
      }
    },

    /**
     * `$data.x++` / `$data.x--` (and the model `$props.x` forms) — the
     * UpdateExpression mutation. `count` is a `createSignal` GETTER, so the
     * verbatim `count()++` is invalid. Route through the SAME `buildSetterCall`
     * path the compound-assignment case uses: `++` becomes `+= 1` →
     * `setCount(count() + 1)`, `--` becomes `-= 1` → `setCount(count() - 1)`.
     *
     * Statement-context only — see the React target's UpdateExpression visitor
     * for the postfix-expression-value rationale. Expression-context
     * `$data.x++` is left unchanged rather than mis-lowered.
     */
    UpdateExpression(path) {
      const node = path.node;
      const arg = node.argument;
      if (!t.isMemberExpression(arg) || arg.computed) return;
      const obj = arg.object;
      const prop = arg.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;

      const isData = obj.name === '$data' && dataNames.has(prop.name);
      const isModel = obj.name === '$props' && modelProps.has(prop.name);
      if (!isData && !isModel) return;

      if (!path.parentPath?.isExpressionStatement()) return;

      const op = node.operator === '++' ? '+=' : '-=';
      const setterCall = buildSetterCall(prop.name, op, t.numericLiteral(1));
      path.replaceWith(setterCall);
    },

    // Handle member expression reads:
    // $props.x (any) → local.x (via splitProps)
    // $data.x → x() (signal getter call)
    // $refs.x → xRef (plain variable)
    MemberExpression(path) {
      // WR-02 (Phase 9) — skip member expressions in TS type position
      // (`let x: typeof $data.foo`). Without this the `$data.foo` rewrite
      // would mangle a `typeof`-query inside a type annotation.
      if (isInTypePosition(path)) return;
      const { object, property, computed } = path.node;
      if (computed) return;
      if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;

      if (object.name === '$props') {
        if (modelProps.has(property.name)) {
          // Model prop: createControllableSignal returns [Accessor<T>, Setter<T>]
          // The accessor is the signal name itself; call it: value()
          let accessorCall: t.Expression = t.callExpression(
            t.identifier(property.name),
            [],
          );
          // An `unknown`-typed model accessor read used as the OBJECT of a
          // member access (`$props.value.length`, `$props.value[0]`) is TS2339
          // on `unknown`. Defeat it with a pure `(value() as any)` assertion,
          // mirroring the `for...of` iterable `as any` neutralization.
          if (
            unknownModelProps.has(property.name) &&
            path.parentPath?.isMemberExpression({ object: path.node })
          ) {
            accessorCall = t.tsAsExpression(accessorCall, t.tsAnyKeyword());
          }
          path.replaceWith(accessorCall);
          path.skip();
          return;
        }
        if (nonModelProps.has(property.name)) {
          // Non-model prop: access via local (splitProps result)
          path.node.object = t.identifier('local');
          return;
        }
        // Unknown prop: use local as best-effort
        path.node.object = t.identifier('local');
        return;
      }

      if (object.name === '$data' && dataNames.has(property.name)) {
        // Signal getter: name()
        path.replaceWith(t.callExpression(t.identifier(property.name), []));
        path.skip();
        return;
      }

      if (object.name === '$refs' && refNames.has(property.name)) {
        // $refs.foo → fooRef (plain variable initialized to null at top of body)
        const refIdent = t.identifier(property.name + 'Ref');
        // Script-context `$el` (Spike 001 B2) lowers through here as the
        // synthesised `$refs.__rozieRoot`. Its callback-ref local is typed
        // `HTMLElement | null`, but every free `$el` read sits inside a
        // lifecycle hook ($onMount/$onUnmount) where the root element is
        // guaranteed mounted — so emit a non-null assertion (`__rozieRootRef!`)
        // to keep the emitted Solid TSX type-safe, matching React's
        // `__rozieRoot.current!`. Plain author `$refs.X` reads stay bare:
        // they can legitimately be null (r-if-gated panels etc.) and the
        // author owns that narrowing.
        // 260712-a09 (Pattern D) — a DOM ref passed as a DIRECT argument to a
        // call inside a `$onMount` setup body (the mount-time engine-init
        // shape, e.g. `useSortableJS($refs.listEl, {...})`) is guaranteed
        // assigned once mount has run, same rationale as `__rozieRoot` above.
        // The ref's DECLARATION (emitScript.ts) stays `| null` — only this
        // specific call-argument USE gets the assertion. Scoped to direct
        // CallExpression arguments only (not NewExpression, not nested member
        // access, not object-literal property values like `{ parent: ... }`)
        // to match the proven real-world shape and avoid widening the fix
        // into a blanket ref-typing change.
        const isDirectCallArg =
          nonNullRefCallArgs &&
          path.parentPath?.isCallExpression() &&
          path.parentPath.node.arguments.includes(path.node);
        if (property.name === '__rozieRoot' || isDirectCallArg) {
          path.replaceWith(t.tsNonNullExpression(refIdent));
        } else {
          path.replaceWith(refIdent);
        }
        path.skip();
        return;
      }

      if (object.name === '$portals' && portalSlotNames.has(property.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the onMount callback.
        path.node.object = t.identifier('portals');
        return;
      }

      if (object.name === '$slots' && allSlotNames.has(property.name)) {
        // Script-side slot presence check (FullCalendar.rozie's
        // `if ($slots.event)` engine-callback gate). Mirrors the canonical
        // template-side rewrite in `rewriteTemplateExpression.ts:208` —
        // lowers to `(_props.<X>Slot ?? _props.slots?.['<X>'])` so the
        // static-named slot field is merged with the consumer-side
        // dynamic-name `slots?:` map.
        const fieldName = property.name === '' ? 'children' : property.name + 'Slot';
        if (property.name === '') {
          path.node.object = t.identifier('_props');
          path.node.property = t.identifier(fieldName);
          return;
        }
        const lhs = t.memberExpression(t.identifier('_props'), t.identifier(fieldName));
        const slotsMember = t.memberExpression(t.identifier('_props'), t.identifier('slots'));
        const rhs = t.optionalMemberExpression(
          slotsMember,
          t.stringLiteral(property.name),
          /* computed */ true,
          /* optional */ true,
        );
        const merged = t.logicalExpression('??', lhs, rhs);
        path.replaceWith(t.parenthesizedExpression(merged));
        path.skip();
        return;
      }
    },

    // Handle $emit('event', args) → _props.onEvent?.(args)
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $snapshot(x) → x — Solid props are accessor functions and reads
      // through `_props.X()` yield plain values, so the engine library
      // already receives a non-reactive value. Identity lowering keeps
      // wrapper authors' `$snapshot()` calls cross-target safe (the Svelte
      // target uses `$state.snapshot(x)`).
      if (callee.name === '$snapshot') {
        const args = path.node.arguments;
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) path.replaceWith(arg);
        }
        return;
      }

      // Phase 45 — $clone(x) → structuredClone(x) (D-01 plain leg). Solid
      // accessor reads (`_props.X()` / state getters) yield plain values, so
      // there is no reactive proxy to unwrap (no toRaw / $state.snapshot —
      // those are Vue/Svelte-only); a direct structuredClone gives an
      // independent deep copy. Do NOT path.skip(): the single argument may
      // carry $props/$data reactive reads that still need per-target lowering.
      if (callee.name === '$clone') {
        const args = path.node.arguments;
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) {
            path.replaceWith(t.callExpression(t.identifier('structuredClone'), [arg]));
          }
        }
        return;
      }

      // $reconcileAfterDomMutation() → `void 0` (no-op). Pre-Phase-16 Item 3:
      // the sigil exists for the Lit target only — Solid's keyed reconciler
      // diffs against live DOM at patch time, so the in-source DOM-restore
      // dance the engine wrappers all implement is sufficient.
      if (callee.name === '$reconcileAfterDomMutation') {
        path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      // Phase 16 — $restoreFocus(sel, idx) → queueMicrotask(() =>
      //   ($el.querySelectorAll(sel)?.[idx] as HTMLElement | undefined)?.focus()).
      //   Solid's keyed reconciler RE-CREATES row DOM on reorder; restore
      //   focus after the next render commit. SPEC R4 lowering table. The
      //   synthesised `$el` identifier flows through the Identifier visitor
      //   above (→ $refs.__rozieRoot → Solid's callback-ref form synthesised
      //   by lowerRootElementRef).
      //
      //   Phase 16-04 typecheck — `querySelectorAll(...)` returns
      //   `NodeListOf<Element>`; `Element` lacks `.focus()`. Cast the indexed
      //   result so the optional-chained `.focus?.()` typechecks under
      //   downstream TS gates.
      if (callee.name === '$restoreFocus') {
        const args = path.node.arguments;
        const selArg = args[0];
        const idxArg = args[1];
        if (!selArg || !idxArg) return; // validator ROZ976 already caught this
        if (!t.isExpression(selArg) || !t.isExpression(idxArg)) return;
        const indexedAccess = t.optionalMemberExpression(
          t.callExpression(
            t.memberExpression(
              t.identifier('$el'),
              t.identifier('querySelectorAll'),
            ),
            [selArg],
          ),
          idxArg,
          /* optional */ true,
          /* computed */ true,
        );
        const asHtmlElement = t.tsAsExpression(
          indexedAccess,
          t.tsUnionType([
            t.tsTypeReference(t.identifier('HTMLElement')),
            t.tsUndefinedKeyword(),
          ]),
        );
        const focusCall = t.optionalCallExpression(
          t.optionalMemberExpression(
            asHtmlElement,
            t.identifier('focus'),
            /* computed */ false,
            /* optional */ true,
          ),
          [],
          /* optional */ true,
        );
        const arrow = t.arrowFunctionExpression([], focusCall);
        path.replaceWith(
          t.callExpression(t.identifier('queueMicrotask'), [arrow]),
        );
        return;
      }

      // $classSelector('grip') → ".grip" — Solid keeps authored class names
      // literal in the emitted DOM, so the compile-time literal is correct.
      // Shared with rewriteTemplateExpression.ts via lowerClassSelectorCall so
      // the two hooks cannot drift (Pitfall 4).
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      const eventArg = args[0];
      if (!eventArg || !t.isStringLiteral(eventArg)) return;

      const eventName = eventArg.value;
      const propName = toSolidEventPropName(eventName);
      const restArgs = args.slice(1) as Array<t.Expression | t.SpreadElement | t.ArgumentPlaceholder>;

      path.replaceWith(
        t.optionalCallExpression(
          t.memberExpression(t.identifier('_props'), t.identifier(propName)),
          restArgs,
          true,
        ),
      );
    },
  });

  return { rewrittenProgram: cloned, diagnostics };
}
