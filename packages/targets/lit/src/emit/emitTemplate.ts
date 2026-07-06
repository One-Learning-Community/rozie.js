/**
 * emitTemplate — Lit target (Plan 06.4-02 Task 1).
 *
 * Walks the IR template tree and produces a Lit `html\`...\`` template literal
 * body (the part that goes inside the backticks). Coordinates:
 *
 *   - `r-for` → `${repeat(items, (item, index) => html\`...\`, (item) => item.key)}`
 *   - `r-if/r-else` → `${cond ? html\`...\` : html\`...\`}` (or `nothing` for empty)
 *   - `:prop="expr"` → `.prop=${expr}` (property binding)
 *   - boolean attr → `?attr=${expr}` (Lit boolean attr sigil)
 *   - `class=` / `style=` → static "..."
 *   - `@event="fn"` → `@event=${($event) => fn($event)}` (handler binding)
 *   - r-model on form input → `.value=${this.X.value} @input=${($event) => this.X.value = $event.target.value}`
 *   - composition tag `<Foo>` → `<rozie-foo>...</rozie-foo>`
 *   - `<slot>` → `<slot name="..."></slot>` with data-rozie-params transport for scoped slots
 *   - `{{ expr }}` → `${expr}` (lit-html auto-escapes by default — T-06.4-03)
 *
 * WR-14 fix: same-name event listeners on a single element (e.g. r-model's
 * implicit `@input` PLUS an authored `@input.debounce(300)`, or
 * `@keydown.enter` PLUS `@keydown.escape`) are MERGED into one `@input=${...}`
 * / `@keydown=${...}` binding. Lit's html`` tagged-template throws
 * "Detected duplicate attribute bindings" at runtime if the same attribute
 * name appears twice on a single element — so we must coalesce. Listeners
 * with `addEventListener` options (capture/passive/once) emit separately
 * (they need their own `{ handleEvent, ...opts }` object).
 *
 * @experimental — shape may change before v1.0
 */
import * as bt from '@babel/types';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateFragmentIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  AttributeBinding,
  Listener,
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry, LitEmissionDescriptor } from '@rozie/core';
import { isEventModifier } from '@rozie/core';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { toKebabCase } from './emitDecorator.js';
import { eventTypeFor } from './emitListeners.js';
import { domElementType } from '../../../../core/src/codegen/domElementType.js';
// Phase 07.2 Plan 03 — consumer-side slot-fill emit for component-tag elements.
import { emitSlotFiller, findTagClose, type EmitSlotFillerCtx } from './emitSlotFiller.js';
// Phase 07.3 Plan 09 — consumer-side `r-model:propName=` two-way binding.
// resolveLitSetterText + kebabize are shared with the standalone
// emitTemplateAttribute branch (re-exported from emitDecorator.toKebabCase
// to guarantee byte-equal CustomEvent name parity with the producer).
import { resolveLitSetterText } from './resolveLitSetterText.js';
import { collectMethodNamesFromIR } from './methodNames.js';
// Phase 71 (r-keynav) — REFERENCE emitter wiring modeled on the React target
// (see emitKeynav.ts's module doc comment).
import {
  buildKeynavFieldDecls,
  keynavItemAttrs,
  keynavRootAttrs,
  resolveKeynavPlan,
  stripKeynavCommitEvent,
  type KeynavEmitPlan,
} from './emitKeynav.js';

export interface EmitTemplateOpts {
  lit: LitImportCollector;
  decorators: LitDecoratorImportCollector;
  runtime: RuntimeLitImportCollector;
  /**
   * Modifier registry for registry-driven template-event modifier dispatch
   * (Plan 07.1-03). `buildEventParts` resolves each `filter`-kind pipeline
   * entry via `registry.get(name).lit(...)` -> `LitEmissionDescriptor` instead
   * of a hand-rolled builtin-name `if`-ladder — so third-party modifiers
   * (e.g. the swipe dogfood canary) emit correctly on template `@event`
   * bindings, not just in `<listeners>` blocks. emitLit threads the shared
   * registry; when omitted a default registry is constructed.
   */
  modifierRegistry?: ModifierRegistry;
  /**
   * Phase 07.6 — producer-side CSS scope token. When set, every
   * `tagKind === 'html'` template element emits with
   * `data-rozie-s-<scopeHash>` so producer's static-styles rules (rewritten
   * via `scopeCss`) can confine to producer-template elements. Consumer
   * property-fill content carries the CONSUMER's hash (different value),
   * so producer rules don't accidentally apply to it post-ec24d26.
   *
   * Same value flows to `emitStyle` so attribute names match between the
   * stamp and the rewritten selectors.
   */
  scopeHash?: string;
  /**
   * Phase 71 (r-keynav) — the per-component keynav emission plan (resolved
   * ONCE by `emitTemplate.ts`'s exported `emitTemplate()` via
   * `resolveKeynavPlan`), or `null` when the component has no `r-keynav`
   * root. `undefined` (the default, back-compat for every existing call
   * site/test-fixture) is treated identically to `null` at every read site
   * (`opts.keynav ?? null`).
   */
  keynav?: KeynavEmitPlan | null;
  /**
   * Phase 71 (r-keynav) — the CURRENT `r-for` loop's index-alias identifier
   * text, threaded by `emitLoop` so a deeply-nested `keynavItem` element can
   * build its `data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabindex`
   * bindings. `undefined` outside any loop. Lit's `repeat()` template
   * callback ALWAYS receives an index parameter (`node.indexAlias ?? '_idx'`
   * — see `emitLoop`), so — UNLIKE the React/Solid references — this never
   * needs a "does the loop body need a synthesized index" pre-check; it is
   * simply set to that same always-present callback parameter on every loop.
   * Scoped to THIS loop's body subtree only — reset to `undefined` outside it
   * so a keynav item's index alias from an outer loop never leaks into an
   * inner, unrelated loop's elements.
   */
  keynavItemIndexAlias?: string | undefined;
  /**
   * Internal mutable state threaded through the emit call chain so recursive
   * emitters (emitLoop) can communicate back to emitTemplate without a module-level
   * singleton. Callers (emitTemplate) initialize this; nested callers mutate it.
   * Not part of the public opts API — emitTemplate initialises it internally.
   *
   * `debouncedFieldDecls` / `debounceCleanupWiring` collect class-field
   * declarations + disconnectedCallback cleanup pushes for template-event
   * `.debounce`/`.throttle` modifiers (WR-15). The wrapper must live on a
   * class field — an inline IIFE in `render()` resets its timer closure on
   * every re-render, silently defeating the debounce.
   *
   * `diagnostics` collects errors raised during deep template-node emission
   * (e.g. `buildEventParts` registry-dispatch failures) and is drained back
   * into the `emitTemplate` result.
   */
  _state?: {
    repeatUsed: boolean;
    /**
     * Quick-task 260518-e2t (Spike 004 Lit subset) — true when at least
     * one literal-object `:style="{...}"` was lowered through `styleMap()`.
     * emitLit.ts reads this off `EmitTemplateResult` and conditionally
     * adds `import { styleMap } from 'lit/directives/style-map.js';` to
     * the shell imports block, mirroring the existing `repeatUsed` →
     * `{ repeat }` import wiring pattern.
     */
    styleMapUsed: boolean;
    /**
     * Plan 14-05 / D-02 — true when at least one `spreadBinding` was lowered
     * via the `${rozieSpread(<expr>)}` lit-html element-position directive.
     * emitLit reads this off `EmitTemplateResult` and conditionally adds
     * `import { rozieSpread } from '@rozie/runtime-lit';` to the shell imports
     * block (mirrors the existing `styleMapUsed` / `repeatUsed` plumbing).
     */
    rozieSpreadUsed: boolean;
    /**
     * Plan 15-05 / D-12 — true when at least one `ListenerSpreadIR` was
     * lowered via the `${rozieListeners(<expr>)}` lit-html element-position
     * AsyncDirective. emitLit reads this off `EmitTemplateResult` and
     * conditionally adds `import { rozieListeners } from '@rozie/runtime-lit';`
     * to the shell imports block (mirrors the existing `rozieSpreadUsed` /
     * `styleMapUsed` plumbing).
     */
    rozieListenersUsed: boolean;
    /**
     * True when at least one consumer-side property-fill (function-prop
     * scoped destructured or portal fill) was emitted onto a producer
     * component's open tag. Triggers a single `ref()` directive per parent
     * tag that calls `adoptConsumerStyles` to bridge the consumer's
     * stylesheets across the producer's shadow boundary — see
     * `@rozie/runtime-lit/adoptConsumerStyles.ts` for the why.
     *
     * Threaded the SAME way as `repeatUsed`/`styleMapUsed`: emitLit reads
     * this off `EmitTemplateResult` and conditionally adds
     * `import { ref } from 'lit/directives/ref.js';` to the shell imports.
     */
    refUsed: boolean;
    debouncedFieldDecls: string[];
    debounceCleanupWiring: string[];
    /**
     * Item 1 (pure-literal component-prop hoist) — per-instance class-field
     * declarations (`private _rozieLit0 = [-77, 37.5];`) for inline
     * Array/Object literals bound to a child component/self-tag prop. Hoisting
     * them to a render-stable per-instance field (NOT a shared module const —
     * an engine that mutates a passed prop in place would otherwise cross-
     * contaminate instances) lets lit-html dedup the binding by reference, so a
     * `model:true` child's reference-equality change guard doesn't re-dispatch
     * every render (the MapLibre-lit infinite-loop class). emitLit splices these
     * alongside the other field decls. The index in `_rozieLit${n}` is the
     * push order (deterministic per template walk → byte-stable output).
     */
    hoistedLiteralFieldDecls: string[];
    /**
     * `r-external` engine-wrapper marker — set true when at least one
     * `TemplateElementIR` with `isExternal === true` was emitted. emitLit
     * reads this off `EmitTemplateResult` and conditionally adds
     * `import { keyed } from 'lit/directives/keyed.js';` plus the
     * `_rozieReconcileSeq = 0;` class field. The seq is bumped by
     * `__rozieReconcileAfterDomMutation` (runtime helper) to invalidate
     * `keyed`-wrapped subtrees while preserving the marked element's own
     * DOM identity (and any third-party listeners attached to it).
     */
    keyedUsed: boolean;
    /**
     * Keyed-remount codegen Task 3 — set true ONLY when at least one
     * `r-external`-marked element was emitted (the `_rozieReconcileSeq`
     * counter is r-external's own invalidation channel; a component-level
     * `:key` remount (`remountKeyExpression`, below) reuses the `keyed()`
     * import via `keyedUsed` but keys off its OWN expression, never the
     * seq counter, so it must NOT trigger this field declaration).
     * emitLit reads this off `EmitTemplateResult` to conditionally declare
     * the `_rozieReconcileSeq = 0;` class field.
     */
    reconcileSeqUsed: boolean;
    /**
     * Phase 24 (req 2) — set true when at least one `r-html` directive was
     * lowered to the unsafeHTML element-content directive. emitLit reads this
     * off `EmitTemplateResult` and conditionally adds the unsafe-html
     * directive import (same plumbing as `keyedUsed`).
     */
    unsafeHtmlUsed: boolean;
    diagnostics: Diagnostic[];
    /**
     * Phase 07.2 Plan 03 — class-field declarations storing captured
     * scoped-slot fill ctx (e.g. `private _headerCtx?: { close: unknown };`).
     * emitLit splices these alongside the other field declarations so they
     * exist before firstUpdated() references them.
     */
    slotFillerClassFields: string[];
    /**
     * Phase 07.3.1 Blocker #3 (D-03) — re-attempt fragments emitted into
     * `updated()` while the per-filler `_slotCtxWired_<name>` flag is
     * false. Closes Race B (producer-upgrade race).
     */
    slotFillerUpdatedBody: string[];
    /**
     * Phase 07.3.1 Blocker #3 (D-03, Landmine 2) — per-filler flag reset
     * lines emitted into `disconnectedCallback()` so re-mount cycles
     * re-attempt wiring cleanly.
     */
    slotFillerDisconnectReset: string[];
  };
}

