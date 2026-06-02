/**
 * emitScript — Lit target (Plan 06.4-02 Task 1).
 *
 * Produces the class-body fragments for a Lit element:
 *   - @property/@state class fields for props + data
 *   - @query class fields for refs
 *   - getter methods for $computed declarations
 *   - user-authored top-level function declarations / variables as class methods
 *   - lifecycle dispatch: $onMount → firstUpdated(), $onUnmount → disconnected,
 *     $onUpdate → updated(), D-19 cleanup-return → push to _disconnectCleanups
 *   - model-prop synthesis: createLitControllableProperty + setter + change-event
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type { EncodedSourceMap } from '@ampproject/remapping';
import type {
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  LifecycleHook,
  WatchHook,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { rewriteScript, collectMethodNamesFromProgram } from '../rewrite/rewriteScript.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import { toKebabCase } from './emitDecorator.js';
import { emitPortals } from './emitPortals.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

export interface EmitScriptOpts {
  decorators: LitDecoratorImportCollector;
  signals: PreactSignalsImportCollector;
  runtime: RuntimeLitImportCollector;
  lit: LitImportCollector;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
}

export interface EmitScriptResult {
  /**
   * Portal-slot primitive (Spike 003) — when true, emitLit's shell must
   * ensure `render` and `nothing` are imported from 'lit' for the portal-
   * closure body that uses them.
   */
  hasPortals: boolean;
  /** Class field declarations (props + state + refs + signal-wrapped data). */
  fieldDecls: string;
  /** Class method declarations (computed getters + user methods + model setters). */
  methodDecls: string;
  /** firstUpdated body — $onMount calls in source order. */
  mountHookBody: string;
  /** disconnectedCallback body — $onUnmount calls (super + cleanup drain is added by orchestrator). */
  unmountHookBody: string;
  /** updated() body — $onUpdate calls. */
  updateHookBody: string;
  /** attributeChangedCallback body (for model-prop notifyAttributeChange). */
  attributeChangedBody: string;
  /**
   * Spike 001 B1 — user-authored `<script>` `ImportDeclaration` statements
   * rendered as a single string, ready to splice at module top by the shell.
   * Empty when the script has no imports. Without this hoist they would land
   * inside `firstUpdated()` and produce TS1232.
   */
  userImports: string;
  /**
   * Phase 9 Plan 09-04 — author-declared `<script lang="ts">` statement-position
   * `interface` / `type` declarations, each rendered as a string. emitLit
   * concatenates these into the shell's `interfaceDecls` bucket so they land at
   * MODULE scope, above the `class extends SignalWatcher(LitElement)`. Without
   * this hoist a `TSInterfaceDeclaration` falls through `partitionScript` →
   * `classBodyFromStatements` into `firstUpdated()`, where an `interface`/`type`
   * declaration is a TS syntax error (TS1184). Always empty for an untyped
   * `<script>`, so untyped emit is byte-identical.
   */
  hoistedTypeDecls: string[];
  /** Source map for user-authored statements (unused in P2 — null). */
  scriptMap: EncodedSourceMap | null;
  /** Number of preamble lines (unused in P2). */
  preambleSectionLines: number;
  diagnostics: Diagnostic[];
}

function renderType(t: PropTypeAnnotation): string {
  if (t.kind === 'identifier') {
    switch (t.name) {
      case 'Number': return 'Number';
      case 'String': return 'String';
      case 'Boolean': return 'Boolean';
      case 'Array': return 'Array';
      case 'Object': return 'Object';
      case 'Function': return 'Function';
      default: return 'Object';
    }
  }
  if (t.kind === 'union') {
    // Lit @property accepts one type token; pick the first.
    if (t.members.length > 0) return renderType(t.members[0]!);
  }
  return 'Object';
}

function renderTsType(ann: PropTypeAnnotation): string {
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number': return 'number';
      case 'String': return 'string';
      case 'Boolean': return 'boolean';
      // Use `any[]` / `any` (not `unknown[]` / `object` / `Record<string, any>`)
      // so user-authored template expressions like `item.X` typecheck without
      // requiring an inner-element type annotation in the rozie source. Lit's
      // `repeat()` infers its element T from the iterable; with `Record<string,
      // any>` it widens to `unknown` and downstream `(child) => child.id` access
      // fails. `any` keeps the iteration ergonomic.
      case 'Array': return 'any[]';
      case 'Object': return 'any';
      case 'Function': return '((...args: unknown[]) => unknown) | null';
      // A non-builtin identifier is a bare type name referencing a type alias
      // / interface declared in the component's `<script lang="ts">` block
      // (those declarations are module-hoisted on this class-based target).
      // Pass it through verbatim — exactly as the other five targets do — so
      // the consumer's type-checker sees the real type instead of `unknown`.
      default: return ann.name;
    }
  }
  if (ann.kind === 'union') {
    return ann.members.map(renderTsType).join(' | ');
  }
  return 'unknown';
}

/**
 * Render a class-field declaration suffix for a prop.
 *
 * 260521-oao — optionality is driven by `prop.required`, NOT by whether a
 * builtin zero-value default can be fabricated:
 *
 *   - prop carries a `default:` (`prop.defaultValue != null`) → keep the
 *     `: <tsType> = <default>` initializer form (UNCHANGED).
 *   - no `default:`, `prop.required === true` → `!: <tsType>`
 *     (definite-assignment; the consumer MUST set the attribute/property).
 *     Applies to BOTH builtin and custom-typed props — the fabricated builtin
 *     zero-value default is no longer emitted for required props.
 *   - no `default:`, `prop.required !== true` → `?: <tsType>` (optional; the
 *     field may legitimately be `undefined`). Applies to BOTH builtin and
 *     custom-typed props — the fabricated builtin `= ''`/`= 0`/`= false`
 *     default is no longer emitted for optional no-default props.
 *
 * The `!`-shape matches what Rozie already emits for Angular `@Input` and Lit
 * `@query` ref fields.
 */
