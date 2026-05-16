/**
 * emitScript — Plan 04-02 Task 2 (React target).
 *
 * Produces the body of the React functional component above the `return ( <JSX> );`.
 * Returns a TWO-SECTION result so downstream plans (04-04) can layer listener
 * wrappers BETWEEN hook declarations and user-authored arrows without
 * retroactively modifying this contract.
 *
 *   hookSection   — useRef hoists + useControllableState + useState +
 *                   useRef (template refs) + useMemo + useEffect (lifecycle)
 *   userArrowsSection — top-level user-authored arrows / helpers / console.log
 *                       preserved verbatim from <script> (DX-03 floor)
 *
 * Plan 04-04 will replace the Plan 04-02 single-string concatenation with
 * the interleaved order: hookSection → userArrowsSection → listener wrappers
 * → listener useEffects.
 *
 * Per CONTEXT D-30 hybrid codegen: <script> body is rewritten via
 * @babel/traverse over a CLONED Babel Program, then printed with
 * @babel/generator. The TOP-LEVEL string assembly is template-builder.
 *
 * Per CONTEXT D-08 collected-not-thrown: never throws on user input.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import _traverse from '@babel/traverse';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  ComputedDecl,
  RefDecl,
  StateDecl,
  LifecycleHook,
  SetupBody,
} from '../../../../core/src/ir/types.js';
import type { SignalRef } from '../../../../core/src/reactivity/signalRef.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { hoistModuleLet } from '../rewrite/hoistModuleLet.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { computeHelperBodyDeps } from './computeHelperDeps.js';
import { renderDepArray as renderDepArrayWithIR } from './renderDepArray.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

type TraverseFn = typeof import('@babel/traverse').default;
const traverse: TraverseFn =
  typeof _traverse === 'function'
    ? (_traverse as TraverseFn)
    : ((_traverse as unknown as { default: TraverseFn }).default);

// Phase 06.1 P2: GEN_OPTS gains sourceMaps:true + sourceFileName so each
// @babel/generator call emits a per-expression child map anchored to the
// .rozie source. The synthesized-AST `.loc =` annotations below (D-104/D-106)
// give those maps real positional content; non-annotated scaffolding nodes
// fall back to nearest-segment via the surrounding shell map (D-102).
//
// v1 limitation: emitScript assembles its output via string concatenation
// across multiple genCode calls (one per IR primitive). v1 surfaces
// scriptMap=null and relies on the buildShell per-block accuracy (DX-04 P1
// floor); the sourceMaps:true switch + .loc annotations give v2 a drop-in
// upgrade path.
const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
  sourceFileName: '<rozie>',
};

// Used only when emitting the user-authored statement block with source maps.
const GEN_OPTS_MAP: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: true,
};

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
}

/**
 * Convert `const X = (...args) => body` (or function expression) into
 * `function X(...args) { ... }` so the binding hoists. Returns the new
 * statement on success, or null when the input is not a single-declarator
 * arrow/function-expression initializer.
 *
 * **Why hoist?** Plan 04-03 deferred limitation #1 — lifecycle useEffects
 * appear in `hookSection` (top of function body), but their dep arrays
 * may include user-authored helpers from `userArrowsSection` (bottom of
 * body). Const arrows do not hoist; the dep-array literal `[lockScroll]`
 * is evaluated AT render time, before `const lockScroll = ...` is reached
 * → TDZ ReferenceError. Function declarations hoist — no TDZ.
 *
 * **Multi-declarator and non-initialized declarators** are left as-is
 * (rare; would require splitting the declaration into multiple statements).
 *
 * **Functions with leading async** are preserved via FunctionDeclaration's
 * `async: true` flag.
 *
 * Per D-08 collected-not-thrown — never throws on user input.
 */
/**
 * Plan 04-04 Wave 0 spike Variant A — wrap a helper that escapes into useEffect
 * (i.e., its identifier appears as a `closure` SignalRef in any Listener.deps
 * or LifecycleHook.setupDeps) in `useCallback(fn, [...bodyDeps])`.
 *
 * Returns the rendered `const X = useCallback(...);` line on success, or
 * null when:
 *   - stmt isn't a single-declarator arrow/function-expression initializer,
 *   - OR the helper's name isn't in `escapingHelperNames` (no wrap needed).
 *
 * **Why useCallback?** Plain function-decl hoists (no TDZ) but creates a
 * fresh function identity every render, so `useEffect(() => {...}, [helper])`
 * re-runs every render — and `react-hooks/exhaustive-deps` lint warns
 * "function makes deps change every render". useCallback gives the helper
 * stable identity (modulo its own bodyDeps), satisfying the lint rule.
 *
 * Body deps are computed via `computeHelperBodyDeps` (the React-side
 * SignalRef walker mirroring Phase 2's `computeExpressionDeps`).
 */