export interface EmitTemplateResult {
  /** Body to embed inside `html\`...\``. */
  renderBody: string;
  /** Host-listener wiring strings (D-LIT-12) spliced into firstUpdated. */
  hostListenerWiring: string[];
  /**
   * True when `repeat()` from `lit/directives/repeat.js` was used in the template.
   * Replaces the module-level `REPEAT_USED` singleton (CR-06 fix — thread through
   * result instead of mutable module state to support concurrent compilation).
   */
  repeatUsed: boolean;
  /**
   * Quick-task 260518-e2t (Spike 004 Lit subset) — true when at least one
   * literal-object `:style="{...}"` was lowered to `styleMap({...})`.
   * emitLit conditionally wires `import { styleMap } from
   * 'lit/directives/style-map.js';` based on this flag (same plumbing as
   * `repeatUsed` → `{ repeat }`).
   */
  styleMapUsed: boolean;
  /**
   * Plan 14-05 / D-02 — true when at least one `spreadBinding` was lowered
   * via the `${rozieSpread(<expr>)}` element-position directive. emitLit
   * conditionally wires `import { rozieSpread } from '@rozie/runtime-lit';`
   * based on this flag (same plumbing as `styleMapUsed`/`repeatUsed`).
   */
  rozieSpreadUsed: boolean;
  /**
   * Plan 15-05 / D-12 — true when at least one `ListenerSpreadIR` was lowered
   * via the `${rozieListeners(<expr>)}` element-position AsyncDirective.
   * emitLit conditionally wires
   * `import { rozieListeners } from '@rozie/runtime-lit';` based on this flag
   * (same plumbing as `rozieSpreadUsed`).
   */
  rozieListenersUsed: boolean;
  /**
   * True when at least one consumer-side property-fill was emitted onto a
   * producer component's open tag. emitLit conditionally wires
   * `import { ref } from 'lit/directives/ref.js';` based on this flag
   * (same plumbing as `repeatUsed`/`styleMapUsed`).
   */
  refUsed: boolean;
  /**
   * True when at least one `r-external`-marked element was emitted. emitLit
   * conditionally wires `import { keyed } from 'lit/directives/keyed.js';`
   * AND declares a `_rozieReconcileSeq = 0;` class field based on
   * this flag. The seq is bumped by `__rozieReconcileAfterDomMutation`;
   * `keyed(seq, …)` then disposes the children of the marked element on
   * the next render, leaving the marked element itself (and any
   * third-party listeners attached to it) untouched.
   */
  keyedUsed: boolean;
  /**
   * Keyed-remount codegen Task 3 — true ONLY when at least one
   * `r-external`-marked element was emitted. emitLit conditionally declares
   * the `_rozieReconcileSeq = 0;` class field based on THIS flag (not
   * `keyedUsed` — a component-level `:key` remount also sets `keyedUsed`
   * for the shared `keyed` import but never touches the seq counter).
   */
  reconcileSeqUsed: boolean;
  /**
   * Phase 24 (req 2) — true when at least one `r-html` directive was lowered
   * to the unsafeHTML element-content directive. emitLit conditionally wires
   * the unsafe-html directive import based on this flag (same plumbing as
   * `keyedUsed`).
   */
  unsafeHtmlUsed: boolean;
  /**
   * Class-field declarations for template-event `.debounce`/`.throttle`
   * wrappers (WR-15). emitLit splices these into the class body alongside the
   * other field declarations so the wrapper identity is stable across renders.
   */
  debouncedFieldDecls: string[];
  /**
   * Item 1 (pure-literal component-prop hoist) — per-instance class-field
   * declarations for inline Array/Object literals bound to a child component
   * prop, hoisted to render-stable fields so lit-html dedups the binding
   * (breaks the `model:true` reference-equality re-dispatch loop). emitLit
   * splices these into the class body alongside the other field decls.
   */
  hoistedLiteralFieldDecls: string[];
  /**
   * Phase 07.2 Plan 03 — class-field declarations storing captured scoped-
   * slot fill ctx (e.g. `private _headerCtx?: { close: unknown };`).
   * emitLit splices these into the class body so firstUpdated()'s
   * `observeRozieSlotCtx` callback can assign into them.
   */
  slotFillerClassFields: string[];
  /**
   * Phase 07.3.1 Blocker #3 (D-03) — re-attempt fragments routed into the
   * generated `updated()` method body. emitLit composes these with the
   * user $onUpdate hook body at the `parts.updatedBody` site.
   */
  slotFillerUpdatedBody: string[];
  /**
   * Phase 07.3.1 Blocker #3 (D-03, Landmine 2) — per-filler
   * `_slotCtxWired_<name>` flag reset lines routed into the generated
   * `disconnectedCallback()` body. emitLit appends these after
   * `_disconnectCleanups` drain so re-mounts re-attempt cleanly.
   */
  slotFillerDisconnectReset: string[];
  /**
   * Phase 71 (r-keynav) — the group-id field + `new KeynavController(this,
   * {...})` field-initializer declarations (empty array when the component
   * has no `r-keynav` root). emitLit splices these into the class body
   * alongside the other field declarations (mirrors `hoistedLiteralFieldDecls`
   * plumbing).
   */
  keynavFieldDecls: string[];
  diagnostics: Diagnostic[];
}

/** True when the handler IR expression is already a function reference / arrow. */
function isHandlerLike(expr: bt.Expression): boolean {
  if (bt.isArrowFunctionExpression(expr)) return true;
  if (bt.isFunctionExpression(expr)) return true;
  if (bt.isIdentifier(expr)) return true;
  if (bt.isMemberExpression(expr)) return true; // `this.fn`
  // Phase 07.2 Plan 03 — Lit consumer-side scoped fill rewrites bare
  // identifier handler refs (`@click="close"`) into OptionalMemberExpressions
  // (`this._headerCtx?.close`). These are still handler-like — lit-html's
  // `@event=${fn}` semantics call `fn` directly with the event. Treating them
  // as handler-like avoids the synthesized `($event: Event) => { …; }` wrap that
  // would otherwise insert a statement-shape body for what is actually a
  // function-reference expression.
  if (bt.isOptionalMemberExpression(expr)) return true;
  return false;
}

const FORM_INPUT_TAGS = new Set(['input', 'textarea', 'select']);
const BOOLEAN_ATTRS = new Set([
  'disabled',
  'checked',
  'readonly',
  'required',
  'autofocus',
  'hidden',
  'open',
  'multiple',
  'selected',
]);

/**
 * For a TemplateElement with composition kind, return the tag name we emit
 * into the html`` template:
 *   - tagKind: 'html'      → tagName verbatim
 *   - tagKind: 'component' → 'rozie-<kebab>'
 *   - tagKind: 'self'      → 'rozie-<kebab-of-component-name>' (host class)
 */
function resolveTagName(node: TemplateElementIR, irName: string): string {
  if (node.tagKind === 'component') {
    return `rozie-${toKebabCase(node.tagName)}`;
  }
  if (node.tagKind === 'self') {
    return `rozie-${toKebabCase(irName)}`;
  }
  return node.tagName;
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ir: IRComponent,
  opts: EmitTemplateOpts,
): string {
  const code = rewriteTemplateExpression(node.expression, ir);
  // Phase 26 (D-06/D-07) — gate on the IR-precomputed wrap decision. A
  // non-primitive value renders portable JSON instead of `[object Object]`;
  // raw when provably string|number|boolean or safeInterpolation is off
  // (SPEC-3, byte-identical to pre-phase). `rozieDisplay(...)` is injected
  // INSIDE the `${ }` lit-html binding so the value is still part of the
  // reactive template part.
  if (node.wrapForDisplay) {
    opts.runtime.add('rozieDisplay');
    return `\${rozieDisplay(${code})}`;
  }
  return `\${${code}}`;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  // Static text — lit-html escapes interpolated values but leaves raw HTML
  // characters in static segments alone. Preserve byte-for-byte.
  return node.text;
}

function attributeIsRModel(attr: AttributeBinding): boolean {
  // Phase 14 — `spreadBinding` is the name-less kind; it is never `r-model`.
  if (attr.kind === 'spreadBinding') return false;
  return attr.name === 'r-model';
}

/**
 * Phase 24 (req 2) — true for a `binding`-kind `r-html` attribute. Used to
 * (a) skip it inside the open-tag attribute loop so no literal `r-html=`
 * leaks (Pitfall 2) and (b) drive the `${unsafeHTML(<expr>)}` element-content
 * emit in `emitElement` (D-13 mirrors Svelte's element-content form).
 */
function attributeIsRHtml(attr: AttributeBinding): boolean {
  if (attr.kind === 'spreadBinding') return false;
  return attr.kind === 'binding' && attr.name === 'r-html';
}

/**
 * Quick-task 260518-e2t (Spike 004 Lit subset) — admits an ObjectExpression
 * for `styleMap()` lowering ONLY when every property is a plain `key: value`
 * pair. Rejects spreads / methods / computed-keys so the bailout path falls
 * through to the existing passthrough (which would produce
 * `[object Object]` — known broken, documented gap, out of scope for this
 * subset).
 */
function isPlainObjectLiteral(obj: bt.ObjectExpression): boolean {
  for (const prop of obj.properties) {
    if (!bt.isObjectProperty(prop)) return false; // SpreadElement / ObjectMethod
    if (prop.computed) return false;
  }
  return true;
}

/**
 * Item 1 (pure-literal component-prop hoist) — true for an expression that is a
 * compile-time constant with NO reactive parts: a primitive literal, or an
 * Array/Object literal whose every element/value is itself a pure literal (and
 * whose object keys are non-computed). FALSE for anything containing an
 * Identifier, MemberExpression, CallExpression, template-with-expressions,
 * spread, etc. — those must re-evaluate each render.
 *
 * Only Array/Object literals are HOISTED (see emitAttribute): a fresh array/
 * object literal re-evaluated every render is a new reference each pass, which
 * on the Lit target re-triggers a `model:true` child's reference-equality
 * change guard → re-dispatch → SignalWatcher re-entrancy → infinite render
 * loop. Bare primitive literals are dedup'd by value by lit-html already, so
 * they need no hoist.
 */
function isPureLiteral(node: bt.Node): boolean {
  if (
    bt.isNumericLiteral(node) ||
    bt.isStringLiteral(node) ||
    bt.isBooleanLiteral(node) ||
    bt.isNullLiteral(node) ||
    bt.isBigIntLiteral(node)
  ) {
    return true;
  }
  // A signed numeric literal parses as a UnaryExpression (`-77` → `-`/NumericLit).
  // Treat a constant unary on a pure-literal argument as pure (`-`, `+`, `~`
  // are arithmetic on a constant; `!`/`void` on a constant are also constant).
  if (
    bt.isUnaryExpression(node) &&
    node.prefix &&
    (node.operator === '-' ||
      node.operator === '+' ||
      node.operator === '~' ||
      node.operator === '!' ||
      node.operator === 'void') &&
    isPureLiteral(node.argument)
  ) {
    return true;
  }
  if (bt.isArrayExpression(node)) {
    return node.elements.every(
      (el) => el !== null && !bt.isSpreadElement(el) && isPureLiteral(el),
    );
  }
  if (bt.isObjectExpression(node)) {
    return node.properties.every(
      (prop) =>
        bt.isObjectProperty(prop) &&
        !prop.computed &&
        bt.isExpression(prop.value) &&
        isPureLiteral(prop.value),
    );
  }
  return false;
}