function renderFieldSuffix(prop: PropDecl): string {
  const tsType = renderTsType(prop.typeAnnotation);
  if (prop.defaultValue != null) {
    return `: ${tsType} = ${renderDefault(prop.defaultValue, prop.typeAnnotation)}`;
  }
  return prop.required ? `!: ${tsType}` : `?: ${tsType}`;
}

function isPrimitiveType(ann: PropTypeAnnotation): boolean {
  if (ann.kind === 'identifier') {
    return ann.name === 'Number' || ann.name === 'String' || ann.name === 'Boolean';
  }
  return false;
}

function renderExpression(expr: t.Expression): string {
  return generate(expr, GEN_OPTS).code;
}

function renderDefault(expr: t.Expression | null, ann: PropTypeAnnotation): string {
  if (expr) {
    // Arrow factory wrapping (Vue-style `default: () => []`) — emit the wrapped
    // body's resolved expression directly because Lit @property accepts a
    // plain default value, not a factory function.
    if (t.isArrowFunctionExpression(expr) && t.isExpression(expr.body)) {
      return renderExpression(expr.body);
    }
    if (t.isFunctionExpression(expr) && expr.body.body.length === 1) {
      const stmt = expr.body.body[0]!;
      if (t.isReturnStatement(stmt) && stmt.argument) {
        return renderExpression(stmt.argument);
      }
    }
    return renderExpression(expr);
  }
  // Fallback default per type.
  if (ann.kind === 'identifier') {
    switch (ann.name) {
      case 'Number': return '0';
      case 'String': return "''";
      case 'Boolean': return 'false';
      case 'Array': return '[]';
      case 'Object': return '{}';
      case 'Function': return 'null';
    }
  }
  return 'undefined';
}

function emitNonModelProp(prop: PropDecl): string {
  const litType = renderType(prop.typeAnnotation);
  const reflect = isPrimitiveType(prop.typeAnnotation);
  const reflectField = reflect ? ', reflect: true' : '';
  // `fieldSuffix` is either `: <type> = <default>` (real/zero-value default)
  // or `!: <type>` (required custom-typed prop with no synthesizable default).
  const fieldSuffix = renderFieldSuffix(prop);
  return `  @property({ type: ${litType}${reflectField} }) ${prop.name}${fieldSuffix};`;
}

interface ModelPropEmit {
  fieldDecl: string;
  controllableInit: string;
  attrCallback: string;
}

function emitModelProp(prop: PropDecl, componentName: string): ModelPropEmit {
  const litType = renderType(prop.typeAnnotation);
  const tsType = renderTsType(prop.typeAnnotation);
  // Model props must NOT reflect — Lit echoes property→attribute which fires
  // attributeChangedCallback→notifyAttributeChange, spuriously flipping
  // wasControlled=false→true on init and breaking uncontrolled write().
  const reflectField = '';
  const defaultStr = renderDefault(prop.defaultValue, prop.typeAnnotation);
  const eventName = `${toKebabCase(prop.name)}-change`;
  const attrName = toKebabCase(prop.name);

  // We emit an @property attribute mirror, plus a private controllable backing.
  // Public getter/setter goes into methodDecls.
  //
  // The `_<name>_attr` FIELD DECLARATION takes the definite-assignment form
  // when no default is synthesizable (a required custom-typed model prop) —
  // `_x_attr: Custom = undefined` is a tsc error. The
  // `createLitControllableProperty` `defaultValue:` arg and the `coerce`
  // expression below still consume the literal `defaultStr` (they need a
  // runtime value, not a `!`-form) — for a custom type that is the string
  // `'undefined'`, the pre-existing behavior, out of scope to change here.
  const attrFieldSuffix = renderFieldSuffix(prop);
  const fieldDecl = [
    `  @property({ type: ${litType}${reflectField}, attribute: '${attrName}' }) _${prop.name}_attr${attrFieldSuffix};`,
    `  private _${prop.name}Controllable = createLitControllableProperty<${tsType}>({ host: this, eventName: '${eventName}', defaultValue: ${defaultStr}, initialControlledValue: undefined });`,
  ].join('\n');

  const controllableInit = ''; // already initialized in field init

  // attributeChangedCallback body — when attribute changes, push to controllable.
  const coerce =
    litType === 'Number'
      ? `value === null ? ${defaultStr} : Number(value)`
      : litType === 'Boolean'
        ? `value !== null`
        : `value as unknown as ${tsType}`;
  const attrCallback = `if (name === '${attrName}') this._${prop.name}Controllable.notifyAttributeChange(${coerce});`;

  void componentName;
  return { fieldDecl, controllableInit, attrCallback };
}

function emitModelGetterSetter(prop: PropDecl): string {
  const tsType = renderTsType(prop.typeAnnotation);
  // The public PROPERTY setter is the entry point for an EXTERNAL parent
  // reassigning the model via a Lit `.${prop.name}=${…}` property binding.
  // A property binding bypasses `attributeChangedCallback` entirely, so it
  // must route through `notifyPropertyWrite` — which establishes / keeps
  // controlled mode — rather than `write` (the producer-internal mutation
  // path that never flips mode). Routing the setter through `write` left a
  // property-bound two-way parent permanently uncontrolled: producer and
  // consumer then held two divergent copies synced only by `*-change`
  // CustomEvent round-trips (the Lit SortableList desync). The producer's OWN
  // `$props.${prop.name} = …` mutations are emitted as direct
  // `_${prop.name}Controllable.write(…)` calls by rewriteScript and never hit
  // this setter, so a standalone (uncontrolled) producer is unaffected.
  return [
    `  get ${prop.name}(): ${tsType} { return this._${prop.name}Controllable.read(); }`,
    `  set ${prop.name}(v: ${tsType}) { this._${prop.name}Controllable.notifyPropertyWrite(v); }`,
  ].join('\n');
}