function tryWrapEscapingHelperUseCallback(
  stmt: t.Statement,
  escapingHelperNames: Set<string>,
  ir: IRComponent,
  allHelperNames: Set<string>,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
): string | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return null;
  const helperName = decl.id.name;
  if (!escapingHelperNames.has(helperName)) return null;

  collectors.react.add('useCallback');

  // Plan 04-04 lint-clean fix — eslint-plugin-react-hooks v5 exhaustive-deps
  // narrows `props.onX(...)` CALLS inconsistently: even with `[props.onX]` in
  // deps, the lint warns "missing dependency: props" with hint "destructure
  // outside the useCallback". Workaround: pre-destructure all `props.onX`
  // names that this helper CALLS to a bare local before the useCallback,
  // then rewrite the body to use the bare local. This satisfies lint without
  // needing the whole `props` in deps.
  //
  // Naming: each destructured local uses a `_rozieProp_` prefix to avoid
  // collision with the helper's own name (e.g. helper `onSearch` calling
  // `props.onSearch` would clash if both share the bare name `onSearch`).
  const destructureNames = collectPropsCallsToDestructure(init.body);
  const renameMap = new Map<string, string>();
  for (const n of destructureNames) {
    renameMap.set(n, `_rozieProp_${n}`);
  }
  let initToEmit: t.Node = init;
  let destructurePrefix = '';
  if (destructureNames.size > 0) {
    initToEmit = rewritePropsToBareLocals(init, renameMap);
    const sortedNames = [...renameMap.keys()].sort();
    const renamedPairs = sortedNames.map((n) => `${n}: ${renameMap.get(n)}`);
    destructurePrefix = `const { ${renamedPairs.join(', ')} } = props;\n  `;
  }

  // Compute body deps using the ORIGINAL body so the walker classifies
  // `props.X` as `{scope:'props', path:['X']}` SignalRefs. After we render
  // the deps array, replace `props.X` with the renamed local for any X that
  // was destructured — eslint expects the deps[] entry to match the body's
  // bare-identifier reference.
  const bodyDeps = computeHelperBodyDeps(init.body, ir, allHelperNames, helperName);
  const rawDepsLiteral = renderDepArrayWithIR(bodyDeps, ir);
  // Rewrite `props.onSearch` → `_rozieProp_onSearch` in the deps array
  // for each destructured name. Sort the resulting list lexically again.
  let depsLiteral = rawDepsLiteral;
  if (renameMap.size > 0) {
    if (depsLiteral === '[]') {
      depsLiteral = '[]';
    } else {
      const items = depsLiteral.slice(1, -1).split(', ').map((tok) => {
        for (const [orig, renamed] of renameMap) {
          if (tok === `props.${orig}`) return renamed;
        }
        return tok;
      });
      const unique = [...new Set(items)].sort();
      depsLiteral = `[${unique.join(', ')}]`;
    }
  }

  const arrowSource = genCode(initToEmit);

  return `${destructurePrefix}const ${helperName} = useCallback(${arrowSource}, ${depsLiteral});`;
}

/**
 * Find all distinct `props.onX` names that appear in CALL position inside
 * `body`. Returns the set of names (without the `on` prefix? no — keep raw
 * since the destructure binds the same name, e.g. `const { onClose } = props`).
 *
 * Only names that are KNOWN prop names (declared in the IR's `emits` array
 * via the auto-synthesized `onX` form) are eligible. We discover them by
 * looking for any MemberExpression `props.X` where X is the callee of a
 * CallExpression — that's the lint-triggering shape.
 */
function collectPropsCallsToDestructure(body: t.Node): Set<string> {
  const names = new Set<string>();
  const wrapped: t.BlockStatement = t.isBlockStatement(body)
    ? body
    : t.blockStatement([t.expressionStatement(body as t.Expression)]);
  const file = t.file(t.program([t.functionDeclaration(t.identifier('__h'), [], wrapped, false, false)]));

  traverse(file, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee)) return;
      if (callee.computed) return;
      if (!t.isIdentifier(callee.object) || callee.object.name !== 'props') return;
      if (!t.isIdentifier(callee.property)) return;
      names.add(callee.property.name);
    },
  });
  return names;
}

/**
 * Replace every `props.X` MemberExpression where X is a key of `renameMap`
 * with a bare Identifier of the mapped name. Returns a CLONED node (input
 * is not mutated).
 */
function rewritePropsToBareLocals(
  node: t.Node,
  renameMap: Map<string, string>,
): t.Node {
  const cloned = t.cloneNode(node, true, false);
  const file = t.file(t.program([t.expressionStatement(cloned as t.Expression)]));

  traverse(file, {
    MemberExpression(path) {
      const n = path.node;
      if (n.computed) return;
      if (!t.isIdentifier(n.object) || n.object.name !== 'props') return;
      if (!t.isIdentifier(n.property)) return;
      const renamed = renameMap.get(n.property.name);
      if (!renamed) return;
      path.replaceWith(t.identifier(renamed));
    },
  });
  return cloned;
}

function tryHoistArrowToFunction(stmt: t.Statement): t.Statement | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return null;

  // Only hoist `const`/`let` (not destructuring, not multi-decl). The runtime
  // semantics of `function name() {}` declarations match `const name = () => {}`
  // for our use case (plain top-level helpers).
  // Skip if the arrow body is an Expression but contains TS type assertion or
  // similar — let it fall through unhoisted.

  const body: t.BlockStatement = t.isBlockStatement(init.body)
    ? init.body
    : t.blockStatement([t.returnStatement(init.body)]);

  const params = init.params.filter((p): p is t.Identifier | t.Pattern | t.RestElement =>
    t.isIdentifier(p) || t.isRestElement(p) || t.isAssignmentPattern(p) ||
    t.isObjectPattern(p) || t.isArrayPattern(p),
  );

  const fn = t.functionDeclaration(decl.id, params, body, false, init.async ?? false);
  return fn;
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Render a PropTypeAnnotation as a TS type string. Mirrors emitPropsInterface. */
function renderType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return 'number';
      case 'String':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Array':
        return 'unknown[]';
      case 'Object':
        return 'Record<string, unknown>';
      case 'Function':
        return '(...args: unknown[]) => unknown';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') return ann.members.map(renderType).join(' | ');
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'unknown[]';
    if (ann.value === 'object') return 'Record<string, unknown>';
    if (ann.value === 'function') return '(...args: unknown[]) => unknown';
    return ann.value;
  }
  return 'unknown';
}