function emitAttribute(
  attr: AttributeBinding,
  ir: IRComponent,
  tagName: string,
  tagKind: 'html' | 'component' | 'self' = 'html',
  opts?: EmitTemplateOpts,
): string {
  if (attr.kind === 'static') {
    // Pass through static attribute as-is.
    return `${attr.name}="${attr.value}"`;
  }

  // Phase 14 R2 / D-07 / D-02 / Plan 14-05 — the bare-spread `r-bind="<expr>"`
  // form (and the synthesized `$attrs` auto-fallthrough spread). Lit has no
  // native attribute-object spread; D-02 / 14-RESEARCH Pattern 4 specifies the
  // lit-html element-position `rozieSpread` directive shipped from
  // `@rozie/runtime-lit`. Emit `${rozieSpread(<expr>)}` in element position;
  // the directive does cross-render diffing (removes keys dropped between
  // renders; null/false → removeAttribute). The `_state.rozieSpreadUsed` flag
  // tells the emitLit shell to add the `import { rozieSpread } …` line
  // (mirrors the `styleMapUsed`/`repeatUsed` plumbing).
  //
  // No key normalization is applied (D-03 is React/Solid-only). HTML attribute
  // names flow through verbatim.
  //
  // AUTO-FALLTHROUGH TARGET (resolves CONTEXT.md A1 for Lit): the synthesized
  // `$attrs` `spreadBinding` from Plan 14-02 lands on the template-root element
  // INSIDE the component's shadow tree (the `<button>` the author wrote),
  // NEVER the host custom element. The emitter places the directive on the
  // inner element it sees in the author's template; the host element receives
  // consumer attributes natively via lit-element's reflection layer.
  //
  // R6 LITERAL class/style merge: when a literal `r-bind` object carries
  // `class`/`style` AND the element has an explicit `class`/`:class`/
  // `style`/`:style` sibling, the literal's class/style is folded into Lit's
  // existing class/style attribute path; only the remaining keys flow through
  // `rozieSpread`. The current emit path delegates that R6 fold to the
  // upstream `emitAttributes`-equivalent walk site; here we always emit the
  // full spread (the R6 R6 acceptance fixture's rest is the entire object on
  // the no-sibling path). DYNAMIC objects: see KNOWN LIMITATION below.
  //
  // KNOWN LIMITATION (RESEARCH OQ1 / A4 / Option a) — for a DYNAMIC `r-bind`
  // object the keys are NOT known at compile time, so a `class`/`style` key
  // inside a dynamic spread CANNOT be extracted into the class/style merge
  // path. lit-html's own `rozieSpread` last-applied-wins applies (a later
  // `rozieSpread` overrides an earlier `class={…}` for the same key). The R6
  // acceptance fixture uses a LITERAL `r-bind`, so the literal path is the
  // mandatory, fully-merge-correct one.
  if (attr.kind === 'spreadBinding') {
    const expr = rewriteTemplateExpression(attr.expression, ir);
    if (opts?._state) opts._state.rozieSpreadUsed = true;
    return `\${rozieSpread(${expr})}`;
  }

  // Phase 07.3 Plan 09 — consumer-side `r-model:propName=` two-way binding.
  // Producer side (`createLitControllableProperty` + dispatchEvent of
  // `<kebab(propName)>-change`) is already locked by Phase 06.4 producer
  // emit; this branch emits the consumer-side pair that wires INTO that
  // contract. Landmine: the listener arg MUST be annotated `(e: CustomEvent)`
  // — Lit's default @event arg type is `Event`, which does not expose
  // `.detail`. The validator (ROZ951) already gated the LHS as a writable
  // lvalue per D-03, so resolveLitSetterText can emit unconditionally.
  if (attr.kind === 'twoWayBinding') {
    const valueExpr = rewriteTemplateExpression(attr.expression, ir);
    const setterText = resolveLitSetterText(attr.expression, ir);
    const eventName = `${toKebabCase(attr.name)}-change`;
    return `.${attr.name}=\${${valueExpr}} @${eventName}=\${($event: CustomEvent) => { ${setterText} = $event.detail; }}`;
  }

  if (attr.kind === 'binding') {
    // r-model handled separately (paired with @input + .value).
    if (attributeIsRModel(attr)) return '';

    // Quick-task 260518-e2t (Spike 004 Lit subset) — `:style="{...}"` with a
    // literal ObjectExpression lowers through Lit's styleMap directive so
    // camelCase keys (`backgroundColor`) round-trip to kebab-case CSS, and
    // the object isn't toString'd to `[object Object]`. Marks
    // `styleMapUsed = true` on _state so emitLit threads the
    // `lit/directives/style-map.js` import (mirrors the repeatUsed plumbing).
    // Bails to the existing passthrough for non-literal-object exprs (string
    // form like `:style="'background: red'"` works natively).
    if (
      attr.name === 'style' &&
      bt.isObjectExpression(attr.expression) &&
      isPlainObjectLiteral(attr.expression)
    ) {
      const expr = rewriteTemplateExpression(attr.expression, ir);
      if (opts?._state) opts._state.styleMapUsed = true;
      return `style=\${styleMap(${expr})}`;
    }

    const expr = rewriteTemplateExpression(attr.expression, ir);

    // Quick-task 260620-rta — a dynamic (non-literal-object) `:style` reaching
    // this point (the literal-object form already returned via styleMap above)
    // is routed through `rozieStyle` so an OBJECT value delivered via a prop /
    // identifier / member / call renders real CSS (styleMap directive) instead
    // of toString-coercing to `[object Object]`; a string value passes through
    // verbatim, and a nullish/empty value drops the attribute via `nothing`.
    // Placed here (parallel to and immediately after the styleMap object-literal
    // bail, BEFORE the component/self-tag and generic branches) so a dynamic
    // `:style` is intercepted consistently on both HTML and custom-element hosts.
    // `rozieStyle(...)` stays the DIRECT binding-site value (never a hoisted
    // field) so lit-html re-reads it each render.
    if (attr.name === 'style') {
      opts?.runtime.add('rozieStyle');
      return `style=\${rozieStyle(${expr})}`;
    }

    // Composition/self tags are custom elements — all prop bindings must use
    // property-binding syntax (.prop=${expr}) so objects/arrays aren't stringified.
    // Kebab attribute names (`:on-close`) must be camelized to JS identifiers
    // (`onClose`) so the child element's `this.onClose` getter resolves; the
    // child's `r-if="$props.onClose"` then evaluates correctly. Matches the
    // Angular composition precedent from Phase 06.2.
    if (tagKind === 'component' || tagKind === 'self') {
      const propName = attr.name.includes('-')
        ? attr.name.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
        : attr.name;
      // Item 1 — hoist an inline Array/Object literal bound to a child prop to a
      // per-instance, render-stable class field. Re-evaluated inline (`.center=
      // ${[-77, 37.5]}`), the literal is a fresh reference every render, which
      // a `model:true` child's `Object.is` change guard treats as a new value →
      // re-dispatch → SignalWatcher re-entrancy → infinite loop. A field read
      // (`.center=${this._rozieLit0}`) is reference-stable so lit-html dedups
      // it. Scoped to Array/Object literals: bare primitive literals are already
      // value-dedup'd by lit-html. PER-INSTANCE (not a shared module const) so
      // an engine mutating a passed prop in place can't cross-contaminate
      // instances (the other 5 targets get a fresh value per render → per
      // instance). The field is declared in the class body via emitLit.
      if (
        opts?._state &&
        (bt.isArrayExpression(attr.expression) ||
          bt.isObjectExpression(attr.expression)) &&
        isPureLiteral(attr.expression)
      ) {
        const idx = opts._state.hoistedLiteralFieldDecls.length;
        const fieldName = `_rozieLit${idx}`;
        opts._state.hoistedLiteralFieldDecls.push(
          `  private ${fieldName} = ${expr};`,
        );
        return `.${propName}=\${this.${fieldName}}`;
      }
      return `.${propName}=\${${expr}}`;
    }

    // Boolean attribute prefix.
    if (BOOLEAN_ATTRS.has(attr.name)) {
      return `?${attr.name}=\${${expr}}`;
    }

    // Property bindings: .prop = ${expr} for form-input value/checked etc.
    if (
      (attr.name === 'value' || attr.name === 'checked') &&
      FORM_INPUT_TAGS.has(tagName)
    ) {
      return `.${attr.name}=\${${expr}}`;
    }

    // Default: attribute binding (Lit auto-coerces values to string).
    // Phase 26 (D-06/SPEC-4) — a non-primitive value would auto-coerce to
    // `[object Object]`; wrap in `rozieDisplay` to render portable JSON. Raw
    // otherwise (SPEC-3). Property bindings (`.prop=`) above are exempt — they
    // pass the value through structurally, not as attribute text. `style` and
    // object-expression bindings are structural too — never wrap.
    if (
      attr.wrapForDisplay &&
      attr.name !== 'style' &&
      !bt.isObjectExpression(attr.expression)
    ) {
      // 260608-sya — whole-value generic-attribute binding: route through
      // `rozieAttr` so a nullish value DROPS the attribute (returns lit's
      // `nothing` sentinel in an `attr=${...}` binding) instead of rendering
      // `attr=""`, matching Vue's `:attr` semantics. `false` still stringifies
      // (preserves aria-/data- a11y). Property/boolean/form bindings above are
      // already excluded; the interpolated-segment branch below stays on
      // `rozieDisplay`. `nothing` is supplied by the runtime-lit helper itself,
      // not this emit site, so no `opts.lit.add('nothing')` is needed here.
      opts?.runtime.add('rozieAttr');
      return `${attr.name}=\${rozieAttr(${expr})}`;
    }
    return `${attr.name}=\${${expr}}`;
  }

  if (attr.kind === 'interpolated') {
    // Mix of static + binding segments → emit as a single attribute value
    // built from string concatenation interpolation.
    const parts = attr.segments.map((seg) => {
      if (seg.kind === 'static') return seg.text;
      const code = rewriteTemplateExpression(seg.expression, ir);
      // Phase 26 (D-06/SPEC-4) — wrap a non-primitive interpolated segment.
      if (seg.wrapForDisplay) {
        opts?.runtime.add('rozieDisplay');
        return `\${rozieDisplay(${code})}`;
      }
      return `\${${code}}`;
    });
    return `${attr.name}="${parts.join('')}"`;
  }
  return '';
}

/**
 * Structured r-model output — replaces the legacy single-string
 * `buildRModelBindings` so the event half (`@input` / `@change`) can be
 * merged with same-name listener events instead of emitting duplicate
 * attribute bindings (WR-14 fix).
 *
 * Returns:
 *   - `propBinding`: the property half (`.value=${…}` or `.checked=${…}`)
 *   - `eventName`:   the event name (`input` or `change`)
 *   - `handlerBody`: the bare arrow body (no `@event=${…}` wrapping) so
 *                    it can be combined with other same-name handlers.
 */
function buildRModelParts(
  rModelAttr: AttributeBinding,
  ir: IRComponent,
  tagName: string,
  allAttrs: AttributeBinding[],
): { propBinding: string; eventName: string; handlerBody: string } | null {
  if (rModelAttr.kind !== 'binding') return null;

  const code = rewriteTemplateExpression(rModelAttr.expression, ir);

  // WR-10 fix: detect checkbox/radio inputs via the sibling `type` attribute
  // and use `.checked` / `@change` instead of `.value` / `@input`.
  const typeAttr = allAttrs.find(
    (a) => a.kind === 'static' && a.name === 'type',
  );
  const inputType =
    typeAttr && typeAttr.kind === 'static' ? typeAttr.value.toLowerCase() : '';

  if (
    FORM_INPUT_TAGS.has(tagName) &&
    (inputType === 'checkbox' || inputType === 'radio')
  ) {
    return {
      propBinding: `.checked=\${${code}}`,
      eventName: 'change',
      // Spike-012 R3-4 — annotate the synthesized param (`: Event`) so a strict
      // consumer (`noImplicitAny`) does not see TS7006; the body already casts
      // `$event.target as HTMLInputElement`.
      handlerBody: `($event: Event) => ${code} = ($event.target as HTMLInputElement).checked`,
    };
  }

  // Phase 12 — the resolved `r-model` modifier chain. `.number`/`.trim` splice
  // a `$v`-placeholder value-transform around the value access; `.lazy` swaps
  // the event from `@input` to `@change` (D-08). Both are empty/absent for
  // bare `r-model`, so its emit stays byte-identical to pre-phase.
  const { valueTransforms, isLazy } = partitionModelModifiers(rModelAttr.modifiers);
  const committedValue = applyValueTransformsString(
    '($event.target as HTMLInputElement).value',
    valueTransforms,
  );

  return {
    propBinding: `.value=\${${code}}`,
    eventName: isLazy ? 'change' : 'input',
    // Spike-012 R3-4 — typed synthesized param (strict-consumer TS7006); the
    // value access already casts `$event.target as HTMLInputElement`.
    handlerBody: `($event: Event) => ${code} = ${committedValue}`,
  };
}

/**
 * Phase 12 — partition the resolved `r-model` modifier list (mirrors the
 * AST-based react/solid emitters, string-side):
 *   - `valueTransforms`: ordered `$v`-placeholder fragments (D-07-canonical).
 *   - `isLazy`: whether any modifier declares `eventSwap: 'change'` (`.lazy`).
 */
function partitionModelModifiers(
  modifiers:
    | { name: string; descriptor: { valueTransform?: string; eventSwap?: 'change' } }[]
    | undefined,
): { valueTransforms: string[]; isLazy: boolean } {
  const valueTransforms: string[] = [];
  let isLazy = false;
  for (const m of modifiers ?? []) {
    if (m.descriptor.valueTransform) valueTransforms.push(m.descriptor.valueTransform);
    if (m.descriptor.eventSwap === 'change') isLazy = true;
  }
  return { valueTransforms, isLazy };
}

/**
 * Phase 12 / CR-02 (12-REVIEW) — substitute the reserved `$v` value-access
 * placeholder token in a `valueTransform` fragment. Token-aware: only `$v`
 * appearing as a standalone token (not part of a longer identifier such as
 * `$value` or `__$v_tmp`) is replaced, so a chain step whose intermediate
 * output contains the literal substring `$v` cannot be double-substituted by
 * a later iteration. `$` is a JS identifier character, so the lookbehind
 * excludes both `\w` and `$` and the lookahead excludes `\w`.
 */
function substituteValuePlaceholder(
  fragment: string,
  replacement: string,
): string {
  return fragment.replace(/(?<![\w$])\$v(?!\w)/g, `(${replacement})`);
}

/**
 * Phase 12 — splice the resolved `valueTransform` fragments into a value-access
 * expression STRING. Each fragment carries the literal `$v` placeholder (D-03);
 * substitute `$v` with the current expression text and chain. Empty list ⇒ the
 * input string is returned unchanged (bare `r-model` byte-identical).
 */
function applyValueTransformsString(
  valueAccess: string,
  valueTransforms: string[],
): string {
  let current = valueAccess;
  for (const fragment of valueTransforms) {
    current = substituteValuePlaceholder(fragment, current);
  }
  return current;
}