function emitStateField(stateName: string, init: t.Expression): string {
  // Signal-backed: `private _x = signal(<init>);`
  return `  private _${stateName} = signal(${renderExpression(init)});`;
}

function emitRefField(refName: string, elementTag: string): string {
  // @query targets refs by data-rozie-ref="<name>" (Plan 06.4-02 inference).
  // The selector pinned by data attribute keeps shadow-DOM scoping correct.
  // Mark with definite-assignment in case the consumer hasn't yet rendered.
  void elementTag;
  const field = `_ref${refName.charAt(0).toUpperCase()}${refName.slice(1)}`;
  return `  @query('[data-rozie-ref="${refName}"]') private ${field}!: HTMLElement;`;
}

function isLifecycleCall(stmt: t.Statement): {
  isHook: boolean;
  hookName?: '$onMount' | '$onUnmount' | '$onUpdate';
  argument?: t.Expression;
} {
  if (!t.isExpressionStatement(stmt)) return { isHook: false };
  const expr = stmt.expression;
  if (!t.isCallExpression(expr)) return { isHook: false };
  if (!t.isIdentifier(expr.callee)) return { isHook: false };
  const name = expr.callee.name;
  if (name !== '$onMount' && name !== '$onUnmount' && name !== '$onUpdate') {
    return { isHook: false };
  }
  if (expr.arguments.length === 0) return { isHook: false };
  const arg = expr.arguments[0]!;
  if (!t.isExpression(arg)) return { isHook: false };
  return { isHook: true, hookName: name, argument: arg };
}

/**
 * Inline a hook callback's body into the lifecycle method.
 * If the arg is an arrow function with a block body, return the body's statements
 * as a string. If it's an identifier, return `<name>();`. Cleanup return-values
 * are stripped and pushed to _disconnectCleanups.
 */
function inlineHookBody(arg: t.Expression): { body: string; cleanup: string } {
  if (t.isIdentifier(arg)) {
    return { body: `${arg.name}();`, cleanup: '' };
  }
  if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
    const body = arg.body;
    if (t.isBlockStatement(body)) {
      // Look for trailing `return fn` — peel off as cleanup.
      const stmts = [...body.body];
      let cleanup = '';
      if (stmts.length > 0) {
        const last = stmts[stmts.length - 1]!;
        if (t.isReturnStatement(last) && last.argument) {
          // `return undefined` / `return null` is "no cleanup" — drop the
          // statement without pushing anything to _disconnectCleanups. Without
          // this guard the literal becomes a non-callable cleanup entry that
          // throws on disconnectedCallback (FullCalendarDemo.rozie's
          // `$onMount(() => { …; return undefined })` repro).
          const isNoCleanupReturn =
            (t.isIdentifier(last.argument) &&
              (last.argument.name === 'undefined' ||
                last.argument.name === 'null')) ||
            t.isNullLiteral(last.argument);
          if (isNoCleanupReturn) {
            stmts.pop();
          } else {
            cleanup = renderExpression(last.argument);
            stmts.pop();
          }
        }
      }
      const rendered = stmts.map((s) => generate(s, GEN_OPTS).code).join('\n');
      return { body: rendered, cleanup };
    }
    // Concise arrow: () => expr — the expression IS the return value.
    // Treat it as a cleanup/unsubscribe callback rather than a side-effect body.
    // e.g., $onMount(() => createSubscription()) — the subscription cleanup is
    // the return value of createSubscription(). CR-04 fix: leak prevention.
    return { body: '', cleanup: renderExpression(body as t.Expression) };
  }
  return { body: `(${renderExpression(arg)})();`, cleanup: '' };
}

interface PartitionedScript {
  /** Top-level statements that should become class methods/getters. */
  classLevelStmts: t.Statement[];
  /** $onMount calls in source order. */
  mountHooks: Array<{ arg: t.Expression }>;
  /** $onUnmount calls. */
  unmountHooks: Array<{ arg: t.Expression }>;
  /** $onUpdate calls. */
  updateHooks: Array<{ arg: t.Expression }>;
  /**
   * Quick plan 260515-u2b — top-level $watch calls in source order. Each
   * entry carries both the getter and the callback as function expressions.
   * Emitted as `this._disconnectCleanups.push(effect(() => { ... }));`
   * inside firstUpdated so the @lit-labs/preact-signals effect subscription
   * is set up alongside the rest of the lifecycle wiring AND torn down on
   * disconnect.
   */
  watcherHooks: Array<{
    getter: t.ArrowFunctionExpression | t.FunctionExpression;
    callback: t.ArrowFunctionExpression | t.FunctionExpression;
  }>;
}

