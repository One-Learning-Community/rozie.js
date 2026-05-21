/**
 * emitScript — Solid target (P1 minimal implementation).
 *
 * Produces the body of the Solid functional component above the `return ( <JSX> );`.
 * P1 maps the IR's state/computed/lifecycle primitives to Solid equivalents.
 * P2 will add full $data/$props/$refs/$emit rewriting via @babel/traverse.
 *
 * Result shape mirrors React's EmitScriptResult but drops `lifecycleEffectsSection`
 * and `hasPropsDefaults` (Solid always uses splitProps; lifecycle goes inline).
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { SolidImportCollector, RuntimeSolidImportCollector } from '../rewrite/collectSolidImports.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import { rewriteRozieIdentifiers, rewriteRozieExpressionNode as rewriteNode } from '../rewrite/rewriteScript.js';
import { emitPortals } from './emitPortals.js';
import { renderType } from './emitPropsInterface.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = {
  retainLines: false,
  compact: false,
  sourceMaps: false,
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
 * Emit `() => body` for an Expression or BlockStatement body.
 *
 * Building the arrow as a Babel node (rather than string-templating
 * `() => ${genCode(body)}`) lets @babel/generator auto-wrap ObjectExpression
 * bodies in parens, so `$computed(() => ({ x: 1 }))` emits `() => ({ x: 1 })`
 * instead of `() => { x: 1 }` (which would parse as a BlockStatement with a
 * LabeledStatement and break the consumer).
 */