/**
 * Structured event-listener parts — replaces the legacy single-string
 * `emitEventListener` so same-name listeners can be merged into a single
 * `@event=${…}` binding (WR-14 fix — Lit forbids duplicate attribute names).
 *
 * Returns:
 *   - `eventName`:   the event name (e.g. `'input'`, `'keydown'`, `'click'`)
 *   - `handlerBody`: the bare handler expression (arrow / function reference)
 *                    suitable for direct interpolation into `@event=${…}`
 *                    or composition with another same-name handler
 *   - `optionParts`: capture/passive/once flags as `['capture: true', ...]`.
 *                    When non-empty the listener MUST be emitted as its own
 *                    `@event=${{ handleEvent, ...opts }}` binding — we never
 *                    merge option-bearing listeners with plain ones because
 *                    the options-object form has different runtime semantics.
 */
// NOTE: a `NATIVE_DOM_EVENTS` name-based carve-out used to live here, gating
// whether a `tagKind === 'component'` listener unwrapped `CustomEvent.detail`.
// Removed in 73-04 (emitter-hardening backlog #6) — see the `unwrapDetail`
// comment in `buildEventParts` below for why it was both unexercised and
// parity-breaking.

/**
 * Spike-012 R3-5 — the synthesized `$event` param annotation for a Lit handler.
 *
 * On a NATIVE element, augment the DOM-event type so `$event.target.value` /
 * `$event.currentTarget.value` typecheck. Unlike Solid's JSX event slots (which
 * type `.target` as `Element` and forbid narrowing it by param contravariance),
 * Lit's `@event=${handler}` binding lives inside a tagged template with NO
 * contextual param type — so both `.currentTarget` AND `.target` can be
 * intersected down to the host element's specific type. Only for `html` tags; a
 * component tag's payload is a `CustomEvent` (handled via unwrapDetail), so it
 * keeps the bare event type. Shared by `buildEventParts` and the multi-listener
 * `mergeHandlerBodies` dispatcher so the outer param is assignable to each inner
 * typed handler.
 */
function litEventParamType(
  eventName: string,
  tagKind: 'html' | 'component' | 'self',
  tagName?: string,
): string {
  const evtType = eventTypeFor(eventName);
  return tagKind === 'html' && tagName !== undefined
    ? `${evtType} & { currentTarget: ${domElementType(tagName)}; target: ${domElementType(tagName)} }`
    : evtType;
}

function buildEventParts(
  listener: Listener,
  ir: IRComponent,
  opts: EmitTemplateOpts,
  tagKind: 'html' | 'component' | 'self' = 'html',
  tagName?: string,
): { eventName: string; handlerBody: string; optionParts: string[] } {
  const eventName = listener.event;
  const handlerRaw = rewriteTemplateExpression(listener.handler, ir);

  // Phase 07.3.1 D-LIT-17 — function-typed scoped-slot params (e.g. `close`)
  // can't transit through `data-rozie-params` (JSON.stringify silently drops
  // function values). The producer side emits a matching `@event` binding
  // (`@rozie-<slot>-<param>=${($event: CustomEvent) => userThunk($event.detail)}`)
  // directly on the producer's `<slot>` element via inline @event in
  // emitSlot() (Phase 07.4 D-LIT-12 — replaces the previous host-scope
  // `addEventListener` path so loop-local `r-for` iteration variables are
  // captured naturally). The consumer must dispatch a matching CustomEvent
  // instead of trying to invoke the (always-undefined) function from ctx.
  // Detection matches the EXACT shape `this._<X>Ctx?.<param>` — composite
  // expressions fall through to the Plan 03 late-binding wrap (which
  // preserves the previous behavior for data-typed params).
  //
  // Cascade order:
  //   1. dispatchEvent translation (D-LIT-17) — exact shape `this._<X>Ctx?.<param>`
  //   2. Late-binding wrap (Blocker #3 D-03) — any `this._<X>Ctx?.` reference
  //   3. Bare handler (existing fallback)
  const dispatchMatch = handlerRaw.match(
    /^\s*this\._([A-Za-z0-9_]+)Ctx\?\.([A-Za-z_][A-Za-z0-9_]*)\s*$/,
  );
  let handler: string;
  if (dispatchMatch) {
    const slot = dispatchMatch[1]!;
    const param = dispatchMatch[2]!;
    // WR-04 (Phase 07.4 review): kebab-case both `slot` and `param` so the
    // consumer-side dispatched event name matches the producer-side
    // `@rozie-<slot>-<param>` binding even when the slot or arg name is
    // camelCase (`<slot name="header" :closeModal="closeModal">` →
    // event `rozie-header-close-modal` on both sides). For single-word
    // lowercase identifiers (current test corpus: close, toggle, remove)
    // `toKebabCase()` is a no-op so existing fixtures are unaffected.
    const slotKebab = toKebabCase(slot);
    const paramKebab = toKebabCase(param);
    // Dispatch on $event.currentTarget (the clicked element INSIDE the producer's
    // light DOM), NOT on `this` (which is the consumer — PARENT of the
    // producer in the tree). Bubbling propagates UP, so a consumer-rooted
    // dispatch never reaches the producer's host listener. The clicked
    // element lives inside `<producer-tag>…<button>` (post-D-LIT-18, the
    // button may have slot="…" directly on it); its bubble path goes UP
    // through the producer, triggering the producer's
    // `addEventListener('rozie-<X>-<param>', …)` host wiring.
    //
    // WR-05 (Phase 07.4 review): cast to `EventTarget` (the actual type that
    // defines `dispatchEvent`) rather than `HTMLElement` — `HTMLElement` is
    // wrong for SVG-rooted scoped-slot fills (`<svg @click="close">`), where
    // currentTarget is `SVGElement`. Runtime worked either way because
    // dispatchEvent is on EventTarget, but the cast was lying to downstream
    // tooling that reads the emitted .ts. Using EventTarget is correct and
    // accepts both HTMLElement and SVGElement (and any other EventTarget).
    handler = `($event) => ($event.currentTarget as EventTarget).dispatchEvent(new CustomEvent('rozie-${slotKebab}-${paramKebab}', { detail: e, bubbles: true, composed: true }))`;
  } else {
    // Phase 07.3.1 Blocker #3 (D-03) — wrap scoped-slot-ctx handler in a
    // late-binding arrow so the ctx read happens at click time, not render
    // time. The first render captures _<X>Ctx as undefined (firstUpdated()
    // hasn't run yet, or the producer hasn't upgraded yet); without late
    // binding, Lit installs no listener and clicks no-op forever. Detection
    // regex matches only the `this._<name>Ctx?.` shape produced by
    // emitSlotFiller's rewriteScopedParamRefs (Landmine 3 — must not wrap
    // user-authored _xxxCtx fields). The wrap is benign for non-undefined
    // function references at click time — `($event) => (fn)?.($event)` invokes the
    // function with the event when present and is a silent no-op when not.
    const isScopedCtxHandler = /this\._[A-Za-z0-9_]+Ctx\?\./.test(handlerRaw);
    // WR-02 (Phase 07.4 review): if the handler looks like a bare
    // `this._<X>Ctx<some>.<param>` reference (matches the loose ctx-handler
    // pattern) but does NOT match the strict dispatchEvent shape — e.g.
    // missing the `?.` optional chain (`this._XCtx.param`), extra
    // whitespace, an unexpected member access in the middle — emit a
    // warning so a future change in `rewriteScopedParamRefs` (emitSlotFiller)
    // that breaks the strict-match contract surfaces immediately rather
    // than silently producing a late-binding wrap that always resolves
    // `undefined` for function-typed params (which JSON.stringify dropped
    // through `data-rozie-params`). The bare-`this._<X>Ctx?.<param>` shape
    // is the ONLY shape function-typed params can take; any other shape
    // here means the producer-side `@event` binding will not receive
    // matching CustomEvents.
    const looseScopedCtxBare = /^\s*this\._[A-Za-z0-9_]+Ctx[A-Za-z0-9_?.]*\s*$/.test(handlerRaw);
    if (looseScopedCtxBare && !dispatchMatch) {
      const diagnosticsArr = opts._state?.diagnostics;
      diagnosticsArr?.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'warning',
        message:
          `Function-typed scoped-slot-param handler '${handlerRaw.trim()}' did not match the strict ` +
          `dispatchEvent shape (this._<slot>Ctx?.<param>). The handler will fall through to the ` +
          `late-binding wrap, which is a no-op for function-typed params (they cannot transit through ` +
          `data-rozie-params). If you changed emitSlotFiller.rewriteScopedParamRefs, update the ` +
          `dispatchMatch regex in buildEventParts() to match the new shape.`,
        loc: listener.sourceLoc,
      });
    }
    handler = isScopedCtxHandler
      ? `($event) => (${handlerRaw})?.($event)`
      : handlerRaw;
  }

  // Detect inlineGuard / native flags from the modifier pipeline.
  //
  // Plan 07.1-03: `filter`-kind modifiers are resolved via registry dispatch
  // (`registry.get(name).lit(...)` -> LitEmissionDescriptor) instead of a
  // hand-rolled builtin-name `if`-ladder. This is the same dispatch contract
  // emitListeners.ts already uses — Plan 07.1-02 missed this real template-
  // event path, so third-party modifiers (the swipe dogfood canary) silently
  // emitted no guard. `.debounce`/`.throttle`
  // (`wrap`-kind) keep their bespoke class-field hoisting (WR-15) and
  // capture/passive/once (`listenerOption`-kind) keep their option-token
  // handling — those are not `inlineGuard` descriptors.
  const inlineGuards: string[] = [];
  let captureOpt = false;
  let passiveOpt = false;
  let onceOpt = false;

  let wrapKind: { kind: 'debounce' | 'throttle'; ms: number } | null = null;

  const registry = opts.modifierRegistry;
  const diagnostics = opts._state?.diagnostics;

  for (const entry of listener.modifierPipeline) {
    if (entry.kind === 'listenerOption') {
      if (entry.option === 'capture') captureOpt = true;
      if (entry.option === 'passive') passiveOpt = true;
      if (entry.option === 'once') onceOpt = true;
      continue;
    }
    if (entry.kind === 'wrap' && (entry.modifier === 'debounce' || entry.modifier === 'throttle')) {
      // WR-15: .debounce(ms) / .throttle(ms) on a template event. The wrapper
      // must be hoisted to a class field (see wrapKind handling below) — an
      // inline IIFE in render() resets its timer closure every re-render.
      wrapKind = { kind: entry.modifier, ms: extractNumberArg(entry.args) };
      continue;
    }
    if (entry.kind === 'filter' || entry.kind === 'wrap') {
      // Registry-driven dispatch (Plan 07.1-03). Every `filter`-kind modifier —
      // builtin (.stop/.prevent/.self/.enter/...) or third-party (.swipe) —
      // resolves through the same `impl.lit()` -> LitEmissionDescriptor path.
      const impl = registry?.get(entry.modifier);
      // Phase 12 / D-01 — narrow the discriminated `ModifierImpl` union to the
      // event-shaped variant before touching the event-only `lit()` hook.
      if (!impl || !isEventModifier(impl) || !impl.lit) {
        diagnostics?.push({
          code: RozieErrorCode.TARGET_LIT_RESERVED,
          severity: 'error',
          message: `Modifier '.${entry.modifier}' has no Lit emitter (missing lit() hook).`,
          loc: entry.sourceLoc,
        });
        continue;
      }
      const descriptor: LitEmissionDescriptor = impl.lit(entry.args, {
        source: 'template-event',
        event: listener.event,
        sourceLoc: entry.sourceLoc,
      });
      if (descriptor.kind === 'inlineGuard') {
        inlineGuards.push(descriptor.code);
        continue;
      }
      if (descriptor.kind === 'native') {
        // capture/passive/once option tokens are only meaningful in
        // <listeners> blocks where they map onto addEventListener options.
        diagnostics?.push({
          code: RozieErrorCode.TARGET_LIT_RESERVED,
          severity: 'error',
          message: `Modifier '.${descriptor.token}' has no template-event equivalent in Lit — only valid in <listeners> blocks.`,
          loc: entry.sourceLoc,
        });
        continue;
      }
      // descriptor.kind === 'helper'
      if (descriptor.listenerOnly === true) {
        diagnostics?.push({
          code: RozieErrorCode.TARGET_LIT_RESERVED,
          severity: 'error',
          message: `Modifier '.${entry.modifier}' is listenerOnly — only valid in <listeners> blocks, not on template @event bindings.`,
          loc: entry.sourceLoc,
        });
        continue;
      }
      // A non-debounce/throttle helper on a template @event is not supported
      // by the template-event path (debounce/throttle are handled above via
      // wrapKind class-field hoisting).
      diagnostics?.push({
        code: RozieErrorCode.TARGET_LIT_RESERVED,
        severity: 'error',
        message: `Modifier helper '${descriptor.helperName}' on a template @event is not supported by the Lit template-event emitter.`,
        loc: entry.sourceLoc,
      });
    }
  }

  // Wrap inline expressions (non-function-like) as arrow handlers so they
  // run at event time, not at render time. Function references and arrows
  // are passed verbatim.
  //
  // Plan 07.1-03: when inlineGuards are present the synthesized arrow's `e`
  // param is typed via `eventTypeFor(eventName)` (e.g. `KeyboardEvent`,
  // `TouchEvent`) — the registry's builtin/third-party inlineGuard codes are
  // cast-free (`$event.key`, `e.touches`), so the precise DOM event type is what
  // keeps the emitted output typecheck-clean. Mirrors emitListeners.ts.
  const isFunctionLike = isHandlerLike(listener.handler);
  const evtType = eventTypeFor(eventName);
  const evtParamType = litEventParamType(eventName, tagKind, tagName);
  // Cast the handler to a permissive signature when we invoke it with `e`. A
  // user method declared `close = () => void` is a perfectly reasonable @click
  // handler but tsc flags `(this.close)($event)` as TS2554 "Expected 0 arguments,
  // but got 1". The cast keeps the emit shape identical at runtime while
  // letting tsc accept the synthetic event arg uniformly across `() => void`
  // and `($event: Event) => void` user methods.
  // Component custom events ($emit / model `<prop>-change`) carry their
  // payload in `CustomEvent.detail`. The cross-framework `$event` contract
  // (React callback payload, Vue emit payload) is that the handler sees the
  // EMITTED VALUE, not the DOM event — so on Lit we unwrap `.detail` here,
  // mirroring the r-model (buildRModelParts) and scoped-slot-arg paths that
  // already do. Modifier-bearing handlers (inlineGuards / debounce /
  // throttle) operate on the raw event and are left untouched — modifiers
  // on a component emit are not a meaningful pattern.
  //
  // Emitter-hardening backlog #6 (73-04): a listener on a `tagKind ===
  // 'component'` tag is genuinely AMBIGUOUS at compile time — it can be
  // EITHER (a) consuming the child's own `$emit(name, payload)` (always a
  // real `CustomEvent`, payload in `.detail`), OR (b) an UNDECLARED
  // consumer listener that auto-fell-through onto the child's forwarded
  // `$listeners` and is now attached directly to the child's real internal
  // DOM element — a genuine native `Event`/`MouseEvent` with NO `.detail`
  // (proven live by `ThemedButtonConsumer.rozie`'s R4 auto-fallthrough
  // `@click`/`@mouseenter`, which ThemedButton does NOT itself `$emit`).
  // Both shapes are reachable under the exact same `eventName` (e.g.
  // `click`/`change` could be either), and single-file compilation has no
  // static visibility into whether the referenced child actually `$emit`s
  // that name — so a compile-time, name-based decision (the previous
  // `isNativeDomEvent` denylist) can only ever be wrong in one direction or
  // the other. `$emit`-dispatched payloads and the synthesized
  // `<prop>-change` model event are UNCONDITIONALLY real `CustomEvent`
  // instances (`rewriteScript.ts` / `createLitControllableProperty`); a
  // real bubbled/forwarded native DOM event is NEVER a `CustomEvent`. So
  // decide at RUNTIME via `instanceof CustomEvent` instead of at compile
  // time via the event name — this fixes the name-collision false-negative
  // (a component `$emit`ing under a name that also happens to be a native
  // event name, e.g. `$emit('change', {…})` + `@change="onChange"` — used
  // by `@rozie-ui/pagination`/`@rozie-ui/switch`/`@rozie-ui/number-field`
  // `change` and `@rozie-ui/pdf` `load`, each of which needed an
  // author-side `e.x == null && e.detail ? e.detail : e` fallback to
  // compensate, now deleted) WITHOUT breaking the real-native-event
  // fallthrough case the old denylist legitimately protected.
  const unwrapDetail = tagKind === 'component';

  const HANDLER_CAST = ' as (...args: any[]) => any';
  let body: string;
  if (inlineGuards.length > 0) {
    if (isFunctionLike) {
      body = `($event: ${evtParamType}) => { ${inlineGuards.join(' ')} ((${handler})${HANDLER_CAST})($event); }`;
    } else {
      body = `($event: ${evtParamType}) => { ${inlineGuards.join(' ')} ${handler}; }`;
    }
  } else if (unwrapDetail) {
    if (isFunctionLike) {
      // Bare ref / arrow / member — invoke with the unwrapped payload when
      // the event genuinely carries one, else pass the raw event through.
      body = `($event: Event) => ((${handler})${HANDLER_CAST})($event instanceof CustomEvent ? $event.detail : $event)`;
    } else {
      // Inline expression that may reference `$event` (e.g.
      // `updateColumnCards(column.id, $event)`). Bind a local `$event` to the
      // unwrapped payload (or the raw event, for the native-fallthrough
      // case) so the user's reference resolves correctly either way. The
      // `__rozieEv` param keeps its underscore prefix so an unused-param lint
      // never fires when the handler ignores the event.
      const bind = handler.includes('$event')
        ? 'const $event = __rozieEv instanceof CustomEvent ? __rozieEv.detail : __rozieEv; '
        : '';
      body = `(__rozieEv: Event) => { ${bind}${handler}; }`;
    }
  } else {
    body = isFunctionLike ? `${handler}` : `($event: ${evtParamType}) => { ${handler}; }`;
  }

  // WR-15: .debounce/.throttle wrapper must live on a class field so its timer
  // closure survives across render() calls. Allocate a unique field, register
  // the field declaration + disconnectedCallback cleanup with emitLit via
  // opts._state, and reference the field as the handler body.
  if (wrapKind && opts._state) {
    const idx = opts._state.debouncedFieldDecls.length;
    const fieldName = `_tw${idx}`;
    opts.runtime.add(wrapKind.kind);
    // The wrapped body is invoked lazily through an arrow — `body` may be a
    // bare method reference (`this.onSearch`) whose class field is declared
    // AFTER this wrapper field. A lazy `($event) => (body)($event)` defers the lookup
    // to event time, when all class fields are initialized.
    opts._state.debouncedFieldDecls.push(
      `  private ${fieldName} = ${wrapKind.kind}(($event: Event) => ((${body}) as (...args: any[]) => any)($event), ${wrapKind.ms});`,
    );
    opts._state.debounceCleanupWiring.push(
      `this._disconnectCleanups.push(() => this.${fieldName}.cancel());`,
    );
    body = `this.${fieldName}`;
  }

  const optionParts: string[] = [];
  if (captureOpt) optionParts.push('capture: true');
  if (passiveOpt) optionParts.push('passive: true');
  if (onceOpt) optionParts.push('once: true');

  return { eventName, handlerBody: body, optionParts };
}