function partitionScript(program: t.File): PartitionedScript {
  const classLevelStmts: t.Statement[] = [];
  const mountHooks: PartitionedScript['mountHooks'] = [];
  const unmountHooks: PartitionedScript['unmountHooks'] = [];
  const updateHooks: PartitionedScript['updateHooks'] = [];
  const watcherHooks: PartitionedScript['watcherHooks'] = [];

  for (const stmt of program.program.body) {
    const hook = isLifecycleCall(stmt);
    if (hook.isHook && hook.argument) {
      const entry = { arg: hook.argument };
      if (hook.hookName === '$onMount') mountHooks.push(entry);
      else if (hook.hookName === '$onUnmount') unmountHooks.push(entry);
      else if (hook.hookName === '$onUpdate') updateHooks.push(entry);
      continue;
    }
    // Phase 21 (REQ-9) — a top-level `$expose({...})` call is a COMPILE-TIME
    // directive consumed via `ir.expose`. Lit re-emits the named user functions
    // as PUBLIC element methods (they lift through classBodyFromStatements); the
    // `$expose(...)` CALL itself must be STRIPPED here, not lifted into
    // firstUpdated() — otherwise it leaks as an undefined-`$expose` runtime
    // reference (mirrors the Vue/React residual-body strip). Drop ONLY the
    // top-level call form; non-$expose statements flow through unchanged so
    // byte-identity holds when ir.expose is empty.
    if (t.isExpressionStatement(stmt)) {
      const callExpr = stmt.expression;
      if (
        t.isCallExpression(callExpr) &&
        t.isIdentifier(callExpr.callee) &&
        callExpr.callee.name === '$expose'
      ) {
        continue;
      }
    }
    // Quick plan 260515-u2b — top-level $watch call detection.
    if (t.isExpressionStatement(stmt)) {
      const expr = stmt.expression;
      if (
        t.isCallExpression(expr) &&
        t.isIdentifier(expr.callee) &&
        expr.callee.name === '$watch'
      ) {
        const getter = expr.arguments[0];
        const callback = expr.arguments[1];
        if (
          getter &&
          callback &&
          (t.isArrowFunctionExpression(getter) || t.isFunctionExpression(getter)) &&
          (t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback))
        ) {
          watcherHooks.push({
            getter: getter as t.ArrowFunctionExpression | t.FunctionExpression,
            callback: callback as t.ArrowFunctionExpression | t.FunctionExpression,
          });
          continue;
        }
      }
    }
    classLevelStmts.push(stmt);
  }

  return { classLevelStmts, mountHooks, unmountHooks, updateHooks, watcherHooks };
}

/**
 * Classify a WatchHook by its IR-computed `getterDeps`:
 *   - 'props' — every dep is a $props.X read; safe to route through Lit's
 *     `updated(changedProperties)` because Lit fires `updated()` whenever
 *     any `@property` accessor changes. The fullcalendar-lit-watch-property
 *     gap (2026-05-19) is exactly this case: `@lit-labs/preact-signals`
 *     `effect()` ONLY subscribes to preact-signal reads, and Lit `@property`
 *     accessors are NOT preact-signals — so `effect()`-routed $watch never
 *     re-fires for prop changes. Per memory project_fullcalendar_react_lit_gaps,
 *     this is option #3 (hybrid IR classification).
 *   - 'effect' — at least one dep reads from `$data` (preact-signal),
 *     `$computed` (computed signal), or `$slots` (signal-watched), OR is an
 *     opaque closure dep we cannot reason about. Keep the `effect()` route so
 *     signal subscriptions are established normally. Lit-`updated()` route
 *     would not fire on $data-only changes (those don't flow through @property
 *     setters) so `effect()` is necessary.
 *
 * `'computed'` and `'slots'` deps go through `effect()` because they ARE
 * preact-signals under the hood in target-lit (computed → `computed()`,
 * slots-presence → `signal()`); the existing `effect()` plumbing observes them
 * correctly.
 */
function classifyWatcherRoute(
  watcher: WatchHook,
): { route: 'props' | 'effect'; propNames: string[] } {
  const propNames = new Set<string>();
  let nonPropsSeen = false;
  for (const dep of watcher.getterDeps) {
    if (dep.scope === 'props') {
      if (dep.path.length > 0) propNames.add(dep.path[0]!);
      continue;
    }
    // 'data' | 'computed' | 'slots' | 'closure' — route through effect()
    nonPropsSeen = true;
  }
  // Edge case: getterDeps is empty (constant getter — `() => 42`). Treat as
  // 'props' route with no prop names so the watcher body never re-runs after
  // mount via either route. The initial firing semantic is preserved either
  // way; constant getters don't observe any change.
  if (nonPropsSeen) return { route: 'effect', propNames: [] };
  return { route: 'props', propNames: [...propNames] };
}

/**
 * Convert a top-level variable declaration into a class field or class method.
 *
 * Rules:
 *   - `const X = $computed(() => expr)` → `get X() { return expr; }` (getter)
 *   - `const X = () => { ... }` → `X = () => { ... };` (class field-arrow)
 *   - `let X = ...` / `const X = ...` (non-arrow) → `X = ...;` (class field)
 *   - `function X() { ... }` → `X() { ... }` (class method)
 *
 * `console.log(...)` and other free expression statements become initialization
 * statements inside the field-init for a private dummy (rare and benign for
 * code-library audience).
 */
/**
 * WR-01 ROOT CAUSE 2 — render a `VariableDeclarator` `id`'s author type
 * annotation as a `": <Type>"` suffix string (empty when the id is untyped).
 * Used by the class-field rebuild site so an author declarator annotation
 * (`const f: (e: MouseEvent) => void = …`) survives onto the emitted field.
 */
function renderDeclaratorTypeSuffix(id: t.LVal): string {
  if (!t.isIdentifier(id)) return '';
  const ann = id.typeAnnotation;
  if (!ann || !t.isTSTypeAnnotation(ann)) return '';
  // @babel/generator cannot print a bare `TSTypeAnnotation` (its printer
  // dereferences a parent that no longer exists). Print the INNER type node
  // and prepend the `: ` ourselves.
  return `: ${generate(ann.typeAnnotation, GEN_OPTS).code}`;
}

