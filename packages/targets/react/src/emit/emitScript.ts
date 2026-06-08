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
import type { NodePath } from '@babel/traverse';
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
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import { rewriteRozieIdentifiers } from '../rewrite/rewriteScript.js';
import { hoistModuleLet } from '../rewrite/hoistModuleLet.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { computeHelperBodyDeps } from './computeHelperDeps.js';
import { renderDepArray as renderDepArrayWithIR } from './renderDepArray.js';
import { emitPortals } from './emitPortals.js';

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
 * Render the inner statements of a BlockStatement as a string, generated
 * in ONE @babel/generator pass.
 *
 * Why one pass: a comment sitting BETWEEN two statements is attached by
 * Babel's parser to BOTH neighbours — as the `trailingComments` of the
 * earlier statement and the `leadingComments` of the later one. Each
 * `generate()` call carries its own printed-comments dedup set, so
 * rendering statements one-at-a-time (`body.map(genCode)`) emits such a
 * comment TWICE: once trailing the earlier stmt, once leading the later.
 * Generating the whole block keeps a single dedup set across every
 * statement, so each comment prints exactly once.
 *
 * The outer braces are stripped (callers supply their own useEffect
 * block). `indent` is prepended to every continuation line — the first
 * line is left flush, since the call site's template provides its
 * indentation.
 */
function genBlockInner(block: t.BlockStatement, indent: string): string {
  const code = genCode(block);
  const inner = code.slice(1, -1).replace(/^\n/, '').replace(/\s+$/, '');
  if (inner === '') return '';
  return inner
    .split('\n')
    .map((line, i) => {
      // Drop @babel/generator's base 2-space block indent; deeper
      // (nested) indentation is preserved relative to it.
      const dedented = line.startsWith('  ') ? line.slice(2) : line;
      if (i === 0) return dedented;
      return dedented === '' ? '' : indent + dedented;
    })
    .join('\n');
}

/**
 * Phase 14.1 follow-up — does any element in the IR template carry a
 * `spreadBinding` attribute? The Plan 14-05 gate at `emitScript` only
 * synthesises `const attrs = ...` (the source for the `$attrs` rewrite at
 * `rewriteTemplateExpression.ts:137`) when `inheritAttrs !== false`. That's
 * correct for the auto-fallthrough wrapper (root element auto-spread), but
 * wrong for the explicit-manual case: `inherit-attrs="false"` plus
 * author-written `r-bind="$attrs"` produces a `spreadBinding` in the IR whose
 * emit references `attrs` — but the destructure that declares `attrs` is
 * gated off, so the rendered component hits ReferenceError and React unmounts
 * the whole tree.
 *
 * Mirrors the Lit fix at `emitLit.ts:160` (`rozieSpreadUsed && inheritAttrs
 * !== false` → `rozieSpreadUsed`). The semantic: `inherit-attrs="false"` only
 * opts out of auto-fallthrough, not out of the author's right to reference
 * `$attrs` explicitly via `r-bind="$attrs"`.
 */