/**
 * Extract the numeric argument from a `.debounce(ms)` / `.throttle(ms)`
 * modifier's args array. Mirrors emitListeners.ts's extractNumberArg.
 */
function extractNumberArg(args: unknown[] | undefined): number {
  if (!args || args.length === 0) return 0;
  const first = args[0];
  if (typeof first === 'object' && first !== null) {
    const a = first as Record<string, unknown>;
    if (a.kind === 'literal') {
      if (typeof a.value === 'number') return a.value;
      if (typeof a.value === 'string') {
        const n = Number(a.value);
        return Number.isFinite(n) ? n : 0;
      }
    }
  }
  return 0;
}

/**
 * Combine two-or-more same-name handler bodies into a single arrow that
 * dispatches each in declaration order. Each `handlerBody` is either a
 * function reference (`this.onSearch`), an inline arrow (`($event) => …`), or a
 * guard-wrapped arrow (`($event: Event) => { if (…) return; (this.fn)($event); }`).
 * Calling the body as a function with the event argument works uniformly
 * for all three shapes thanks to JavaScript's `(expr)(arg)` invocation.
 */
function mergeHandlerBodies(bodies: string[], evtType: string = 'Event'): string {
  if (bodies.length === 1) return bodies[0]!;
  const invocations = bodies.map((b) => `(${b})($event);`).join(' ');
  // Type the outer wrapper with the event-specific type so child handlers
  // typed `($event: KeyboardEvent) => ...` (from inline guards like `.enter`/`.escape`)
  // don't get a `Event`-typed `e` passed in — tsc flags TS2345 otherwise.
  return `($event: ${evtType}) => { ${invocations} }`;
}

/**
 * Plan 15-05 — synthesize a virtual `Listener` from a `ListenerSpreadIR`'s
 * `literalKeys[i]` entry. Each literal-key entry carries
 * `{ eventName, modifierPipeline, valueExpr }` — enough to fabricate a
 * Listener with the same shape `buildEventParts` already consumes from
 * `el.events`. `target` is `'self'` (the element this spread lives on);
 * `when` is null; `deps` inherits the parent spread's deps; `source` is
 * `'template-event'` (codegen path treats both sources identically).
 *
 * Mirror of the Vue/Svelte/React/Solid targets' `listenerFromLiteralKey`.
 */
function listenerFromLiteralKey(
  spread: ListenerSpreadIR,
  literalKey: NonNullable<ListenerSpreadIR['literalKeys']>[number],
): Listener {
  return {
    type: 'Listener',
    target: { kind: 'self', el: '$el' },
    event: literalKey.eventName,
    modifierPipeline: literalKey.modifierPipeline,
    when: null,
    handler: literalKey.valueExpr,
    deps: spread.deps,
    source: 'template-event',
    sourceLoc: spread.sourceLoc,
  };
}