function classBodyFromStatements(
  stmts: t.Statement[],
  computedNames: Set<string>,
): { methods: string; freeStatements: string } {
  const methodChunks: string[] = [];
  const freeChunks: string[] = [];

  for (const stmt of stmts) {
    if (t.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (!t.isIdentifier(decl.id) || !decl.init) continue;
        const name = decl.id.name;

        // $computed(() => expr) → getter method
        if (
          computedNames.has(name) &&
          t.isCallExpression(decl.init) &&
          t.isIdentifier(decl.init.callee) &&
          decl.init.callee.name === '$computed' &&
          decl.init.arguments.length > 0
        ) {
          const arrow = decl.init.arguments[0]!;
          if (t.isArrowFunctionExpression(arrow) || t.isFunctionExpression(arrow)) {
            if (t.isExpression(arrow.body)) {
              methodChunks.push(
                `  get ${name}() { return ${renderExpression(arrow.body)}; }`,
              );
            } else if (t.isBlockStatement(arrow.body)) {
              const bodyCode = arrow.body.body
                .map((s) => generate(s, GEN_OPTS).code)
                .join('\n');
              methodChunks.push(
                `  get ${name}() {\n${indent(bodyCode, 4)}\n  }`,
              );
            }
            continue;
          }
        }

        // Arrow functions become field-arrows (preserve `this` binding semantics)
        if (
          t.isArrowFunctionExpression(decl.init) ||
          t.isFunctionExpression(decl.init)
        ) {
          // Render as `name = (args) => body;` (preserves arrow lexical this).
          // WR-01 ROOT CAUSE 2: a declarator type annotation
          // (`const f: (e: MouseEvent) => void = …`) must survive onto the
          // class field — `${name} = …` alone drops it. For a declarator-typed
          // callback the field annotation is the sole type carrier (core's
          // typeNeutralizeScript leaves the contextually-typed params bare), so
          // re-emit it as `f: (e: MouseEvent) => void = …`.
          const code = renderExpression(decl.init);
          const declTypeSuffix = renderDeclaratorTypeSuffix(decl.id);
          methodChunks.push(`  ${name}${declTypeSuffix} = ${code};`);
          continue;
        }

        // Plain value initializer → class field. genCode the whole declarator
        // (not just the init) so a `: any` annotation added by
        // typeNeutralizeScript — e.g. `let editor = null` → `editor: any =
        // null` — survives onto the field; without it the field is typed
        // `null` and every reassignment (`this.editor = new Editor()`) is
        // TS2322.
        methodChunks.push(`  ${generate(decl, GEN_OPTS).code};`);
      }
      continue;
    }

    if (t.isFunctionDeclaration(stmt) && stmt.id) {
      // Convert `function X(...) {...}` → a class method. Phase 9 Plan 09-04
      // (RESEARCH Pitfall 3): build a real `t.classMethod` node and let
      // @babel/generator print it rather than hand-stringifying
      // `name(params) { body }`. Generating each param in ISOLATION
      // (`generate(param)`) drops its `typeAnnotation` — @babel/generator only
      // prints a param's annotation when the param sits in a typed parent
      // context. A `ClassMethod` provides that context, so a
      // `<script lang="ts">` `function describe(item: Item): string {…}`
      // keeps both the `Item` param type and the `string` return type. The
      // generated shape is byte-identical to the previous hand-rolled output
      // for an untyped function (no annotations to print). `returnType` and
      // `typeParameters` are first-class `ClassMethod` fields — re-attached
      // from the source `FunctionDeclaration` so author generics survive too.
      const method = t.classMethod(
        'method',
        t.identifier(stmt.id.name),
        stmt.params,
        stmt.body,
        false,
        false,
        false,
        stmt.async ?? false,
      );
      // `?? null` because a `FunctionDeclaration` carries these as
      // `… | null | undefined` while a `ClassMethod`'s fields are `… | null`
      // (no `undefined` under `exactOptionalPropertyTypes`). For an untyped
      // function both are absent, so the result is `null` — no emit change.
      method.returnType = stmt.returnType ?? null;
      method.typeParameters = stmt.typeParameters ?? null;
      // Indent the generated method by 2 to carry the class-body prefix the
      // surrounding `methodChunks` entries already include.
      methodChunks.push(indent(generate(method, GEN_OPTS).code, 2));
      continue;
    }

    // Free expression statement (e.g. console.log) — move into firstUpdated.
    freeChunks.push(generate(stmt, GEN_OPTS).code);
  }

  return {
    methods: methodChunks.join('\n\n'),
    freeStatements: freeChunks.join('\n'),
  };
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length > 0 ? pad + line : line))
    .join('\n');
}

/**
 * Inline a lifecycle hook from the IR's LifecycleHook list (paired form).
 * The IR already pairs $onMount/$onUnmount via the lowerer (D-19).
 *
 * Each hook's setup/cleanup expression is wrapped into a synthetic Babel File
 * + Program and run through rewriteScript so $props.X / $data.X / $refs.X /
 * top-level method names get rewritten to `this.X` form. Then the body is
 * rendered with @babel/generator.
 */