function templateUsesSpreadBinding(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
): boolean {
  if (node === null || node === undefined) return false;
  // TemplateElementIR: scan its own attrs + recurse into children.
  if (node.type === 'TemplateElement') {
    for (const a of node.attributes ?? []) {
      if (a.kind === 'spreadBinding') return true;
    }
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    // TemplateMatch hostElement is itself a TemplateElement, covered above
    // when recursion reaches it via the parent's children.
    return false;
  }
  // TemplateConditional / TemplateMatch — recurse into branch bodies.
  if (node.type === 'TemplateConditional' || node.type === 'TemplateMatch') {
    for (const branch of node.branches ?? []) {
      for (const c of branch.body ?? []) {
        if (templateUsesSpreadBinding(c)) return true;
      }
    }
    if (node.hostElement && templateUsesSpreadBinding(node.hostElement)) return true;
    return false;
  }
  // TemplateLoop — recurse into body.
  if (node.type === 'TemplateLoop') {
    for (const c of node.body ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  // TemplateFragment — recurse into children.
  if (node.type === 'TemplateFragment') {
    for (const c of node.children ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  // TemplateSlotInvocation — fallback body (no attrs of its own).
  if (node.type === 'TemplateSlotInvocation') {
    for (const c of node.fallback ?? []) {
      if (templateUsesSpreadBinding(c)) return true;
    }
    return false;
  }
  // TemplateInterpolation / TemplateStaticText carry no spreadBinding.
  return false;
}

/**
 * Phase 15 D-19 mirror of `templateUsesSpreadBinding`. Returns true if any
 * descendant `TemplateElement` carries a `listenerSpreads` entry whose
 * `expression` is a bare `$listeners` Identifier — that bare reference lands
 * verbatim in the emitted JSX (`{...$listeners}` or `mergeListeners(..., $listeners)`),
 * so the function shell must declare `$listeners` for the reference to
 * type-check (otherwise tsc reports TS2304 `Cannot find name '$listeners'`,
 * which the react-typecheck / vue-typecheck / svelte-typecheck gates trip on
 * the typed fixture set even when dist-parity byte-equality is green).
 *
 * The synthesized auto-fallthrough push (lowerTemplate.ts
 * `synthesizeListenersFallthrough`) AND author-written `r-on="$listeners"`
 * both lower to the bare-identifier shape, so this single scan covers both
 * cases. A dynamic `r-on="someObj"` spread routes through the runtime
 * `normalizeListeners(someObj)` wrap — no `$listeners` declaration is needed
 * for that path.
 */
function templateUsesListenersSpread(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any,
): boolean {
  if (node === null || node === undefined) return false;
  if (node.type === 'TemplateElement') {
    for (const s of node.listenerSpreads ?? []) {
      const expr = s.expression;
      if (
        expr !== null &&
        expr !== undefined &&
        expr.type === 'Identifier' &&
        expr.name === '$listeners'
      ) {
        return true;
      }
    }
    for (const c of node.children ?? []) {
      if (templateUsesListenersSpread(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateConditional' || node.type === 'TemplateMatch') {
    for (const branch of node.branches ?? []) {
      for (const c of branch.body ?? []) {
        if (templateUsesListenersSpread(c)) return true;
      }
    }
    if (node.hostElement && templateUsesListenersSpread(node.hostElement)) return true;
    return false;
  }
  if (node.type === 'TemplateLoop') {
    for (const c of node.body ?? []) {
      if (templateUsesListenersSpread(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateFragment') {
    for (const c of node.children ?? []) {
      if (templateUsesListenersSpread(c)) return true;
    }
    return false;
  }
  if (node.type === 'TemplateSlotInvocation') {
    for (const c of node.fallback ?? []) {
      if (templateUsesListenersSpread(c)) return true;
    }
    return false;
  }
  return false;
}

/**
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Why not `\`() => ${genCode(body)}\``? When `body` is an ObjectExpression
 * (e.g. `$computed(() => ({ x: 1 }))`), `genCode(body)` returns `{ x: 1 }`
 * and the template yields `() => { x: 1 }` — an arrow with a BlockStatement
 * body containing a LabeledStatement `x: 1`, not an arrow returning an
 * object literal. Building the arrow as a Babel node lets @babel/generator
 * auto-wrap the body in parens.
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
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

  // WR-01 ROOT CAUSE 2 — the `useCallback` wrap rebuilds the declaration as a
  // string from `helperName`, which drops a declarator-id type annotation
  // (`const handleClick: (e: MouseEvent) => void = …`). Re-emit that
  // annotation onto the `const` so the author's contextual typing survives the
  // wrap. (typeNeutralizeScript already leaves the arrow's params bare for the
  // declarator-typed shape, so `: (e: MouseEvent) => void` on the const is the
  // sole — and sufficient — carrier.)
  const declTypeSuffix = renderDeclaratorTypeSuffix(decl.id);

  return `${destructurePrefix}const ${helperName}${declTypeSuffix} = useCallback(${arrowSource}, ${depsLiteral});`;
}

/**
 * WR-01 ROOT CAUSE 2 helper — render a `VariableDeclarator` `id`'s author type
 * annotation as a `": <Type>"` suffix string (empty when the id is untyped).
 * Used by the `const`-preserving rebuild sites (`useCallback` wrap) so an
 * author declarator annotation survives a string-template rebuild.
 */
function renderDeclaratorTypeSuffix(id: t.LVal): string {
  if (!t.isIdentifier(id)) return '';
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return '';
  // @babel/generator cannot print a bare `TSTypeAnnotation` (its printer
  // dereferences a parent that no longer exists → "Cannot read properties of
  // null"). Print the INNER type node and prepend the `: ` ourselves.
  return `: ${genCode(ann.typeAnnotation)}`;
}

/**
 * Plan 07.7 follow-up — wrap a top-level NON-FUNCTION `const X = init`
 * declaration in `useMemo(() => init, [...initDeps])` when the binding
 * escapes into a useEffect (i.e., its identifier appears as a `closure`
 * SignalRef in any Listener.deps / LifecycleHook.setupDeps / WatchHook.getterDeps).
 *
 * Why useMemo? A bare `const X = [a, b, c]` inside the component function
 * is re-evaluated on every render, producing a fresh value identity
 * (`Object.is(prev, curr) === false`) and re-firing every useEffect that
 * lists X in its dep array. The "engine wrapper" pattern (FullCalendar /
 * AG-Grid / Swiper / Flatpickr — Vue/Svelte-flavored module-scoped consts
 * read from `$onMount`) trips this every time: the engine destroys +
 * recreates on every consumer render → portal `createRoot()` work
 * unmounted before commit. `useMemo(() => init, [...initDeps])` gives the
 * const stable identity across renders (modulo its real reactive deps).
 *
 * The companion case (function-shaped escapees → useCallback) is handled
 * by `tryWrapEscapingHelperUseCallback` above. The companion-companion
 * (top-level mutable `let X` referenced from a lifecycle hook → useRef
 * via `hoistModuleLet`) is handled in `hoistModuleLet.ts`.
 *
 * Returns the rendered `const X = useMemo(...);` line on success, or null
 * when:
 *   - stmt isn't a single-declarator initializer,
 *   - OR init IS an arrow/fn (handled by tryWrapEscapingHelperUseCallback),
 *   - OR the binding's name isn't in `escapingHelperNames` (no wrap needed —
 *     the binding doesn't escape into any effect).
 */
function tryWrapEscapingConstUseMemo(
  stmt: t.Statement,
  escapingHelperNames: Set<string>,
  ir: IRComponent,
  allHelperNames: Set<string>,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
): string | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.kind !== 'const') return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  // Arrow/fn-expression inits are handled by tryWrapEscapingHelperUseCallback.
  if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) return null;
  const constName = decl.id.name;
  if (!escapingHelperNames.has(constName)) return null;

  collectors.react.add('useMemo');

  // Compute deps the same way useCallback wraps do — walk the initializer
  // for reactive references.
  const initDeps = computeHelperBodyDeps(init, ir, allHelperNames, constName);
  const depsLiteral = renderDepArrayWithIR(initDeps, ir);

  return `const ${constName} = useMemo(${arrowBody(init)}, ${depsLiteral});`;
}

/**
 * Member-mutating instance methods. A call `X.<m>(...)` where `<m>` is one of
 * these MUTATES the instance `X` (rather than reading from it — `.has`/`.get`/
 * `.map`/`.size` are reads and deliberately excluded). Used by
 * `collectMutatedInstanceBinders` to distinguish a cross-render scratch binder
 * (must persist) from a read-only one.
 */
const MUTATING_INSTANCE_METHODS = new Set<string>([
  // Set / Map
  'add', 'set', 'delete', 'clear',
  // Array
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
]);

/** A `new X()`, `[...]`, or `{...}` initializer — a freshly-built mutable instance. */
function isFreshMutableInstanceInit(init: t.Expression): boolean {
  return t.isNewExpression(init) || t.isArrayExpression(init) || t.isObjectExpression(init);
}

/** Root identifier name of a (possibly nested) MemberExpression: `X.a.b`/`X[k]` → `X`. */
function memberRootName(node: t.Node): string | null {
  let cur: t.Node = node;
  while (t.isMemberExpression(cur) || t.isOptionalMemberExpression(cur)) {
    cur = cur.object;
  }
  return t.isIdentifier(cur) ? cur.name : null;
}

/**
 * Phase 35 follow-up (feedback_react_const_mutinstance_not_stabilized) —
 * collect the names of top-level `const`/`let` binders whose initializer is a
 * freshly-constructed MUTABLE INSTANCE (`new X()`, `[...]`, `{...}`) AND which
 * are MEMBER-MUTATED somewhere in the component (`X.add(...)`, `X.set(...)`,
 * `X.push(...)`, `X.delete(...)`, `X[k] = …`, `X.foo++`, `delete X[k]`).
 *
 * Such a binder is cross-render scratch state in the author's setup-once mental
 * model: the 5 setup-once targets run `<script>` ONCE so the instance persists,
 * but React re-runs the component body every render, re-creating the instance
 * and silently resetting the state. CodeMirrorDemo's `const gutterSeen = new
 * Set()` dedupe guard is the canonical case — re-created every render →
 * `markGutterMount` always re-increments `$data` (the guard never deduplicates)
 * → render side-effect → re-render → infinite loop → 30s VR hang. Wrapping the
 * binder in `useMemo(() => init, [])` restores per-instance setup-once identity
 * (the const-analog of the reassigned-`let`→`useRef` hoist in `hoistModuleLet`,
 * but useMemo keeps the binder name so reads/mutations need no `.current`
 * rewrite).
 *
 * Conservatism, two gates:
 *   - init-shape: only `new`/array/object literals — a pure derived `const total
 *     = a + b` is never a fresh-instance init, so it is never frozen.
 *   - member-mutation: the binder must actually be mutated; a read-only fresh
 *     instance is left alone (its identity churn is harmless).
 *
 * `let` binders that are also REASSIGNED (`X = …`, a bare-identifier write) are
 * excluded — useMemo cannot model reassignment; those are the `hoistModuleLet`
 * → `useRef` case (already handled when they escape into a lifecycle hook).
 */
function collectMutatedInstanceBinders(program: t.File): Set<string> {
  // 1. Candidate binders: top-level single-name const/let with a fresh-instance init.
  const candidates = new Set<string>();
  for (const stmt of program.program.body) {
    if (!t.isVariableDeclaration(stmt)) continue;
    if (stmt.kind !== 'const' && stmt.kind !== 'let') continue;
    for (const d of stmt.declarations) {
      if (!t.isIdentifier(d.id)) continue;
      if (!d.init) continue;
      if (t.isArrowFunctionExpression(d.init) || t.isFunctionExpression(d.init)) continue;
      if (!isFreshMutableInstanceInit(d.init)) continue;
      candidates.add(d.id.name);
    }
  }
  if (candidates.size === 0) return candidates;

  // 2. Walk the whole program. Record member-mutations (→ mutated) and bare
  //    reassignments (→ reassigned, which disqualify a `let`).
  const mutated = new Set<string>();
  const reassigned = new Set<string>();
  traverse(program, {
    AssignmentExpression(path) {
      const left = path.node.left;
      if (t.isIdentifier(left)) {
        if (candidates.has(left.name)) reassigned.add(left.name);
        return;
      }
      if (t.isMemberExpression(left)) {
        const r = memberRootName(left);
        if (r && candidates.has(r)) mutated.add(r);
      }
    },
    UpdateExpression(path) {
      const arg = path.node.argument;
      if (t.isIdentifier(arg)) {
        if (candidates.has(arg.name)) reassigned.add(arg.name);
        return;
      }
      if (t.isMemberExpression(arg)) {
        const r = memberRootName(arg);
        if (r && candidates.has(r)) mutated.add(r);
      }
    },
    UnaryExpression(path) {
      if (path.node.operator !== 'delete') return;
      const arg = path.node.argument;
      if (t.isMemberExpression(arg)) {
        const r = memberRootName(arg);
        if (r && candidates.has(r)) mutated.add(r);
      }
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (!t.isMemberExpression(callee) || callee.computed) return;
      if (!t.isIdentifier(callee.property)) return;
      if (!MUTATING_INSTANCE_METHODS.has(callee.property.name)) return;
      if (!t.isIdentifier(callee.object)) return;
      if (candidates.has(callee.object.name)) mutated.add(callee.object.name);
    },
  });

  // Member-mutated AND not bare-reassigned (consts can never be reassigned).
  const result = new Set<string>();
  for (const name of mutated) {
    if (!reassigned.has(name)) result.add(name);
  }
  return result;
}

/**
 * Phase 35 follow-up — wrap a top-level member-mutated fresh-instance
 * `const`/`let X = init` in `useMemo(() => init, [])` so the instance is built
 * ONCE per component instance (setup-once parity). Companion detection lives in
 * `collectMutatedInstanceBinders`. Returns the rendered line, or null when the
 * binder isn't a stabilization target.
 *
 * Distinct from `tryWrapEscapingConstUseMemo`: that wraps a const that escapes
 * into a useEffect dep array, keyed on its real reactive deps (`[...initDeps]`).
 * This wraps cross-render MUTABLE STATE, which must NEVER be re-created — hence
 * the empty `[]` dep array regardless of what the init reads (matching the
 * setup-once targets, which capture init values once and never re-read them).
 * Runs FIRST in the loop so a binder that is both escaping and mutated gets the
 * stable `[]` identity.
 */
function tryWrapMutatedInstanceUseMemo(
  stmt: t.Statement,
  mutatedInstanceNames: ReadonlySet<string>,
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector },
): string | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.kind !== 'const' && stmt.kind !== 'let') return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  if (t.isArrowFunctionExpression(init) || t.isFunctionExpression(init)) return null;
  if (!mutatedInstanceNames.has(decl.id.name)) return null;

  collectors.react.add('useMemo');
  // Preserve an author declarator annotation (`const seen: Set<string> = …`):
  // `useMemo(() => new Set(), [])` would otherwise infer `Set<unknown>`.
  const declTypeSuffix = renderDeclaratorTypeSuffix(decl.id);
  return `const ${decl.id.name}${declTypeSuffix} = useMemo(${arrowBody(init)}, []);`;
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

/**
 * Plan 07.7 follow-up — rewrite watched-prop reads inside a lifecycle hook
 * body to stable-ref `.current` reads, returning the rewritten cloned node.
 *
 * For each prop X with a sibling `$watch(() => $props.X, ...)` declaration,
 * any read of X inside the lifecycle setup/cleanup body — either as a bare
 * `<X>` Identifier (model-bound props post-rewrite) or as a `props.<X>`
 * MemberExpression (non-model props post-rewrite) — is replaced with a
 * MemberExpression `_<X>Ref.current`. The caller is responsible for
 * declaring the matching `const _<X>Ref = useRef(<reactIdent>); _<X>Ref.current = <reactIdent>;`
 * lines in `hookSection`.
 *
 * Why? The React useEffect's exhaustive-deps lint rule (D-62 floor — no
 * eslint-disable) requires every identifier READ inside the callback to
 * appear in the dep array. For the "engine wrapper" pattern (FullCalendar /
 * AG-Grid / Swiper / Flatpickr — Vue/Svelte-flavored module-let mutators
 * read from `$onMount`) we ALSO need the watched prop OUT of the dep array
 * (otherwise the engine destroy + recreate cycle thrashes portal trees on
 * every consumer render). Rewriting the read to `_<X>Ref.current` satisfies
 * both constraints simultaneously: the body now reads from the stable ref
 * (no lint warning), and the dep array can drop `props.<X>` / `<X>` (no
 * re-mount cycle). The watcher itself handles reactive updates for X.
 *
 * Identifier-rewrite safety: skips
 *   - property keys of MemberExpressions (e.g., `obj.X` — X is a key, not a ref)
 *   - ObjectProperty keys (non-shorthand `{X: ...}` — X is a key)
 *   - VariableDeclarator id positions (`let X = ...` — X is a binding)
 *   - Function param positions (`(X) => ...` — X is a binding)
 *   - Function declaration names
 *   - Import / export specifier slots
 *   - Label identifiers
 *
 * BlockStatement bodies and Expression bodies are both supported.
 */
function rewriteWatchedPropReads(
  bodyClone: t.Expression | t.BlockStatement,
  watchedModelProps: ReadonlySet<string>,
  watchedNonModelProps: ReadonlySet<string>,
): t.Expression | t.BlockStatement {
  // Wrap into a Program-rooted file so we can traverse with scope.
  const programStmts: t.Statement[] = t.isBlockStatement(bodyClone)
    ? bodyClone.body
    : [t.expressionStatement(bodyClone as t.Expression)];
  const file = t.file(t.program(programStmts));

  // Identifiers we MANUFACTURED as the `object` of a freshly-built
  // `_<X>Ref.current` MemberExpression — visiting them would re-rewrite
  // and produce `_<X>Ref.current.current`. Tracked via WeakSet keyed on
  // node identity (same pattern as hoistModuleLet).
  const synthesizedIdentifiers = new WeakSet<t.Node>();

  traverse(file, {
    MemberExpression(path: NodePath<t.MemberExpression>) {
      // Match `props.<X>` where X is a watched non-model prop.
      const obj = path.node.object;
      const prop = path.node.property;
      if (path.node.computed) return;
      if (!t.isIdentifier(obj) || obj.name !== 'props') return;
      if (!t.isIdentifier(prop)) return;
      if (!watchedNonModelProps.has(prop.name)) return;
      const refIdent = t.identifier(`_${prop.name}Ref`);
      synthesizedIdentifiers.add(refIdent);
      path.replaceWith(t.memberExpression(refIdent, t.identifier('current')));
      path.skip();
    },
    Identifier(path: NodePath<t.Identifier>) {
      if (synthesizedIdentifiers.has(path.node)) return;
      const name = path.node.name;
      if (!watchedModelProps.has(name)) return;
      const parent = path.parent;
      // Skip property positions of MemberExpressions: `obj.X` — X is a property,
      // not a real reference.
      if (
        (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
        parent.property === path.node &&
        !parent.computed
      ) {
        return;
      }
      // Skip ObjectProperty key positions (non-shorthand).
      if (t.isObjectProperty(parent) && parent.key === path.node && !parent.shorthand) {
        return;
      }
      // Skip declaration-id positions.
      if (t.isVariableDeclarator(parent) && parent.id === path.node) return;
      if (t.isFunctionDeclaration(parent) && parent.id === path.node) return;
      if (t.isFunction(parent) && parent.params.includes(path.node)) return;
      if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent)) return;
      if (t.isExportSpecifier(parent)) return;
      if (t.isLabeledStatement(parent) && parent.label === path.node) return;
      // Skip identifiers nested ANYWHERE inside a binding pattern (e.g.,
      // destructuring on the LHS of an assignment or in a function param).
      let p: NodePath | null = path.parentPath;
      while (p) {
        if (t.isObjectPattern(p.node) || t.isArrayPattern(p.node)) {
          // We're inside a destructure binding — skip rewrite.
          return;
        }
        // Stop early at function boundaries (param-list patterns are caught
        // by the above; function bodies are normal scope).
        if (t.isFunction(p.node) || t.isBlockStatement(p.node) || t.isProgram(p.node)) break;
        p = p.parentPath;
      }
      // Rewrite to `_<name>Ref.current`.
      const refIdent = t.identifier(`_${name}Ref`);
      synthesizedIdentifiers.add(refIdent);
      path.replaceWith(t.memberExpression(refIdent, t.identifier('current')));
    },
  });

  // Reassemble — file.program.body now contains the rewritten Program body.
  if (t.isBlockStatement(bodyClone)) {
    return t.blockStatement(file.program.body);
  }
  // Expression body: pop the single ExpressionStatement.
  const stmt = file.program.body[0];
  if (stmt && t.isExpressionStatement(stmt)) {
    return stmt.expression;
  }
  // Defensive fallback (shouldn't happen for well-formed input).
  return bodyClone;
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

  // Phase 09 rebuild-site audit (Pattern 4 / Pitfall 3): `params` is passed by
  // reference, so each param's `typeAnnotation` survives verbatim into output.
  // `t.functionDeclaration` has no `returnType` / `typeParameters` parameters —
  // those fields are NOT carried from `init`. The locked Phase 09 TS surface
  // (annotations on declarations/params/catch + interface/type + import type)
  // excludes explicit return types and generic functions, so the drop is in
  // scope; a future maintainer adding return-type / generic support must
  // copy `init.returnType` / `init.typeParameters` onto `fn` here.
  const fn = t.functionDeclaration(decl.id, params, body, false, init.async ?? false);
  // WR-01 ROOT CAUSE 2 — `function f() {}` cannot carry a type annotation on
  // its `id`, so hoisting `const f: (e: MouseEvent) => void = (e) => {…}` would
  // drop the author's declarator annotation. Re-project the declarator's
  // function-type onto the hoisted FunctionDeclaration's params + returnType so
  // the author's types survive (and the hoist — which fixes a real TDZ — is
  // preserved). `init`'s OWN returnType/typeParameters are also carried so a
  // future return-type/generics surface expansion is covered.
  reprojectDeclaratorFunctionType(decl.id, init, fn);
  return fn;
}

/**
 * WR-01 ROOT CAUSE 2 — re-project an author function-type annotation written
 * on a `VariableDeclarator` `id` (`const f: (e: E) => R = …`) onto a rebuilt
 * `FunctionDeclaration` (which has no annotatable `id`). Each declarator-type
 * parameter type is copied onto the matching positional param of `fn`; the
 * declarator-type return type becomes `fn.returnType`.
 *
 * Idempotent / conservative: only fills a param that has NO `typeAnnotation`
 * already (a directly-typed param wins), and only when `id.typeAnnotation` is
 * genuinely a `TSFunctionType`. `init`'s own `returnType`/`typeParameters`
 * (rare on an arrow but legal) are carried first so nothing is lost.
 */
function reprojectDeclaratorFunctionType(
  id: t.Identifier,
  init: t.ArrowFunctionExpression | t.FunctionExpression,
  fn: t.FunctionDeclaration,
): void {
  // Carry the arrow's own type metadata (defensive — usually absent).
  if (init.returnType) fn.returnType = init.returnType;
  if (init.typeParameters && !t.isNoop(init.typeParameters)) {
    fn.typeParameters = init.typeParameters;
  }
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return;
  const fnType = ann.typeAnnotation;
  if (!t.isTSFunctionType(fnType)) return;
  // Return type: declarator wins only when the arrow didn't declare its own.
  if (!fn.returnType && fnType.typeAnnotation) {
    fn.returnType = fnType.typeAnnotation;
  }
  // Param types: positional copy onto bare params.
  const declParams = fnType.parameters;
  for (let i = 0; i < fn.params.length && i < declParams.length; i++) {
    const target = fn.params[i]!;
    const sourceParam = declParams[i]!;
    const sourceAnn =
      t.isIdentifier(sourceParam) || t.isRestElement(sourceParam)
        ? sourceParam.typeAnnotation
        : undefined;
    if (!sourceAnn || !t.isTSTypeAnnotation(sourceAnn)) continue;
    if (
      (t.isIdentifier(target) ||
        t.isObjectPattern(target) ||
        t.isArrayPattern(target) ||
        t.isRestElement(target)) &&
      !target.typeAnnotation
    ) {
      target.typeAnnotation = t.cloneNode(sourceAnn, true);
    }
  }
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
        return 'any[]';
      case 'Object':
        return 'Record<string, any>';
      case 'Function':
        return '(...args: any[]) => any';
      default:
        return ann.name;
    }
  }
  if (ann.kind === 'union') return ann.members.map(renderType).join(' | ');
  if (ann.kind === 'literal') {
    if (ann.value === 'array') return 'any[]';
    if (ann.value === 'object') return 'Record<string, any>';
    if (ann.value === 'function') return '(...args: any[]) => any';
    return ann.value;
  }
  return 'unknown';
}

/**
 * 260521-oao — builtin zero-value for a prop type, used as the
 * `useControllableState` `defaultValue` seed for a no-default model prop. A
 * custom (non-builtin) identifier type has no synthesizable zero — fall back
 * to `undefined as unknown as <T>` so the option still typechecks (the seed
 * is unobserved for a required model prop, which is always controlled).
 */
function zeroValueFor(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number':
        return '0';
      case 'String':
        return "''";
      case 'Boolean':
        return 'false';
      case 'Array':
        return '[]';
      case 'Object':
        return '{}';
      case 'Function':
        return 'null';
    }
  }
  if (ann.kind === 'literal') {
    if (ann.value === 'number') return '0';
    if (ann.value === 'string') return "''";
    if (ann.value === 'boolean') return 'false';
    if (ann.value === 'array') return '[]';
    if (ann.value === 'object') return '{}';
    if (ann.value === 'function') return 'null';
  }
  return `undefined as unknown as ${renderType(ann)}`;
}