function emitElementOpenTag(
  node: TemplateElementIR,
  ir: IRComponent,
  irName: string,
  opts: EmitTemplateOpts,
): { open: string; selfClose: boolean } {
  const tagName = resolveTagName(node, irName);
  const parts: string[] = [];

  // refs: add data-rozie-ref="<name>" attribute (matches @query selector).
  let refAttr: string | null = null;

  const rModelAttr = node.attributes.find((a) => attributeIsRModel(a));

  // Collect class-related attributes so we can merge static + binding into a
  // single classMap call when both are present.
  const staticClassValues: string[] = [];
  let bindingClass: AttributeBinding | null = null;
  for (const attr of node.attributes) {
    // Phase 14 — `spreadBinding` is the name-less kind; it is not a `class`
    // attribute and never participates in the classMap merge.
    if (attr.kind === 'spreadBinding') continue;
    if (attr.name === 'class') {
      if (attr.kind === 'static') {
        staticClassValues.push(attr.value);
      } else if (attr.kind === 'binding') {
        bindingClass = attr;
      } else if (attr.kind === 'interpolated') {
        bindingClass = attr;
      }
    }
  }
  if (bindingClass !== null) {
    if (
      bindingClass.kind === 'binding' &&
      bt.isObjectExpression(bindingClass.expression)
    ) {
      // Object class binding — always use Object.entries so { done: true }
      // renders as "done" not "[object Object]" (CR-01 fix).
      const obj = bindingClass.expression;
      for (const value of staticClassValues) {
        for (const cls of value.split(/\s+/)) {
          if (!cls) continue;
          obj.properties.unshift(
            bt.objectProperty(bt.stringLiteral(cls), bt.booleanLiteral(true)),
          );
        }
      }
      const expr = rewriteTemplateExpression(obj, ir);
      parts.push(
        `class="\${Object.entries(${expr}).filter(([, v]) => v).map(([k]) => k).join(' ')}"`,
      );
    } else if (bindingClass.kind === 'binding') {
      const expr = rewriteTemplateExpression(bindingClass.expression, ir);
      const staticPart = staticClassValues.length > 0
        ? `${staticClassValues.join(' ')} `
        : '';
      // 260620-kby — normalize a non-provably-string plain `:class` binding
      // through `rozieClass` so an array/object class value renders a valid
      // space-joined string instead of JSON / `a,b` / `[object Object]` (this
      // REPLACES the prior `rozieDisplay` wrap, which JSON-stringified an array).
      // `rozieClass(...)` stays the DIRECT binding-site value. A template literal
      // is provably a string (`wrapForDisplay=true` only because the IR checker
      // doesn't model template literals) → keep its pre-fix `rozieDisplay`
      // passthrough (byte-identical). Raw otherwise (`wrapForDisplay=false`).
      let classExpr = expr;
      if (bindingClass.wrapForDisplay) {
        if (bt.isTemplateLiteral(bindingClass.expression)) {
          opts.runtime.add('rozieDisplay');
          classExpr = `rozieDisplay(${expr})`;
        } else {
          opts.runtime.add('rozieClass');
          classExpr = `rozieClass(${expr})`;
        }
      }
      // Use quoted attribute — lit-html requires quotes for mixed static+dynamic values (CR-01 fix).
      parts.push(`class="${staticPart}\${(${classExpr})}"`);
    } else if (bindingClass.kind === 'interpolated') {
      const emitted = emitAttribute(bindingClass, ir, node.tagName, 'html', opts);
      if (emitted) parts.push(emitted);
    }
  } else if (staticClassValues.length > 0) {
    parts.push(`class="${staticClassValues.join(' ')}"`);
  }

  for (const attr of node.attributes) {
    // Phase 14 — `spreadBinding` is the name-less kind; it is not `class`/`ref`
    // and is not `r-model`. Route it straight to `emitAttribute` (which skips
    // it — Lit D-02 spread is Wave 3 / Plan 14-03).
    if (attr.kind !== 'spreadBinding') {
      if (attr.name === 'class') continue;
      if (attr.kind === 'static' && attr.name === 'ref') {
        refAttr = `data-rozie-ref="${attr.value}"`;
        continue;
      }
      if (attributeIsRModel(attr)) continue;
      // Phase 24 (req 2) — strip r-html from the open tag; emitElement emits
      // it as `${unsafeHTML(<expr>)}` element content (Pitfall 2).
      if (attributeIsRHtml(attr)) continue;
      // Keyed-remount codegen Task 3 — a component-level `:key` that lowered
      // to `remountKeyExpression` (Task 1) is consumed by `emitElement`'s
      // `keyed()` wrap (below), NOT emitted as a property binding here. Core
      // deliberately RETAINS the raw `key` binding in `.attributes` (Vue
      // relies on it as its own working vnode-key remount — see Task 1's
      // Global Constraints), so Lit must strip it at its own seam to avoid
      // ALSO emitting a dead `.key=${…}` property binding alongside the
      // `keyed()` wrap. Guarded on `remountKeyExpression` being set so an
      // r-for LOOP key (which never sets `remountKeyExpression`) is
      // untouched here.
      if (attr.name === 'key' && node.remountKeyExpression) continue;
    }
    const emitted = emitAttribute(attr, ir, node.tagName, node.tagKind, opts);
    if (emitted) parts.push(emitted);
  }

  // WR-14: collect r-model's implicit event + all authored events, then
  // group by event name and merge same-name handlers into a single
  // `@event=${…}` binding. Listeners with capture/passive/once options
  // stay separate (they require the `{ handleEvent, …opts }` shape).
  const plainEvents: Array<{ eventName: string; handlerBody: string }> = [];
  const optionEvents: Array<{
    eventName: string;
    handlerBody: string;
    optionParts: string[];
  }> = [];

  if (rModelAttr) {
    const modelParts = buildRModelParts(
      rModelAttr,
      ir,
      node.tagName,
      node.attributes,
    );
    if (modelParts) {
      parts.push(modelParts.propBinding);
      plainEvents.push({
        eventName: modelParts.eventName,
        handlerBody: modelParts.handlerBody,
      });
    }
  }

  // Phase 15 — partition `node.listenerSpreads` into literal-key entries
  // (synthesized into virtual Listeners spliced alongside `node.events` so
  // R6 same-event merge fires through the existing event-grouping below)
  // and dynamic spreads (emitted as separate element-position
  // `${rozieListeners(<expr>)}` bindings — Lit has no native object-form
  // listener directive, so the AsyncDirective is the ONLY correct lowering
  // path for the dynamic case).
  //
  // Defensive `?? []`: synthetic test-IR may omit `listenerSpreads`; the real
  // lowered IR always sets `[]` by construction (Plan 15-01 made the field
  // non-optional on TemplateElementIR).
  const syntheticListenerEvents: Listener[] = [];
  const dynamicListenerSpreads: ListenerSpreadIR[] = [];
  for (const spread of node.listenerSpreads ?? []) {
    const literalKeys = spread.literalKeys;
    if (literalKeys !== undefined && literalKeys.length > 0) {
      for (const lk of literalKeys) {
        syntheticListenerEvents.push(listenerFromLiteralKey(spread, lk));
      }
    } else {
      dynamicListenerSpreads.push(spread);
    }
  }

  // Combine real events + synthetic listener-from-literal-key Listeners.
  // The existing same-event grouping further down folds R6 collisions into
  // a single `@event=${dispatcher}` binding (Lit forbids duplicate attribute
  // names; same-event merge is mandatory for correctness).
  const combinedEvents: Listener[] = [...node.events, ...syntheticListenerEvents];

  for (const event of combinedEvents) {
    const parts1 = buildEventParts(event, ir, opts, node.tagKind, node.tagName);
    if (parts1.optionParts.length > 0) {
      optionEvents.push(parts1);
    } else {
      plainEvents.push({
        eventName: parts1.eventName,
        handlerBody: parts1.handlerBody,
      });
    }
  }

  // Group plain events by name and emit merged handlers. Preserve the
  // first-occurrence order across the original event list so the rendered
  // attribute order stays stable across compilations.
  const groupOrder: string[] = [];
  const groups = new Map<string, string[]>();
  for (const ev of plainEvents) {
    if (!groups.has(ev.eventName)) {
      groups.set(ev.eventName, []);
      groupOrder.push(ev.eventName);
    }
    groups.get(ev.eventName)!.push(ev.handlerBody);
  }
  for (const name of groupOrder) {
    const bodies = groups.get(name)!;
    const merged = mergeHandlerBodies(bodies, litEventParamType(name, node.tagKind, node.tagName));
    parts.push(`@${name}=\${${merged}}`);
  }

  // Option-bearing listeners emit individually — each carries its own
  // `{ handleEvent, capture, passive, once }` object. If the user authored
  // two same-name option-bearing listeners that's a separate (rare) edge
  // case we surface as an emitted duplicate today; Lit will throw at
  // runtime and the user can deduplicate at source. (No reasonable merge
  // semantic exists because their option flags may differ.)
  for (const ev of optionEvents) {
    const optsText = ev.optionParts.join(', ');
    parts.push(
      `@${ev.eventName}=\${{ handleEvent: ${ev.handlerBody}, ${optsText} }}`,
    );
  }

  // Phase 15 — dynamic `ListenerSpreadIR` entries emit as element-position
  // `${rozieListeners(<expr>)}` AsyncDirective bindings. The directive owns
  // the per-Element WeakMap diff (cross-render add/remove/replace), the
  // FORBIDDEN_KEYS prototype-pollution skip (T-15-V5-03), AND the
  // `disconnected()` cleanup that prevents listener leaks across element
  // disposal (T-15-V5-04 — the load-bearing reason `rozieListeners` extends
  // `AsyncDirective` instead of regular `Directive`).
  //
  // D-19 bare `$listeners`: the bare Identifier passes through
  // `rewriteTemplateExpression` unchanged (registered in STABLE_IDENTIFIERS
  // — see Plan 15-01) and resolves to `undefined` at runtime; the directive's
  // `obj ?? {}` coercion (CR-03 mirror) makes that a clean no-op rather than
  // a TypeError. The directive still runs because Lit has no native
  // object-form listener directive — the AsyncDirective IS the lowering for
  // ALL dynamic shapes including bare `$listeners`.
  //
  // Mixed dynamic + literal/explicit: dynamic spreads emit as a SEPARATE
  // `${rozieListeners(...)}` element-position binding; the literal/explicit
  // half rides the `@event=${...}` template-binding path (folded above into
  // a single binding per event name via the same-event grouping). Both
  // attach via DOM-level `addEventListener` (lit-html's `@event` directive
  // and the AsyncDirective's per-key `addEventListener` calls), so the all-
  // fire R6 semantic is preserved automatically at the DOM layer (no runtime
  // `mergeListeners` helper needed for Lit; same divergence from React/Solid
  // that Vue/Svelte exhibit).
  for (const spread of dynamicListenerSpreads) {
    const expr = rewriteTemplateExpression(spread.expression, ir);
    if (opts._state) opts._state.rozieListenersUsed = true;
    parts.push(`\${rozieListeners(${expr})}`);
  }

  if (refAttr) parts.push(refAttr);

  // Phase 71 (r-keynav) — root `aria-activedescendant` and item
  // `id`/`data-rozie-keynav-item`/`data-rozie-keynav-active`/`tabindex`
  // markers (see emitKeynav.ts's module doc comment). `[]` for every
  // element outside a keynav plan (no keynav plan, or this element carries
  // neither marker) — a cheap two-property check, not a tree walk, so
  // non-keynav components pay zero emission cost.
  const keynav = opts.keynav ?? null;
  parts.push(
    ...keynavRootAttrs(keynav, node, opts.runtime),
    ...keynavItemAttrs(keynav, node, opts.keynavItemIndexAlias ?? null),
  );

  // Phase 07.6 — producer-side CSS scope stamp on `tagKind === 'html'`
  // elements: composed custom elements (`component`) own their own internal
  // shadow scope, and the implicit host ('self') is the producer custom
  // element itself (CSS uses `:host` to target it, exempted in scopeCss).
  // Consumer property-fill body elements flow through this path too —
  // they carry the CONSUMER's scope hash, NOT the producer's, so
  // producer-CSS rules never match them across the shadow boundary.
  //
  // Phase 14.1 — ALSO stamp on `tagKind === 'component'` invocations so the
  // consumer's scope attr lands on the child custom element's HOST. Inside
  // the consumer's own shadow root, consumer-authored CSS like
  // `.extra-variant[data-rozie-s-CONSUMER] { font-weight: 600 }` now matches
  // the host custom element (which carries `class="extra-variant"` from the
  // consumer's invocation), and the inner button inherits via `font: inherit`.
  // Mirrors the cross-target scope propagation applied to React + Solid.
  if (
    (node.tagKind === 'html' || node.tagKind === 'component') &&
    opts.scopeHash
  ) {
    parts.push(`data-rozie-s-${opts.scopeHash}`);
  }

  const attrsText = parts.length > 0 ? ' ' + parts.join(' ') : '';
  const isVoid = isVoidElement(node.tagName);
  if (isVoid && node.children.length === 0) {
    return { open: `<${tagName}${attrsText} />`, selfClose: true };
  }
  return { open: `<${tagName}${attrsText}>`, selfClose: false };
}

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
  'meta', 'source', 'track', 'wbr',
]);
function isVoidElement(tagName: string): boolean {
  return VOID_ELEMENTS.has(tagName);
}

function emitNode(
  node: TemplateNode,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  switch (node.type) {
    case 'TemplateInterpolation':
      return emitInterpolation(node, ir, opts);
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateElement':
      return emitElement(node, ir, hostListenerWiring, opts);
    case 'TemplateConditional':
      return emitConditional(node, ir, hostListenerWiring, opts);
    case 'TemplateMatch':
      return emitMatchNode(node, ir, hostListenerWiring, opts);
    case 'TemplateLoop':
      return emitLoop(node, ir, hostListenerWiring, opts);
    case 'TemplateSlotInvocation':
      return emitSlot(node, ir, hostListenerWiring, opts);
    case 'TemplateFragment':
      return emitFragment(node, ir, hostListenerWiring, opts);
    default:
      return '';
  }
}

function emitElement(
  origNode: TemplateElementIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  const markup = emitElementInner(origNode, ir, hostListenerWiring, opts);

  // Keyed-remount codegen Task 3 — a component-level `:key="expr"` (NOT
  // under r-for; that path owns `key` via `TemplateLoopIR.keyExpression`
  // and never sets this field — see Task 1's Global Constraints) lowers to
  // `remountKeyExpression`. Lit has no native "destroy+recreate this
  // element when a property changes" primitive, so we reuse the
  // `r-external` `keyed()` precedent (see the `isExternal` branch inside
  // `emitElementInner`): wrap the ENTIRE component invocation — not just
  // its children, unlike `r-external`'s wrap, because a composed component
  // is typically self-closing and the WHOLE custom element must be
  // disposed + recreated, not merely its content — in
  // `${keyed(<expr>, html\`<invocation>\`)}`. lit-html then disposes and
  // rebuilds the inner template (and the custom element inside it)
  // whenever the key value changes across renders. Applying the wrap here
  // (around the fully-assembled markup returned by every internal return
  // path of `emitElementInner` — selfClose, r-html, slot-fillers, isExternal
  // children-wrap, and the plain children case) means every element shape
  // gets keyed-remount support uniformly, with no per-branch duplication.
  // The inert `.key=` property binding is stripped at `emitElementOpenTag`'s
  // attribute-emit seam (guarded on this SAME field) so it is never ALSO
  // emitted alongside this wrap.
  if (origNode.remountKeyExpression) {
    if (opts._state) opts._state.keyedUsed = true;
    const keyExpr = rewriteTemplateExpression(origNode.remountKeyExpression, ir);
    return `\${keyed(${keyExpr}, html\`${markup}\`)}`;
  }
  return markup;
}

