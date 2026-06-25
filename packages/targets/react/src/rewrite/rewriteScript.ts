/**
 * rewriteRozieIdentifiers — Plan 04-02 Task 1 (React target).
 *
 * Walks a CLONED Babel Program and rewrites Rozie-specific magic accessors
 * into React-idiomatic identifier shapes per RESEARCH.md Pattern 2 (lines
 * 466-501) verbatim:
 *
 *   - `$props.value` (model: true) read   → `value`              (NO .value — useState/useControllableState return T directly)
 *   - `$props.value = X` (model write)    → `setValue(X)`         (CallExpression replacing the AssignmentExpression)
 *   - `$props.value += X` (model compound) → `setValue(prev => prev + X)`  (Pitfall 6 functional updater for concurrent-safe semantics)
 *   - `$props.step` (non-model) read      → `props.step`
 *   - `$data.foo` read                    → `foo`                (bare local from useState)
 *   - `$data.foo = X`                     → `setFoo(X)`
 *   - `$data.foo += 1`                    → `setFoo(prev => prev + 1)`
 *   - `$data.foo.bar = X` nested write    → emit ROZ521, leave AST unchanged (Pitfall 7)
 *   - `$refs.foo` read                    → `foo.current`
 *   - `$slots.foo` (boolean check)        → `(props.renderFoo ?? props.slots?.['foo'])`  (Phase 07.3.2 Plan 08 — merge guard with dynamic-name fallback; mirrors rewriteTemplateExpression)
 *   - `$emit('search', q)`                → `props.onSearch?.(q)`  (camelCase + on-prefix + optional-chain)
 *
 * `$onMount`/`$onUnmount`/`$onUpdate` calls are NOT mutated by this pass —
 * they're consumed STRUCTURALLY from `ir.lifecycle` by emitScript (Task 2).
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * Per Phase 2 D-T-2-01-04 CJS-interop pattern: normalize `@babel/traverse`
 * default-export at import time.
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
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { isInTypePosition } from '../../../../core/src/ast/typePosition.js';
import {
  deconflictGeneratedSymbols,
  subtreeReads,
  DECONFLICT_SUFFIX,
  type GeneratedSymbolGroup,
} from '../../../../core/src/rewrite/deconflict.js';
import { lowerClassSelectorCall } from './lowerClassSelectorCall.js';
import { reactGeneratedBindingNames } from './reactGeneratedNames.js';

// CJS interop normalization (Phase 2 D-T-2-01-04 pattern).
type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

/**
 * Decide whether a `$refs.X` / `$el` access should lower to a non-null
 * assertion (`foo.current!`) instead of the default nullable handle
 * (`foo.current`).
 *
 * Ported verbatim from the Angular target's `refLowersToNonNull`
 * (`packages/targets/angular/src/rewrite/rewriteScript.ts`) — quick task
 * 260520-w18 bug class 1. Each target package owns its own copy of this
 * helper per the per-package `cloneProgram.ts` convention.
 *
 * The nullable handle is the safe DEFAULT — a ref whose element is `r-if`-gated
 * (e.g. Dropdown's `panelEl`) is genuinely null before it renders, and guard
 * code like `if (!$refs.panelEl) return` depends on the handle yielding `null`.
 *
 * Two contexts prove the author has asserted the element exists:
 *
 *   1. The author wrote a NON-optional access on it — `$refs.X.method()` /
 *      `$refs.X.prop` — so each independent nullable lowering would otherwise
 *      defeat TS narrowing across an earlier `if (!$refs.X) return` (TS18047).
 *   2. It is handed to a function/constructor call — `flatpickr($refs.inputEl)`,
 *      `new SortableJS($el, …)`, `new Editor({ element: $refs.editorEl })` —
 *      the canonical engine-wrapper pattern. The host element a vanilla-JS
 *      engine mounts into is unconditional by construction; passing a
 *      possibly-`null` value into a typed engine constructor is TS18047. The
 *      walk steps out through enclosing object/array literals so
 *      `{ element: $refs.editorEl }` is recognised as "passed into `new Editor(...)`".
 */
function refLowersToNonNull(
  path: NodePath<t.MemberExpression> | NodePath<t.OptionalMemberExpression>,
): boolean {
  const parent = path.parent;
  // (1) authored non-optional member/call on the ref itself. OptionalMember /
  //     OptionalCall parents are intentionally excluded — the author opted
  //     into optionality there (`$refs.dialogEl?.focus()`).
  if (t.isMemberExpression(parent) && parent.object === path.node) return true;
  if (t.isCallExpression(parent) && parent.callee === path.node) return true;
  // (2) flows into a Call/NewExpression argument, possibly nested inside
  //     object/array literals.
  let child: t.Node = path.node;
  let p: NodePath | null = path.parentPath;
  while (p) {
    const n = p.node;
    if (
      (t.isCallExpression(n) || t.isNewExpression(n)) &&
      n.arguments.some((a) => (a as t.Node) === child)
    ) {
      return true;
    }
    if (t.isObjectProperty(n) && n.value === child) {
      child = n;
      p = p.parentPath;
      continue;
    }
    if (
      t.isObjectExpression(n) ||
      t.isArrayExpression(n) ||
      t.isSpreadElement(n)
    ) {
      child = n;
      p = p.parentPath;
      continue;
    }
    break;
  }
  return false;
}