/**
 * For the merged `props` const's intersection-type override: render the prop's
 * TS type WITHOUT the `?` optional marker. Used to narrow defaulted props from
 * `step?: number` (interface) to `step: number` (in the merged const), so
 * downstream `props.step` reads don't fire TS18048. See 5.0 below.
 */
function renderPropTypeForOverride(prop: PropDecl): string {
  return renderType(prop.typeAnnotation);
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
          // `return undefined` / `return null` / `return` are "no cleanup" —
          // skip the lift so React's useEffect sees a plain mount-only effect
          // (without this guard, the emit wraps the literal in a callable
          // `() => undefined()` → runtime TypeError when React fires cleanup).
          const isNoCleanupReturn =
            lastStmt &&
            t.isReturnStatement(lastStmt) &&
            (lastStmt.argument === null ||
              lastStmt.argument === undefined ||
              (t.isIdentifier(lastStmt.argument) &&
                (lastStmt.argument.name === 'undefined' ||
                  lastStmt.argument.name === 'null')) ||
              t.isNullLiteral(lastStmt.argument));
          if (isNoCleanupReturn && lastStmt && t.isReturnStatement(lastStmt)) {
            // Strip the dead return so it doesn't show up in residual emit.
            // Phase 09 rebuild-site audit (Pattern 4): `setupCloned.params` is
            // reused by reference — param `typeAnnotation`s survive. Lifecycle
            // setup arrows take no params in the locked surface and never
            // carry a `returnType`, so nothing else needs copying here.
            setupCloned = t.arrowFunctionExpression(
              setupCloned.params,
              t.blockStatement(fnBody.body.slice(0, -1)),
              setupCloned.async,
            );
          } else if (lastStmt && t.isReturnStatement(lastStmt) && lastStmt.argument) {
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
  /**
   * Cloned callback parameter list — preserved so the watcher emission can
   * re-bind each named param to its corresponding getter value before
   * splicing the body into the useEffect. Without this binding, a callback
   * like `(v) => instance?.option('disabled', v)` lowers to a useEffect that
   * references an unresolved `v` (compiles, runs, silently passes undefined).
   * v1 supports only the first param (the new-value position).
   */
  callbackParams: ReadonlyArray<t.Identifier | t.Pattern | t.RestElement>;
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
      callbackParams: entry.callback.params,
    });
  }
  return { perWatcher, consumedIndices: consumed };
}

/**
 * Render a getter body (either the cloned expression/block from the watcher
 * source, or the raw IR getter ArrowFunctionExpression) as a React-side
 * expression. Block-bodied getters become an IIFE; expression-bodied getters
 * inline directly.
 */
function renderGetterExpression(
  getter: t.Expression | t.BlockStatement | t.ArrowFunctionExpression | t.FunctionExpression,
): string {
  // If we got the full arrow/function (no clone available), pull the body.
  let body: t.Expression | t.BlockStatement;
  if (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter)) {
    body = getter.body;
  } else {
    body = getter;
  }
  if (t.isBlockStatement(body)) {
    return `(() => ${genCode(body)})()`;
  }
  return genCode(body);
}