/**
 * Render a SignalRef as the React-side identifier per RESEARCH Pattern 3
 * lines 510-518:
 *
 *   { scope: 'props', path: ['foo'] } (non-model) → 'props.foo'
 *   { scope: 'props', path: ['value'] } (model:true) → 'value'
 *   { scope: 'data', path: ['foo'] }              → 'foo'
 *   { scope: 'computed', path: ['canIncrement'] } → 'canIncrement'
 *   { scope: 'slots', path: ['header'] }          → 'props.renderHeader'
 *   { scope: 'closure', identifier: 'helperFn' }  → 'helperFn'
 *
 * Refs are excluded by Phase 2 D-21b — Listener.deps / LifecycleHook.setupDeps
 * already contain no $refs.
 */
function renderSignalRef(ref: SignalRef, modelProps: ReadonlySet<string>): string {
  if (ref.scope === 'props') {
    const head = ref.path[0] ?? '';
    if (modelProps.has(head)) {
      return head;
    }
    return `props.${head}`;
  }
  if (ref.scope === 'data') {
    return ref.path[0] ?? '';
  }
  if (ref.scope === 'computed') {
    return ref.path[0] ?? '';
  }
  if (ref.scope === 'slots') {
    const head = ref.path[0] ?? '';
    return `props.render${capitalize(head)}`;
  }
  // closure
  return ref.identifier;
}

/**
 * Build a sorted, deduplicated dep-array literal from a set of SignalRefs.
 * Output: `[]`, `[X]`, `[X, Y]`, etc. (alphabetized for snapshot stability).
 */
function renderDepArray(deps: SignalRef[], modelProps: ReadonlySet<string>): string {
  const rendered = new Set<string>();
  for (const d of deps) {
    rendered.add(renderSignalRef(d, modelProps));
  }
  const sorted = [...rendered].sort();
  return `[${sorted.join(', ')}]`;
}

/**
 * Find the scriptProgram-cloned `body` Expression/BlockStatement for each
 * ComputedDecl by name. We match VariableDeclarators with init = $computed(arrow|fn).
 * Returns map { computedName → cloned-body }.
 */
function findClonedComputedBodies(
  clonedProgram: t.File,
): Map<string, t.Expression | t.BlockStatement> {
  const out = new Map<string, t.Expression | t.BlockStatement>();
  for (const stmt of clonedProgram.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init || !t.isCallExpression(d.init)) continue;
      const callee = d.init.callee;
      if (!t.isIdentifier(callee) || callee.name !== '$computed') continue;
      const cb = d.init.arguments[0];
      if (!cb) continue;
      if (t.isArrowFunctionExpression(cb) || t.isFunctionExpression(cb)) {
        out.set(d.id.name, cb.body);
      }
    }
  }
  return out;
}

/**
 * Find the cloned body for each LifecycleHook by source-order matching the
 * ir.lifecycle entries to top-level $onMount/$onUnmount/$onUpdate
 * CallExpressions in the cloned Program.
 *
 * For each LifecycleHook (in IR order) we capture:
 *   - setupCloned: the (cloned) setup expression to embed in useEffect
 *   - cleanupCloned: the (cloned) cleanup expression (if any) — paired
 *     LifecycleHooks have `cleanup` set; we use the cloned $onUnmount arg.
 *   - consumedIndices: the set of Program-body indices to skip when emitting
 *     residual user-authored statements.
 */
interface LifecycleClonedBody {
  setupCloned: t.Expression | t.BlockStatement;
  cleanupCloned: t.Expression | null;
}