function arrowBody(body: t.Expression | t.BlockStatement): string {
  return genCode(t.arrowFunctionExpression([], body));
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Convert `const X = (...args) => body` (or function expression) into
 * `function X(...args) { ... }` so the binding HOISTS. Returns the new
 * statement, or null when the input is not a single-declarator
 * arrow/function-expression initializer (left as-is by the caller).
 *
 * **Why hoist?** `createMemo` (from `$computed`) runs its callback EAGERLY at
 * component-setup time, and memos are emitted in `hookSection` — above the
 * user helpers in `userArrowsSection`. A `$computed` whose body calls a
 * user-authored helper (`stats = $computed(() => stripHtml($data.content))`)
 * therefore reads that helper before its `const` declaration runs → TDZ
 * `ReferenceError: Cannot access 'stripHtml' before initialization`. A
 * `function` declaration hoists to the top of the component-function scope,
 * so it is defined before any eager memo callback fires. This mirrors
 * `tryHoistArrowToFunction` in the React emitter (whose `useMemo` callback
 * has the same eager-evaluation property).
 *
 * Multi-declarator / non-arrow declarations are left untouched. `async` is
 * preserved via FunctionDeclaration's `async` flag; a concise-expression
 * arrow body is wrapped in `{ return <expr>; }`.
 */
function tryHoistArrowToFunction(stmt: t.Statement): t.Statement | null {
  if (!t.isVariableDeclaration(stmt)) return null;
  if (stmt.declarations.length !== 1) return null;
  const decl = stmt.declarations[0]!;
  if (!t.isIdentifier(decl.id)) return null;
  const init = decl.init;
  if (!init) return null;
  if (!t.isArrowFunctionExpression(init) && !t.isFunctionExpression(init)) return null;

  const body: t.BlockStatement = t.isBlockStatement(init.body)
    ? init.body
    : t.blockStatement([t.returnStatement(init.body)]);

  const params = init.params.filter(
    (p): p is t.Identifier | t.Pattern | t.RestElement =>
      t.isIdentifier(p) ||
      t.isRestElement(p) ||
      t.isAssignmentPattern(p) ||
      t.isObjectPattern(p) ||
      t.isArrayPattern(p),
  );

  const fn = t.functionDeclaration(decl.id, params, body, false, init.async ?? false);
  // WR-01 ROOT CAUSE 2 — `function f() {}` cannot carry a type annotation on
  // its `id`, so hoisting `const f: (e: MouseEvent) => void = (e) => {…}` would
  // drop the author's declarator annotation. Re-project the declarator's
  // function-type onto the hoisted FunctionDeclaration's params + returnType so
  // the author's types survive (and the hoist — which fixes a real TDZ — is
  // preserved).
  reprojectDeclaratorFunctionType(decl.id, init, fn);
  // Inherit the original statement's `loc` + attached comments onto the
  // synthetic FunctionDeclaration. Without this the new node has no source
  // position, so @babel/generator (a) drops any user `<script>` comments
  // attached to the declaration, (b) falls back to default blank-line
  // spacing, and (c) loses the source-map mapping for these lines — Solid's
  // emitScript generates code + map in a single pass over `filteredStmts`,
  // so the synthetic node must carry position metadata.
  return t.inherits(fn, stmt);
}

/**
 * WR-01 ROOT CAUSE 2 — re-project an author function-type annotation written
 * on a `VariableDeclarator` `id` (`const f: (e: E) => R = …`) onto a rebuilt
 * `FunctionDeclaration` (which has no annotatable `id`). Each declarator-type
 * parameter type is copied onto the matching positional param of `fn`; the
 * declarator-type return type becomes `fn.returnType`.
 *
 * Idempotent / conservative: only fills a param that has NO `typeAnnotation`
 * already, and only when `id.typeAnnotation` is genuinely a `TSFunctionType`.
 */
function reprojectDeclaratorFunctionType(
  id: t.Identifier,
  init: t.ArrowFunctionExpression | t.FunctionExpression,
  fn: t.FunctionDeclaration,
): void {
  if (init.returnType) fn.returnType = init.returnType;
  if (init.typeParameters && !t.isNoop(init.typeParameters)) {
    fn.typeParameters = init.typeParameters;
  }
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return;
  const fnType = ann.typeAnnotation;
  if (!t.isTSFunctionType(fnType)) return;
  if (!fn.returnType && fnType.typeAnnotation) {
    fn.returnType = fnType.typeAnnotation;
  }
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

export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — when true, the shell must add
   * `import { render } from 'solid-js/web';` because the portals closure
   * uses Solid's imperative render API. The existing 'solid-js/web' import
   * (used for the component's main `render` mount call in the shell) is
   * already present, so this is informational — but kept distinct for
   * future emit shape evolution.
   */
  hasPortals: boolean;
  /**
   * Solid signal/memo/lifecycle declarations + user-authored helpers.
   */
  hookSection: string;
  /** Alias for hookSection (kept for structural parity with React's EmitScriptResult). */
  userArrowsSection: string;
  /**
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a single string, ready to splice at module top by the shell.
   * Empty when the script has no imports.
   */
  userImports: string;
  /**
   * `const _merged = mergeProps({ step: 1, ... }, _props);\n` when non-model
   * props have declared defaults. Null when no non-model defaults exist.
   * Emitted before splitPropsCall in the shell so `local.*` gets defaults.
   */
  mergePropsCall: string | null;
  /**
   * Number of statement lines in hookSection (createSignal, createMemo, etc.).
   * Used by buildShell to compute where userArrowsSection starts in the output
   * so the script source map can be line-offset-adjusted correctly.
   */
  hookSectionLines: number;
  /**
   * Source map for user-authored statements, produced by @babel/generator with
   * sourceMaps:true. Maps positions in the generated userArrowsSection text back
   * to the original .rozie source lines. The shell adjusts this map's generated
   * line numbers by the userCodeLineOffset before composing the final map.
   * Null when there are no user statements or no filename was provided.
   */
  scriptMap: EncodedSourceMap | null;
  diagnostics: Diagnostic[];
}

export interface EmitScriptCollectors {
  solidImports: SolidImportCollector;
  runtimeImports: RuntimeSolidImportCollector;
  /** .rozie filename; when provided, enables per-statement source map generation. */
  filename?: string | undefined;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string | undefined;
}

export function emitScript(
  ir: IRComponent,
  collectors: EmitScriptCollectors,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _registry?: unknown,
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];
  const hookLines: string[] = [];

  // Clone + rewrite the Babel program (P1: minimal rewrite).
  const cloned = cloneScriptProgram(ir.setupBody.scriptProgram);
  const rewriteResult = rewriteRozieIdentifiers(cloned, ir);
  diagnostics.push(...rewriteResult.diagnostics);

  // Spike 001 B1 — partition user-authored top-level ImportDeclarations out
  // of the rewritten Program body BEFORE the residual-body iteration. Mutate
  // `rewriteResult.rewrittenProgram.program.body` in place so downstream
  // iterations naturally see only non-import statements; surface imports via
  // `userImports` rendered as a string for the shell to splice at module top.
  const { userImports: userImportNodes, bodyStmts } = partitionUserImports(
    rewriteResult.rewrittenProgram,
  );
  rewriteResult.rewrittenProgram.program.body = bodyStmts;
  const userImports =
    userImportNodes.length > 0
      ? userImportNodes.map((imp) => genCode(imp)).join('\n') + '\n'
      : '';

  // 1. createControllableSignal for model:true props (D-135).
  // 1b. mergeProps call for non-model props with declared defaults.
  //     Must be emitted in shell BEFORE splitPropsCall so `local.*` gets defaults.
  // Exclude NullLiteral defaults (`default: null`) — `null` and `undefined` are
  // both falsy; including `null` in mergeProps would cause TypeScript type
  // mismatches for optional function props typed as `T | undefined`.
  const nonModelDefaultProps = ir.props.filter(
    (p) => !p.isModel && p.defaultValue !== null && !t.isNullLiteral(p.defaultValue),
  );
  let mergePropsCall: string | null = null;
  if (nonModelDefaultProps.length > 0) {
    collectors.solidImports.add('mergeProps');
    const defaultEntries = nonModelDefaultProps.map((p) => {
      const raw = genCode(p.defaultValue!);
      const val = (
        t.isArrowFunctionExpression(p.defaultValue!) ||
        t.isFunctionExpression(p.defaultValue!)
      ) ? `(${raw})()` : raw;
      return `${p.name}: ${val}`;
    });
    mergePropsCall = `const _merged = mergeProps({ ${defaultEntries.join(', ')} }, _props);\n`;
  }

  for (const p of ir.props) {
    if (!p.isModel) continue;
    collectors.runtimeImports.add('createControllableSignal');
    const setterName = 'set' + capitalize(p.name);
    let dflt = 'undefined';
    if (p.defaultValue !== null) {
      const raw = genCode(p.defaultValue);
      // When the prop default is a factory arrow/function (e.g. `default: () => []`),
      // the emitted `createControllableSignal` third arg should be the *initial value*
      // (the result of calling the factory), not the factory itself — otherwise
      // TypeScript infers T as the function type rather than the array/object type.
      if (
        t.isArrowFunctionExpression(p.defaultValue) ||
        t.isFunctionExpression(p.defaultValue)
      ) {
        dflt = `(${raw})()`;
      } else {
        dflt = raw;
      }
    }
    // Thread the prop's TS type to the call site so the resulting Signal<T>
    // doesn't widen to `never[]` / `unknown` when the default is an empty
    // factory result. Without this, `default: () => []` makes TS infer T as
    // `never[]`, which cascades to "Property 'X' does not exist on type
    // 'never'" everywhere the signal is read.
    const tsType = renderType(p.typeAnnotation);
    hookLines.push(
      `const [${p.name}, ${setterName}] = createControllableSignal<${tsType}>(_props as Record<string, unknown>, '${p.name}', ${dflt});`,
    );
  }

  // 2. createSignal for each StateDecl (<data> entries).
  for (const s of ir.state) {
    collectors.solidImports.add('createSignal');
    const setterName = 'set' + capitalize(s.name);
    hookLines.push(
      `const [${s.name}, ${setterName}] = createSignal(${genCode(s.initializer)});`,
    );
  }

  // 3. createMemo for each ComputedDecl.
  // Rule 1 fix: rewrite $props/$data/$refs in the computed body before emitting.
  for (const c of ir.computed) {
    collectors.solidImports.add('createMemo');
    const rewrittenBody = rewriteNode(c.body, ir);
    hookLines.push(`const ${c.name} = createMemo(${arrowBody(rewrittenBody)});`);
  }

  // Portal-slot primitive (Spike 003) — emit portal scaffolding just before
  // the lifecycle hooks so the `portals` closure exists when user code's
  // onMount runs. The closure references `props.XSlot`, `render` (from
  // 'solid-js/web'), and `onCleanup`.
  const portalsEmit = emitPortals(ir, collectors.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    collectors.solidImports.add('onCleanup');
    // The `render` named import lives on 'solid-js/web', not 'solid-js'.
    // SolidImportCollector currently only emits 'solid-js' — wire a separate
    // shell field through the script-emit result for the web import line.
    hookLines.push(portalsEmit.setupLines);
  }

  // 4. onMount/onCleanup for each LifecycleHook.
  //
  // Rule 1 fix: when lh.setup is a BlockStatement, genCode() produces `{ ... }`
  // which Babel's generator renders as an object literal — invalid as a function
  // argument. Wrap BlockStatements in an arrow function.
  //
  // Callable-reference Expressions (Identifier from `$onMount(reset)`, MemberExpr
  // from `$onMount(obj.handler)`, or the rare paired `() => () => cleanup`) are
  // already function values — pass straight through.
  //
  // Any OTHER Expression is the unwrapped concise-body of `() => <expr>` —
  // extractCleanupReturn strips the arrow wrapper, leaving e.g. `reset()` as
  // `lh.setup`. Passing it through verbatim would emit `onMount(reset())` which
  // (a) calls reset() at registration instead of after mount, and (b) TDZs on
  // any `const` declared later in the emitted output (e.g. `const reset = ...`
  // lives in userArrowsSection AFTER hookSection). Wrap it back in an arrow.
  function lifecycleArg(node: t.Node): string {
    if (t.isBlockStatement(node)) {
      return arrowBody(node);
    }
    if (
      t.isIdentifier(node) ||
      t.isMemberExpression(node) ||
      t.isArrowFunctionExpression(node) ||
      t.isFunctionExpression(node)
    ) {
      return genCode(node);
    }
    // Generic Expression fallback — use arrowBody so ObjectExpression bodies
    // get auto-parenthesized.
    return arrowBody(node as t.Expression);
  }

  for (const lh of ir.lifecycle) {
    if (lh.phase === 'mount') {
      if (lh.cleanup) {
        // Paired mount+cleanup: wrap in onMount, call onCleanup inside.
        // Shape: onMount(() => { const _cleanup = setupFn(); if (_cleanup) onCleanup(_cleanup); })
        collectors.solidImports.add('onMount');
        collectors.solidImports.add('onCleanup');
        // Rule 1 fix: rewrite $props/$data/$refs in the setup body; wrap BlockStatement in IIFE.
        const rewrittenSetup = rewriteNode(lh.setup, ir);
        const rawSetup = genCode(rewrittenSetup);
        const setupCall = t.isBlockStatement(lh.setup)
          ? `(() => ${rawSetup})()`
          : `(${rawSetup})()`;
        const rewrittenCleanup = rewriteNode(lh.cleanup, ir);
        const cleanupCode = genCode(rewrittenCleanup);
        hookLines.push(
          `onMount(() => {\n` +
          `  const _cleanup = ${setupCall} as unknown;\n` +
          `  if (_cleanup) onCleanup(_cleanup as () => void);\n` +
          `  onCleanup(${cleanupCode});\n` +
          `});`,
        );
      } else {
        collectors.solidImports.add('onMount');
        const rewrittenSetup = rewriteNode(lh.setup, ir);
        const arg = lifecycleArg(rewrittenSetup);
        hookLines.push(`onMount(${arg});`);
      }
    } else if (lh.phase === 'unmount') {
      collectors.solidImports.add('onCleanup');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`onCleanup(${arg});`);
    } else if (lh.phase === 'update') {
      // update phase: createEffect re-runs on tracked dependency change
      collectors.solidImports.add('createEffect');
      const rewrittenSetup = rewriteNode(lh.setup, ir);
      const arg = lifecycleArg(rewrittenSetup);
      hookLines.push(`createEffect(${arg});`);
    }
  }

  // 4c. Quick plan 260515-u2b — $watch lowers to createEffect(() => { getter(); cb(); }).
  // Solid's createEffect auto-tracks reads inside its callback. We IIFE-invoke
  // the getter so its reactive reads subscribe the effect, then run the
  // callback inside `untrack(...)` so the callback fires on first run + on
  // re-trigger WITHOUT its own reads (or transitive helper reads) joining the
  // effect's dependency set.
  // Both bodies need rewriteNode (post-IR rewrite) so $props.X / $data.X /
  // $refs.X lower to the Solid-side idiom (props.X / dataX() / xRef).
  // The getter/callback fields in the IR are bodies (BlockStatement | Expression);
  // wrap each back into a Babel arrow expression, then run rewriteNode, then
  // genCode.
  //
  // Bug B fix (260519 linechart-watch-recreate) — without the `untrack`
  // wrapper, the callback's transitive reads land in the watcher's deps:
  // LineChart's `$watch($props.type)` callback calls `buildConfig()` which
  // reads `$props.data`, so the `type` watcher re-fired (destroying +
  // recreating the Chart.js instance) on every data tick. `untrack` confines
  // the watcher's dependency set to the getter's reads only — matching Vue's
  // `watch(getter, cb)` and Svelte's untrack-wrapped $watch callback.
  for (const wh of ir.watchers) {
    collectors.solidImports.add('createEffect');
    collectors.solidImports.add('untrack');
    const getterArrow = t.arrowFunctionExpression([], wh.getter);
    // Preserve the user-authored callback params (e.g. `(v) => ...`) so the
    // reconstructed arrow declares them; otherwise references inside the body
    // would be unbound. Pass the getter's evaluated value as the first arg so
    // the param actually has a binding at call time.
    const cbArrow = t.arrowFunctionExpression(wh.callbackParams, wh.callback);
    const rewrittenGetter = rewriteNode(getterArrow, ir);
    const rewrittenCb = rewriteNode(cbArrow, ir);
    const getterCode = genCode(rewrittenGetter);
    const cbCode = genCode(rewrittenCb);
    // Only pass __watchVal when the callback declares a param to receive it —
    // passing an arg to a 0-param arrow is runtime-safe (JS drops extras) but
    // tsc flags TS2554 "Expected 0 arguments, but got 1". Conditional bind keeps
    // both `(v) => ...` and `() => ...` shapes type-clean.
    const callArg = wh.callbackParams.length > 0 ? '__watchVal' : '';
    hookLines.push(
      `createEffect(() => { const __watchVal = (${getterCode})(); untrack(() => (${cbCode})(${callArg})); });`,
    );
  }

  // 4b. Ref variable declarations: `let fooRef: HTMLElement | null = null;`
  // Solid uses plain let variables (not useRef objects) for DOM refs.
  // Using HTMLElement (not Element) so DOM properties like .style, .focus() are accessible.
  for (const ref of ir.refs) {
    hookLines.push(`let ${ref.name}Ref: HTMLElement | null = null;`);
  }

  // 5. Emit user-authored top-level statements from the rewritten program.
  //    Skip: $computed declarators (handled above), $onMount/$onUnmount calls.
  const filteredStmts: t.Statement[] = [];
  for (const stmt of rewriteResult.rewrittenProgram.program.body) {
    // Skip $computed variable declarations.
    if (t.isVariableDeclaration(stmt)) {
      const allComputed = stmt.declarations.every(
        (d) =>
          d.init &&
          t.isCallExpression(d.init) &&
          t.isIdentifier(d.init.callee) &&
          d.init.callee.name === '$computed',
      );
      if (allComputed) continue;
    }
    // Skip lifecycle call expressions.
    if (t.isExpressionStatement(stmt) && t.isCallExpression(stmt.expression)) {
      const callee = stmt.expression.callee;
      if (
        t.isIdentifier(callee) &&
        (callee.name === '$onMount' ||
          callee.name === '$onUnmount' ||
          callee.name === '$onUpdate' ||
          // Quick plan 260515-u2b — $watch is consumed by the watcher loop above.
          callee.name === '$watch')
      ) {
        continue;
      }
    }
    // Hoist `const X = () => …` helpers to `function X() {…}` so they are
    // defined before any eagerly-evaluated `createMemo` callback in
    // hookSection references them (TDZ fix — see tryHoistArrowToFunction).
    filteredStmts.push(tryHoistArrowToFunction(stmt) ?? stmt);
  }

  // Generate user statements as a single Babel program so we get one coherent
  // source map. The AST nodes already carry correct .rozie line numbers
  // (startLine was passed to @babel/parser in parseScript.ts), so the map
  // produced here maps generated-output positions → actual .rozie lines.
  // buildShell will shift the generated lines by userCodeLineOffset so the
  // final map references the correct tsx output line numbers.
  let userArrowsSection = '';
  let scriptMap: EncodedSourceMap | null = null;

  if (filteredStmts.length > 0) {
    const sourceFileName = collectors.filename ?? '<rozie>';
    const genResult = generate(
      t.file(t.program(filteredStmts)),
      { ...GEN_OPTS_MAP, sourceFileName },
    );
    userArrowsSection = genResult.code;
    if (genResult.map) {
      scriptMap = genResult.map as EncodedSourceMap;
    }
  }

  const hookSection = hookLines.join('\n');
  const hookSectionLines = hookLines.length;

  return {
    hasPortals: portalsEmit.hasPortals,
    hookSection,
    userArrowsSection,
    userImports,
    mergePropsCall,
    hookSectionLines,
    scriptMap,
    diagnostics,
  };
}