export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — true when the IR has any slot with
   * `isPortal === true`. emitReact uses this to inject the
   * `import { createRoot, type Root } from 'react-dom/client';` line into
   * the shell.
   */
  hasPortals: boolean;
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
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a single string, ready to splice at module top by the shell.
   * Empty string when the script has no imports. Without this hoist the
   * imports would be emitted INSIDE the component function body and produce
   * `TS1232: An import declaration can only be used at the top level of a
   * namespace or module.`
   */
  userImports: string;
  /**
   * Quick task 260521-mj9 — author-declared `<script lang="ts">`
   * statement-position `interface` / `type` declarations, each rendered as a
   * string. emitReact routes these into the shell's module-scope interface
   * bucket so they land ABOVE the props interface. Without this hoist they
   * stay inside the component function body, where the module-scope props
   * interface cannot see them — a custom prop type (`kind?: Kind`) referencing
   * such a name fails with TS2304. Always empty for an untyped `<script>`, so
   * untyped emit is byte-identical.
   */
  hoistedTypeDecls: string[];
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
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
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

  // 1b. Spike 001 B1 + quick task 260521-mj9 — partition user-authored
  //     top-level ImportDeclarations AND statement-position `interface`/`type`
  //     declarations out of the Program body BEFORE any downstream pass
  //     iterates the body. Mutate `cloned.program.body` in place to drop both;
  //     index-based pairing passes (`pairClonedLifecycle`, `pairClonedWatchers`)
  //     naturally operate on the partitioned body because their input IS the
  //     mutated `cloned.program.body`.
  //
  //     `userImports` is surfaced as a string for the shell to splice at module
  //     top — without this hoist imports would land inside the component
  //     function body and produce TS1232.
  //
  //     `hoistedTypeDecls` carries any `<script lang="ts">` statement-position
  //     `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`. Left in the
  //     function body they are out of scope of the MODULE-scope props interface
  //     (`interface FooProps { kind?: Kind }`), so a custom prop type like
  //     `Kind` referenced from that interface fails with TS2304. emitReact
  //     routes the rendered strings into the shell's module-scope bucket —
  //     mirroring Angular/Lit, which already hoist these. Always empty for an
  //     untyped `<script>`, so untyped emit stays byte-identical.
  const {
    userImports: userImportNodes,
    hoistedTypeDecls: hoistedTypeNodes,
    bodyStmts,
  } = partitionUserImports(cloned);
  cloned.program.body = bodyStmts;
  const userImports =
    userImportNodes.length > 0
      ? userImportNodes.map((imp) => genCode(imp)).join('\n') + '\n'
      : '';
  const hoistedTypeDecls = hoistedTypeNodes.map((decl) => genCode(decl));

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

  // Portal-slot primitive (Spike 003) — synthesize per-target portal
  // scaffolding when ir.slots has any portal entries. Three artefacts
  // (see emitPortals.ts):
  //   - refDeclLine    → pushed to hookLines below (component-scope useRef)
  //   - closureBlock   → prepended to the first mount-phase useEffect body
  //   - bulkDispose    → prepended to the first mount-phase useEffect cleanup
  const portalsEmit = emitPortals(ir, collectors, opts.portalScopeHash ?? '');

  // 4b. Plan 07.7 follow-up — pre-compute the watched-prop ref-rewrite plan.
  // For each prop X that has a sibling `$watch(() => $props.X, ...)`, we
  // want the mount-phase useEffect body to read `_<X>Ref.current` instead
  // of `props.<X>` (or bare `<X>` for model props), so the useEffect dep
  // array can drop the watched prop without tripping
  // `react-hooks/exhaustive-deps` (D-62 floor: no eslint-disable in
  // emitted output).
  //
  // The watcher itself owns reactive updates for X. The mount useEffect
  // captures the INITIAL value of X via `useRef(<X>)` and re-reads the
  // latest value on every engine callback via `.current` — without
  // re-mounting the engine on every consumer render.
  //
  // Two passes:
  //   (a) Walk every lifecycle hook's setup AND cleanup bodies to discover
  //       which watched props are actually referenced. Skip emitting refs
  //       for watched props that aren't read from any lifecycle body
  //       (avoids unused-variable noise).
  //   (b) Rewrite those references in-place on the cloned bodies before
  //       the lifecycle forEach below emits them.
  //
  // The model-prop vs non-model-prop distinction follows `renderSignalRef`:
  // model props lower to bare identifiers, non-model props lower to
  // `props.<X>` MemberExpressions. The rewriter handles both shapes.
  const watchedModelPropNames = new Set<string>();
  const watchedNonModelPropNames = new Set<string>();
  for (const wh of ir.watchers) {
    for (const d of wh.getterDeps) {
      if (d.scope === 'props' && d.path.length > 0) {
        const name = d.path[0]!;
        if (modelProps.has(name)) watchedModelPropNames.add(name);
        else watchedNonModelPropNames.add(name);
      }
    }
  }

  // 260521 sortable-stale-state — the watched-prop ref-rewrite above fixes
  // stale reads of *props*, but a mount-phase `$onMount` that registers a
  // long-lived engine callback can ALSO read reactive STATE / MODEL values
  // (`useState` / `useControllableState` destructured locals). A mount hook
  // lowers to `useEffect(() => {...}, [])` (mount-once, by contract — see the
  // `depsArr` comment in the lifecycle loop), so any closure created inside
  // it permanently captures the FIRST-render value of those plain destructured
  // consts. The other 5 targets are immune: they read bound state through a
  // LIVE accessor (`.value` / signal call / getter) that a mount-once closure
  // still resolves freshly. React alone destructures a frozen plain value.
  //
  // Surfaced by SortableList.rozie: its `$onMount` registers SortableJS's
  // `onUpdate`, whose body does `const next = [...items]` where `items` is the
  // `model: true` prop. Every drop spliced a stale snapshot (the initial empty
  // `[]`) and committed a wrong order.
  //
  // The fix routes those reactive state/model reads through the SAME synced
  // ref (`_<X>Ref.current`, kept current via `_<X>Ref.current = <X>`) the
  // watched-prop rewrite already uses — the ref-sync idiom generalizes to any
  // read inside a mount-once effect, not just the splice-then-set case.
  //
  // Reactive state/model names lower to BARE identifiers (see `renderSignalRef`):
  //   - `ir.state`  → `useState` destructure  → bare `<name>`
  //   - model props → `useControllableState` destructure → bare `<name>`
  // so they slot into `rewriteWatchedPropReads`'s model-set (bare-identifier)
  // path. `ir.computed` is intentionally EXCLUDED — a `useMemo` value is
  // recomputed by React and a fresh closure already sees it; only the
  // `useState`/`useControllableState` destructured frozen consts are at risk.
  const mountReactiveStateNames = new Set<string>();
  for (const s of ir.state) mountReactiveStateNames.add(s.name);
  for (const name of modelProps) mountReactiveStateNames.add(name);

  // Discover-then-rewrite per lifecycle hook. We collect the rewritten
  // bodies into Maps keyed by hook index so the lifecycle forEach below
  // uses them instead of `paired?.setupCloned` / `paired?.cleanupCloned`.
  const rewrittenSetupByIdx = new Map<number, t.Expression | t.BlockStatement>();
  const rewrittenCleanupByIdx = new Map<number, t.Expression>();
  // 260521 sortable-stale-state — `actuallyRewrittenModelProps` holds two
  // flavours of bare-identifier name post-discovery: watched model props (its
  // original role) AND mount-phase reactive state/model reads (the new path).
  // Both lower to the identical `_<X>Ref.current` synced-ref shape, so they
  // share this one set; section 5b-bis emits one ref decl per entry.
  const actuallyRewrittenModelProps = new Set<string>();
  const actuallyRewrittenNonModelProps = new Set<string>();

  if (
    (watchedModelPropNames.size > 0 ||
      watchedNonModelPropNames.size > 0 ||
      mountReactiveStateNames.size > 0) &&
    ir.lifecycle.length > 0
  ) {
    // `bareNames` is the set of bare-identifier reactive names this walk
    // should discover (watched model props always; mount-phase reactive
    // state/model names ADDITIONALLY for mount hooks — see the caller). The
    // discovered names are merged into `outModel` because both flavours lower
    // to the identical `_<X>Ref.current` bare-identifier rewrite shape.
    const findRefsInBody = (
      bodyNode: t.Expression | t.BlockStatement,
      outModel: Set<string>,
      outNonModel: Set<string>,
      bareNames: ReadonlySet<string>,
    ): void => {
      const programStmts: t.Statement[] = t.isBlockStatement(bodyNode)
        ? bodyNode.body
        : [t.expressionStatement(bodyNode as t.Expression)];
      const f = t.file(t.program(programStmts));
      traverse(f, {
        MemberExpression(p) {
          if (p.node.computed) return;
          const obj = p.node.object;
          const prop = p.node.property;
          if (!t.isIdentifier(obj) || obj.name !== 'props') return;
          if (!t.isIdentifier(prop)) return;
          if (watchedNonModelPropNames.has(prop.name)) outNonModel.add(prop.name);
        },
        Identifier(p) {
          const name = p.node.name;
          if (!bareNames.has(name)) return;
          const parent = p.parent;
          if (
            (t.isMemberExpression(parent) || t.isOptionalMemberExpression(parent)) &&
            parent.property === p.node &&
            !parent.computed
          ) return;
          if (t.isObjectProperty(parent) && parent.key === p.node && !parent.shorthand) return;
          if (t.isVariableDeclarator(parent) && parent.id === p.node) return;
          if (t.isFunctionDeclaration(parent) && parent.id === p.node) return;
          if (t.isFunction(parent) && parent.params.includes(p.node)) return;
          outModel.add(name);
        },
      });
    };

    ir.lifecycle.forEach((lh, idx) => {
      const paired = lifecyclePairing.perHook[idx];
      const setupCloned = paired?.setupCloned ?? lh.setup;
      const cleanupCloned = paired?.cleanupCloned ?? null;

      // 260521 sortable-stale-state — reactive state/model reads are routed
      // through a synced ref ONLY for MOUNT-phase hooks. A mount hook lowers
      // to a `[]`-dep `useEffect` (mount-once), so a closure created inside it
      // permanently freezes the destructured state value. `$onUpdate` hooks
      // keep their real dep array, so React re-creates the effect (and its
      // closures) when the state changes — no staleness to defend against.
      // Watched props are rewritten regardless of phase (their existing
      // contract); reactive state names join the bare-identifier set only
      // here, for `phase === 'mount'`.
      const bareNamesForHook =
        lh.phase === 'mount'
          ? new Set<string>([...watchedModelPropNames, ...mountReactiveStateNames])
          : watchedModelPropNames;

      // Determine the actual body to walk + rewrite. For arrow/fn-expr
      // setups, we operate on the body (block or expression). For Identifier
      // setups (e.g. `$onMount(lockScroll)`), the helper's body is in
      // userArrows — out of scope for this pass (the helper's reads are
      // tracked separately via the closure-dep system).
      let setupBodyForRewrite: t.Expression | t.BlockStatement | null = null;
      if (t.isArrowFunctionExpression(setupCloned) || t.isFunctionExpression(setupCloned)) {
        setupBodyForRewrite = setupCloned.body;
      } else if (t.isBlockStatement(setupCloned) || t.isExpression(setupCloned)) {
        setupBodyForRewrite = setupCloned as t.Expression | t.BlockStatement;
      }
      if (!setupBodyForRewrite) return;

      const localModel = new Set<string>();
      const localNonModel = new Set<string>();
      findRefsInBody(setupBodyForRewrite, localModel, localNonModel, bareNamesForHook);
      // Walk cleanup too (engine wrappers sometimes read props from cleanup
      // for teardown sequencing).
      if (cleanupCloned) {
        let cleanupBodyForRewrite: t.Expression | t.BlockStatement | null = null;
        if (t.isArrowFunctionExpression(cleanupCloned) || t.isFunctionExpression(cleanupCloned)) {
          cleanupBodyForRewrite = cleanupCloned.body;
        } else if (t.isExpression(cleanupCloned)) {
          cleanupBodyForRewrite = cleanupCloned;
        }
        if (cleanupBodyForRewrite) {
          findRefsInBody(cleanupBodyForRewrite, localModel, localNonModel, bareNamesForHook);
        }
      }

      if (localModel.size === 0 && localNonModel.size === 0) return;

      // 260521 sortable-stale-state — `localModel` now holds two flavours of
      // bare-identifier name: watched model props AND mount-phase reactive
      // state/model reads. Both rewrite to `_<X>Ref.current` and both want the
      // identical synced-ref decl (`const _<X>Ref = useRef(<bareName>); …`),
      // so both are merged into `actuallyRewrittenModelProps` — the section
      // 5b-bis ref-decl emit iterates that one set, and because it is a `Set`
      // a name that is BOTH a watched prop and a mount-state read emits
      // exactly once.
      for (const n of localModel) actuallyRewrittenModelProps.add(n);
      for (const n of localNonModel) actuallyRewrittenNonModelProps.add(n);

      // Now rewrite setupCloned. We replace setupBodyForRewrite (the inner
      // body) with the rewritten version. For arrow/fn-expr setups, we
      // rebuild the arrow with the rewritten body. For block/expression
      // setups, we rewrite directly.
      const rewrittenInner = rewriteWatchedPropReads(
        setupBodyForRewrite,
        localModel,
        localNonModel,
      );
      // Phase 09 rebuild-site audit (Pattern 4 / Pitfall 3): both the arrow
      // and function-expression rebuilds below reuse `setupCloned.params` /
      // `cleanupCloned.params` by reference — every param `typeAnnotation`
      // survives. `t.arrowFunctionExpression` / `t.functionExpression` do NOT
      // carry `returnType` / `typeParameters`; the locked Phase 09 TS surface
      // excludes both, so the drop is in scope and intentional.
      let newSetupCloned: t.Expression | t.BlockStatement;
      if (t.isArrowFunctionExpression(setupCloned)) {
        newSetupCloned = t.arrowFunctionExpression(
          setupCloned.params,
          rewrittenInner,
          setupCloned.async,
        );
      } else if (t.isFunctionExpression(setupCloned)) {
        newSetupCloned = t.functionExpression(
          setupCloned.id,
          setupCloned.params,
          t.isBlockStatement(rewrittenInner)
            ? rewrittenInner
            : t.blockStatement([t.returnStatement(rewrittenInner)]),
          setupCloned.generator ?? false,
          setupCloned.async ?? false,
        );
      } else {
        newSetupCloned = rewrittenInner;
      }
      rewrittenSetupByIdx.set(idx, newSetupCloned);

      if (cleanupCloned) {
        let cleanupBodyForRewrite: t.Expression | t.BlockStatement | null = null;
        if (t.isArrowFunctionExpression(cleanupCloned) || t.isFunctionExpression(cleanupCloned)) {
          cleanupBodyForRewrite = cleanupCloned.body;
        } else if (t.isExpression(cleanupCloned)) {
          cleanupBodyForRewrite = cleanupCloned;
        }
        if (cleanupBodyForRewrite) {
          const rewrittenCleanupInner = rewriteWatchedPropReads(
            cleanupBodyForRewrite,
            localModel,
            localNonModel,
          );
          let newCleanupCloned: t.Expression;
          if (t.isArrowFunctionExpression(cleanupCloned)) {
            newCleanupCloned = t.arrowFunctionExpression(
              cleanupCloned.params,
              rewrittenCleanupInner,
              cleanupCloned.async,
            );
          } else if (t.isFunctionExpression(cleanupCloned)) {
            newCleanupCloned = t.functionExpression(
              cleanupCloned.id,
              cleanupCloned.params,
              t.isBlockStatement(rewrittenCleanupInner)
                ? rewrittenCleanupInner
                : t.blockStatement([t.returnStatement(rewrittenCleanupInner)]),
              cleanupCloned.generator ?? false,
              cleanupCloned.async ?? false,
            );
          } else {
            newCleanupCloned = rewrittenCleanupInner as t.Expression;
          }
          rewrittenCleanupByIdx.set(idx, newCleanupCloned);
        }
      }
    });
  }

  // 5. Build hookSection.
  const hookLines: string[] = [];

  if (portalsEmit.hasPortals) {
    hookLines.push(portalsEmit.refDeclLine);
  }

  // 5.0. Defaults rebind for non-model props that declare a default. We rebind
  //     the function parameter `_props` to a new const `props` whose missing
  //     fields are filled from declared defaults. Model:true props are handled
  //     by useControllableState below; their defaults route through the
  //     `default<Name>` seed prop rather than this rebind. shell.ts uses the function
  //     parameter name `_props` whenever `propsDefaultsBlock` is non-empty.
  //
  // Phase 16 R1 / D-01 / D-02 — include `default: null` and all primitive
  // defaults (0 / '' / false). The prior `!t.isNullLiteral` filter dropped
  // null-default props so an empty consumer call read `undefined` (not the
  // declared `null`) — divergent from Vue/Angular. Null IS the declared
  // default; assigning null is the intended semantic. For factory defaults
  // (() => [] / () => ({})) emit a `useRef(() => (<factory>)()).current`
  // hoist line BEFORE the merged-`props` block so the cached value is
  // referenced by the coalesce. This is the D-02 once-per-instance contract
  // (matches Vue 3's withDefaults factory-default behavior). The previous
  // inline `(<factory>)()` form re-invoked the factory on every render,
  // breaking referential equality across renders.
  const defaultedNonModelProps = ir.props.filter(
    (p) => !p.isModel && p.defaultValue !== null,
  );
  let propsDefaultsBlock = '';
  if (defaultedNonModelProps.length > 0) {
    // Step 1 — for FACTORY defaults, emit `const __default<X> = useRef(() =>
    // (<factory>)()).current;` BEFORE the merged-`props` block. The ref's
    // initializer arg is invoked exactly once at mount time and the cached
    // value is reused across the instance's lifetime (D-02 once-per-instance).
    const factoryDefaultProps = defaultedNonModelProps.filter(
      (p) =>
        t.isArrowFunctionExpression(p.defaultValue!) ||
        t.isFunctionExpression(p.defaultValue!),
    );
    if (factoryDefaultProps.length > 0) {
      collectors.react.add('useState');
      for (const p of factoryDefaultProps) {
        const raw = genCode(p.defaultValue!);
        const cachedName = `__default${capitalize(p.name)}`;
        // `useState(() => factory())[0]` is the React-idiomatic once-per-
        // instance lazy-init pattern (React docs: "If you pass a function to
        // useState, React will only call it during the initial render").
        // The setter is dropped because the cached value never changes.
        // useRef(() => factory()) would NOT work — useRef stores its first
        // arg verbatim (the factory function), not its invocation result.
        hookLines.push(
          `const ${cachedName} = useState(() => (${raw})())[0];`,
        );
      }
    }
    const defaultLines = defaultedNonModelProps.map((p) => {
      const isFactory =
        t.isArrowFunctionExpression(p.defaultValue!) ||
        t.isFunctionExpression(p.defaultValue!);
      let dflt: string;
      if (isFactory) {
        dflt = `__default${capitalize(p.name)}`;
      } else {
        // Primitive default — emit the literal expression in the coalesce
        // operand (null / 0 / '' / false / identifier / member expr / etc.).
        dflt = genCode(p.defaultValue!);
      }
      return `  ${p.name}: _props.${p.name} ?? ${dflt},`;
    });
    // 2026-05-18 — Override defaulted fields as REQUIRED in the merged `props`
    // type so downstream `props.step` reads don't fire TS18048 ("possibly
    // undefined"). The override narrows just the defaulted slots; other
    // fields keep the interface's optional-marker. Without this override, the
    // declared type was bare `${ir.name}Props` and TS treated `..._props` spread
    // as "still optional" → every `props.step + 1` arithmetic was an error.
    //
    // Phase 16 — for `default: null` props, widen the override type with
    // `| null` so the merged-props type accepts null as a legal value
    // (mirrors Svelte's `(${typeText}) | null` widening at svelte/
    // emit/emitScript.ts:232). Without this widening,
    // `{ a: ((...args)=>any) | null }` would fail to narrow from
    // `_props.a ?? null` for `((...args)=>any) | undefined` slots.
    //
    // Use `Omit<XProps, 'defaulted...'> & { ... }` rather than `XProps & { ... }`:
    // a plain intersection narrows to the COMMON subtype of the original
    // optional field and the override (`string | undefined` ∩ `string | null`
    // = `string`), which strips the `| null` widening and the coalesce write
    // `field: _props.field ?? null` fails to assign back. `Omit` cleanly
    // removes the original field type so the override stands alone.
    const defaultedNames = defaultedNonModelProps.map((p) => `'${p.name}'`);
    const requiredOverride = defaultedNonModelProps
      .map((p) => {
        const tsTypeForOverride = renderPropTypeForOverride(p);
        const widened = t.isNullLiteral(p.defaultValue!)
          ? `(${tsTypeForOverride}) | null`
          : tsTypeForOverride;
        return `${p.name}: ${widened}`;
      })
      .join('; ');
    const mergedType =
      `Omit<${ir.name}Props, ${defaultedNames.join(' | ')}> & { ${requiredOverride} }`;
    // Spread first so user-supplied values come through, then explicit
    // `X: _props.X ?? <default>` lines override any missing/undefined values
    // with the declared default.
    propsDefaultsBlock =
      `const props: ${mergedType} = {\n` +
      `  ..._props,\n` +
      `${defaultLines.join('\n')}\n` +
      `};`;
    hookLines.push(propsDefaultsBlock);
  }

  // Plan 14-05 — cross-framework attribute fallthrough rest binding. When
  // `inheritAttrs !== false`, synthesise `const { foo, ...attrs } = <propsParam>`
  // so the rewriteTemplateExpression `$attrs` Identifier rewrite (which lowers
  // `$attrs` → bare `attrs`, set up in Plan 14-03) resolves. Declared prop
  // names are listed explicitly so the rest bucket carries only consumer-
  // passed attributes the component did NOT declare. A `void name1, name2;`
  // line follows the destructure to suppress TS6133 (unused-locals) for the
  // declared names — the prop values are read via the existing `props.X` /
  // `_props.X` patterns set up above, NOT via these destructured locals
  // (which would collide with the upstream state hooks).
  //
  // `hasPropsDefaults` decides the parameter name: when at least one non-
  // model prop has a declared default, shell.ts renames the function param
  // from `props` to `_props` (the rebinder block creates `props` as the
  // merged object). Both expose every consumer-passed key — read from
  // whichever the shell named.
  //
  // Phase 14.1 follow-up — also synthesise when the template carries an
  // explicit `spreadBinding` (`r-bind="$attrs"`) even if `inherit-attrs="false"`
  // suppresses auto-fallthrough. The `$attrs` rewrite at
  // `rewriteTemplateExpression.ts:137` lowers the identifier to bare `attrs`;
  // without this destructure that reference dangles and React throws at
  // render, killing the whole tree. Mirrors the Lit fix at
  // `emitLit.ts:160` (same gate-widening for the explicit-manual case).
  // Phase 15 D-19 gate widening — also trigger the `attrs` IIFE when the
  // template references `$listeners` (synthesized auto-fallthrough OR
  // explicit `r-on="$listeners"`). React lowers `$listeners` to bare
  // `attrs` at template-expression rewrite time, so the IIFE must emit
  // even when `inherit-attrs="false"` AND no `r-bind="$attrs"` — without
  // this widening the lowered `attrs` reference would dangle and tsc
  // reports TS2304 (Cannot find name 'attrs').
  if (
    ir.inheritAttrs !== false ||
    templateUsesSpreadBinding(ir.template) ||
    ir.inheritListeners !== false ||
    templateUsesListenersSpread(ir.template)
  ) {
    const propsParam = defaultedNonModelProps.length > 0 ? '_props' : 'props';
    // `declaredNames` reads ONLY from `ir.props` — `ir.emits` does not enter
    // the destructure list. When `ir.props.length === 0` the destructure is
    // empty regardless of `ir.emits.length`; previously the guard
    // `ir.props.length === 0 && ir.emits.length === 0` would emit
    // `const { , ...rest } = ...` + `void ;` (both JS syntax errors) for a
    // no-`<props>` + `$emit(...)` component. Compute the declared-names list
    // first, then route on its emptiness — covering both no-props/no-emits
    // and no-props/with-emits via the same simple path. (CR-01)
    const declaredNames = [
      ...ir.props.map((p) => p.name),
      // model: true props add `defaultValue` + `onValueChange` consumer-side
      // (useControllableState convention) — strip both so they never leak
      // into the rest bucket. The model prop name itself (`value`) is in
      // declaredNames already.
      ...ir.props.flatMap((p) =>
        p.isModel
          ? [
              'defaultValue',
              `on${p.name[0]!.toUpperCase()}${p.name.slice(1)}Change`,
              // Some model props use `default<Name>` (e.g. `defaultItems` for `items` model);
              `default${p.name[0]!.toUpperCase()}${p.name.slice(1)}`,
            ]
          : [],
      ),
    ];
    const declaredNamesUnique = Array.from(new Set(declaredNames));
    if (declaredNamesUnique.length === 0) {
      // No declared prop surface — every key on the param is a fallthrough
      // attribute. (Includes the `ir.props.length === 0 && ir.emits.length > 0`
      // case that previously fell into the IIFE branch and emitted invalid
      // empty-destructure / empty-void code.)
      hookLines.push(
        `const attrs = ${propsParam} as Record<string, unknown>;`,
      );
    } else {
      // Wrap the destructure in an IIFE so the destructured prop locals are
      // scoped inside the IIFE — otherwise a declared prop name collides with
      // an outer state hook (`const items` clashes with
      // `const [items, setItems] = useControllableState(...)`). The IIFE
      // returns ONLY the rest bucket; outer `attrs` carries no inner locals.
      const propNameList = declaredNamesUnique.join(', ');
      // TypeScript flags unused destructured locals (TS6133) under strict
      // settings; the IIFE wrapper plus `void` short-circuits also silences
      // them. We use a single statement chain since the IIFE only returns
      // the rest bucket.
      hookLines.push(
        `const attrs: Record<string, unknown> = (() => {\n` +
          `  const { ${propNameList}, ...rest } = ${propsParam} as ${ir.name}Props & Record<string, unknown>;\n` +
          `  void ${declaredNamesUnique.join('; void ')};\n` +
          `  return rest;\n` +
          `})();`,
      );
    }
  }


  // 5a-bis. Portal-slot stable-renderer refs (Spike 003 FullCalendar React fix).
  //
  // For each portal slot, emit two lines:
  //   const _render<Pascal>Ref = useRef(props.render<Pascal>);
  //   _render<Pascal>Ref.current = props.render<Pascal>;
  //
  // The mount-phase useEffect's portal closure (emitPortals.closureBlock)
  // reads `_render<Pascal>Ref.current` instead of `props.render<Pascal>`,
  // and the slot SignalRef is filtered out of the useEffect dep array below.
  // Without this indirection, a consumer passing a fresh-arrow
  // `renderEvent={({ arg }) => <span>...</span>}` would trigger useEffect
  // cleanup → setup on every consumer render, unmounting just-scheduled-
  // but-not-yet-committed `createRoot(node).render(...)` calls and leaving
  // engine-owned portal containers empty (FullCalendar VR `react` cell).
  //
  // The during-render `ref.current = props.X` assignment is the canonical
  // React 18 idiom for "stable handler / mutable value" — see useEffectEvent
  // RFC + React 18 useRef docs. It's safe here because the assignment is
  // idempotent (same prop → same value) and the ref isn't a DOM ref.
  if (portalsEmit.hasPortals && portalsEmit.rendererRefLines.length > 0) {
    hookLines.push(portalsEmit.rendererRefLines);
  }

  // 5a. Hoisted useRef declarations (one per hoist instruction).
  //     `h.tsType` carries the explicit type argument when typeNeutralizeScript
  //     annotated the source `let` declarator (a null/undefined-initialised
  //     module-let — the engine-wrapper pattern). Bare `useRef(null)` infers
  //     `RefObject<null>`, so the engine assignment would be TS2322;
  //     `useRef<any>(null)` keeps `.current` assignable.
  for (const h of hoistResult.hoisted) {
    const typeArg = h.tsType ? `<${h.tsType}>` : '';
    hookLines.push(`const ${h.name} = useRef${typeArg}(${genCode(h.initialExpr)});`);
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
      // 260521-oao — a no-default model prop (notably a `required: true`
      // model prop) has no author `default:`. `useControllableState`'s
      // `defaultValue` option is typed `T` (non-optional), so a bare
      // `undefined` fails tsc. Seed the uncontrolled-mode fallback with the
      // builtin zero-value for the prop's type (matching Lit's `renderDefault`
      // fallback and Dropdown's explicit `false`). For a required model prop
      // `value` is always present so the hook is always controlled and this
      // seed is never observed; for an optional no-default model prop it is a
      // sound uncontrolled-mode initial value.
      dflt = zeroValueFor(p.typeAnnotation);
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
    // D-84 model:true triplet — the public seed prop is keyed to the model
    // name (`default${Pascal}`: defaultValue / defaultOpen / defaultItems),
    // matching emitTypes.ts's `.d.ts` emission and Radix's `defaultOpen` /
    // `defaultChecked` convention. The `useControllableState` OPTION key stays
    // `defaultValue` — that's the runtime hook's own API, not the public prop.
    hookLines.push(
      `const [${p.name}, ${setterName}] = useControllableState({\n` +
        `  value: props.${p.name},\n` +
        `  defaultValue: props.default${capitalize(p.name)} ?? ${dflt},\n` +
        `  onValueChange: props.on${capitalize(p.name)}Change,\n` +
        `});`,
    );
  }

  // 5b-bis. Plan 07.7 follow-up — watched-prop / mount-state stable refs.
  //
  // For each prop X that has a sibling `$watch(() => $props.X, ...)` AND is
  // actually read from a lifecycle hook body — OR (260521 sortable-stale-state)
  // each reactive state/model value read from a MOUNT-phase hook body —
  // emit:
  //   const _<X>Ref = useRef(<reactIdent>);
  //   _<X>Ref.current = <reactIdent>;
  //
  // The lifecycle body's `<reactIdent>` reads were rewritten to
  // `_<X>Ref.current` by the same pre-compute pass, so (for watched props) the
  // useEffect dep array drops the watched prop without tripping
  // `react-hooks/exhaustive-deps`, and (for mount-state reads) a closure
  // created in the `[]`-dep mount effect reads the LATEST value via `.current`
  // instead of the frozen first-render destructured const. The watcher /
  // React state owns reactive updates; the synced `_<X>Ref.current = <X>`
  // assignment during render keeps the ref live.
  //
  // ORDERING — a ref decl `useRef(<reactIdent>)` references the bound binding,
  // so it MUST be emitted AFTER that binding's declaration:
  //   - non-model props  → `props.<X>` is always in scope → emit here.
  //   - model props      → `useControllableState` (section 5b above) → emit here.
  //   - `ir.state` names → `useState` (section 5c BELOW) → DEFERRED to 5c-bis,
  //                        else `const _<X>Ref = useRef(<X>)` would hit the
  //                        not-yet-declared `useState` const (TDZ at render).
  // `actuallyRewrittenModelProps` carries both watched model props and
  // mount-state model/`ir.state` reads; we partition `ir.state` names out so
  // they emit after section 5c.
  //
  // Sorting (alphabetical) keeps the emit deterministic across runs
  // for snapshot stability.
  const stateDeclNames = new Set(ir.state.map((s) => s.name));
  const deferredStateRefNames: string[] = [];
  {
    const sortedModelRefs = [...actuallyRewrittenModelProps].sort();
    const sortedNonModelRefs = [...actuallyRewrittenNonModelProps].sort();
    for (const name of sortedNonModelRefs) {
      collectors.react.add('useRef');
      hookLines.push(
        `const _${name}Ref = useRef(props.${name});\n` +
          `_${name}Ref.current = props.${name};`,
      );
    }
    for (const name of sortedModelRefs) {
      // `ir.state` names lower to `useState` (section 5c) which is declared
      // AFTER this block — defer their ref decls to section 5c-bis.
      if (stateDeclNames.has(name)) {
        deferredStateRefNames.push(name);
        continue;
      }
      collectors.react.add('useRef');
      hookLines.push(
        `const _${name}Ref = useRef(${name});\n` +
          `_${name}Ref.current = ${name};`,
      );
    }
  }

  // 5c. useState for each StateDecl.
  for (const s of ir.state) {
    collectors.react.add('useState');
    const setterName = 'set' + capitalize(s.name);
    // Quick task 260520-w18 bug class 2 — an empty-array `<data>` initializer
    // (`files: []`) types as `useState<never[]>([])`, so `files.map(f => f.id)`
    // fails TS2339 ("Property 'id' does not exist on type 'never'"). Engine
    // wrappers routinely seed a `$data` array empty and let the engine
    // populate it. Annotate the empty-array literal case as `any[]`.
    //
    // Phase 16-04 — a `<data>` initializer of `null` types as `useState<null>`,
    // so a later `setX(<number>)` fails TS2345. The SortableList keyboard
    // re-land uses `liftedIndex: null` and writes `liftedIndex.set(index)`
    // where `index` is a number. Same widening intent as Angular's
    // `signal<any>(null)` (Plan 16-01) — annotate the bare-null case as `any`.
    let stateTypeArg = '';
    if (t.isArrayExpression(s.initializer) && s.initializer.elements.length === 0) {
      stateTypeArg = '<any[]>';
    } else if (t.isNullLiteral(s.initializer)) {
      stateTypeArg = '<any>';
    }
    hookLines.push(
      `const [${s.name}, ${setterName}] = useState${stateTypeArg}(${genCode(s.initializer)});`,
    );
  }

  // 5c-bis. 260521 sortable-stale-state — synced refs for `ir.state` names
  // read from a mount-phase hook body, deferred from section 5b-bis so they
  // land AFTER the `useState` declarations they reference (avoids a TDZ
  // ReferenceError at render — see the 5b-bis ORDERING note). Same shape as
  // the model-prop refs: `const _<X>Ref = useRef(<X>); _<X>Ref.current = <X>;`.
  for (const name of deferredStateRefNames.sort()) {
    collectors.react.add('useRef');
    hookLines.push(
      `const _${name}Ref = useRef(${name});\n` +
        `_${name}Ref.current = ${name};`,
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
      case 'canvas':
        domType = 'HTMLCanvasElement';
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
    const depsArr = renderDepArray(c.deps, modelProps);
    // arrowBody handles BlockStatement vs Expression bodies (incl. the
    // ObjectExpression paren-wrap case) by building the arrow as an AST node.
    hookLines.push(`const ${c.name} = useMemo(${arrowBody(body)}, ${depsArr});`);
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

  // Pre-scan ALL top-level helpers (arrow + function decl) so the
  // `computeHelperBodyDeps` walk knows which identifiers are sibling helpers
  // (and should be classified as `closure` deps, not unknown identifiers).
  //
  // 260519 linechart-watch-recreate Round 4 — this pre-scan was previously
  // built in section 6b (AFTER the lifecycle + watcher loops). It is hoisted
  // here so the watcher loop's callback-body walk can consult it when deciding
  // whether to emit the targeted `react-hooks/exhaustive-deps` disable
  // directive (see the per-watcher block below).
  const allHelperNames = new Set<string>();
  // Build helper-name -> declaration-location map for the ROZ524 diagnostic.
  const helperLocByName = new Map<string, { start: number; end: number }>();
  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
    // Quick plan 260515-u2b - $watch lines were emitted as useEffects.
    if (watcherPairing.consumedIndices.has(i)) continue;
    const stmt = cloned.program.body[i]!;
    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      allHelperNames.add(stmt.id.name);
      if (stmt.id.loc) {
        helperLocByName.set(stmt.id.name, {
          start: stmt.id.loc.start.index ?? 0,
          end: stmt.id.loc.end.index ?? 0,
        });
      }
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
          if (d.id.loc) {
            helperLocByName.set(d.id.name, {
              start: d.id.loc.start.index ?? 0,
              end: d.id.loc.end.index ?? 0,
            });
          }
        }
      }
    }
  }

  const lifecycleEffectLines: string[] = [];
  // Portal-slot primitive (Spike 003) — inject the portals closure into the
  // FIRST mount-phase lifecycle hook. The closure depends on `portalRoots`
  // (hoisted in hookLines) and `props`, both in scope at useEffect-body
  // position. Same hook gets the bulk-dispose prepended to its cleanup.
  let portalsInjected = false;
  ir.lifecycle.forEach((lh, idx) => {
    collectors.react.add('useEffect');
    const paired = lifecyclePairing.perHook[idx];

    // Bug #15 fix (260519 react-watch-onunmount-emit) — a STANDALONE
    // `$onUnmount(fn)` (one not paired with a preceding `$onMount`) is a
    // cleanup-only lifecycle hook: `fn` must run on UNMOUNT. The IR carries
    // its body in `lh.setup` with `lh.phase === 'unmount'`. The general path
    // below treats `lh.setup` as the useEffect SETUP body — which runs on
    // MOUNT — so a lone `$onUnmount` previously mis-lowered to
    // `useEffect(() => { fn(); }, [fn])` (fires on mount). The correct React
    // shape is `useEffect(() => () => { fn(); }, [])`: an empty setup that
    // RETURNS the body as the cleanup, with `[]` deps so it registers once
    // and fires exactly once on unmount. This matches the five sibling
    // targets (Vue `onBeforeUnmount(fn)`, Svelte/Solid `onMount` return,
    // Angular `DestroyRef`, Lit `disconnectedCallback`).
    if (lh.phase === 'unmount') {
      const unmountCloned = paired?.setupCloned ?? lh.setup;
      let unmountBody: string;
      if (t.isIdentifier(unmountCloned)) {
        unmountBody = `${unmountCloned.name}();`;
      } else if (
        t.isArrowFunctionExpression(unmountCloned) ||
        t.isFunctionExpression(unmountCloned)
      ) {
        const fnBody = unmountCloned.body;
        if (t.isBlockStatement(fnBody)) {
          unmountBody = genBlockInner(fnBody, '    ');
        } else {
          unmountBody = genCode(fnBody) + ';';
        }
      } else {
        unmountBody = genCode(unmountCloned) + ';';
      }
      lifecycleEffectLines.push(
        `useEffect(() => {\n  return () => {\n    ${unmountBody}\n  };\n}, []);`,
      );
      return;
    }

    // Use the rewritten setup/cleanup bodies (watched-prop reads replaced
    // with `_<X>Ref.current`) when the pre-compute pass produced them.
    // Falls back to the un-rewritten paired clone otherwise.
    const setupCloned = rewrittenSetupByIdx.get(idx) ?? paired?.setupCloned ?? lh.setup;
    const cleanupCloned = rewrittenCleanupByIdx.get(idx) ?? paired?.cleanupCloned ?? null;
    // Filter SignalRefs out of the mount-phase useEffect dep array when
    // keeping them would re-fire the engine-mount cleanup+setup loop on
    // every consumer render:
    //
    //   1. Portal-slot renderer SignalRefs (`{ scope: 'slots', path: [<portalName>] }`)
    //      — the portal closure reads the latest renderer via
    //      `_render<Pascal>Ref.current` (Spike 003 FullCalendar React fix).
    //      Per V1 portal-slot constraint (REQ-5): portal slots are NOT
    //      reactive after mount.
    //
    //   2. Watched-prop SignalRefs (`{ scope: 'props', path: [X] }` where
    //      a sibling `$watch(() => $props.X, ...)` exists AND X was
    //      actually read from this hook's body). The body's reads were
    //      already rewritten to `_<X>Ref.current` by the pre-compute pass,
    //      so the dep can drop `props.<X>` / `<X>` without tripping
    //      `react-hooks/exhaustive-deps` (D-62 floor: no eslint-disable).
    //
    // Non-portal slots never appear in `setupDeps` (their content lives
    // in the template, not the lifecycle hook body), so the slot filter
    // doesn't disturb general code paths.
    const filteredSetupDeps = lh.setupDeps.filter((d) => {
      if (
        d.scope === 'slots' &&
        d.path.length > 0 &&
        portalsEmit.portalSlotNames.has(d.path[0]!)
      ) {
        return false;
      }
      if (
        d.scope === 'props' &&
        d.path.length > 0 &&
        (
          actuallyRewrittenModelProps.has(d.path[0]!) ||
          actuallyRewrittenNonModelProps.has(d.path[0]!)
        )
      ) {
        return false;
      }
      return true;
    });
    // Bug B fix (260519 linechart-watch-recreate) — a MOUNT-phase lifecycle
    // hook runs exactly ONCE by contract. The other five targets honour this
    // structurally: Vue `onMounted`, Svelte `onMount`, Solid `onMount`, Lit
    // `firstUpdated`, Angular `ngAfterViewInit` all run once regardless of
    // what reactive values their body reads. React's useEffect has no such
    // primitive — re-run is governed entirely by the dep array — so a mount
    // hook MUST emit `[]`. Any non-empty dep array makes the hook re-run on a
    // consumer render, which (for engine-wrapper components like LineChart)
    // destroys + recreates the engine instance every tick.
    //
    // `filteredSetupDeps` is correct for $onUpdate (update-phase re-runs on
    // dependency change) but wrong for $onMount: the closure deps it carries
    // (`Chart` import, `buildConfig` helper, the `instance` let) are setup
    // ingredients, not subscription sources. Reconciliation of post-mount
    // prop changes is owned by the sibling $watch hooks, never the mount
    // useEffect. So: mount → `[]`; update → keep the computed deps.
    const depsArr =
      lh.phase === 'mount' ? '[]' : renderDepArray(filteredSetupDeps, modelProps);
    const injectPortalsHere =
      portalsEmit.hasPortals && !portalsInjected && lh.phase === 'mount';
    if (injectPortalsHere) portalsInjected = true;

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
        // already provides its own block. Generated as ONE block so
        // @babel/generator de-dups comments across statement boundaries.
        setupInvocation = genBlockInner(fnBody, '  ');
      } else {
        setupInvocation = genCode(fnBody) + ';';
      }
    } else {
      setupInvocation = genCode(setupCloned) + ';';
    }

    if (injectPortalsHere) {
      // Prepend the `const portals = { ... };` closure to the setup body so
      // user code's rewritten `portals.<name>(...)` references resolve.
      setupInvocation = portalsEmit.closureBlock + '\n  ' + setupInvocation;
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
          const innerStmts = genBlockInner(fnBody, '    ');
          const cleanupBody = injectPortalsHere
            ? portalsEmit.bulkDisposeBlock + '\n    ' + innerStmts
            : innerStmts;
          cleanupInvocation = `\n  return () => {\n    ${cleanupBody}\n  };`;
        } else {
          const cleanupBody = injectPortalsHere
            ? `{\n    ${portalsEmit.bulkDisposeBlock}\n    ${genCode(fnBody)};\n  }`
            : genCode(fnBody);
          cleanupInvocation = injectPortalsHere
            ? `\n  return () => ${cleanupBody};`
            : `\n  return () => ${cleanupBody};`;
        }
      } else {
        const inner = `(${genCode(cleanupCloned)})()`;
        if (injectPortalsHere) {
          cleanupInvocation = `\n  return () => {\n    ${portalsEmit.bulkDisposeBlock}\n    ${inner};\n  };`;
        } else {
          cleanupInvocation = `\n  return () => ${inner};`;
        }
      }
    } else if (injectPortalsHere) {
      // No user cleanup but portals need bulk-dispose — synthesize one.
      cleanupInvocation = `\n  return () => {\n    ${portalsEmit.bulkDisposeBlock}\n  };`;
    }

    // 260519 linechart-watch-recreate Round 4 — emit a TARGETED
    // `react-hooks/exhaustive-deps` disable on the dependency-array line of an
    // intentional mount-once useEffect. A mount hook emits `[]` by contract
    // (see the `depsArr` comment above); `exhaustive-deps` is a static lint
    // that cannot distinguish that intentional `[]` from a forgotten
    // dependency, so it flags every mount useEffect whose body reads a
    // closure helper / state var / prop. D-62 (relaxed for justified cases)
    // permits this rule-specific, idiomatic disable — it is exactly what a
    // careful React dev hand-writes for an intentional `[]`.
    //
    // PLACEMENT: `exhaustive-deps` reports on the dependency-array node, i.e.
    // the `}, [...]);` line. The directive is appended as a trailing
    // `eslint-disable-line` on that exact line so it suppresses the report.
    //
    // CONDITIONAL: eslint v9 flat config defaults `reportUnusedDisableDirectives`
    // to `warn`, so a directive on a non-violating effect (an empty-body mount
    // useEffect, or one that only reads stable refs) becomes an unused-directive
    // warning that re-fails the strict gate. `filteredSetupDeps` is non-empty
    // only when the body reads a flagged binding (closure / props / data /
    // computed — refs are already excluded per D-21b), so it is the exact
    // proxy for "this `[]` mount effect actually trips the rule".
    //
    // PREDICATE PRECISION: `filteredSetupDeps` non-empty is NOT a sufficient
    // proxy on its own. The IR's dep analysis classifies a bare global
    // (`console`, `window`, ...) read inside the hook body as a `closure`
    // SignalRef — but `exhaustive-deps` knows globals are stable and does NOT
    // flag them. A directive emitted for a body that reads ONLY globals would
    // become an unused-directive warning. So a setup dep counts as
    // lint-flaggable only when it is a genuine reactive binding:
    //   - props / data / computed / slots — always real reactive reads;
    //   - closure — real ONLY when the identifier is a top-level helper
    //     (`allHelperNames`); those get a `useCallback` wrap (section 6a) and
    //     thus an unstable identity the rule flags. A `closure` ref whose
    //     identifier is NOT a known helper is a mis-tagged global — skip it.
    const mountHasFlaggableDep = filteredSetupDeps.some((d) =>
      d.scope === 'closure' ? allHelperNames.has(d.identifier) : true,
    );
    const mountNeedsDisable = lh.phase === 'mount' && mountHasFlaggableDep;
    if (mountNeedsDisable) {
      lifecycleEffectLines.push(
        `useEffect(() => {\n  ${setupInvocation}${cleanupInvocation}\n}, ${depsArr}); // eslint-disable-line react-hooks/exhaustive-deps`,
      );
    } else {
      lifecycleEffectLines.push(
        `useEffect(() => {\n  ${setupInvocation}${cleanupInvocation}\n}, ${depsArr});`,
      );
    }
  });

  // Quick plan 260515-u2b — emit one useEffect per WatchHook.
  //
  // Bug B fix (260519 linechart-watch-recreate) — the dep array is the
  // WatchHook's GETTER deps only (see the per-watcher block below). The
  // previous implementation also walked the callback body via
  // computeHelperBodyDeps and unioned those deps to satisfy
  // `react-hooks/exhaustive-deps`; that pulled the unstable `buildConfig`
  // useCallback identity into the `type`-watcher array and re-fired the
  // engine recreation every data tick. The watcher-fires-on-getter contract
  // (shared by all six targets) is the correctness invariant, so the
  // callback-body walk is gone.
  ir.watchers.forEach((wh, idx) => {
    collectors.react.add('useEffect');
    const paired = watcherPairing.perWatcher[idx];
    // `callbackCloned` is the post-rewrite callback body (BlockStatement or
    // Expression). Inline its statements directly into the useEffect callback.
    const cbCloned = paired?.callbackCloned ?? wh.callback;
    let cbInvocation: string;
    if (t.isBlockStatement(cbCloned)) {
      cbInvocation = genBlockInner(cbCloned, '  ');
    } else {
      // Concise arrow body — emit as an expression statement.
      cbInvocation = `${genCode(cbCloned)};`;
    }

    // Bind the callback's first parameter (the new-value position) to the
    // getter expression so source like `$watch(() => $props.x, v => ... v)`
    // lowers to `useEffect(() => { const v = props.x; ... v }, [props.x])`.
    // useEffect callbacks don't receive args, so without this binding the
    // identifier `v` would resolve to nothing — body silently passes undefined.
    //
    // Bug #14 fix (260519 react-watch-onunmount-emit) — SKIP the rebind when
    // the rendered getter expression is textually IDENTICAL to the param name.
    // `$watch(() => $data.open, (open) => …)` rewrites the getter `$data.open`
    // to the bare React-side identifier `open` (the `useState`/`useMemo`
    // binding); the param is also named `open`. Emitting `const open = open;`
    // is a self-referential declaration — the RHS `open` resolves to the
    // not-yet-initialised `const open` (TDZ), throwing
    // `ReferenceError: Cannot access 'open' before initialization` at render.
    // When the getter already IS the param identifier the rebind is a pure
    // no-op: the callback body's reads of `open` resolve straight to the outer
    // hook binding, which holds exactly the watched value. So we drop it.
    const cbParams = paired?.callbackParams ?? [];
    const firstParam = cbParams[0];
    const renderedGetter = renderGetterExpression(paired?.getterCloned ?? wh.getter);
    const paramBinding =
      firstParam &&
      t.isIdentifier(firstParam) &&
      renderedGetter !== firstParam.name
        ? `const ${firstParam.name} = ${renderedGetter};\n  `
        : '';

    // Bug B fix (260519 linechart-watch-recreate) — the watcher useEffect's
    // dep array is the GETTER's deps ONLY. A $watch re-runs when its WATCHED
    // expression changes; this is the contract on every other target —
    // Vue `watch(getter, cb)`, Svelte/Solid untrack-wrapped callbacks, Lit
    // `changedProperties`-gated `updated()`. The callback BODY's reads are
    // NOT subscription sources: they're consequences of the watcher firing.
    //
    // The previous code unioned `computeHelperBodyDeps(callback)` into the
    // dep array to satisfy `react-hooks/exhaustive-deps`. But that pulled
    // unstable identities into the array — LineChart's `type` watcher
    // callback calls `buildConfig()`, a `useCallback` keyed on
    // `[props.data, props.options, props.type]`, so its identity changes
    // every data tick. Listing it made the `type` watcher re-fire (and
    // recreate the Chart.js instance) on every data change. The exhaustive-
    // deps rule is advisory tooling; the watcher-fires-on-getter contract is
    // the correctness invariant — and it matches the five sibling targets.
    const depsArr = renderDepArray(wh.getterDeps, modelProps);

    // 260519 linechart-watch-recreate Round 4 — emit a TARGETED
    // `react-hooks/exhaustive-deps` disable on the watcher useEffect's
    // dependency-array line WHEN (and only when) the callback body reads a
    // binding beyond the getter's deps. The watcher's dep array is the
    // getter's deps ONLY (the watcher-fires-on-getter contract above); the
    // callback body's reads are consequences of the watcher firing, not
    // subscription sources. `exhaustive-deps` cannot know that, so it flags
    // any callback-body read missing from `depsArr`.
    //
    // CONDITIONAL: `computeHelperBodyDeps` (the pre-Bug-B helper that the dep
    // array used to union in) computes exactly the set of bindings the
    // callback body reads. If every one of those is already covered by
    // `wh.getterDeps`, the effect does not trip the rule and a directive
    // would become an unused-directive warning — so emit it only for the
    // genuine over-read case. Refs / stable identifiers are excluded by
    // `computeHelperBodyDeps` itself (D-21b), so a callback that only touches
    // refs correctly gets no directive.
    const getterDepKeys = new Set(
      wh.getterDeps.map((d) =>
        d.scope === 'closure'
          ? `closure::${d.identifier}`
          : `${d.scope}::${d.path.join('.')}`,
      ),
    );
    const callbackBodyDeps = computeHelperBodyDeps(
      cbCloned,
      ir,
      allHelperNames,
      '',
    );
    const watcherNeedsDisable = callbackBodyDeps.some((d) => {
      const key =
        d.scope === 'closure'
          ? `closure::${d.identifier}`
          : `${d.scope}::${d.path.join('.')}`;
      return !getterDepKeys.has(key);
    });
    // 260602-9lw — `$watch` is now LAZY by default on all six targets (REVERSES
    // the 260519 immediate-by-default contract). `useEffect` fires on mount, so
    // for the default (`!wh.immediate`) we hoist a stable `useRef(true)` skip
    // flag and bail out of the effect body on the first run — the callback then
    // fires only on subsequent re-runs (driven by `depsArr` reference-`!==`
    // changes). `{ immediate: true }` keeps today's eager shape (no guard).
    //
    // The skip ref is a `useRef` (stable identity) and is read ONLY inside the
    // body — it MUST NOT enter `depsArr` (exhaustive-deps exempts refs), and the
    // body read does not change `callbackBodyDeps` (computed from `cbCloned`
    // above, before this guard is prepended), so `watcherNeedsDisable` is
    // unaffected.
    let effectBody = `${paramBinding}${cbInvocation}`;
    if (!wh.immediate) {
      collectors.react.add('useRef');
      const firstRefName = `_watch${idx}First`;
      hookLines.push(`const ${firstRefName} = useRef(true);`);
      effectBody = `if (${firstRefName}.current) { ${firstRefName}.current = false; return; }\n  ${effectBody}`;
    }
    if (watcherNeedsDisable) {
      lifecycleEffectLines.push(
        `useEffect(() => {\n  ${effectBody}\n}, ${depsArr}); // eslint-disable-line react-hooks/exhaustive-deps`,
      );
    } else {
      lifecycleEffectLines.push(
        `useEffect(() => {\n  ${effectBody}\n}, ${depsArr});`,
      );
    }
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

  // 6a'. Phase 35 follow-up (feedback_react_const_mutinstance_not_stabilized) —
  // collect top-level fresh-instance const/let binders that are member-mutated
  // (cross-render scratch state, e.g. CodeMirrorDemo's `const gutterSeen = new
  // Set()` dedupe guard). These must persist per-instance like the setup-once
  // targets; without stabilization React re-creates them every render and the
  // guard resets → render side-effects re-fire → infinite re-render → VR hang.
  const mutatedInstanceNames = collectMutatedInstanceBinders(cloned);

  // 6b. Helper-name pre-scan (`allHelperNames` / `helperLocByName`) is built
  // earlier — hoisted above the lifecycle + watcher loops in Round 4 of
  // 260519 linechart-watch-recreate so the watcher loop's callback-body walk
  // can consult it. See the pre-scan block before `lifecycleEffectLines`.

  // Phase 07.7 — ROZ524 collision detection. React auto-generates `set<Cap>`
  // setters for every state / model-prop via `useState` / `useControllableState`
  // destructure. If the user authors a top-level helper with the same name
  // (e.g. `const setView = (v) => { $data.view = v }` when `view` is a model
  // prop), the emitted code has TWO `setView` bindings — useState's destructure
  // AND the user's const — producing "Identifier 'setView' has already been
  // declared". Worse, the user's body `$data.view = v` rewrites to `setView(v)`
  // which then targets the user's own wrapper → infinite recursion. Detect at
  // compile time; emit ROZ524; user must rename. Surfaced by FullCalendarDemo's
  // `setView` wrapper for `view: { model: true }`.
  const autoSetters = new Set<string>();
  for (const p of ir.props) {
    if (p.isModel) autoSetters.add('set' + capitalize(p.name));
  }
  for (const s of ir.state) {
    autoSetters.add('set' + capitalize(s.name));
  }
  for (const name of allHelperNames) {
    if (autoSetters.has(name)) {
      const loc = helperLocByName.get(name);
      diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_SETTER_NAME_COLLISION,
        severity: 'error',
        message:
          `User-defined function '${name}' collides with the React auto-generated setter for the same-named state/model prop. ` +
          `React's \`useState\` / \`useControllableState\` destructure binds '${name}' from the IR's state/model props, ` +
          `and a top-level user helper with the same identifier produces "Identifier '${name}' has already been declared" at runtime, ` +
          `plus the user's body rewrite ('$data.${name.slice(3, 4).toLowerCase()}${name.slice(4)} = v' → '${name}(v)') becomes infinite recursion. ` +
          `Rename the user function — e.g. '${name}' → 'select${name.slice(3)}'.`,
        loc: loc ? { start: loc.start, end: loc.end } : { start: 0, end: 0 },
      });
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
      // Phase 21 ($expose) — the top-level `$expose({...})` call is a compiler
      // directive, not runtime code: its contract is lowered into `ir.expose`
      // and re-emitted as the React `useImperativeHandle` handle. Strip the raw
      // call from the body so it never reaches the output (a bare `$expose(...)`
      // would be an undefined-identifier ReferenceError at runtime).
      if (t.isIdentifier(callee) && callee.name === '$expose') {
        continue;
      }
    }

    // Phase 35 follow-up — member-mutated fresh-instance binder → useMemo(()=>init,[]).
    // Runs FIRST so a binder that is BOTH escaping and mutated gets the stable
    // `[]` identity (cross-render mutable state must never be re-created),
    // rather than the reactive-deps `[...]` from tryWrapEscapingConstUseMemo.
    const mutMemoWrapped = tryWrapMutatedInstanceUseMemo(
      stmt,
      mutatedInstanceNames,
      collectors,
    );
    if (mutMemoWrapped) {
      userArrowsLines.push(mutMemoWrapped);
      // String output (like the other wraps) — excluded from mappableStmts.
      continue;
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

    // Plan 07.7 follow-up — non-function const escapees → useMemo wrap.
    // Handles patterns like `const PLUGINS = [dayGridPlugin, ...]` referenced
    // from `$onMount` body: without stable identity, every consumer render
    // produces a fresh array → mount-phase useEffect dep change → engine
    // destroy + recreate cycle → portal trees unmounted before commit.
    const memoWrapped = tryWrapEscapingConstUseMemo(
      stmt,
      escapingHelperNames,
      ir,
      allHelperNames,
      collectors,
    );
    if (memoWrapped) {
      userArrowsLines.push(memoWrapped);
      // Same source-map exclusion rationale as the useCallback wrap above.
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
    hasPortals: portalsEmit.hasPortals,
    hookSection,
    userArrowsSection,
    userImports,
    hoistedTypeDecls,
    lifecycleEffectsSection,
    hasPropsDefaults: defaultedNonModelProps.length > 0,
    hookSectionLines,
    scriptMap,
    diagnostics,
  };
}