function pairClonedLifecycle(
  clonedProgram: t.File,
  ir: IRComponent,
): { perHook: LifecycleClonedBody[]; consumedIndices: Set<number> } {
  const perHook: LifecycleClonedBody[] = [];
  const consumed = new Set<number>();
  // Walk top-level lifecycle calls in source order.
  const lifecycleCallIndices: Array<{ idx: number; calleeName: string; arg: t.Node }> = [];
  for (let i = 0; i < clonedProgram.program.body.length; i++) {
    const stmt = clonedProgram.program.body[i]!;
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr)) continue;
    const callee = expr.callee;
    if (!t.isIdentifier(callee)) continue;
    if (
      callee.name !== '$onMount' &&
      callee.name !== '$onUnmount' &&
      callee.name !== '$onUpdate'
    ) {
      continue;
    }
    const arg = expr.arguments[0];
    if (!arg) continue;
    lifecycleCallIndices.push({ idx: i, calleeName: callee.name, arg });
  }

  // Pair $onMount Identifier with adjacent $onUnmount Identifier (D-19 conservative).
  let cursor = 0;
  for (const lh of ir.lifecycle) {
    // Find the next lifecycle call entry that matches this hook's phase.
    while (cursor < lifecycleCallIndices.length) {
      const entry = lifecycleCallIndices[cursor]!;
      cursor++;
      const expectedCallee =
        lh.phase === 'mount' ? '$onMount' : lh.phase === 'unmount' ? '$onUnmount' : '$onUpdate';
      if (entry.calleeName !== expectedCallee) continue;
      consumed.add(entry.idx);
      let setupCloned = entry.arg as t.Expression | t.BlockStatement;
      let cleanupCloned: t.Expression | null = null;
      // If the IR LifecycleHook has cleanup, first try to pair with an
      // adjacent $onUnmount call (D-19 conservative pairing of two
      // top-level Identifier args, e.g. Modal's lockScroll/unlockScroll).
      if (lh.cleanup) {
        if (cursor < lifecycleCallIndices.length) {
          const next = lifecycleCallIndices[cursor]!;
          if (next.calleeName === '$onUnmount') {
            consumed.add(next.idx);
            cleanupCloned = next.arg as t.Expression;
            cursor++;
          }
        }
      }
      // Pitfall 5 fallback: if cleanup wasn't paired with an $onUnmount,
      // detect `return <expr>` as last stmt of the setup arrow's
      // BlockStatement body and lift it to cleanup. Applies when:
      //   - lh.cleanup is falsy (no Phase 2 detection — pure Pitfall 5), OR
      //   - lh.cleanup is truthy BUT no adjacent $onUnmount existed
      //     (cleanup originated from the setup body's return, like
      //     SearchInput's $onMount(() => { ...; return () => {} })).
      if (
        cleanupCloned === null &&
        lh.phase === 'mount' &&
        (t.isArrowFunctionExpression(setupCloned) || t.isFunctionExpression(setupCloned))
      ) {
        const fnBody = setupCloned.body;
        if (t.isBlockStatement(fnBody) && !setupCloned.async) {
          const lastStmt = fnBody.body[fnBody.body.length - 1];
          if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
            cleanupCloned = lastStmt.argument;
            // Strip the return from the setup body.
            const newBody = t.blockStatement(fnBody.body.slice(0, -1));
            // Construct a new arrow with the trimmed body.
            const newArrow = t.arrowFunctionExpression(
              setupCloned.params,
              newBody,
              setupCloned.async,
            );
            setupCloned = newArrow;
          }
        }
      }
      perHook.push({ setupCloned, cleanupCloned });
      break;
    }
  }
  return { perHook, consumedIndices: consumed };
}

/**
 * Quick plan 260515-u2b — locate the cloned getter/callback bodies for each
 * WatchHook by source-order matching to top-level $watch CallExpressions in
 * the cloned Program. After rewriteRozieIdentifiers runs on the clone,
 * `$props.x` reads inside the cloned bodies have been rewritten to React-side
 * identifiers; we reuse those rewritten bodies verbatim for emission.
 */
interface WatcherClonedBody {
  /** Cloned getter body — used only when callback inlining needs access. */
  getterCloned: t.Expression | t.BlockStatement;
  /** Cloned callback body — inlined into the useEffect callback. */
  callbackCloned: t.Expression | t.BlockStatement;
}

function pairClonedWatchers(
  clonedProgram: t.File,
  ir: IRComponent,
): { perWatcher: WatcherClonedBody[]; consumedIndices: Set<number> } {
  const perWatcher: WatcherClonedBody[] = [];
  const consumed = new Set<number>();
  const watcherCallIndices: Array<{
    idx: number;
    getter: t.ArrowFunctionExpression | t.FunctionExpression;
    callback: t.ArrowFunctionExpression | t.FunctionExpression;
  }> = [];

  for (let i = 0; i < clonedProgram.program.body.length; i++) {
    const stmt = clonedProgram.program.body[i]!;
    if (!t.isExpressionStatement(stmt)) continue;
    const expr = stmt.expression;
    if (!t.isCallExpression(expr)) continue;
    const callee = expr.callee;
    if (!t.isIdentifier(callee) || callee.name !== '$watch') continue;
    const getter = expr.arguments[0];
    const callback = expr.arguments[1];
    if (
      !getter ||
      (!t.isArrowFunctionExpression(getter) && !t.isFunctionExpression(getter))
    ) {
      continue;
    }
    if (
      !callback ||
      (!t.isArrowFunctionExpression(callback) && !t.isFunctionExpression(callback))
    ) {
      continue;
    }
    watcherCallIndices.push({
      idx: i,
      getter: getter as t.ArrowFunctionExpression | t.FunctionExpression,
      callback: callback as t.ArrowFunctionExpression | t.FunctionExpression,
    });
  }

  // 1:1 match — each IR WatchHook corresponds to the next $watch call in
  // source order. ir.watchers length should match watcherCallIndices length
  // (malformed calls were dropped by the collector + warned by the validator).
  let cursor = 0;
  for (let i = 0; i < ir.watchers.length; i++) {
    if (cursor >= watcherCallIndices.length) break;
    const entry = watcherCallIndices[cursor]!;
    cursor++;
    consumed.add(entry.idx);
    perWatcher.push({
      getterCloned: entry.getter.body,
      callbackCloned: entry.callback.body,
    });
  }
  return { perWatcher, consumedIndices: consumed };
}