export interface RewriteScriptResult {
  rewrittenProgram: File;
  diagnostics: Diagnostic[];
}

/** Convert an event name (`'search'` / `'value-change'`) to a `props.onX` field name (`onSearch` / `onValueChange`). */
function toReactEventPropName(eventName: string): string {
  // Hyphen / underscore split + camelCase + 'on' prefix.
  const parts = eventName.split(/[-_]/).filter(Boolean);
  if (parts.length === 0) return 'on';
  const camel = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return 'on' + camel;
}

/** Capitalize first letter of a name: `value` → `Value`, `hovering` → `Hovering`. */
function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Map of compound-assignment operator → matching binary operator. */
const COMPOUND_OP_MAP: Record<string, t.BinaryExpression['operator']> = {
  '+=': '+',
  '-=': '-',
  '*=': '*',
  '/=': '/',
  '%=': '%',
  '**=': '**',
  '<<=': '<<',
  '>>=': '>>',
  '>>>=': '>>>',
  '&=': '&',
  '|=': '|',
  '^=': '^',
};

/**
 * Detect whether `expr` reads the magic accessor `<accessor>.<name>` anywhere
 * inside it (e.g. `$data.points` inside `[...$data.points.slice(-19), next]`).
 *
 * Walks the expression's own subtree only; nested function bodies count too
 * (a stale read inside an inline callback is just as stale). Returns true on
 * the first match.
 */
function exprReadsAccessor(
  expr: t.Expression,
  accessor: '$data' | '$props',
  name: string,
): boolean {
  let found = false;
  const file = t.file(t.program([t.expressionStatement(expr)]));
  try {
    traverse(file, {
      MemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          found = true;
          path.stop();
        }
      },
      OptionalMemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          found = true;
          path.stop();
        }
      },
    });
  } catch {
    // Defensive (D-08) — never throw on an unusual AST shape.
  }
  return found;
}

/**
 * Rewrite every `<accessor>.<name>` SELF-REFERENCE inside `expr` to a bare
 * `Identifier(paramName)`. Used to build the React functional-updater form:
 * `$data.points = f($data.points)` → `setPoints(prev => f(prev))` so the
 * `prev` is always the latest state, never a stale closure capture.
 *
 * Only the SAME-name accessor reads are rewritten; reads of OTHER state /
 * props pass through untouched and flow into the normal MemberExpression
 * rewrite downstream. Mutates `expr` in place.
 */
function rewriteSelfReadsToParam(
  expr: t.Expression,
  accessor: '$data' | '$props',
  name: string,
  paramName: string,
): void {
  const file = t.file(t.program([t.expressionStatement(expr)]));
  try {
    traverse(file, {
      MemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          path.replaceWith(t.identifier(paramName));
          path.skip();
        }
      },
      OptionalMemberExpression(path) {
        if (path.node.computed) return;
        const o = path.node.object;
        const pr = path.node.property;
        if (
          t.isIdentifier(o) &&
          o.name === accessor &&
          t.isIdentifier(pr) &&
          pr.name === name
        ) {
          path.replaceWith(t.identifier(paramName));
          path.skip();
        }
      },
    });
  } catch {
    // Defensive (D-08).
  }
}

/**
 * Build the per-state setter call.
 *
 *   - plain `=` with NO self-read of the same state  → `setName(rhs)`
 *   - plain `=` whose RHS reads the SAME state        → `setName(prev => rhs')`
 *     (functional updater; `rhs'` has the self-reads rewritten to `prev`)
 *   - compound `+=` etc.                              → `setName(prev => prev OP rhs)`
 *
 * The functional-updater form for plain `=` (Pitfall 6, extended) is what
 * keeps `$data.points = [...$data.points.slice(-19), next]` correct: React's
 * `setX(value)` form captures the rendered-time `points`, so a setter pinned
 * by `setInterval` rebuilds from a stale array forever. `setX(prev => ...)`
 * always receives the current state. `accessor` selects which magic accessor
 * counts as the self-reference ($data for state writes, $props for model
 * writes).
 */
