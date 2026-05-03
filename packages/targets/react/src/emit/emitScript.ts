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
import type { GeneratorOptions } from '@babel/generator';
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

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

function genCode(node: t.Node): string {
  return generate(node, GEN_OPTS).code;
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

export interface EmitScriptResult {
  /** React hook declarations: useRef hoists + useControllableState + useState + useRef + useMemo + useEffect. Comes FIRST. */
  hookSection: string;
  /** User-authored top-level arrows / helpers / console.log preserved verbatim from <script>. */
  userArrowsSection: string;
  diagnostics: Diagnostic[];
}

export interface EmitScriptCollectors {
  react: ReactImportCollector;
  runtime: RuntimeReactImportCollector;
}

export function emitScript(
  ir: IRComponent,
  collectors: EmitScriptCollectors,
): EmitScriptResult {
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

  // 5. Build hookSection.
  const hookLines: string[] = [];

  // 5a. Hoisted useRef declarations (one per hoist instruction).
  for (const h of hoistResult.hoisted) {
    hookLines.push(`const ${h.name} = useRef(${genCode(h.initialExpr)});`);
  }

  // 5b. useControllableState for each model:true prop.
  for (const p of ir.props) {
    if (!p.isModel) continue;
    collectors.runtime.add('useControllableState');
    const setterName = 'set' + capitalize(p.name);
    const dflt = p.defaultValue !== null ? genCode(p.defaultValue) : 'undefined';
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

  // 5f. useEffect for each paired LifecycleHook.
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

    hookLines.push(
      `useEffect(() => {\n  ${setupInvocation}${cleanupInvocation}\n}, ${depsArr});`,
    );
  });

  const hookSection = hookLines.join('\n');

  // 6. Build userArrowsSection — top-level user-authored arrows / helpers /
  //    console.log preserved verbatim. Skip:
  //    - VariableDeclarations whose ALL declarators are $computed initializers
  //      (consumed by useMemo above)
  //    - Lifecycle ExpressionStatements (consumed via lifecyclePairing)
  const userArrowsLines: string[] = [];
  for (let i = 0; i < cloned.program.body.length; i++) {
    if (lifecyclePairing.consumedIndices.has(i)) continue;
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
          callee.name === '$onUpdate')
      ) {
        // Safety net — should already have been consumed by lifecyclePairing.
        continue;
      }
    }
    userArrowsLines.push(genCode(stmt));
  }
  const userArrowsSection = userArrowsLines.join('\n');

  return { hookSection, userArrowsSection, diagnostics };
}