export interface EmitScriptResult {
  /**
   * React state-style hook declarations: useRef hoists + useControllableState +
   * useState + useRef (template refs) + useMemo. NO useEffects here.
   *
   * Plan 04-04 split: lifecycle useEffects moved to `lifecycleEffectsSection`
   * (placed AFTER user arrows) so const-arrow + useCallback helpers from
   * userArrowsSection are in scope when the lifecycle dep arrays evaluate.
   * Eliminates the Plan 04-03 deferred TDZ limitation #1.
   */
  hookSection: string;
  /** User-authored top-level arrows / helpers / console.log preserved verbatim from <script>. */
  userArrowsSection: string;
  /**
   * Plan 04-04 — useEffect blocks for each LifecycleHook. Emitted AFTER user
   * arrows (and after listener wrapper consts via shell.ts) so they can
   * reference any user helper without TDZ.
   */
  lifecycleEffectsSection: string;
  /**
   * True when at least one non-model prop has a declared default. The script's
   * hookSection rebinds `props` from `_props` to merge defaults, so shell.ts
   * needs to name the function parameter `_props` instead of `props`.
   */
  hasPropsDefaults: boolean;
  /**
   * Number of statement lines in hookSection (useRef, useControllableState,
   * useState, useRef for template refs, useMemo). Used by buildShell to compute
   * where userArrowsSection starts in the output so the script source map can
   * be line-offset-adjusted correctly.
   */
  hookSectionLines: number;
  /**
   * Phase 06.1 P2 (D-100/D-101): per-expression child sourcemap from
   * @babel/generator's sourceMaps:true mode. Generated from mappable
   * user-authored statements (those not wrapped by tryWrapEscapingHelperUseCallback).
   * Null when no mappable statements exist or no filename was provided.
   */
  scriptMap: EncodedSourceMap | null;
  diagnostics: Diagnostic[];
}

export interface EmitScriptCollectors {
  react: ReactImportCollector;
  runtime: RuntimeReactImportCollector;
  /** .rozie filename; when provided, enables per-statement source map generation. */
  filename?: string | undefined;
}

/**
 * Phase 06.1 P2 emitScript options.
 */
export interface EmitScriptOptions {
  /**
   * .rozie filename surfaced as `sourceFileName` on @babel/generator's
   * per-call output map (D-103). Defaults to '<rozie>' when omitted.
   */
  filename?: string;
}

