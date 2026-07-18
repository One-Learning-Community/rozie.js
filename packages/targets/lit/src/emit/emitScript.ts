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
import { buildPropJsdoc } from '../../../../core/src/codegen/buildPropJsdoc.js';
import { resolveComponentRefs } from '../../../../core/src/codegen/resolveComponentRefs.js';
import {
  isPublishedSpecifier,
  rewriteRozieImport,
} from '../../../../core/src/codegen/rewriteRozieImport.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  PreactSignalsImportCollector,
  RuntimeLitImportCollector,
  LitContextImportCollector,
  LitContextImport,
} from '../rewrite/collectLitImports.js';
import { rewriteScript, collectMethodNamesFromProgram } from '../rewrite/rewriteScript.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { partitionUserImports } from '../rewrite/partitionUserImports.js';
import { toKebabCase } from './emitDecorator.js';
import { emitPortals } from './emitPortals.js';
import { emitContext } from './emitContext.js';
import { computeTsCastWrapText, unwrapTsCast } from '../../../../core/src/ast/unwrapTsCast.js';

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
   * Phase 36 (R10) — `@lit/context` import collector for the cross-component
   * context emit. Optional so legacy callers/tests that don't pass it still
   * compile; emitContext is empty-gated, so an absent collector is only ever
   * touched when the component actually has `$provide`/`$inject`.
   */
  context?: LitContextImportCollector;
  /**
   * Spike 004 — per-component scope hash threaded into `emitPortals` so the
   * portal closure's `container.setAttribute('data-rozie-portal-<name>', …)`
   * line uses the same hash the `@portal` CSS rules are scoped with. Empty
   * string / omitted when the caller has no portal slots to scope.
   */
  portalScopeHash?: string;
  /**
   * command-palette-portal-through-portal cluster (BUG A follow-up) —
   * whether ANY element in this component's template carries `r-portal`
   * (computed once in emitLit.ts via the shared `hasElementPortal` walk,
   * NOT the unrelated `hasPortals` slot-portal-primitive result field
   * above). Threaded into `emitRefField` below — see its doc comment.
   * `false`/omitted is BYTE-IDENTICAL to today (the overwhelming majority
   * of components have no `r-portal` element).
   */
  hasElementPortal?: boolean;
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
  /**
   * Phase 36 (R10) — module-scope `const __rozieCtx_<key> =
   * createContext(Symbol.for('rozie:<key>'));` lines for the context primitive,
   * one per distinct key. emitLit splices these into its `interfaceDecls`
   * bucket (module scope, above the class) so a provider and an in-module
   * consumer share one context object. Empty for a non-context component
   * (byte-identical, R12 / D-5).
   */
  moduleContextDecls: string[];
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
      // Converge on React's permissive `any` precedent (see
      // renderPropsInterface.ts core comment) — `unknown`'s return type is not
      // assignable to a strict typed function param (e.g. `CommandScorer<T>`),
      // producing TS2345. `| null` is retained: a Function prop has no
      // synthesizable zero value (see `zeroValueFor`), so Lit's field default
      // is `null` and the declared type must admit it.
      case 'Function': return '((...args: any[]) => any) | null';
      // A non-builtin identifier is a bare type name referencing a type alias
      // / interface declared in the component's `<script lang="ts">` block
      // (those declarations are module-hoisted on this class-based target).
      // Pass it through verbatim — exactly as the other five targets do — so
      // the consumer's type-checker sees the real type instead of `unknown`.
      default: return ann.name;
    }
  }
  if (ann.kind === 'union') {
    // A function-type member MUST be parenthesized inside a union — `string |
    // (...) => x` is ambiguous/invalid TS (the arrow binds the whole union);
    // `string | ((...) => x)` is correct. Mirrors the same guard applied to the
    // other five targets (renderPropsInterface.ts + react/solid/angular/svelte).
    // Lit's `Function` identifier already pre-expands to a parenthesized form,
    // so this is consistency insurance for future literal-`function` members.
    return ann.members
      .map((m) => {
        const r = renderTsType(m);
        const isFn =
          (m.kind === 'identifier' && m.name === 'Function') ||
          (m.kind === 'literal' && m.value === 'function');
        return isFn ? `(${r})` : r;
      })
      .join(' | ');
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
/**
 * 260712-a09 (Pattern B) — an explicit `default: undefined` (or `default: void 0`)
 * is authorial shorthand for "no meaningful default", not a real default value.
 * `prop.defaultValue` is a live (non-null) AST node for either form, so the
 * `prop.defaultValue != null` guard below would otherwise route it into the
 * `= <default>` initializer branch and emit `foo: string = undefined` — a
 * TS2322 under strictNullChecks (a typed field can't be initialized with
 * `undefined` unless the type itself admits it). Detect both spellings here
 * and treat them identically to "no default" so they fall through to the
 * existing `?:`/`!:` branch.
 */
function isUndefinedDefault(expr: t.Expression): boolean {
  return (
    t.isIdentifier(expr, { name: 'undefined' }) ||
    (t.isUnaryExpression(expr) && expr.operator === 'void')
  );
}

/**
 * 260712-ig6 Task A — the full ARIAMixin field-name set (lib.dom.d.ts). A
 * prop authored with one of these names collides with LitElement's own
 * `implements ARIAMixin` field declaration (always `<T> | null`, NEVER
 * `undefined`-admitting) if it lands in the ordinary no-default `?:`/`!:`
 * branch below — Pattern B's `default: undefined` routes there and would
 * otherwise emit `ariaLabel?: string;` (`string | undefined`), which is not
 * assignable to the base class's `string | null` field (TS2416/TS1240).
 * Gated STRICTLY on name-set membership so every other prop name keeps its
 * pre-existing byte-identical `?:`/`!:` output.
 */
const ARIA_MIXIN_FIELDS = new Set([
  'ariaAtomic',
  'ariaAutoComplete',
  'ariaBusy',
  'ariaChecked',
  'ariaColCount',
  'ariaColIndex',
  'ariaColSpan',
  'ariaCurrent',
  'ariaDescription',
  'ariaDisabled',
  'ariaExpanded',
  'ariaHasPopup',
  'ariaHidden',
  'ariaInvalid',
  'ariaKeyShortcuts',
  'ariaLabel',
  'ariaLevel',
  'ariaLive',
  'ariaModal',
  'ariaMultiLine',
  'ariaMultiSelectable',
  'ariaOrientation',
  'ariaPlaceholder',
  'ariaPosInSet',
  'ariaPressed',
  'ariaReadOnly',
  'ariaRequired',
  'ariaRoleDescription',
  'ariaRowCount',
  'ariaRowIndex',
  'ariaRowSpan',
  'ariaSelected',
  'ariaSetSize',
  'ariaSort',
  'ariaValueMax',
  'ariaValueMin',
  'ariaValueNow',
  'ariaValueText',
  'role',
]);

function renderFieldSuffix(prop: PropDecl): string {
  const tsType = renderTsType(prop.typeAnnotation);
  if (prop.defaultValue != null && !isUndefinedDefault(prop.defaultValue)) {
    // Phase 65 (Class 1 / SC-1) — a `null` default on a non-null-admitting field
    // type (`@property() ariaLabel: string = null`) is a type/init mismatch
    // (TS2322 `'null' is not assignable to 'string'`). Widen the DECLARED type to
    // admit the `= null` init, mirroring the React/Solid `| null` prop-interface
    // widening (Phase 16 R1). renderDefault already emits `null` for the init.
    //
    // Byte-identity carve-out: skip types that ALREADY admit `null` under
    // strictNullChecks, so their field text stays byte-identical. A type admits
    // `null` when it contains a `null` union alternative — at the top level
    // (Function props render `(...) | null`) OR paren-grouped within a pure
    // union (data-table `aggregationFn: string | (((...) => any) | null)`
    // flattens to include `null`) — or has a bare `any` / `unknown` union member
    // (`any` sentinel, `any | boolean`). A genuinely null-FAILING type
    // (`string` / `number` / `any[]` (array, not a bare `any`) / an object
    // shape) gets the `| null` suffix. The `\bnull\b` token check is safe here
    // because every `null` appearing in an emitted Lit field type is a pure-union
    // alternative that bubbles to the top (no `Array<T | null>`-style nesting).
    let fieldType = tsType;
    const admitsNull =
      /\bnull\b/.test(fieldType) || /(^|\|)\s*(any|unknown)\s*(\||$)/.test(fieldType);
    if (t.isNullLiteral(prop.defaultValue) && !admitsNull) {
      fieldType = `${fieldType} | null`;
    }
    return `: ${fieldType} = ${renderDefault(prop.defaultValue, prop.typeAnnotation)}`;
  }
  // 260712-ig6 Task A — an ARIAMixin-named prop falls through to here for the
  // `default: undefined` / no-default shapes (Pattern B's no-default branch).
  // The ordinary `?:`/`!:` forms both admit `undefined` in the field's
  // effective type, which collides with LitElement's `implements ARIAMixin`
  // base field (`<T> | null`, never `undefined`). Route ONLY these names to a
  // `| null`-compatible declared+initialized form instead — mirrors the
  // `t.isNullLiteral` widening carve-out above, but keyed on field NAME
  // rather than default-value shape. Every other prop name is untouched.
  if (ARIA_MIXIN_FIELDS.has(prop.name)) {
    const admitsNull = /\bnull\b/.test(tsType) || /(^|\|)\s*(any|unknown)\s*(\||$)/.test(tsType);
    const nullableType = admitsNull ? tsType : `${tsType} | null`;
    return `: ${nullableType} = null`;
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

/**
 * Quick 260717-uvl — rewriteTemplateExpression's flattenInlineCode collapses
 * every newline to a single space WITHOUT stripping `//` line comments. A
 * multi-line `<data>` initializer (e.g. an object literal with an inline
 * `// comment` on one of its properties) would have that comment silently
 * swallow the REST of the flattened line — a real, observed corpus bug (the
 * FlowCanvas demo's `graph` initializer). Strip all comments from a cloned
 * copy of the initializer before routing it through the per-target rewriter,
 * scoped to ONLY this new call site (template/handler expressions elsewhere
 * are single-line already and keep their comments untouched).
 */
function stripInitializerComments<T extends t.Node>(node: T): T {
  const cloned = t.cloneNode(node, true, false);
  t.traverseFast(cloned, (n) => {
    delete n.leadingComments;
    delete n.trailingComments;
    delete n.innerComments;
  });
  return cloned;
}

/**
 * Quick 260717-uvl — true when a `<data>` initializer contains a `$props`/
 * `$data` member access anywhere in its subtree (the ONLY shapes that reach
 * emit — `$refs`/`$slots` in a `<data>` initializer remain a ROZ208 error and
 * never get this far). Gates the rewriteTemplateExpression routing so a
 * PLAIN initializer (the overwhelming majority — no sigil at all) keeps its
 * ORIGINAL renderExpression() output byte-identical (multi-line
 * pretty-printed, comments intact). Only a sigil-bearing initializer pays
 * the flattened-single-line cost rewriteTemplateExpression's shared
 * flattenInlineCode imposes — scoping this quick task's snapshot diff to
 * exactly the initializers it is meant to fix.
 */
function initializerHasLeakingSigil(node: t.Node): boolean {
  let found = false;
  t.traverseFast(node, (n) => {
    if (found) return;
    if (t.isMemberExpression(n) && t.isIdentifier(n.object)) {
      if (n.object.name === '$props' || n.object.name === '$data') found = true;
    }
  });
  return found;
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
  // Phase 58 (SC-2/SC-3) — leading JSDoc above the @property decorator (valid
  // TS: JSDoc-above-decorator), gated on `prop.docs` (returns '' for a docless
  // prop → byte-identical, SC-5). The builder's trailing newline joins the
  // block directly onto the field line.
  const jsdoc = buildPropJsdoc(prop, '  ');
  return `${jsdoc}  @property({ type: ${litType}${reflectField} }) ${prop.name}${fieldSuffix};`;
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
  // Phase 58 (SC-2/SC-3) — leading JSDoc above the public @property attr mirror
  // of a model prop, gated on `prop.docs` (returns '' → byte-identical, SC-5).
  // The builder's trailing newline joins the block onto the first field line.
  const jsdoc = buildPropJsdoc(prop, '  ');
  const fieldDecl = [
    `${jsdoc}  @property({ type: ${litType}${reflectField}, attribute: '${attrName}' }) _${prop.name}_attr${attrFieldSuffix};`,
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

function emitStateField(stateName: string, init: t.Expression, ir: IRComponent): string {
  // Signal-backed: `private _x = signal(<init>);`
  // Class 2 (Phase 65-02) — a NARROW-LITERAL `<data>` default makes the signal
  // infer a too-narrow type that breaks every downstream `.value` read:
  //   `[]` → `Signal<never[]>`   → `.value.map` / `repeat` → TS2339/TS2769
  //   `{}` → `Signal<{}>`        → string-key index        → TS7053
  //   `null` → `Signal<null>`    → `.value = <value>`      → TS2322 ('null')
  // Emit an explicit type arg widened via Lit's own renderTsType precedents
  // (`Array → any[]`, `Object → any`) so `repeat()`/index/assignment typecheck.
  // Narrow-literal ONLY: a non-empty literal, a call, or a factory is
  // well-inferred and stays byte-identical (no type arg).
  let typeArg = '';
  if (t.isArrayExpression(init) && init.elements.length === 0) {
    typeArg = '<any[]>';
  } else if (t.isNullLiteral(init)) {
    typeArg = '<any>';
  } else if (t.isObjectExpression(init) && init.properties.length === 0) {
    typeArg = '<any>';
  }
  // Quick 260717-uvl (ROZ208 make-it-work) — route the initializer through
  // rewriteTemplateExpression (the SAME machinery already used to lower
  // $props.X/$data.X in templates/handlers) so a <data> initializer that
  // reads $props.x/$data.x (the idiomatic Vue-port derived-initial pattern)
  // lowers to a this.-prefixed read instead of leaking the raw sigil (TS2304
  // + runtime ReferenceError). DESIGN CAVEAT: this SNAPSHOTS the prop/data
  // value at class-field-initializer time and does not track later changes
  // (the derived-state footgun, uniform across all six targets) — an
  // $onMount seed remains the honest REACTIVE form; this only makes the
  // snapshot form work.
  const initText = initializerHasLeakingSigil(init)
    ? rewriteTemplateExpression(stripInitializerComments(init), ir)
    : renderExpression(init);
  return `  private _${stateName} = signal${typeArg}(${initText});`;
}

function emitRefField(refName: string, elementTag: string, composedType?: string, hasElementPortal?: boolean): string {
  // @query targets refs by data-rozie-ref="<name>" (Plan 06.4-02 inference).
  // The selector pinned by data attribute keeps shadow-DOM scoping correct.
  // Mark with definite-assignment in case the consumer hasn't yet rendered.
  const field = `_ref${refName.charAt(0).toUpperCase()}${refName.slice(1)}`;
  // Phase 66-04 (D-2 Lit branch, SC-3) — ELEMENT-CLASS route: a ref on a
  // `<components>`-composed child types as the CHILD ELEMENT CLASS, not
  // HTMLElement. Lit re-emits the child's `$expose` verbs as PUBLIC members on
  // `class <C> extends LitElement` and the sidecar `.d.rozie.ts` declares
  // `export declare class <C>` + `HTMLElementTagNameMap['rozie-<c>'] = <C>`, so
  // typing the `@query` field as `<C>` makes `this._refX.exposedVerb()`
  // typecheck without a shadow-pierce (mirrors Angular's component-instance
  // approach). The child class name is brought into type scope via a
  // `import type { <C> } from '<importPath>'` line appended to userImports at
  // the call site. INERTNESS GATE: resolveComponentRefs returns nothing for a
  // DOM ref, so `composedType` is undefined and the byte-identical
  // HTMLElement / HTMLDialogElement branch below runs unchanged.
  let domType: string;
  if (composedType) {
    domType = composedType;
  } else {
    // LB6 SEAM 1 — gated carve-out: a ref on a native `<dialog>` types to
    // HTMLDialogElement so `$refs.x.showModal()` / `.close()` are accessible.
    // Emitter-hardening backlog item #4 — extended to `img`/`ul`/`li`
    // (promoted from the dialog-only ternary to a switch; every other tag
    // keeps the byte-identical `HTMLElement` default).
    domType = 'HTMLElement';
    switch (elementTag.toLowerCase()) {
      case 'dialog':
        domType = 'HTMLDialogElement';
        break;
      case 'img':
        domType = 'HTMLImageElement';
        break;
      case 'ul':
        domType = 'HTMLUListElement';
        break;
      case 'li':
        domType = 'HTMLLIElement';
        break;
    }
  }
  // command-palette-portal-through-portal cluster (BUG A) —
  // `hasElementPortal` false/omitted (the overwhelming majority of Lit
  // leaves) stays the plain, BYTE-IDENTICAL uncached `@query` field: a
  // fresh renderRoot-scoped lookup on every access.
  if (!hasElementPortal) {
    return `  @query('[data-rozie-ref="${refName}"]') private ${field}!: ${domType};`;
  }
  // hasElementPortal — this component has at least one `r-portal` element
  // somewhere in its template, which can relocate an ANCESTOR subtree out
  // of `this.renderRoot` (RoziePortalController's `appendChild`) at
  // runtime. A plain `@query`, scoped to `this.renderRoot`, permanently
  // returns null for any ref living inside that relocated subtree once the
  // move happens — even though the node is still connected, just parked in
  // a foreign container (confirmed live: command-palette's $refs.panel/
  // frame/combobox all silently no-op post-portal, breaking goBack()'s
  // seedQuery + the popup reopen + the action-menu focus arbitration).
  //
  // Fix: keep the fresh, uncached `@query` as the PRIMARY probe (so a
  // close→reopen — Lit dropping and recreating the `r-if` subtree — always
  // observes the NEW node, never a stale one), and delegate the fallback to
  // `rozieResolvePortalledRef` (`@rozie/runtime-lit`), which searches WITHIN
  // the LIVE relocated subtree of this instance's own
  // `RoziePortalController`(s). A cache/sticky field seeded lazily on first
  // read does NOT work here — `RoziePortalController.hostUpdated()`
  // performs the relocation synchronously, strictly BEFORE the component's
  // own `firstUpdated()`/`updated()`, so the very first render with the
  // portal already active never gives consumer code a chance to observe the
  // pre-relocation position even once (see `rozieResolvePortalledRef`'s doc
  // comment for the full rationale).
  const rawField = `__rozieRawRef${refName.charAt(0).toUpperCase()}${refName.slice(1)}`;
  return [
    `  @query('[data-rozie-ref="${refName}"]') private ${rawField}!: ${domType};`,
    `  private get ${field}(): ${domType} {`,
    `    return rozieResolvePortalledRef(this, '[data-rozie-ref="${refName}"]', this.${rawField}) as ${domType};`,
    '  }',
  ].join('\n');
}

function isLifecycleCall(stmt: t.Statement): {
  isHook: boolean;
  hookName?: '$onMount' | '$onUnmount' | '$onUpdate';
  argument?: t.Expression;
} {
  if (!t.isExpressionStatement(stmt)) return { isHook: false };
  // ROZ-cast-blindness fix — unwrap through any TS wrapper before the
  // CallExpression check, so `$onMount(...) as void` is still recognized.
  const expr = unwrapTsCast(stmt.expression);
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
      // ROZ-cast-blindness fix — unwrap through any TS wrapper before the
      // CallExpression check, so e.g. `($expose({...}) as unknown)` /
      // `($provide(...) as void)` is still recognized as the sigil.
      const callExpr = unwrapTsCast(stmt.expression);
      if (
        t.isCallExpression(callExpr) &&
        t.isIdentifier(callExpr.callee) &&
        callExpr.callee.name === '$expose'
      ) {
        continue;
      }
      // Phase 36 (R10) — a top-level `$provide('k', v)` call is a COMPILE-TIME
      // directive consumed via `ir.provides` and re-emitted by emitContext as a
      // `new ContextProvider(this, …)` field. Strip the call here so the bare
      // `$provide` identifier never leaks into firstUpdated() as an undefined
      // runtime reference (mirrors the $expose / Angular residual-body strip).
      if (
        t.isCallExpression(callExpr) &&
        t.isIdentifier(callExpr.callee) &&
        callExpr.callee.name === '$provide'
      ) {
        continue;
      }
    }
    // Phase 36 (R10) — a top-level `const x = $inject('k', f?)` binder is a
    // COMPILE-TIME directive consumed via `ir.injects` and re-emitted by
    // emitContext as a `new ContextConsumer(this, …)` field + a null-guarded
    // `get x()` accessor. Strip the declaration here so the bare `$inject`
    // identifier never leaks into the class body as an undefined ref. Only the
    // all-`$inject` declaration form is stripped; a mixed declarator flows
    // through unchanged (ROZ130 forbids mixing in practice).
    if (t.isVariableDeclaration(stmt)) {
      // ROZ132 cast-blindness fix — `d.init` unwraps through any TS wrapper
      // (`as T` / `!` / `satisfies T` / `<T>`) before the CallExpression check,
      // so `const theme = $inject('theme') as ThemeContext` is stripped too.
      const allInject =
        stmt.declarations.length > 0 &&
        stmt.declarations.every((d) => {
          if (!d.init) return false;
          const call = unwrapTsCast(d.init);
          return (
            t.isCallExpression(call) &&
            t.isIdentifier(call.callee) &&
            call.callee.name === '$inject'
          );
        });
      if (allInject) continue;
    }
    // Quick plan 260515-u2b — top-level $watch call detection.
    // ROZ-cast-blindness fix — unwrap through any TS wrapper before the
    // CallExpression check, so `$watch(...) as void` is still recognized.
    if (t.isExpressionStatement(stmt)) {
      const expr = unwrapTsCast(stmt.expression);
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
  modelPropNames: ReadonlySet<string>,
): { route: 'props' | 'effect'; propNames: string[] } {
  const propNames = new Set<string>();
  let nonPropsSeen = false;
  for (const dep of watcher.getterDeps) {
    if (dep.scope === 'props') {
      const name = dep.path.length > 0 ? dep.path[0]! : undefined;
      // A `model: true` prop is NOT a plain Lit `@property`: its value lives in
      // a preact `signal()` behind `createLitControllableProperty`, and the
      // public accessor (`get open()` / `set open()`) never populates
      // `changedProperties` — the reactive `@property` is the attribute mirror
      // `_<name>_attr`, while property-binding and imperative writes flow
      // through `notifyPropertyWrite` → the signal, not the reactive-property
      // setter. So `changedProperties.has('open')` is permanently false and the
      // props-route branch is dead for a model prop. Route it through `effect()`
      // instead: the getter's `this.open` read resolves to the preact-signal
      // read, which `effect()` DOES subscribe to. (Mirror image of the
      // fullcalendar-lit-watch-property fix — there, plain `@property` reads
      // needed the changedProperties route because `effect()` can't see them;
      // here, model-prop signal reads need the effect route because
      // `changedProperties` can't see them.)
      if (name !== undefined && modelPropNames.has(name)) {
        nonPropsSeen = true;
        continue;
      }
      if (name !== undefined) propNames.add(name);
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
        // ROZ-cast-blindness fix — `decl.init` unwraps through any TS wrapper
        // (`as T` / `!` / `satisfies T` / `<T>`) before the CallExpression
        // check, so `const label = $computed(() => ...) as string` is still
        // recognized (rather than falling through to the "plain value
        // initializer" branch below, which would leak the raw `$computed`
        // identifier as a class field — a ReferenceError at runtime). The
        // getter has no natural "wrapped read" call site the way
        // useMemo/computed/createMemo do on the other targets, so the cast is
        // re-applied around the RETURN VALUE instead — `return (expr) as T;`
        // for an expression body, or around an IIFE-wrapped block body.
        const computedCall = unwrapTsCast(decl.init);
        if (
          computedNames.has(name) &&
          t.isCallExpression(computedCall) &&
          t.isIdentifier(computedCall.callee) &&
          computedCall.callee.name === '$computed' &&
          computedCall.arguments.length > 0
        ) {
          const arrow = computedCall.arguments[0]!;
          if (t.isArrowFunctionExpression(arrow) || t.isFunctionExpression(arrow)) {
            const cast = computeTsCastWrapText(
              decl.init,
              (node) => generate(node, GEN_OPTS).code,
            );
            if (t.isExpression(arrow.body)) {
              methodChunks.push(
                `  get ${name}() { return ${cast.prefix}${renderExpression(arrow.body)}${cast.suffix}; }`,
              );
            } else if (t.isBlockStatement(arrow.body)) {
              const bodyCode = arrow.body.body
                .map((s) => generate(s, GEN_OPTS).code)
                .join('\n');
              if (cast.prefix === '' && cast.suffix === '') {
                methodChunks.push(
                  `  get ${name}() {\n${indent(bodyCode, 4)}\n  }`,
                );
              } else {
                // Cast-typed block-bodied computed — no single "return value"
                // to splice the cast onto without re-walking every return
                // statement, so wrap the whole block in an IIFE arrow
                // (preserves `this` binding) and cast its result.
                methodChunks.push(
                  `  get ${name}() { return ${cast.prefix}(() => {\n${indent(bodyCode, 4)}\n  })()${cast.suffix}; }`,
                );
              }
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
    fieldLines.push(emitStateField(state.name, state.initializer, ir));
  }

  // Phase 66-04 (D-2 Lit branch, SC-3) — resolve which refs point at a
  // `<components>`-composed child (shared P1 core resolver, single source of
  // truth). A composed ref types as the child ELEMENT CLASS; a DOM ref is
  // ABSENT from the map (inertness carve-out → the HTMLElement branch is
  // byte-identical). We also gather the distinct child class names that need a
  // `import type { <C> }` line so the field annotation resolves.
  const composedRefs = resolveComponentRefs(ir);
  const composedTypeImports = new Set<string>();
  for (const ref of ir.refs) {
    const composedType = composedRefs.get(ref.name);
    fieldLines.push(emitRefField(ref.name, ref.elementTag, composedType, opts.hasElementPortal));
    // A self-recursion ref (`<Self ref="x">`) resolves to `ir.name` — the class
    // being defined in THIS module — so it needs no import. Only cross-component
    // children (with a distinct import path) require a type import.
    if (composedType && composedType !== ir.name) composedTypeImports.add(composedType);
  }
  // command-palette-portal-through-portal cluster (BUG A) — register the
  // `rozieResolvePortalledRef` runtime import ONLY when emitRefField above
  // actually emitted at least one portal-surviving getter (hasElementPortal
  // AND at least one ref) — mirrors the KeynavController/RoziePortalController
  // conditional-import gates so a non-portal component's
  // `@rozie/runtime-lit` import line stays byte-identical.
  if (opts.hasElementPortal && ir.refs.length > 0) {
    opts.runtime.add('rozieResolvePortalledRef');
  }
  // Build the `import type { <C> } from '<importPath>'` lines. The child is
  // ALREADY side-effect-imported by the shell (`import '<importPath>'`, custom-
  // element registration); this additive TYPE-only import (erased at runtime, so
  // registration still fires exactly once) brings the class NAME into type scope
  // so `private _refX!: <C>` resolves. Inert when no composed ref exists.
  const composedTypeImportLines: string[] = [];
  for (const typeName of composedTypeImports) {
    const decl = (ir.components ?? []).find((c) => c.localName === typeName);
    if (decl) {
      // Phase 75 (D-08/D-09): a LOCAL `.rozie` specifier stays VERBATIM
      // (unchanged — resolved by @rozie/unplugin's `.d.rozie.ts` sidecar). A
      // PUBLISHED cross-package specifier is rewritten to the derived
      // per-target package (`@rozie-ui/combobox-lit`), whose barrel
      // re-exports the class under its OWN name (`export { default as
      // Combobox }`) — the same named-import shape, no default-import
      // conversion needed.
      const importPath = isPublishedSpecifier(decl.importPath)
        ? rewriteRozieImport(decl.importPath, 'lit')
        : decl.importPath;
      composedTypeImportLines.push(`import type { ${typeName} } from '${importPath}';`);
    }
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
  // Phase 66-04 — prepend the composed-child `import type { <C> }` lines (built
  // during ref-field emission above) so the `@query` element-class annotations
  // resolve. Inert (empty) for any component with no composed-component ref, so
  // userImports is byte-identical for every non-composed component.
  const composedTypeImportsBlock =
    composedTypeImportLines.length > 0 ? composedTypeImportLines.join('\n') + '\n' : '';
  // Quick task 260714-orv — render hoisted user imports in ONE
  // @babel/generator pass (`t.program(nodes)` prints only its body
  // statements) so a comment shared between two adjacent imports (Babel
  // attaches it as BOTH the earlier import's `trailingComments` AND the
  // later import's `leadingComments`) prints exactly once. Generating
  // imports one at a time (`nodes.map(...).join`) gives each import its OWN
  // comment-dedup set, doubling any shared comment. Non-comment cases stay
  // byte-identical.
  const userImports =
    composedTypeImportsBlock +
    (userImportNodes.length > 0
      ? generate(t.program(userImportNodes), GEN_OPTS).code + '\n'
      : '');
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
    // Set when any LAZY props-route watcher exists — those need the
    // __rozieFirstUpdateDone class-field gate (see the props-route comment).
    let needsFirstUpdateDoneFlag = false;
    // Model props are signal-backed (createLitControllableProperty), so a
    // $watch over one must take the effect() route, not the dead
    // changedProperties route — see classifyWatcherRoute.
    const modelPropNames = new Set(
      ir.props.filter((p) => p.isModel).map((p) => p.name),
    );
    const watcherCount = Math.min(
      partition.watcherHooks.length,
      ir.watchers.length,
    );
    for (let i = 0; i < watcherCount; i++) {
      const w = partition.watcherHooks[i]!;
      const irWatcher = ir.watchers[i]!;
      const classification = classifyWatcherRoute(irWatcher, modelPropNames);

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
        // set — so a bare `changedProperties.has('X')` would fire at mount.
        //
        // NOTE: `this.hasUpdated` CANNOT serve as the first-cycle gate.
        // ReactiveElement sets `hasUpdated = true` BEFORE invoking `updated()`
        // on the first cycle (@lit/reactive-element 2.1.2,
        // reactive-element.js:943-946 — `hasUpdated = true; firstUpdated(...);`
        // then `updated(...)`), so it is already `true` during the first
        // `updated()` call. Instead we gate on our own class field
        // `__rozieFirstUpdateDone`, which flips to `true` only at the END of
        // the watcher segment of `updated()` — skipping exactly the initial
        // cycle. `{ immediate: true }` drops the gate and keeps the eager
        // mount fire.
        const propChecks = classification.propNames
          .map((n) => `changedProperties.has('${n}')`)
          .join(' || ');
        if (!irWatcher.immediate) needsFirstUpdateDoneFlag = true;
        const guard = irWatcher.immediate
          ? propChecks
          : `this.__rozieFirstUpdateDone && (${propChecks})`;
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
    if (needsFirstUpdateDoneFlag) {
      // Lazy props-route watchers gate on this field instead of
      // `this.hasUpdated` (which is already `true` during the first
      // `updated()` — see the props-route comment above). The flag flips at
      // the end of the watcher segment so every lazy branch in the same
      // cycle sees the pre-flip value.
      fieldLines.push('private __rozieFirstUpdateDone = false;');
      watcherUpdatedBranches.push('this.__rozieFirstUpdateDone = true;');
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

  // Phase 36 (R10) — cross-component context primitive. Read the $provide value
  // / $inject fallback expressions back from the REWRITTEN program so they carry
  // the $data.x → this._x.value / $computed getter / $props.x → this.x rewrites.
  // Empty-gated on ir.provides/injects so non-context components emit nothing new
  // (R12 / D-5). Provider/Consumer controller fields land alongside the other
  // class fields; the reactive `setValue` effect registrations (Pattern 5 / D-3)
  // join the firstUpdated cleanup-push region so they subscribe at first paint
  // AND tear down on disconnect.
  const contextEmit = emitContext(ir, rewritten.file);
  const moduleContextDecls = contextEmit.moduleContextDecls;
  if (contextEmit.hasContext) {
    for (const line of contextEmit.fieldLines) fieldLines.push(line);
    if (opts.context) {
      for (const sym of contextEmit.litContextImports) {
        opts.context.add(sym as LitContextImport);
      }
    }
    if (contextEmit.needsEffectImport) opts.signals.add('effect');
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
  // Phase 36 (R10 / Pattern 5) — reactive context `setValue` effect
  // registrations join the firstUpdated cleanup-push region: they subscribe to
  // the provided value's signal reads at first paint and tear down on disconnect
  // via `_disconnectCleanups`. Empty for constant / $props-only provided values.
  if (contextEmit.setValueEffects.length > 0)
    mountSegments.push(contextEmit.setValueEffects.join('\n'));
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
    moduleContextDecls,
    scriptMap: null,
    preambleSectionLines: 0,
    diagnostics,
  };
}