function emitElementInner(
  origNode: TemplateElementIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  // Phase 71 (r-keynav) — strip the synthetic `@keynav-commit` listener
  // BEFORE any listener emission runs; it's routed into `KeynavController`'s
  // `onCommit` option by `emitKeynav.ts`'s `buildKeynavFieldDecls`, never as
  // a `@keynavCommit=${...}` template binding (see `stripKeynavCommitEvent`'s
  // doc comment). No-op (returns the SAME node) for every element that isn't
  // a keynav root.
  const node = stripKeynavCommitEvent(origNode);
  const tagName = resolveTagName(node, ir.name);
  const { open, selfClose } = emitElementOpenTag(node, ir, ir.name, opts);
  if (selfClose) return open;

  // Phase 24 (req 2) — r-html → `${unsafeHTML(<expr>)}` element content
  // (D-13 mirrors Svelte's element-content form). r-html was already stripped
  // from the open tag (emitElementOpenTag attribute loop), so `open` carries
  // no literal `r-html=` (Pitfall 2). Raise ROZ833 (severity error) when
  // children coexist; flag `unsafeHtmlUsed` so emitLit wires the conditional
  // `unsafe-html` import.
  const rHtml = node.attributes.find((a) => attributeIsRHtml(a));
  if (rHtml && rHtml.kind === 'binding') {
    if (node.children.length > 0) {
      opts._state?.diagnostics.push({
        code: RozieErrorCode.TARGET_LIT_RHTML_WITH_CHILDREN,
        severity: 'error',
        message:
          'r-html cannot coexist with template children on the same element. Move r-html to a child element or remove the children.',
        loc: node.sourceLoc,
      });
    }
    if (opts._state) opts._state.unsafeHtmlUsed = true;
    const expr = rewriteTemplateExpression(rHtml.expression, ir);
    return `${open}\${unsafeHTML(${expr})}</${tagName}>`;
  }

  // Phase 07.2 Plan 03 — Lit consumer-side slot-fill emit (R3 + R4).
  //
  // When this element is a component-tag with structured `slotFillers`,
  // render each filler as a child element bearing `slot="<name>"`
  // (shadow-DOM projection) instead of the parallel-array raw children.
  // Scoped fills also push class-field declarations + firstUpdated()
  // wiring for `observeRozieSlotCtx` via opts._state channels (mirrors
  // the existing debouncedFieldDecls pattern).
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const fillerCtx: EmitSlotFillerCtx = {
      ir,
      emitChildren: (children) =>
        children.map((c) => emitNode(c, ir, hostListenerWiring, opts)).join(''),
    };
    const fillerChildren: string[] = [];
    // Phase 07.5 — function-prop emit path: portal slots + scoped slots where
    // the consumer destructures populate `out.propertyAttr` instead of
    // `out.childTemplate`. We accumulate those snippets and splice them into
    // the component's open tag before the final `>` (mirrors emitSlot's
    // eventStr splicing established in Phase 07.4).
    const propertyAttrs: string[] = [];
    let needsObserveImport = false;
    for (const filler of node.slotFillers) {
      const out = emitSlotFiller(filler, fillerCtx);
      if (out.propertyAttr !== undefined && out.propertyAttr.length > 0) {
        propertyAttrs.push(out.propertyAttr);
      } else if (out.childTemplate) {
        fillerChildren.push(out.childTemplate);
      }
      for (const f of out.classFields) {
        opts._state?.slotFillerClassFields.push(f);
      }
      for (const line of out.firstUpdatedLines) {
        hostListenerWiring.push(line);
      }
      if (out.firstUpdatedLines.length > 0) needsObserveImport = true;
      // Phase 07.3.1 Blocker #3 (D-03) — surface updated() re-attempt
      // fragments and disconnect-reset lines through opts._state so emitLit
      // can splice them into the generated `updated()` and
      // `disconnectedCallback()` bodies (mirrors slotFillerClassFields
      // routing pattern).
      for (const line of out.updatedBodyLines) {
        opts._state?.slotFillerUpdatedBody.push(line);
      }
      for (const line of out.disconnectResetLines) {
        opts._state?.slotFillerDisconnectReset.push(line);
      }
    }
    if (needsObserveImport) {
      opts.runtime.add('observeRozieSlotCtx');
    }
    // Phase 07.5 — splice property attrs into the parent component's open
    // tag before the final `>`. `open` is the component's open tag (e.g.
    // `<rozie-modal r-model:open=${…}>`); never self-close in the
    // slot-filler path (components with fills are container elements).
    //
    // WR-03 (Phase 07.5 review): use findTagClose (quote + `${...}`-aware
    // scanner shared with emitSlotFiller) instead of `lastIndexOf('>')`.
    // A naive lastIndexOf walks past attribute interpolations like
    // `@click=${($event) => fn($event)}` and would splice inside an attribute value
    // if any such interpolation followed the property-prop emit. Starting
    // the scan at index 1 skips the opening `<` of the tag itself.
    let openWithProps = open;
    if (propertyAttrs.length > 0) {
      // Phase 07.6 — bridge consumer's stylesheets across the producer's
      // shadow boundary. Function-prop fills render their html template
      // inside the producer's shadow DOM, where the consumer's static
      // styles (scoped to the consumer's own shadow root) cannot reach.
      // Emit a single `ref()` directive per parent tag that adopts the
      // consumer's CSSStyleSheet instances onto the producer's
      // `shadowRoot.adoptedStyleSheets` — the standard Web Components
      // cross-root style-sharing mechanism. Idempotent + safe-when-no-shadow
      // (helper no-ops if the producer is not a Lit custom element).
      opts.runtime.add('adoptConsumerStyles');
      if (opts._state) opts._state.refUsed = true;
      const refAttr =
        '${ref((el: Element | undefined) => el && adoptConsumerStyles(el, ' +
        '(this.constructor as { styles?: unknown }).styles))}';
      propertyAttrs.push(refAttr);
      const tagClose = findTagClose(open, 1);
      if (tagClose === -1) {
        // Defensive — should never happen for well-formed emit output.
        openWithProps = open;
      } else {
        openWithProps =
          open.slice(0, tagClose) + ' ' + propertyAttrs.join(' ') + open.slice(tagClose);
      }
    }
    return `${openWithProps}${fillerChildren.join('')}</${tagName}>`;
  }

  const children = node.children
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
  // `r-external` engine-wrapper marker — wrap the marked element's children
  // in `keyed(this._rozieReconcileSeq ?? 0, html\`…\`)` so that the runtime
  // helper `__rozieReconcileAfterDomMutation` can dispose orphan DOM and
  // rebuild a fresh sentinel-comment structure WITHOUT disturbing the
  // marked element itself (and any third-party listeners attached to it —
  // SortableJS et al.). The seq is bumped by the helper; `keyed` reacts.
  if (node.isExternal === true) {
    if (opts._state) {
      opts._state.keyedUsed = true;
      opts._state.reconcileSeqUsed = true;
    }
    return `${open}\${keyed(this._rozieReconcileSeq ?? 0, html\`${children}\`)}</${tagName}>`;
  }
  return `${open}${children}</${tagName}>`;
}

/**
 * True when some `r-match` branch test references an `Identifier` named
 * `tempName` — i.e. core actually folded the hoist temp into the rungs.
 *
 * Core classifies a non-`Identifier`/`MemberExpression` discriminant as
 * `hoist` (D-03), but the literal-`true`/`false` predicate-chain form (R4)
 * lowers each rung to a BARE predicate that never references the temp. For
 * that form the hoist wrapper would be a dead `const __rozieMatch_N = true`
 * binding — so the wrapper is emitted only when the temp is genuinely used.
 */
function tempNameIsReferenced(node: TemplateMatchIR, tempName: string): boolean {
  const walk = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(walk);
    if (value === null || typeof value !== 'object') return false;
    const obj = value as Record<string, unknown>;
    if (obj['type'] === 'Identifier' && obj['name'] === tempName) return true;
    return Object.values(obj).some(walk);
  };
  return node.branches.some((b) => b.test !== null && walk(b.test));
}

/**
 * D-02 — the `r-match` (`TemplateMatch`) delegate.
 *
 * `node.branches` is byte-identical to `TemplateConditionalIR.branches` (the
 * `r-case`/`r-default` tests are pre-folded by core, plan 11-01), so emitting a
 * match is pure delegation: construct a synthetic `TemplateConditional` and
 * hand it to the INLINE `emitConditional` (the standalone
 * `lit/src/emit/emitConditional.ts` is dead code — RESEARCH Pitfall 2). No
 * bespoke `emitMatch` logic, no touch to `emitConditional`'s signature.
 *
 * Lit's `emitNode` `default:` has no `_exhaustive` never-check, so TS does NOT
 * flag a missing `TemplateMatch` case — this case is added deliberately.
 *
 * When `node.hostElement` is present (a real-element host, `<div r-match>`),
 * the conditional ladder is rendered as the single child of a synthetic copy
 * of that host element — so the host tag + its attributes survive to emitted
 * output (R8), mirroring how a real-element `r-if` host keeps its tag.
 *
 * The `discriminantMode === 'hoist'` path (D-04 — plan 11-05): an expensive
 * `CallExpression` discriminant must be evaluated EXACTLY ONCE per render. The
 * inline `emitConditional` returns a `${...}` interpolation wrapping a ternary
 * ladder; we re-wrap that ladder in a render-scoped arrow IIFE that declares
 * the discriminant temp `node.tempName` (`__rozieMatch_N`, allocated by core)
 * as a local `const` before returning the ladder:
 * `${(() => { const <tempName> = <discriminant>; return <ladder>; })()}`.
 *
 * The arrow runs once each time `render()` evaluates this interpolation, so
 * `<discriminant>` is invoked exactly once and every folded `r-case` test —
 * which already references `t.identifier(node.tempName)` — reads the temp
 * rather than re-invoking the call. (`renderBody` is interpolated inside
 * `html``` by `emitLit.ts`, which is out of this plan's scope, so the temp is
 * declared in this render-scoped arrow rather than as a bare method-prelude
 * statement — functionally a render() prelude `const`: one evaluation, before
 * the ladder.) A `hoist`-classified literal predicate chain whose rungs never
 * reference the temp falls through to pure delegation — no dead wrapper.
 */
function emitMatchNode(
  node: TemplateMatchIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  if (
    node.discriminantMode === 'hoist' &&
    node.tempName !== undefined &&
    tempNameIsReferenced(node, node.tempName)
  ) {
    // D-04 hoist — `emitConditional` returns `${<ladder>}`; strip the `${}`
    // interpolation wrapper and re-wrap as a render-scoped arrow IIFE that
    // binds the discriminant temp once. `node.discriminant` is routed through
    // the SAME `rewriteTemplateExpression` the folded branch tests use.
    const ladderInterp = emitConditional(synthetic, ir, hostListenerWiring, opts);
    const ladder = ladderInterp.startsWith('${') && ladderInterp.endsWith('}')
      ? ladderInterp.slice(2, -1)
      : ladderInterp;
    const discriminantCode = rewriteTemplateExpression(node.discriminant, ir);
    const hoisted = `\${(() => { const ${node.tempName} = ${discriminantCode}; return ${ladder}; })()}`;
    if (node.hostElement !== undefined) {
      const verbatim: TemplateStaticTextIR = {
        type: 'TemplateStaticText',
        text: hoisted,
        sourceLoc: node.hostElement.sourceLoc,
      };
      const wrapper: TemplateElementIR = {
        ...node.hostElement,
        children: [verbatim],
      };
      return emitElement(wrapper, ir, hostListenerWiring, opts);
    }
    return hoisted;
  }
  if (node.hostElement !== undefined) {
    const wrapper: TemplateElementIR = {
      ...node.hostElement,
      children: [synthetic],
    };
    return emitElement(wrapper, ir, hostListenerWiring, opts);
  }
  return emitConditional(synthetic, ir, hostListenerWiring, opts);
}

function emitConditional(
  node: TemplateConditionalIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  // Render as nested ternary chain.
  // branches[0] = if-branch, branches[1+] = else-if branches, last (test:null) = else.
  let result = '';
  let hasElse = false;
  for (let i = node.branches.length - 1; i >= 0; i--) {
    const branch = node.branches[i]!;
    const body = branch.body
      .map((c) => emitNode(c, ir, hostListenerWiring, opts))
      .join('');
    if (branch.test === null) {
      result = `html\`${body}\``;
      hasElse = true;
    } else {
      const cond = rewriteTemplateExpression(branch.test, ir);
      const truthy = `html\`${body}\``;
      const falsy = result.length > 0 ? result : 'nothing';
      result = `${cond} ? ${truthy} : ${falsy}`;
    }
  }
  if (!hasElse) {
    // No else — need `nothing` import.
    opts.lit.add('nothing');
  }
  return `\${${result}}`;
}