export function emitScript(
  ir: IRComponent,
  collectors: EmitScriptCollectors,
  opts: EmitScriptOptions = {},
): EmitScriptResult {
  // Phase 06.1 P2 (D-103): wire opts.filename through GEN_OPTS.sourceFileName.
  // void here keeps unused-locals quiet until v2 wires per-call emitState.
  void opts.filename;
  const diagnostics: Diagnostic[] = [];
  const modelProps = new Set(ir.props.filter((p) => p.isModel).map((p) => p.name));

  // 1. Clone the Babel Program (NEVER mutate ir.setupBody.scriptProgram).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);

  // 2. Hoist module-scoped `let X = init` declarations referenced from
  //    lifecycle hooks. ROZ522 advisories collected.
  const hoistResult = hoistModuleLet(cloned, ir);
  diagnostics.push(...hoistResult.diagnostics);
  if (hoistResult.hoisted.length > 0) {
    collectors.react.add('useRef');
  }

  // 3. Rewrite Rozie magic accessors on the clone (ROZ521 advisories collected).
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // 4. Locate cloned bodies for ComputedDecl + LifecycleHook so we can embed
  //    REWRITTEN expressions in the emitted hooks.
  const clonedComputedBodies = findClonedComputedBodies(cloned);
  const lifecyclePairing = pairClonedLifecycle(cloned, ir);
  // Quick plan 260515-u2b — locate cloned $watch call sites so we can emit
  // useEffect with the REWRITTEN callback body and consume the source-level
  // statements so they don't appear in userArrowsSection.
  const watcherPairing = pairClonedWatchers(cloned, ir);

  // 5. Build hookSection.
  const hookLines: string[] = [];

  // 5.0. Defaults rebind for non-model props that declare a default. We rebind
  //     the function parameter `_props` to a new const `props` whose missing
  //     fields are filled from declared defaults. Model:true props are handled
  //     by useControllableState below; their defaults route through
  //     `defaultValue` rather than this rebind. shell.ts uses the function
  //     parameter name `_props` whenever `propsDefaultsBlock` is non-empty.
  const defaultedNonModelProps = ir.props.filter(
    (p) => !p.isModel && p.defaultValue !== null,
  );
  let propsDefaultsBlock = '';
  if (defaultedNonModelProps.length > 0) {
    const defaultLines = defaultedNonModelProps.map((p) => {
      // Reuse the same arrow-factory invocation logic as the model branch:
      // `() => []` defaults are factory-invoked to avoid shared-mutable state.
      const raw = genCode(p.defaultValue!);
      const isFactoryArrow =
        t.isArrowFunctionExpression(p.defaultValue!) &&
        (t.isArrayExpression(p.defaultValue!.body) ||
          t.isObjectExpression(p.defaultValue!.body));
      const dflt = isFactoryArrow ? `(${raw})()` : raw;
      return `  ${p.name}: _props.${p.name} ?? ${dflt},`;
    });
    // Spread first so user-supplied values come through, then explicit
    // `X: _props.X ?? <default>` lines override any missing/undefined values
    // with the declared default.
    propsDefaultsBlock =
      `const props: ${ir.name}Props = {\n` +
      `  ..._props,\n` +
      `${defaultLines.join('\n')}\n` +
      `};`;
    hookLines.push(propsDefaultsBlock);
  }

  // 5a. Hoisted useRef declarations (one per hoist instruction).
  for (const h of hoistResult.hoisted) {
    hookLines.push(`const ${h.name} = useRef(${genCode(h.initialExpr)});`);
  }

  // 5b. useControllableState for each model:true prop.
  for (const p of ir.props) {
    if (!p.isModel) continue;
    collectors.runtime.add('useControllableState');
    const setterName = 'set' + capitalize(p.name);
    // Plan 04-04 — defaults like `() => []` (arrow factory) need parens when
    // appearing as the RHS of `??` because `a ?? () => []` doesn't parse
    // (operator precedence: `??` has higher precedence than the arrow's `=>`).
    // Wrap in parens unconditionally for arrow / function-expression defaults.
    let dflt: string;
    if (p.defaultValue === null) {
      dflt = 'undefined';
    } else {
      const raw = genCode(p.defaultValue);
      const needsParens =
        t.isArrowFunctionExpression(p.defaultValue) ||
        t.isFunctionExpression(p.defaultValue);
      dflt = needsParens ? `(${raw})` : raw;
      // Arrow factory case: emit `(props.defaultValue ?? <factoryArrow>)()` so
      // the default callable is invoked and we get the actual value (Vue's
      // factory-form prop default convention). Detect by checking if the
      // default's body is an array/object literal (the factory pattern).
      if (
        t.isArrowFunctionExpression(p.defaultValue) &&
        (t.isArrayExpression(p.defaultValue.body) || t.isObjectExpression(p.defaultValue.body))
      ) {
        // Invoke the factory: `(() => [])()` → `[]`. The user's default is
        // intended as a per-instance fresh value (avoiding shared-mutable-default).
        dflt = `${dflt}()`;
      }
    }
    hookLines.push(
      `const [${p.name}, ${setterName}] = useControllableState({\n` +
        `  value: props.${p.name},\n` +
        `  defaultValue: props.defaultValue ?? ${dflt},\n` +
        `  onValueChange: props.on${capitalize(p.name)}Change,\n` +
        `});`,
    );
  }

  // 5c. useState for each StateDecl.
  for (const s of ir.state) {
    collectors.react.add('useState');
    const setterName = 'set' + capitalize(s.name);
    hookLines.push(
      `const [${s.name}, ${setterName}] = useState(${genCode(s.initializer)});`,
    );
  }

  // 5d. useRef for each RefDecl. Element type guessed from elementTag.
  for (const r of ir.refs) {
    collectors.react.add('useRef');
    let domType = 'HTMLElement';
    switch (r.elementTag.toLowerCase()) {
      case 'input':
        domType = 'HTMLInputElement';
        break;
      case 'textarea':
        domType = 'HTMLTextAreaElement';
        break;
      case 'select':
        domType = 'HTMLSelectElement';
        break;
      case 'button':
        domType = 'HTMLButtonElement';
        break;
      case 'form':
        domType = 'HTMLFormElement';
        break;
      case 'div':
        domType = 'HTMLDivElement';
        break;
    }
    hookLines.push(`const ${r.name} = useRef<${domType} | null>(null);`);
  }

  // 5e. useMemo for each ComputedDecl.
  for (const c of ir.computed) {
    collectors.react.add('useMemo');
    const body = clonedComputedBodies.get(c.name) ?? c.body;
    const bodyCode = genCode(body);
    const depsArr = renderDepArray(c.deps, modelProps);
    // For BlockStatement bodies, wrap as `() => { ... }`. For Expression
    // bodies, wrap as `() => expr`. genCode already prints both correctly,
    // but for an ArrowFunctionBody we need the outer arrow form.
    if (t.isBlockStatement(body)) {
      hookLines.push(`const ${c.name} = useMemo(() => ${bodyCode}, ${depsArr});`);
    } else {
      hookLines.push(`const ${c.name} = useMemo(() => ${bodyCode}, ${depsArr});`);
    }
  }

  // 5f. useEffect for each paired LifecycleHook — Plan 04-04: split into a
  // separate `lifecycleEffectsSection` (placed AFTER user arrows) so const-
  // arrow + useCallback helpers from userArrowsSection are in scope when the
  // dep arrays evaluate. Eliminates Plan 04-03 deferred TDZ limitation #1.
  //
  // Quick plan 260515-u2b — WatchHook also lowers to useEffect, but the dep
  // array comes from WatchHook.getterDeps (NOT the callback body's deps).
  // Same `renderDepArray` helper applies; callback body is inlined into the
  // useEffect callback exactly like a lifecycle setup body.
  const lifecycleEffectLines: string[] = [];
  ir.lifecycle.forEach((lh, idx) => {
    collectors.react.add('useEffect');
    const paired = lifecyclePairing.perHook[idx];
    const setupCloned = paired?.setupCloned ?? lh.setup;
    const cleanupCloned = paired?.cleanupCloned ?? null;
    const depsArr = renderDepArray(lh.setupDeps, modelProps);

    // Build the useEffect callback body.
    // setup may be Identifier (helper fn ref) or arrow/fn (inline body).
    let setupInvocation: string;
    if (t.isIdentifier(setupCloned)) {
      setupInvocation = `${setupCloned.name}();`;
    } else if (t.isArrowFunctionExpression(setupCloned) || t.isFunctionExpression(setupCloned)) {
      // Inline the body: if BlockStatement, splice it in; if Expression, call it.
      const fnBody = setupCloned.body;
      if (t.isBlockStatement(fnBody)) {
        // Strip the surrounding block braces — the useEffect callback
        // already provides its own block. Use @babel/generator on each stmt.
        const innerStmts = fnBody.body.map((s) => genCode(s)).join('\n      ');
        setupInvocation = innerStmts;
      } else {
        setupInvocation = genCode(fnBody) + ';';
      }
    } else {
      setupInvocation = genCode(setupCloned) + ';';
    }

    let cleanupInvocation = '';
    if (cleanupCloned) {
      if (t.isIdentifier(cleanupCloned)) {
        cleanupInvocation = `\n  return () => ${cleanupCloned.name}();`;
      } else if (
        t.isArrowFunctionExpression(cleanupCloned) ||
        t.isFunctionExpression(cleanupCloned)
      ) {
        const fnBody = cleanupCloned.body;
        if (t.isBlockStatement(fnBody)) {
          const innerStmts = fnBody.body.map((s) => genCode(s)).join('\n        ');
          cleanupInvocation = `\n  return () => {\n    ${innerStmts}\n  };`;
        } else {
          cleanupInvocation = `\n  return () => ${genCode(fnBody)};`;
        }
      } else {
        cleanupInvocation = `\n  return () => (${genCode(cleanupCloned)})();`;
      }
    }

    lifecycleEffectLines.push(
      `useEffect(() => {\n  ${setupInvocation}${cleanupInvocation}\n}, ${depsArr});`,
    );
  });

  // Quick plan 260515-u2b — emit one useEffect per WatchHook. Dep array
  // unions WatchHook.getterDeps with the callback body's deps walked via
  // computeHelperBodyDeps. WHY UNION: react-hooks/exhaustive-deps flags any
  // identifier READ inside the useEffect callback that isn't in the deps —
  // and the callback body typically calls helper functions like
  // `reposition()` (closure refs) AND reads reactive values. The Vue/Svelte/
  // Solid/Angular/Lit targets auto-track reactive reads inside their effect
  // primitive and ignore the array entirely; React's static lint requires
  // the union. We compute callback-body deps below (after allHelperNames is
  // collected) — see immediately following block.
  //
  // Note: helper-name discovery happens AFTER this loop today, so we collect
  // them inline here for the watcher's callback walk only. The earlier
  // allHelperNames block (line ~929) still runs independently for the
  // useArrows section's tryWrapEscapingHelperUseCallback path.
  const watcherHelperNames = new Set<string>();
  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    if (watcherPairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      watcherHelperNames.add(stmt.id.name);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (
          t.isIdentifier(d.id) &&
          d.init &&
          (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
        ) {
          watcherHelperNames.add(d.id.name);
        }
      }
    }
  }

  ir.watchers.forEach((wh, idx) => {
    collectors.react.add('useEffect');
    const paired = watcherPairing.perWatcher[idx];
    // `callbackCloned` is the post-rewrite callback body (BlockStatement or
    // Expression). Inline its statements directly into the useEffect callback.
    const cbCloned = paired?.callbackCloned ?? wh.callback;
    let cbInvocation: string;
    if (t.isBlockStatement(cbCloned)) {
      const innerStmts = cbCloned.body.map((s) => genCode(s)).join('\n      ');
      cbInvocation = innerStmts;
    } else {
      // Concise arrow body — emit as an expression statement.
      cbInvocation = `${genCode(cbCloned)};`;
    }
    // Union getter deps with closure refs walked over the callback body so
    // the lint rule is satisfied without an eslint-disable (D-62 floor).
    const cbDeps = computeHelperBodyDeps(
      cbCloned,
      ir,
      watcherHelperNames,
      '', // synthetic helper name; never collides because we don't filter on it
    );
    const merged = [...wh.getterDeps, ...cbDeps];
    const depsArr = renderDepArray(merged, modelProps);
    lifecycleEffectLines.push(
      `useEffect(() => {\n  ${cbInvocation}\n}, ${depsArr});`,
    );
  });

  const hookSection = hookLines.join('\n');
  const lifecycleEffectsSection = lifecycleEffectLines.join('\n');

  // 6. Build userArrowsSection — top-level user-authored arrows / helpers /
  //    console.log preserved verbatim. Skip:
  //    - VariableDeclarations whose ALL declarators are $computed initializers
  //      (consumed by useMemo above)
  //    - Lifecycle ExpressionStatements (consumed via lifecyclePairing)
  //
  // Plan 04-04 (Wave 0 spike Variant A) — helpers whose IDENTIFIER is referenced
  // as a `closure` SignalRef from any Listener.deps or LifecycleHook.setupDeps
  // ESCAPE INTO useEffect. To satisfy `react-hooks/exhaustive-deps` without
  // emitting any `eslint-disable` comments (D-62 floor), wrap such helpers in
  // useCallback(fn, [...bodyDeps]). The wrap gives the helper stable identity
  // across renders (modulo its real reactive deps), eliminating the
  // "function identity changes every render" lint warning that would otherwise
  // appear on the listener/lifecycle useEffect deps[] containing the helper.
  //
  // Helpers whose names DON'T appear in any escaping-deps set are emitted as
  // plain function-decls (hoisted, no useCallback overhead).

  // 6a. Collect the escaping-helper-name set from listener+lifecycle deps.
  const escapingHelperNames = new Set<string>();
  for (const listener of ir.listeners) {
    for (const dep of listener.deps) {
      if (dep.scope === 'closure') escapingHelperNames.add(dep.identifier);
    }
  }
  for (const lh of ir.lifecycle) {
    for (const dep of lh.setupDeps) {
      if (dep.scope === 'closure') escapingHelperNames.add(dep.identifier);
    }
  }

  // 6b. Pre-scan ALL top-level helpers (arrow + function decl) so the
  // computeHelperBodyDeps walk knows which identifiers are sibling helpers
  // (and should be classified as `closure` deps, not unknown identifiers).
  const allHelperNames = new Set<string>();
  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    // Quick plan 260515-u2b — $watch lines were emitted as useEffects.
    if (watcherPairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      allHelperNames.add(stmt.id.name);
      continue;
    }
    if (t.isVariableDeclaration(stmt)) {
      for (const d of stmt.declarations) {
        if (
          t.isIdentifier(d.id) &&
          d.init &&
          (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init))
        ) {
          allHelperNames.add(d.id.name);
        }
      }
    }
  }

  const userArrowsLines: string[] = [];
  // Collect statements that are emitted as-is (not wrapped by
  // tryWrapEscapingHelperUseCallback) so we can generate a unified source map
  // from them. Wrapped statements produce string output (not AST) and have no
  // reliable source location after the useCallback transformation, so they are
  // excluded from the map (acceptable partial fix per brief).
  const mappableStmts: t.Statement[] = [];

  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    // Quick plan 260515-u2b — $watch lines were emitted as useEffects.
    if (watcherPairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;
    if (t.isVariableDeclaration(stmt)) {
      const allComputed =
        stmt.declarations.length > 0 &&
        stmt.declarations.every(
          (d) =>
            d.init &&
            t.isCallExpression(d.init) &&
            t.isIdentifier(d.init.callee) &&
            d.init.callee.name === '$computed',
        );
      if (allComputed) continue;
    }
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (
        t.isIdentifier(callee) &&
        (callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate' ||
          // Quick plan 260515-u2b — defensive: should already be consumed by
          // watcherPairing, but skip here as a safety net.
          callee.name === '$watch')
      ) {
        // Safety net — should already have been consumed by lifecyclePairing.
        continue;
      }
    }

    // Try the useCallback escape-wrap first; falls back to function-decl
    // hoist if the helper isn't escaping.
    const wrapped = tryWrapEscapingHelperUseCallback(
      stmt,
      escapingHelperNames,
      ir,
      allHelperNames,
      collectors,
    );
    if (wrapped) {
      userArrowsLines.push(wrapped);
      // Wrapped statements are emitted as strings via genCode on the callback
      // body; their source locations are unreliable post-transformation.
      // Exclude from mappableStmts.
      continue;
    }

    // Plan 04-04 fix: hoist `const X = (...) => body` to `function X(...) { body }`.
    // Function declarations hoist; const arrows DO NOT. Lifecycle useEffects in
    // hookSection (top of body) include these helpers in their dep arrays, and
    // const-arrow + dep-array literal evaluation order = TDZ ReferenceError at
    // render time. Function-decl hoist eliminates the TDZ. (Per Plan 04-03
    // deferred limitation #1; see RESEARCH Pitfall 3/8.)
    const hoisted = tryHoistArrowToFunction(stmt);
    const emitted = hoisted ?? stmt;
    userArrowsLines.push(genCode(emitted));
    // Only collect the ORIGINAL stmt for source-map purposes — hoisted nodes are
    // synthetic (no .loc) and would produce empty mappings. The original stmt
    // retains the .rozie source location from @babel/parser.
    mappableStmts.push(stmt);
  }
  const userArrowsSection = userArrowsLines.join('\n');

  // Generate a source map from mappable user statements. We generate ONE map
  // from the combined program so generated-line numbers are relative to the
  // start of userArrowsSection (line 0 = first user statement). buildShell
  // shifts this by userCodeLineOffset so it aligns with tsx output lines.
  let scriptMap: EncodedSourceMap | null = null;
  const sourceFileName = collectors.filename;
  if (mappableStmts.length > 0 && sourceFileName !== undefined) {
    const genResult = generate(
      t.file(t.program(mappableStmts)),
      { ...GEN_OPTS_MAP, sourceFileName },
    );
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  // Count the actual OUTPUT lines of hookSection, not the number of entries.
  // React hookSection entries can span multiple lines (e.g., useControllableState
  // block with 4 sub-lines, propsDefaultsBlock with 5 sub-lines). The shell
  // needs the actual line count to compute userCodeLineOffset correctly.
  const hookSectionLines = hookSection.length > 0
    ? hookSection.split('\n').length
    : 0;

  return {
    hookSection,
    userArrowsSection,
    lifecycleEffectsSection,
    hasPropsDefaults: defaultedNonModelProps.length > 0,
    hookSectionLines,
    scriptMap,
    diagnostics,
  };
}