function lifecycleHookBody(
  hook: LifecycleHook,
  ir: IRComponent,
  methodNames: Set<string>,
  runtime: RuntimeLitImportCollector,
): { body: string; cleanup: string } {
  let body = '';
  if (t.isBlockStatement(hook.setup)) {
    const wrapper = t.file(t.program([...hook.setup.body]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames, runtime });
    body = rewritten.file.program.body.map((s) => generate(s, GEN_OPTS).code).join('\n');
  } else if (t.isExpression(hook.setup)) {
    // A bare callable reference (`$onMount(reset)` → Identifier;
    // `$onMount(obj.handler)` → MemberExpression) needs to be INVOKED, so wrap
    // it in a CallExpression before splicing as a statement.
    //
    // Any other Expression came from extractCleanupReturn unwrapping a
    // concise-body arrow (`$onMount(() => reset())` → CallExpression `reset()`).
    // Splice it AS A STATEMENT — wrapping in another CallExpression would emit
    // `this.reset()();` (double-call), which both fails at runtime and TDZs on
    // the inner reference because lifecycle bodies run before user arrows are
    // initialised on the class.
    const isCallableRef =
      t.isIdentifier(hook.setup) || t.isMemberExpression(hook.setup);
    const cloned = t.cloneNode(hook.setup, true, false);
    const stmt = isCallableRef
      ? t.expressionStatement(t.callExpression(cloned, []))
      : t.expressionStatement(cloned);
    const wrapper = t.file(t.program([stmt]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames, runtime });
    body = rewritten.file.program.body.map((s) => generate(s, GEN_OPTS).code).join('\n');
  }

  let cleanup = '';
  if (hook.cleanup) {
    // Preserve multi-line shape — rewriteTemplateExpression flattens newlines
    // which can swallow line-comments inside arrow bodies. Use rewriteScript
    // over a wrapper file + multi-line generator instead.
    const cleanupClone = t.cloneNode(hook.cleanup, true, false);
    const wrapper = t.file(t.program([t.expressionStatement(cleanupClone)]));
    const rewritten = rewriteScript(wrapper, ir, { methodNamesOverride: methodNames, runtime });
    const stmt = rewritten.file.program.body[0]!;
    if (t.isExpressionStatement(stmt)) {
      cleanup = generate(stmt.expression, GEN_OPTS).code;
    }
  }

  return { body, cleanup };
}