function buildSetterCall(
  stateName: string,
  operator: string,
  rhs: t.Expression,
  accessor: '$data' | '$props',
): t.CallExpression {
  const setterName = 'set' + capitalize(stateName);
  if (operator === '=') {
    if (exprReadsAccessor(rhs, accessor, stateName)) {
      // Functional updater — rewrite the self-reads to the `prev` param so the
      // updater is concurrent-safe and free of stale-closure capture.
      rewriteSelfReadsToParam(rhs, accessor, stateName, 'prev');
      const arrow = t.arrowFunctionExpression([t.identifier('prev')], rhs);
      return t.callExpression(t.identifier(setterName), [arrow]);
    }
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const binOp = COMPOUND_OP_MAP[operator];
  if (!binOp) {
    return t.callExpression(t.identifier(setterName), [rhs]);
  }
  const arrow = t.arrowFunctionExpression(
    [t.identifier('prev')],
    t.binaryExpression(binOp, t.identifier('prev'), rhs),
  );
  return t.callExpression(t.identifier(setterName), [arrow]);
}

/**
 * Phase 18 (Req 2) — normalize the producer-side two-way-write sigil `$model`
 * to `$props` across the cloned Program, in place.
 *
 * `$model.X` is the producer-side sigil for writing a `model: true` prop. By
 * contract it is model-only: Wave 1's core semantic pass already emitted
 * ROZ205 / ROZ113 for `$model.<nonModelProp>` / `$model.<nonExistent>` BEFORE
 * lowering, so every `$model.X` reaching the emitter is a declared model prop.
 * `$model` is ALWAYS a member-expression object (it is deliberately NOT in
 * STABLE_IDENTIFIERS, D-03), so renaming the object Identifier of every
 * non-computed Member/OptionalMember expression from `$model` → `$props` routes
 * the read/write through the IDENTICAL `$props.<modelProp>` lowering and yields
 * byte-identical emit. Reuse, not reimplement.
 */
function normalizeModelAccessor(program: File): void {
  traverse(program, {
    MemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (t.isIdentifier(obj) && obj.name === '$model') obj.name = '$props';
    },
  });
}

/**
 * Phase 61 Plan 05 risk A — declare-then-assign ref shadow.
 *
 * The accessor-`$refs` deconfliction group (in `rewriteRozieIdentifiers`) only
 * catches a `const X = $refs.X` INIT-shape self-shadow, AND it runs AFTER
 * `hoistModuleLet` has already removed/rewritten the declaration. A
 * declare-then-assign module-let — `let anchorEl = null; … anchorEl = $refs.anchorEl`
 * (the canonical "populate the ref handle inside `$onMount`" form) — collides
 * with the ref-const the emitter mints for `ref="anchorEl"` in TWO ways:
 *   1. `hoistModuleLet` hoists the module-let (it is referenced from the
 *      `$onMount` body) → `const anchorEl = useRef(null)`.
 *   2. emitScript generates the ref-const → a SECOND `const anchorEl = useRef(...)`.
 * Two `anchorEl` bindings → TS2451 redeclare.
 *
 * Fix: rename the colliding module-`let` (the renameable side — `refNames` are
 * the contract) to `<name>$local` on the freshly-cloned Program BEFORE
 * `hoistModuleLet` and the ref-const generation run. The hoist then lifts
 * `anchorEl$local` to its own `useRef`, and the ref-const keeps the bare name.
 *
 * Gated on an actual `$refs.<name>` read ANYWHERE in the program (not just the
 * declarator init) so the declare-then-assign form is caught while a non-
 * colliding module-let stays byte-identical. MUST run on the freshly-cloned,
 * not-yet-mutated Program (scope cache valid). Mutates `program` in place.
 */
export function deconflictDeclareThenAssignRef(
  program: File,
  ir: IRComponent,
): void {
  const refNames = new Set(ir.refs.map((r) => r.name));
  if (refNames.size === 0) return;

  // Collect program-scope `let` declarator names that collide with a ref name
  // AND whose program scope reads `$refs.<name>` somewhere (the declare-then-
  // assign signal). A `const X = $refs.X` init-shape is already handled by the
  // accessor group; this catches the `let`-declared, later-assigned form.
  const targets = new Set<string>();
  for (const stmt of program.program.body) {
    if (!t.isVariableDeclaration(stmt) || stmt.kind !== 'let') continue;
    for (const decl of stmt.declarations) {
      if (!t.isIdentifier(decl.id)) continue;
      const name = decl.id.name;
      if (!refNames.has(name)) continue;
      // Only-on-collision: require an actual `$refs.<name>` read in the program.
      if (subtreeReads(program.program, '$refs', name)) targets.add(name);
    }
  }
  if (targets.size === 0) return;

  // Rename atomically via the program scope (declaration + every reference).
  traverse(program, {
    Program(path) {
      for (const name of targets) {
        const binding = path.scope.getBinding(name);
        if (binding && binding.scope === path.scope) {
          path.scope.rename(name, `${name}${DECONFLICT_SUFFIX}`);
        }
      }
      path.stop();
    },
  });
}