function emitLoop(
  node: TemplateLoopIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  opts.lit.add('html');
  // Import repeat directive — registered via a side-effect import on lit/directives/repeat.js.
  // We mark it on lit collector but the rendered import line comes via lit/directives/repeat.js;
  // for v1 we emit a `{ repeat }` value import line manually outside the lit collector.
  // We can't track it in the lit collector (different module). Emit a marker via runtime
  // collector? No — emit a separate top-of-file line. We register through a global stash:
  // simplest path is to emit a `import { repeat } from 'lit/directives/repeat.js';` later
  // in the shell. We'll signal via a side channel: emit a token that emitLit picks up.
  opts.lit.add('html'); // ensure html is in
  // Signal that repeat() was used. Use opts._state to avoid the module-level
  // singleton pattern (CR-06 fix: supports concurrent / parallel compilation).
  if (opts._state) opts._state.repeatUsed = true;

  const items = rewriteTemplateExpression(node.iterableExpression, ir);
  const item = node.itemAlias;
  const idx = node.indexAlias ?? '_idx';
  // Phase 71 (r-keynav) — `repeat()`'s template callback ALWAYS receives an
  // index parameter (`idx`, whether or not the author declared one), so a
  // nested `keynavItem` element's index-alias context is simply `idx` on
  // EVERY loop — no "does this loop need a synthesized index" pre-check the
  // React/Solid references require (their loop callback omits the index
  // entirely unless requested). Scoped to THIS loop's body subtree only via a
  // shallow opts copy — a keynav item's index alias from an outer loop must
  // never leak into an inner, unrelated loop's elements.
  const loopOpts: EmitTemplateOpts = { ...opts, keynavItemIndexAlias: idx };
  const body = node.body
    .map((c) => emitNode(c, ir, hostListenerWiring, loopOpts))
    .join('');
  // For the key function, pass shadowAliases so the loop alias (and idx) are
  // not rewritten to `this.alias.value` — they are loop-scoped, not class fields.
  // This replaces the fragile string-regex hack that CR-03 identified.
  const keyExpr = node.keyExpression
    ? rewriteTemplateExpression(node.keyExpression, ir, { shadowAliases: [item, idx] })
    : `${item}`;
  // Both callbacks take (item, idx) so :key expressions referencing the loop
  // index alias resolve in the key callback's scope (mirrors the renderer's
  // scope). Without this, `:key="fn(item, index)"` saw an undefined `index`.
  const keyFn = `(${item}, ${idx}) => ${keyExpr}`;
  // Explicit `<any>` type arg on repeat — Lit's `repeat<T>(items, keyFn, tplFn)`
  // can't infer T from an `any`-typed iterable (e.g. `this.node` declared as
  // `any` because the rozie prop type was `Object`), and T defaults to
  // `unknown`, making `(child) => child.id` access fail. Explicit `<any>`
  // matches the looseness already in the prop type contract.
  return `\${repeat<any>(${items}, ${keyFn}, (${item}, ${idx}) => html\`${body}\`)}`;
}

// NOTE: REPEAT_USED singleton removed in CR-06 fix. repeatUsed is now returned
// as part of EmitTemplateResult. emitLit.ts must read templateResult.repeatUsed.

function emitSlot(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  // Phase 07.4 D-LIT-12 (WR-03 from review): this function MUST NOT push to
  // `hostListenerWiring` for slot-param event handlers — function-typed
  // slot-args go inline on the <slot> element via `eventAttrs`, NEVER via
  // host-scope `addEventListener` (the host-scope path was broken inside
  // `r-for` loops: loop-local identifiers like `item` don't exist at host
  // scope). The `hostListenerWiring` parameter is forwarded to nested
  // `emitNode()` calls (for fallback children) only — debounce cleanup and
  // other host-level wiring still flow through it from those nested paths.
  // If you find yourself wanting to push slot-param dispatch wiring here,
  // STOP and re-read CONTEXT.md §D-01 / §D-02 — the universal path is
  // intentional and any "loop-ancestor detection" approach was explicitly
  // rejected (see `feedback_no_detection_when_universal.md`).
  void opts;
  // Determine name + args.
  const name = node.slotName === '' ? '' : node.slotName;
  const fallbackChildren = node.fallback
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');

  // Identify the function-name set: top-level methods + arrow consts.
  const methodNameSet = collectMethodNamesFromIR(ir);

  const dataAttrs: string[] = [];
  const eventAttrs: string[] = [];
  if (node.args.length > 0) {
    const dataEntries: string[] = [];
    for (const arg of node.args) {
      // Determine if this is function-typed based on the IR expression's
      // shape, NOT a regex on the rewritten code. Function-typed IR shapes:
      //   - ArrowFunctionExpression / FunctionExpression
      //   - Identifier referencing a known method name
      //   - MemberExpression whose property is a known method name
      let isFnLike = false;
      const expr = arg.expression;
      if (bt.isArrowFunctionExpression(expr) || bt.isFunctionExpression(expr)) {
        isFnLike = true;
      } else if (bt.isIdentifier(expr) && methodNameSet.has(expr.name)) {
        isFnLike = true;
      }

      const argCode = rewriteTemplateExpression(arg.expression, ir);
      if (isFnLike) {
        // WR-04 (Phase 07.4 review): kebab-case the slot and param names so
        // producer and consumer agree on the event-name shape even for
        // camelCase args (`:closeModal` -> `rozie-<slot>-close-modal` on
        // both sides). For single-word lowercase identifiers (current
        // fixtures: close/toggle/remove) `toKebabCase()` is a no-op.
        const slotPart = toKebabCase(name || 'default');
        const paramPart = toKebabCase(arg.name);
        const evt = `rozie-${slotPart}-${paramPart}`;
        // Phase 07.4 D-LIT-12 — emit inline `@event` on the <slot> element
        // instead of pushing to host-scope `_armListeners()` via
        // `hostListenerWiring`. The host-scope path was broken inside `r-for`:
        // the user thunk references loop-local `item`, which doesn't exist at
        // host scope (tsc TS2304, runtime ReferenceError). The per-iteration
        // `<slot>` lives inside the `repeat()` callback closure, so loop-local
        // identifiers are naturally captured. For non-loop slots (Modal /
        // Dropdown `:close`) the same path is equally correct — Lit's
        // html-template `@event` binding works on `<slot>` like any DOM node.
        //
        // The argCode is paren-wrapped before the cast — argCode is often an
        // arrow expression like `() => this.toggle(item.id)` and `as` binds
        // tighter than `=>`, so a naked cast would attach to the arrow's
        // return value instead of the whole arrow. The explicit parens fix
        // the precedence. The `as (...args: any[]) => any` widening is
        // required for 0-arg user thunks (e.g. `this.close` typed
        // `() => void`) so they accept `$event.detail` uniformly — otherwise tsc
        // flags TS2554 "Expected 0 arguments, but got 1" against
        // every `:close="close"` slot-arg binding.
        eventAttrs.push(
          `@${evt}=\${($event: CustomEvent) => ((${argCode}) as (...args: any[]) => any)($event.detail)}`,
        );
      } else {
        dataEntries.push(`${arg.name}: ${argCode}`);
      }
    }
    if (dataEntries.length > 0) {
      const obj = `{${dataEntries.join(', ')}}`;
      // Wrap in try/catch so non-JSON-safe values (BigInt, circular, undefined)
      // don't crash the render — CR-02 fix.
      dataAttrs.push(`data-rozie-params=\${(() => { try { return JSON.stringify(${obj}); } catch { return '{}'; } })()}`);
    }
  }

  const slotName = name.length > 0 ? ` name="${name}"` : '';
  const dataStr = dataAttrs.length > 0 ? ' ' + dataAttrs.join(' ') : '';
  const eventStr = eventAttrs.length > 0 ? ' ' + eventAttrs.join(' ') : '';

  const slotElement =
    fallbackChildren.trim().length > 0
      ? `<slot${slotName}${dataStr}${eventStr}>${fallbackChildren}</slot>`
      : `<slot${slotName}${dataStr}${eventStr}></slot>`;

  // Phase 07.5 CR-01 — producer-side function-prop invocation for scoped
  // slots. When this <slot> declaration has scope-params, the consumer's
  // Phase 07.5 emit may set the matching `this.<propRef>` function-prop
  // (via `.<propRef>=${(scope) => html\`…\`}` on the parent component open
  // tag). The producer MUST invoke that function when set, falling back to
  // the light-DOM `<slot>` projection only when no consumer has assigned
  // the property — consumers still using the legacy `observeRozieSlotCtx`
  // ctx-roundtrip path with `<element slot="X">` light-DOM children rely
  // on the fallback rendering. Without this invocation the consumer's
  // function-prop is dead at runtime (the producer renders default slot
  // content; the consumer's body is never called).
  //
  // Portal slots (isPortal === true) are emitted from script via
  // `$portals.<X>` and `emitPortals.buildSlotMethod` already handles the
  // function-prop invocation — those invocations must NOT also fire from
  // template render, so skip the wrap for them.
  //
  // Default-slot mapping: name '' → property `__rozieDefaultSlot__` (mirrors
  // emitSlotDecl and emitSlotFiller — see Phase 07.5 SUMMARY decisions).
  // WR-02 (Phase 07.5 review): renamed from `_defaultSlotFn` to dodge any
  // realistic user-authored slot name collision.
  if (node.args.length > 0 && node.isPortal !== true) {
    const scopeEntries = node.args
      .map((a) => `${a.name}: ${rewriteTemplateExpression(a.expression, ir)}`)
      .join(', ');
    const propRef = name === '' ? '__rozieDefaultSlot__' : name;
    return `\${this.${propRef} !== undefined ? this.${propRef}({${scopeEntries}}) : html\`${slotElement}\`}`;
  }

  return slotElement;
}

// collectMethodNamesFromIR moved to ./methodNames.ts so emitSlotDecl can reuse it (WR-01).

function emitFragment(
  node: TemplateFragmentIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  return node.children
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
}

export function emitTemplate(
  ir: IRComponent,
  opts: EmitTemplateOpts,
): EmitTemplateResult {
  const diagnostics: Diagnostic[] = [];
  const hostListenerWiring: string[] = [];
  // Initialize per-call state (CR-06 fix: replaces module-level REPEAT_USED singleton).
  const state = {
    repeatUsed: false,
    styleMapUsed: false,
    rozieSpreadUsed: false,
    rozieListenersUsed: false,
    refUsed: false,
    keyedUsed: false,
    reconcileSeqUsed: false,
    unsafeHtmlUsed: false,
    debouncedFieldDecls: [] as string[],
    debounceCleanupWiring: [] as string[],
    hoistedLiteralFieldDecls: [] as string[],
    slotFillerClassFields: [] as string[],
    slotFillerUpdatedBody: [] as string[],
    slotFillerDisconnectReset: [] as string[],
    diagnostics,
  };
  // Phase 71 (r-keynav) — resolved ONCE per component (not per element; see
  // emitKeynav.ts's module doc comment). `null` for the overwhelming
  // majority of components (no r-keynav root) — every downstream keynav
  // read site short-circuits on `null`/`undefined`, so a non-keynav
  // component's emit is completely untouched (SPEC §11: "no corpus rebless").
  const keynav = resolveKeynavPlan(ir);
  const optsWithState: EmitTemplateOpts = { ...opts, keynav, _state: state };
  const keynavFieldDecls =
    keynav !== null
      ? buildKeynavFieldDecls(keynav, ir, { runtime: opts.runtime })
      : [];

  if (!ir.template) {
    // CR-01 fix (Phase 07.4 review): the early-return path now uses the same
    // shape as the non-early-return path below — read every field from
    // `state` rather than hardcoding `[]`/`false` literals. This eliminates
    // the drift risk if a future caller populates `state.*` before
    // `emitNode()` runs (or if a future change adds host-listener pre-pass).
    // Also push debounceCleanupWiring symmetrically so the two paths cannot
    // diverge on cleanup-wiring handling.
    hostListenerWiring.push(...state.debounceCleanupWiring);
    return {
      renderBody: '',
      hostListenerWiring,
      repeatUsed: state.repeatUsed,
      styleMapUsed: state.styleMapUsed,
      rozieSpreadUsed: state.rozieSpreadUsed,
      rozieListenersUsed: state.rozieListenersUsed,
      refUsed: state.refUsed,
      keyedUsed: state.keyedUsed,
      reconcileSeqUsed: state.reconcileSeqUsed,
      unsafeHtmlUsed: state.unsafeHtmlUsed,
      debouncedFieldDecls: state.debouncedFieldDecls,
      hoistedLiteralFieldDecls: state.hoistedLiteralFieldDecls,
      slotFillerClassFields: state.slotFillerClassFields,
      slotFillerUpdatedBody: state.slotFillerUpdatedBody,
      slotFillerDisconnectReset: state.slotFillerDisconnectReset,
      keynavFieldDecls,
      diagnostics,
    };
  }

  const body = emitNode(ir.template, ir, hostListenerWiring, optsWithState);

  // WR-15: debounce/throttle cleanup pushes flow into firstUpdated via the
  // hostListenerWiring channel (same channel host-listener wiring uses).
  hostListenerWiring.push(...state.debounceCleanupWiring);

  return {
    renderBody: body,
    hostListenerWiring,
    repeatUsed: state.repeatUsed,
    styleMapUsed: state.styleMapUsed,
    rozieSpreadUsed: state.rozieSpreadUsed,
    rozieListenersUsed: state.rozieListenersUsed,
    refUsed: state.refUsed,
    keyedUsed: state.keyedUsed,
    reconcileSeqUsed: state.reconcileSeqUsed,
    unsafeHtmlUsed: state.unsafeHtmlUsed,
    debouncedFieldDecls: state.debouncedFieldDecls,
    hoistedLiteralFieldDecls: state.hoistedLiteralFieldDecls,
    slotFillerClassFields: state.slotFillerClassFields,
    slotFillerUpdatedBody: state.slotFillerUpdatedBody,
    slotFillerDisconnectReset: state.slotFillerDisconnectReset,
    keynavFieldDecls,
    diagnostics,
  };
}