export function emitScript(
  ir: IRComponent,
  opts: EmitScriptOpts,
): EmitScriptResult {
  const diagnostics: Diagnostic[] = [];

  // Decorator imports we always need.
  if (ir.props.length > 0) opts.decorators.add('property');
  if (ir.state.length > 0) opts.signals.add('signal');
  if (ir.refs.length > 0) opts.decorators.add('query');

  // Track model props — need controllable helper + dispatch.
  const modelProps = ir.props.filter((p) => p.isModel);
  if (modelProps.length > 0) opts.runtime.add('createLitControllableProperty');

  // 1. Field declarations.
  const fieldLines: string[] = [];
  const attrCallbackLines: string[] = [];

  for (const prop of ir.props) {
    if (prop.isModel) {
      const emit = emitModelProp(prop, ir.name);
      fieldLines.push(emit.fieldDecl);
      attrCallbackLines.push(emit.attrCallback);
    } else {
      fieldLines.push(emitNonModelProp(prop));
    }
  }

  for (const state of ir.state) {
    fieldLines.push(emitStateField(state.name, state.initializer));
  }

  for (const ref of ir.refs) {
    fieldLines.push(emitRefField(ref.name, ref.elementTag));
  }

  // 2. Rewrite the script Babel AST so $props.X / $data.X / etc. become this.X
  // before we render statements out.
  const rewritten = rewriteScript(ir.setupBody.scriptProgram, ir, {
    runtime: opts.runtime,
  });

  // 2b. Spike 001 B1 + Phase 9 Plan 09-04 — partition user-authored top-level
  //     ImportDeclarations AND statement-position `interface`/`type`
  //     declarations out of the rewritten Program body BEFORE partitionScript
  //     classifies statements. Mutate `rewritten.file.program.body` in place to
  //     drop both.
  //
  //     `userImports` is surfaced as a string for the shell to splice at module
  //     top — without this hoist imports would land inside `firstUpdated()`
  //     (the per-target lifecycle body) and produce TS1232.
  //
  //     `hoistedTypeNodes` carries any `<script lang="ts">` statement-position
  //     `TSInterfaceDeclaration` / `TSTypeAliasDeclaration`. Left in the body
  //     they would fall through `partitionScript` → `classBodyFromStatements`
  //     into the `freeChunks` bucket and land inside `firstUpdated()`, where a
  //     type declaration is a TS syntax error (TS1184). They are rendered into
  //     `hoistedTypeDecls`; emitLit concatenates that into the shell's
  //     `interfaceDecls` bucket so they land at MODULE scope, above the class.
  //     Always empty for an untyped `<script>`, so untyped emit is
  //     byte-identical.
  const {
    userImports: userImportNodes,
    hoistedTypeDecls: hoistedTypeNodes,
    bodyStmts: nonImportStmts,
  } = partitionUserImports(rewritten.file);
  rewritten.file.program.body = nonImportStmts;
  const userImports =
    userImportNodes.length > 0
      ? userImportNodes.map((imp) => generate(imp, GEN_OPTS).code).join('\n') + '\n'
      : '';
  const hoistedTypeDecls = hoistedTypeNodes.map(
    (decl) => generate(decl, GEN_OPTS).code,
  );

  // 3. Partition the rewritten program into class-level vs lifecycle.
  const partition = partitionScript(rewritten.file);

  const computedNames = new Set(ir.computed.map((c) => c.name));
  const { methods: classMethodsFromScript, freeStatements } = classBodyFromStatements(
    partition.classLevelStmts,
    computedNames,
  );

  // 4. Model-prop getter/setter pair → methods.
  const modelMethodLines: string[] = modelProps.map(emitModelGetterSetter);

  const methodDecls = [classMethodsFromScript, modelMethodLines.join('\n')]
    .filter((s) => s.trim().length > 0)
    .join('\n\n');

  // 5. Lifecycle hook routing — IR-level hooks (paired by lowerScript) take
  // precedence; in addition, $onMount/$onUnmount/$onUpdate calls in the script
  // body (partitioned above) are inlined in source order.
  const mountBodies: string[] = [];
  const unmountBodies: string[] = [];
  const updateBodies: string[] = [];
  const cleanupPushes: string[] = [];

  // If IR provides paired lifecycle, prefer it for emission.
  // Collect method names from the original IR script program so identifiers
  // in lifecycle hooks get rewritten to `this.X`.
  const methodNames = collectMethodNamesFromProgram(ir.setupBody.scriptProgram, ir);
  if (ir.lifecycle && ir.lifecycle.length > 0) {
    for (const hook of ir.lifecycle) {
      const { body, cleanup } = lifecycleHookBody(hook, ir, methodNames, opts.runtime);
      if (hook.phase === 'mount') {
        if (body.trim()) mountBodies.push(body);
        if (cleanup) {
          cleanupPushes.push(`this._disconnectCleanups.push((${cleanup}));`);
        }
      } else if (hook.phase === 'unmount') {
        if (body.trim()) unmountBodies.push(body);
      } else if (hook.phase === 'update') {
        if (body.trim()) updateBodies.push(body);
      }
    }
  } else {
    // Fall back to inlining partition hooks directly.
    for (const h of partition.mountHooks) {
      const { body, cleanup } = inlineHookBody(h.arg);
      if (body.trim()) mountBodies.push(body);
      if (cleanup) {
        cleanupPushes.push(`this._disconnectCleanups.push((${cleanup}));`);
      }
    }
    for (const h of partition.unmountHooks) {
      const { body } = inlineHookBody(h.arg);
      if (body.trim()) unmountBodies.push(body);
    }
    for (const h of partition.updateHooks) {
      const { body } = inlineHookBody(h.arg);
      if (body.trim()) updateBodies.push(body);
    }
  }

  // 5b. Quick plan 260515-u2b + fullcalendar-lit-watch-property fix (2026-05-19,
  // option #3 hybrid IR classification). $watch routing depends on
  // `WatchHook.getterDeps`:
  //
  //   - props-only getter → emit `if (changedProperties.has('X')) { … }`
  //     blocks inside `updated()`. Lit fires `updated()` whenever a
  //     @property accessor changes, which subsumes the watcher contract for
  //     prop reads. `@lit-labs/preact-signals` `effect()` does NOT subscribe
  //     to @property reads (those aren't preact-signals), so the historic
  //     `effect()` route was a silent no-op for $props-only watchers — the
  //     bug that left FullCalendar's `$watch(() => $props.events, …)` from
  //     ever firing post-mount.
  //
  //   - data/computed/slots/closure-touching getter → keep the `effect()`
  //     route since those scopes ARE preact-signals in target-lit's emit
  //     surface and `effect()` subscribes correctly. The route is also
  //     necessary because $data-only changes don't flow through @property
  //     setters, so `updated()` wouldn't fire on them.
  //
  // partition.watcherHooks (rewritten Babel bodies, in source order) and
  // ir.watchers (IR-level WatchHook[] with getterDeps, in source order) are
  // 1:1 by source-order pairing — the same algorithm React's emitScript uses
  // (see `pairClonedWatchers`).
  const watcherCleanupPushes: string[] = [];
  const watcherUpdatedBranches: string[] = [];
  if (partition.watcherHooks.length > 0) {
    // We may add 'effect' below depending on classification — accumulate.
    let needsEffectImport = false;
    const watcherCount = Math.min(
      partition.watcherHooks.length,
      ir.watchers.length,
    );
    for (let i = 0; i < watcherCount; i++) {
      const w = partition.watcherHooks[i]!;
      const irWatcher = ir.watchers[i]!;
      const classification = classifyWatcherRoute(irWatcher);

      // Wrap each function expression in @babel/types in a Program so the
      // rewrite pass can lower $props.x → this.x, $data.x → this._x.value, etc.
      const getterWrapper = t.file(t.program([t.expressionStatement(w.getter)]));
      const cbWrapper = t.file(t.program([t.expressionStatement(w.callback)]));
      const getterRewritten = rewriteScript(getterWrapper, ir, {
        methodNamesOverride: methodNames,
        runtime: opts.runtime,
      });
      const cbRewritten = rewriteScript(cbWrapper, ir, {
        methodNamesOverride: methodNames,
        runtime: opts.runtime,
      });
      const getterStmt = getterRewritten.file.program.body[0]!;
      const cbStmt = cbRewritten.file.program.body[0]!;
      const getterCode =
        t.isExpressionStatement(getterStmt)
          ? generate(getterStmt.expression, GEN_OPTS).code
          : '() => {}';
      const cbCode =
        t.isExpressionStatement(cbStmt)
          ? generate(cbStmt.expression, GEN_OPTS).code
          : '() => {}';
      // Bind the getter's evaluated value as the callback's first argument so
      // user-authored `(v) => ...` params actually receive the new value at
      // invocation time. Without this the param is bound to `undefined`.
      //
      // Only pass __watchVal when the callback declares a param to receive it.
      // Passing an arg to a 0-param arrow is runtime-safe (JS drops extras) but
      // tsc flags TS2554 "Expected 0 arguments, but got 1". The conditional
      // bind keeps both `(v) => ...` and `() => ...` shapes type-clean.
      const callArg = w.callback.params.length > 0 ? '__watchVal' : '';

      if (classification.route === 'props' && classification.propNames.length > 0) {
        // updated(changedProperties)-based route. One branch per WatchHook.
        // The branch fires when ANY of the prop names the getter reads has
        // changed. We evaluate the rewritten getter (which already reads
        // `this.X` after rewriteScript) to obtain the new value, then invoke
        // the user callback with that value.
        //
        // changedProperties.has() check union: `(changedProperties.has('a') || changedProperties.has('b'))`.
        // For the single-prop common case, this collapses to one check.
        //
        // 260602-9lw — `$watch` is now LAZY by default on all six targets
        // (REVERSES the 260519 immediate-by-default contract). Lit's
        // `updated(changedProperties)` ALSO runs on the FIRST render cycle, and
        // on that cycle `changedProperties` contains every property that was
        // set — so a bare `changedProperties.has('X')` would fire at mount. For
        // the default (`!irWatcher.immediate`) we additionally gate on
        // `this.hasUpdated`, which Lit sets to `true` only AFTER the first
        // `updated()` (it is `false` during the first call) — skipping exactly
        // the initial cycle. `{ immediate: true }` drops the `hasUpdated` guard
        // and keeps the eager mount fire.
        const propChecks = classification.propNames
          .map((n) => `changedProperties.has('${n}')`)
          .join(' || ');
        const guard = irWatcher.immediate
          ? propChecks
          : `this.hasUpdated && (${propChecks})`;
        watcherUpdatedBranches.push(
          `if (${guard}) { const __watchVal = (${getterCode})(); (${cbCode})(${callArg}); }`,
        );
      } else {
        // effect()-based route (data/computed/slots/closure-touching, OR
        // empty getterDeps as a defensive fallback).
        //
        // Bug B fix (260519 linechart-watch-recreate) — the callback runs
        // inside `untracked(...)` so its reactive reads (and transitive ones
        // via a helper call like `buildConfig()` reading a `$data` signal) do
        // NOT join the `effect()` dependency set. The getter is still invoked
        // in the tracking scope so its reads subscribe the effect; only those
        // reads define what re-runs the watcher — matching Vue's
        // `watch(getter, cb)`, Solid's untrack-wrapped callback (e57df14), and
        // Angular's `untracked`-wrapped callback. The `updated()`-route
        // branch above is `changedProperties`-gated and needs no untrack.
        //
        // 260602-9lw — `$watch` is now LAZY by default on all six targets
        // (REVERSES the 260519 immediate-by-default contract). preact-signals
        // `effect()` fires on its first run, so for the default
        // (`!irWatcher.immediate`) we add a class-field first-run flag read/
        // written INSIDE `untracked(...)` (mirroring Angular/Svelte) so it does
        // not join the effect's dependency set; the callback is skipped on the
        // first run. `{ immediate: true }` keeps today's eager shape.
        needsEffectImport = true;
        if (irWatcher.immediate) {
          watcherCleanupPushes.push(
            `this._disconnectCleanups.push(effect(() => { const __watchVal = (${getterCode})(); untracked(() => (${cbCode})(${callArg})); }));`,
          );
        } else {
          const flag = `__rozieWatchInitial_${i}`;
          fieldLines.push(`private ${flag} = true;`);
          watcherCleanupPushes.push(
            `this._disconnectCleanups.push(effect(() => { const __watchVal = (${getterCode})(); untracked(() => { if (this.${flag}) { this.${flag} = false; return; } (${cbCode})(${callArg}); }); }));`,
          );
        }
      }
    }
    if (needsEffectImport) {
      opts.signals.add('effect');
      // `untracked` is re-exported by @lit-labs/preact-signals (via
      // `export * from '@preact/signals-core'`) — same import source as `effect`.
      opts.signals.add('untracked');
    }
  }

  // Portal-slot primitive (Spike 003) — synthesize the per-component
  // portal scaffolding. Three artefacts:
  //   - fieldDecl       → pushed alongside other class fields
  //   - closureBlock    → prepended to the firstUpdated body so user code
  //                       (which got `$portals.X` rewritten to `portals.X`)
  //                       has the closure in scope
  //   - disconnectedBlock → prepended to disconnectedCallback body
  const portalsEmit = emitPortals(ir, opts.portalScopeHash ?? '');
  if (portalsEmit.hasPortals) {
    opts.lit.add('render');
    opts.lit.add('nothing');
    fieldLines.push(portalsEmit.fieldDecl);
  }

  // 6. firstUpdated body: free-statement preamble + cleanup pushes + mount hooks
  //    + watcher effect registrations. Watcher registrations live alongside
  //    cleanup pushes — they MUST fire at first paint so the @lit-labs/preact-signals
  //    effect subscribes before any user interaction.
  const mountSegments: string[] = [];
  if (portalsEmit.hasPortals) mountSegments.push(portalsEmit.closureBlock);
  if (freeStatements.trim()) mountSegments.push(freeStatements);
  if (cleanupPushes.length > 0) mountSegments.push(cleanupPushes.join('\n'));
  if (watcherCleanupPushes.length > 0)
    mountSegments.push(watcherCleanupPushes.join('\n'));
  for (const body of mountBodies) mountSegments.push(body);

  const unmountSegments: string[] = [];
  if (portalsEmit.hasPortals) unmountSegments.push(portalsEmit.disconnectedBlock);
  unmountSegments.push(...unmountBodies);

  // 7. updated() body: $watch property-route branches + $onUpdate hook bodies.
  // The $watch branches go FIRST so a user $onUpdate that wants to observe a
  // mutation triggered by a watcher sees the post-watcher state. Both surfaces
  // run only AFTER firstUpdated (Lit's lifecycle ordering), so the initial
  // mount uses firstUpdated for setup and `updated()` for reactive sync.
  const updatedSegments: string[] = [];
  if (watcherUpdatedBranches.length > 0)
    updatedSegments.push(watcherUpdatedBranches.join('\n'));
  if (updateBodies.length > 0) updatedSegments.push(updateBodies.join('\n\n'));

  return {
    hasPortals: portalsEmit.hasPortals,
    fieldDecls: fieldLines.join('\n'),
    methodDecls,
    mountHookBody: mountSegments.join('\n\n'),
    unmountHookBody: unmountSegments.join('\n\n'),
    updateHookBody: updatedSegments.join('\n\n'),
    attributeChangedBody: attrCallbackLines.join('\n'),
    userImports,
    hoistedTypeDecls,
    scriptMap: null,
    preambleSectionLines: 0,
    diagnostics,
  };
}