/**
 * Detect whether a MemberExpression LHS represents a NESTED write
 * (e.g., `$data.todo.title = X`). Returns the root `$data`/`$props`
 * Identifier name when so; null otherwise.
 */
function nestedWriteRoot(left: t.LVal | t.OptionalMemberExpression): string | null {
  if (!t.isMemberExpression(left)) return null;
  // SHALLOW write would be MemberExpression{object: Identifier('$data'), property: Identifier('field')}.
  // NESTED write would be MemberExpression{object: MemberExpression{...$data.X}, property: Identifier('subField')}.
  if (!t.isMemberExpression(left.object) && !t.isOptionalMemberExpression(left.object)) {
    return null;
  }
  // Walk to root.
  let node: t.Node = left.object;
  while (
    (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    (t.isMemberExpression(node.object) || t.isOptionalMemberExpression(node.object))
  ) {
    node = node.object;
  }
  if (!t.isMemberExpression(node) && !t.isOptionalMemberExpression(node)) return null;
  const root = node.object;
  if (!t.isIdentifier(root)) return null;
  if (root.name !== '$data' && root.name !== '$props') return null;
  return root.name;
}

/**
 * Rewrite Rozie magic-accessor identifiers in-place on a cloned Program.
 *
 * Strategy: single-pass @babel/traverse with multiple visitors. Replacements
 * use `path.replaceWith` and DO NOT call `path.skip()` — letting traversal
 * descend into the replacement node ensures nested rewrites apply (e.g., the
 * `node.right` of a setter-replaced AssignmentExpression still gets walked
 * so `$props.step` references inside it are rewritten to `props.step`).
 */
export function rewriteRozieIdentifiers(
  program: File,
  ir: IRComponent,
): RewriteScriptResult {
  const diagnostics: Diagnostic[] = [];

  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));
  const nonModelProps = new Set(ir.props.filter((p) => !p.isModel).map((p) => p.name));
  const dataNames = new Set(ir.state.map((s) => s.name));
  const refNames = new Set(ir.refs.map((r) => r.name));
  const slotNames = new Set(ir.slots.map((s) => s.name));
  const portalSlotNames = new Set(
    ir.slots.filter((s) => s.isPortal === true).map((s) => portalKey(s)),
  );

  // Phase 06.1 P2 (D-104/D-106): name → IR-primitive lookups so synthesized
  // identifier nodes can inherit the IR's sourceLoc. The .loc cast is `as any`
  // because @babel/types' SourceLocation expects {line, column} while our
  // SourceLoc is {start, end} byte offsets — runtime shape diverges; the
  // metadata is present for v2 to refine into proper line/column.
  const stateByName = new Map(ir.state.map((s) => [s.name, s]));
  const refByName = new Map(ir.refs.map((r) => [r.name, r]));
  const propByName = new Map(ir.props.map((p) => [p.name, p]));

  // Phase 18 (Req 2) — producer-side two-way-write sigil `$model.X`.
  // `$model` is model-only by contract: Wave 1's core semantic pass already
  // rejected `$model.<nonModelProp>` (ROZ205) and `$model.<nonExistent>`
  // (ROZ113) BEFORE lowering, so every `$model.X` that survives to here is a
  // declared model prop. We normalize the accessor identifier `$model` → `$props`
  // in a single pre-pass over the cloned Program so EVERY downstream write/read
  // site (AssignmentExpression, UpdateExpression, MemberExpression,
  // OptionalMemberExpression — AND the RHS self-read detection inside
  // buildSetterCall) routes through the IDENTICAL `$props.<modelProp>` path.
  // This is "reuse, not reimplement" (SPEC Req 2) in its purest form: the emit
  // is byte-identical to the prior `$props.X` model form, proven in Wave 3.
  normalizeModelAccessor(program);

  // UNIFIED DECONFLICTION PASS (Phase 46 ITEM-5 / D-02) — the single shared,
  // target-parameterized, collision-aware rename pass in @rozie/core. Runs on
  // the freshly-cloned, not-yet-mutated Program (after the $model→$props
  // normalization, which renames only $model object identifiers — not bindings —
  // so the scope cache is valid) BEFORE the scope-blind bare-identifier rewrite
  // below. Subsumes the former React-local `deconflictRefShadows` AND the ROZ524
  // setter-collision ERROR (now an auto-rename of the user side).
  //
  // React's generated-symbol set (RESEARCH Pattern 3):
  //   - `$refs.X` → bare `X` (`.current`): accessor-shadow, gated on a real
  //     `$refs.X` read (the canonical `const flow = $refs.flow` TDZ).
  //   - model-prop → bare `X` (useControllableState value): accessor-shadow on
  //     `$props` (model props read via `$props.X` after $model normalization).
  //   - `setX` setter (per state + per model prop): a pure binding collision —
  //     a user helper named `setX` (the ROZ524 case) auto-renames to
  //     `setX$local`; the generated `setX` setter is the contract.
  //   NOT non-model props — React keeps those as `props.X` member access, so a
  //   like-named local never collides. NOT `$data` keys here — a `$data` key that
  //   collides with an `$expose` verb is renamed at the GENERATED-state level by
  //   the shared `deconflictStateExposeCollision` IR pass (which renames the
  //   state key `open`→`open$local` UNIFORMLY across all 6 targets, leaving the
  //   exposed verb intact). The user-side `$data` self-shadow (`const open =
  //   $data.open`) is folded into that same IR rename.
  //
  // PUBLIC-CONTRACT guard: `$expose` verb names + prop names are NEVER renamed,
  // even on a model-prop accessor collision.
  const setterNames = new Set<string>();
  for (const s of ir.state) setterNames.add('set' + capitalize(s.name));
  for (const p of ir.props) if (p.isModel) setterNames.add('set' + capitalize(p.name));
  // Protected = $expose verbs ONLY. Prop names are NOT protected — the accessor
  // groups rename a USER LOCAL shadowing a prop/ref, which shares that name and
  // IS the renameable side. (The exposed-function case `const open` is guarded
  // because `open` is an $expose verb.)
  const reactProtected = new Set<string>((ir.expose ?? []).map((e) => e.name));

  // Phase 61 Plan 05 risk D — SYNTHESIZED-INTERNAL cross-kind collisions. The
  // React emitter mints a fixed set of internal bindings the author never sees:
  //   - `props`              — the component function parameter (non-model props
  //                            read via `props.X`; also the slot/$emit object).
  //   - `attrs`              — the inherit-attrs fallthrough spread object.
  //   - `_props`             — the controllable-state internal props alias.
  //   - `_rozieExposeRef`    — the `$expose` handle-stash useRef.
  //   - `portals`            — the portal-slot closure injected in the mount hook.
  // A user `<script>` TOP-LEVEL helper/const named one of these REDECLARES the
  // synthesized program-scope binding → broken emit (e.g. a top-level `const
  // attrs = …` clobbers the fallthrough spread). The renameable side is the USER
  // binding (the synthesized name is the contract) → rename to `<name>$local`.
  //
  // Phase 61 Plan 09 — TWO precise gates (mirrors the Vue 61-07 over-application
  // fix). (1) `programOnly: true` on the group: ONLY a PROGRAM/setup-scope
  // binding is renamed; a function PARAMETER (tiptap `(attrs) => …` /
  // `function isActive(name, attrs)`) or a function-LOCAL `const` (chartjs
  // `const prev = live.datasets.slice()`) is a LEGAL nested shadow (no
  // redeclare) — never touched. (2) `reactGeneratedBindingNames(ir)`: the set is
  // the ACTUALLY-generated names for THIS component, each gated on the IR
  // condition that mints it at program scope. `prev` is EXCLUDED entirely (React
  // never emits a top-level `prev` — it is only the `setX(prev => …)` updater
  // PARAMETER). Without these gates the static set + unconditional binding
  // trigger drifted the committed React leaves (`prev → prev$local` ×35,
  // `attrs → attrs$local` ×4, `props → props$local` ×2). Only-on-collision: a
  // component with no such TOP-LEVEL helper is byte-identical.
  // Prefix-pattern internals (`_*Ref`/`__ctx_*`/`__default*`/`_rozieProp_*`) are
  // lower-risk (collision-react §2) — handle the literal short names first; add
  // prefix matching only if a corpus fixture needs it.
  const synthesizedInternalNames = reactGeneratedBindingNames(ir);

  // Phase 61 Plan 05 risk E — `$computed` name == helper: NO React group needed.
  // The plan flagged a `$computed`-name vs helper collision as "rare but
  // unguarded," but on React it is a NON-ISSUE, proven by the ModelParamShadow
  // corpus fixture (a closure param `label` shadowing a `$computed label`):
  //   - A TOP-LEVEL helper named the same as a `$computed` would be a SECOND
  //     program-scope `const <name>` → a duplicate-declaration parse error; it
  //     cannot reach the emitter. (Distinct from Vue, where the `bare-read`
  //     trigger guards a NESTED shadow that would otherwise `.value`-wrap to the
  //     computed ref.)
  //   - A NESTED param/local named the same LEXICALLY SHADOWS the React
  //     `const <name> = useMemo(...)` correctly — `{ token: label }` reads the
  //     PARAM (React does not `.value`-wrap a computed read), so there is no
  //     mis-capture to fix. Adding a `bare-read` computed group here WRONGLY
  //     renames that param to `label$local` → ModelParamShadow react drift (the
  //     fixture explicitly guarantees the five non-Vue targets carry NO rename).
  // So the React computed collision is left to natural lexical shadowing; no
  // group is added. (Risk E is a Vue-only concern — handled in Plan 02.)

  const reactGroups: GeneratedSymbolGroup[] = [
    { names: refNames, trigger: { kind: 'accessor', accessor: '$refs' } },
    { names: modelProps, trigger: { kind: 'accessor', accessor: '$props' } },
    { names: setterNames, trigger: { kind: 'binding' } },
    {
      names: synthesizedInternalNames,
      trigger: { kind: 'binding', programOnly: true },
    },
  ];
  deconflictGeneratedSymbols(program, reactGroups, reactProtected);

  traverse(program, {
    AssignmentExpression(path) {
      const node = path.node;
      const left = node.left;

      // Detect nested writes BEFORE we attempt any rewrite. Emit ROZ521 +
      // leave AST unchanged (Pitfall 7).
      const nested = nestedWriteRoot(left);
      if (nested !== null) {
        const startLoc = node.loc?.start;
        const endLoc = node.loc?.end;
        diagnostics.push({
          code: RozieErrorCode.TARGET_REACT_NESTED_STATE_MUTATION,
          severity: 'warning',
          message: `Nested member write \`${nested}.<deep-path> = …\` is not auto-rewritten in v1 (Pitfall 7). Use \`set${nested === '$data' ? 'Field' : 'Field'}(prev => ({ ...prev, ... }))\` or accept the leftover \`${nested}.\` reference in emitted output. AST left unchanged.`,
          loc: {
            start: startLoc?.index ?? 0,
            end: endLoc?.index ?? 0,
          },
        });
        return;
      }

      // SHALLOW writes: `$data.X = ...` or `$props.X = ...` (model only).
      if (!t.isMemberExpression(left)) return;
      const obj = left.object;
      const prop = left.property;
      if (!t.isIdentifier(obj)) return;
      if (left.computed) return;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$data') {
        if (!dataNames.has(prop.name)) return;
        const setterCall = buildSetterCall(
          prop.name,
          node.operator,
          node.right,
          '$data',
        );
        path.replaceWith(setterCall);
        // No path.skip() — let traversal descend into the new arrow body so
        // `$props.step` references inside `prev + $props.step` get rewritten,
        // and so other-name `$data.Y` reads in a functional updater body still
        // lower to their bare locals. Same-name `$data.X` reads were already
        // replaced with the `prev` param by buildSetterCall.
        return;
      }

      if (obj.name === '$props') {
        if (!modelProps.has(prop.name)) return;
        const setterCall = buildSetterCall(
          prop.name,
          node.operator,
          node.right,
          '$props',
        );
        path.replaceWith(setterCall);
        return;
      }
    },

    /**
     * `$data.x++` / `$data.x--` (and the `$props.x` model forms) — the
     * UpdateExpression mutation. `count` is `const [count, setCount] =
     * useState(...)`, so the bare `count++` that would otherwise pass through
     * is an assignment-to-const and will not compile. Route through the SAME
     * `buildSetterCall` path the compound-assignment case uses: `++` becomes
     * `+= 1`, `--` becomes `-= 1`, yielding `setCount(prev => prev + 1)`.
     *
     * Statement-context only: in `arr[i++]` / `const y = x++` the postfix
     * pre-increment VALUE matters, and a functional-updater setter call returns
     * the SETTER's result, not the prior value — semantically different. We
     * only rewrite when the UpdateExpression sits directly under an
     * ExpressionStatement (the `inc = () => { $data.count++ }` common case);
     * any expression-context `$data.x++` is left unchanged (it would already
     * be broken on a bare local, but we do not silently mis-lower it).
     */
    UpdateExpression(path) {
      const node = path.node;
      const arg = node.argument;
      if (!t.isMemberExpression(arg) || arg.computed) return;
      const obj = arg.object;
      const prop = arg.property;
      if (!t.isIdentifier(obj) || !t.isIdentifier(prop)) return;
      if (obj.name !== '$data' && obj.name !== '$props') return;

      const isData = obj.name === '$data';
      if (isData && !dataNames.has(prop.name)) return;
      if (!isData && !modelProps.has(prop.name)) return;

      // Only rewrite in statement context, where prefix/postfix are equivalent
      // and the returned value is discarded.
      if (!path.parentPath?.isExpressionStatement()) return;

      const op = node.operator === '++' ? '+=' : '-=';
      const setterCall = buildSetterCall(
        prop.name,
        op,
        t.numericLiteral(1),
        isData ? '$data' : '$props',
      );
      path.replaceWith(setterCall);
    },

    Identifier(path) {
      // Spike 001 B2 — script-context `$el` lowers to
      // `MemberExpression($refs, __rozieRoot)`. The IR pass `lowerRootElementRef`
      // already appended `RefDecl { name: '__rozieRoot' }` to `ir.refs` when a
      // free `$el` read was detected and the root template qualifies, so the
      // synthesised MemberExpression naturally flows into the existing
      // `$refs.X` handler below and lowers to `__rozieRoot.current` (React's
      // useRef accessor). When the IR pass declined to synthesise (root is
      // conditional/loop/fragment, OR user already has root ref), `$el`
      // remains a free identifier — v1 limitation, surfaced in spike docs.
      // WR-02 (Phase 9) — skip identifiers in TS type position. `$el` is a
      // Rozie sigil that should never appear in a type annotation, but the
      // guard keeps this visitor uniform with the other targets.
      if (isInTypePosition(path)) return;
      if (path.node.name !== '$el') return;
      const parentPath = path.parentPath;
      if (!parentPath) return;
      // Skip binding/declaration positions — same gating as Lit's existing
      // pattern at rewriteScript.ts:234.
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
      // the target-native ref.
      return;
    },

    MemberExpression(path) {
      // WR-02 (Phase 9) — skip member expressions in TS type position
      // (`let x: typeof $data.foo`). Without this the `$data.foo` rewrite
      // would mangle a `typeof`-query inside a type annotation.
      if (isInTypePosition(path)) return;
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // $props.value (model) → value
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          // $props.step → props.step (mutate object, retain property)
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // $data.hovering → hovering (bare)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // $refs.dialogEl → dialogEl.current  (default, nullable)
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        // Lower to `dialogEl.current!` (non-null) vs `dialogEl.current`
        // (nullable) per refLowersToNonNull — authored non-optional access
        // (TS18047 narrowing) OR passed into an engine constructor/function
        // call (TS18047 on a `HTMLElement | null` argument). Quick task
        // 260520-w18 bug class 1. See refLowersToNonNull's doc comment.
        if (refLowersToNonNull(path)) {
          path.replaceWith(
            t.tsNonNullExpression(
              t.memberExpression(newObj, t.identifier('current')),
            ),
          );
          return;
        }
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
      if (obj.name === '$slots' && slotNames.has(prop.name)) {
        // Phase 07.3.2 Plan 08 (F-07.3.2-05-A) — script-context mirror of the
        // template rewriter. $slots.foo lowers to:
        //   (props.renderFoo ?? props.slots?.['foo'])
        // so listener `when:` conditions, computed bodies, and any other
        // $slots.X check site agree with the template-side guard and the
        // canonical invocation-site merge at emitSlotInvocation.ts:231.
        // See rewriteTemplateExpression.ts for the full rationale.
        const renderName = 'render' + capitalize(prop.name);
        const fieldKey = prop.name;
        const merged = t.parenthesizedExpression(
          t.logicalExpression(
            '??',
            t.memberExpression(t.identifier('props'), t.identifier(renderName)),
            t.optionalMemberExpression(
              t.memberExpression(t.identifier('props'), t.identifier('slots')),
              t.stringLiteral(fieldKey),
              true, // computed
              true, // optional
            ),
          ),
        );
        path.replaceWith(merged);
        path.skip();
        return;
      }
      if (obj.name === '$portals' && portalSlotNames.has(prop.name)) {
        // Portal-slot primitive (Spike 003). $portals.<name> resolves to the
        // synthesized local `portals` closure that emitScript injects at the
        // top of the mount-phase useEffect body. Just rename the object —
        // member traversal continues into the call args.
        path.node.object = t.identifier('portals');
        return;
      }
    },

    OptionalMemberExpression(path) {
      const obj = path.node.object;
      if (!t.isIdentifier(obj)) return;
      if (path.node.computed) return;
      const prop = path.node.property;
      if (!t.isIdentifier(prop)) return;

      if (obj.name === '$props') {
        if (modelProps.has(prop.name)) {
          // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR PropDecl.
          const propDecl = propByName.get(prop.name);
          const synthId = t.identifier(prop.name);
          if (propDecl) synthId.loc = propDecl.sourceLoc as any;
          path.replaceWith(synthId);
          return;
        }
        if (nonModelProps.has(prop.name)) {
          path.node.object = t.identifier('props');
          return;
        }
        return;
      }
      if (obj.name === '$data' && dataNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR StateDecl.
        const stateDecl = stateByName.get(prop.name);
        const synthId = t.identifier(prop.name);
        if (stateDecl) synthId.loc = stateDecl.sourceLoc as any;
        path.replaceWith(synthId);
        return;
      }
      if (obj.name === '$refs' && refNames.has(prop.name)) {
        // Phase 06.1 P2 D-104/D-106: anchor synth identifier loc to IR RefDecl.
        const refDecl = refByName.get(prop.name);
        const newObj = t.identifier(prop.name);
        if (refDecl) newObj.loc = refDecl.sourceLoc as any;
        // refLowersToNonNull non-null lowering (260520-w18 bug class 1) —
        // mirrors the MemberExpression branch above for `$refs.foo?.bar`.
        if (refLowersToNonNull(path)) {
          path.replaceWith(
            t.tsNonNullExpression(
              t.memberExpression(newObj, t.identifier('current')),
            ),
          );
          return;
        }
        path.node.object = newObj;
        path.node.property = t.identifier('current');
        return;
      }
    },

    /**
     * `$emit('event', ...args)` → `props.onEvent?.(...args)` optional-chain.
     *
     * Leave $onMount/$onUnmount/$onUpdate untouched (consumed structurally
     * by emitScript). Leave console.log untouched (DX-03 floor).
     */
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isIdentifier(callee)) return;

      // $snapshot(x) → x — React props are plain JS values (no reactive
      // proxies), so the engine library already receives a non-reactive
      // value. Identity lowering keeps wrapper authors' `$snapshot()`
      // calls cross-target safe (the Svelte target uses
      // `$state.snapshot(x)`).
      if (callee.name === '$snapshot') {
        const args = path.node.arguments;
        if (args.length === 1) {
          const arg = args[0]!;
          if (t.isExpression(arg)) path.replaceWith(arg);
        }
        return;
      }

      // Phase 45 — $clone(x) → structuredClone(x) (D-01 plain leg). React
      // props/state are plain JS values, so there is no reactive proxy to
      // unwrap (no toRaw / $state.snapshot — those are Vue/Svelte-only); a
      // direct structuredClone gives an independent deep copy safe for
      // undo/history stacks. Do NOT path.skip(): the single argument may carry
      // $props/$data reactive reads that still need per-target lowering.
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
      // the sigil exists for the Lit target only — React's keyed reconciler
      // diffs against live DOM at patch time, so the in-source DOM-restore
      // dance the engine wrappers all implement is sufficient.
      if (callee.name === '$reconcileAfterDomMutation') {
        path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      // Phase 16 — $restoreFocus(sel, idx) → `void 0` (no-op). React's keyed
      // reconciler MOVES the existing DOM element on reorder; focus survives
      // natively. SPEC R4 lowering table.
      if (callee.name === '$restoreFocus') {
        path.replaceWith(t.unaryExpression('void', t.numericLiteral(0)));
        return;
      }

      // $classSelector('grip') → "." + styles.grip — React runs class names
      // through CSS Modules, so a literal ".grip" never matches the hashed
      // DOM. Shared with rewriteTemplateExpression.ts via lowerClassSelectorCall
      // so the two hooks cannot drift (Pitfall 4).
      if (callee.name === '$classSelector') {
        lowerClassSelectorCall(path);
        return;
      }

      if (callee.name !== '$emit') return;

      const args = path.node.arguments;
      if (args.length === 0) return;
      const firstArg = args[0]!;
      if (!t.isStringLiteral(firstArg)) {
        // Non-literal event name — emit cannot be statically rewritten.
        return;
      }
      const eventName = firstArg.value;
      const propName = toReactEventPropName(eventName);
      // Filter out JSXNamespacedName which can never appear here (TS narrowing).
      const restArgs = args
        .slice(1)
        .filter((a) => !t.isJSXNamespacedName(a)) as Array<
        t.Expression | t.SpreadElement | t.ArgumentPlaceholder
      >;
      // Plan 04-04 lint-clean fix — `props.onClose?.()` (OptionalCallExpression
      // of OptionalMemberExpression) confuses eslint-plugin-react-hooks v5's
      // exhaustive-deps narrowing: the deps array entry `props.onClose` is a
      // plain MemberExpression but the body's optional chain doesn't structurally
      // match, so the lint rule warns "missing dependency: props". Workaround:
      // emit a logical-AND guard `props.onClose && props.onClose(...)` which
      // uses MemberExpression on both sides — matches deps[] entry exactly.
      const memberExpr = t.memberExpression(
        t.identifier('props'),
        t.identifier(propName),
      );
      const replacement = t.logicalExpression(
        '&&',
        memberExpr,
        t.callExpression(t.cloneNode(memberExpr), restArgs),
      );
      path.replaceWith(replacement);
    },
  });

  return { rewrittenProgram: program, diagnostics };
}
