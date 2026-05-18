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
 *   - `@event="fn"` → `@event=${(e) => fn(e)}` (handler binding)
 *   - r-model on form input → `.value=${this.X.value} @input=${(e) => this.X.value = e.target.value}`
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
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateFragmentIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  AttributeBinding,
  Listener,
} from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { ModifierRegistry, LitEmissionDescriptor } from '@rozie/core';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import type {
  LitImportCollector,
  LitDecoratorImportCollector,
  RuntimeLitImportCollector,
} from '../rewrite/collectLitImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { toKebabCase } from './emitDecorator.js';
import { eventTypeFor } from './emitListeners.js';
// Phase 07.2 Plan 03 — consumer-side slot-fill emit for component-tag elements.
import { emitSlotFiller, type EmitSlotFillerCtx } from './emitSlotFiller.js';
// Phase 07.3 Plan 09 — consumer-side `r-model:propName=` two-way binding.
// resolveLitSetterText + kebabize are shared with the standalone
// emitTemplateAttribute branch (re-exported from emitDecorator.toKebabCase
// to guarantee byte-equal CustomEvent name parity with the producer).
import { resolveLitSetterText } from './resolveLitSetterText.js';

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
    debouncedFieldDecls: string[];
    debounceCleanupWiring: string[];
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
   * Class-field declarations for template-event `.debounce`/`.throttle`
   * wrappers (WR-15). emitLit splices these into the class body alongside the
   * other field declarations so the wrapper identity is stable across renders.
   */
  debouncedFieldDecls: string[];
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
  // as handler-like avoids the synthesized `(e: Event) => { …; }` wrap that
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
): string {
  const code = rewriteTemplateExpression(node.expression, ir);
  return `\${${code}}`;
}

function emitStaticText(node: TemplateStaticTextIR): string {
  // Static text — lit-html escapes interpolated values but leaves raw HTML
  // characters in static segments alone. Preserve byte-for-byte.
  return node.text;
}

function attributeIsRModel(attr: AttributeBinding): boolean {
  return attr.name === 'r-model';
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
    return `.${attr.name}=\${${valueExpr}} @${eventName}=\${(e: CustomEvent) => { ${setterText} = e.detail; }}`;
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
    return `${attr.name}=\${${expr}}`;
  }

  if (attr.kind === 'interpolated') {
    // Mix of static + binding segments → emit as a single attribute value
    // built from string concatenation interpolation.
    const parts = attr.segments.map((seg) => {
      if (seg.kind === 'static') return seg.text;
      const code = rewriteTemplateExpression(seg.expression, ir);
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
    (a) => a.name === 'type' && a.kind === 'static',
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
      handlerBody: `(e) => ${code} = (e.target as HTMLInputElement).checked`,
    };
  }

  return {
    propBinding: `.value=\${${code}}`,
    eventName: 'input',
    handlerBody: `(e) => ${code} = (e.target as HTMLInputElement).value`,
  };
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
function buildEventParts(
  listener: Listener,
  ir: IRComponent,
  opts: EmitTemplateOpts,
): { eventName: string; handlerBody: string; optionParts: string[] } {
  const eventName = listener.event;
  const handlerRaw = rewriteTemplateExpression(listener.handler, ir);

  // Phase 07.3.1 D-LIT-17 — function-typed scoped-slot params (e.g. `close`)
  // can't transit through `data-rozie-params` (JSON.stringify silently drops
  // function values). The producer side emits a matching `@event` binding
  // (`@rozie-<slot>-<param>=${(e: CustomEvent) => userThunk(e.detail)}`)
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
    // Dispatch on e.currentTarget (the clicked element INSIDE the producer's
    // light DOM), NOT on `this` (which is the consumer — PARENT of the
    // producer in the tree). Bubbling propagates UP, so a consumer-rooted
    // dispatch never reaches the producer's host listener. The clicked
    // element lives inside `<producer-tag>…<button>` (post-D-LIT-18, the
    // button may have slot="…" directly on it); its bubble path goes UP
    // through the producer, triggering the producer's
    // `addEventListener('rozie-<X>-<param>', …)` host wiring.
    handler = `(e) => (e.currentTarget as HTMLElement).dispatchEvent(new CustomEvent('rozie-${slotKebab}-${paramKebab}', { detail: e, bubbles: true, composed: true }))`;
  } else {
    // Phase 07.3.1 Blocker #3 (D-03) — wrap scoped-slot-ctx handler in a
    // late-binding arrow so the ctx read happens at click time, not render
    // time. The first render captures _<X>Ctx as undefined (firstUpdated()
    // hasn't run yet, or the producer hasn't upgraded yet); without late
    // binding, Lit installs no listener and clicks no-op forever. Detection
    // regex matches only the `this._<name>Ctx?.` shape produced by
    // emitSlotFiller's rewriteScopedParamRefs (Landmine 3 — must not wrap
    // user-authored _xxxCtx fields). The wrap is benign for non-undefined
    // function references at click time — `(e) => (fn)?.(e)` invokes the
    // function with the event when present and is a silent no-op when not.
    const isScopedCtxHandler = /this\._[A-Za-z0-9_]+Ctx\?\./.test(handlerRaw);
    handler = isScopedCtxHandler
      ? `(e) => (${handlerRaw})?.(e)`
      : handlerRaw;
  }

  // Detect inlineGuard / native flags from the modifier pipeline.
  //
  // Plan 07.1-03: `filter`-kind modifiers are resolved via registry dispatch
  // (`registry.get(name).lit(...)` -> LitEmissionDescriptor) instead of a
  // hand-rolled builtin-name `if`-ladder. This is the same dispatch contract
  // emitListeners.ts / emitTemplateEvent.ts already use — Plan 07.1-02 missed
  // this real template-event path, so third-party modifiers (the swipe
  // dogfood canary) silently emitted no guard. `.debounce`/`.throttle`
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
      if (!impl || !impl.lit) {
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
  // cast-free (`e.key`, `e.touches`), so the precise DOM event type is what
  // keeps the emitted output typecheck-clean. Mirrors emitListeners.ts.
  const isFunctionLike = isHandlerLike(listener.handler);
  const evtType = eventTypeFor(eventName);
  // Cast the handler to a permissive signature when we invoke it with `e`. A
  // user method declared `close = () => void` is a perfectly reasonable @click
  // handler but tsc flags `(this.close)(e)` as TS2554 "Expected 0 arguments,
  // but got 1". The cast keeps the emit shape identical at runtime while
  // letting tsc accept the synthetic event arg uniformly across `() => void`
  // and `(e: Event) => void` user methods.
  const HANDLER_CAST = ' as (...args: any[]) => any';
  let body: string;
  if (inlineGuards.length > 0) {
    if (isFunctionLike) {
      body = `(e: ${evtType}) => { ${inlineGuards.join(' ')} ((${handler})${HANDLER_CAST})(e); }`;
    } else {
      body = `(e: ${evtType}) => { ${inlineGuards.join(' ')} ${handler}; }`;
    }
  } else {
    body = isFunctionLike ? `${handler}` : `(e: Event) => { ${handler}; }`;
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
    // AFTER this wrapper field. A lazy `(e) => (body)(e)` defers the lookup
    // to event time, when all class fields are initialized.
    opts._state.debouncedFieldDecls.push(
      `  private ${fieldName} = ${wrapKind.kind}((e: Event) => ((${body}) as (...args: any[]) => any)(e), ${wrapKind.ms});`,
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
 * function reference (`this.onSearch`), an inline arrow (`(e) => …`), or a
 * guard-wrapped arrow (`(e: Event) => { if (…) return; (this.fn)(e); }`).
 * Calling the body as a function with the event argument works uniformly
 * for all three shapes thanks to JavaScript's `(expr)(arg)` invocation.
 */
function mergeHandlerBodies(bodies: string[], evtType: string = 'Event'): string {
  if (bodies.length === 1) return bodies[0]!;
  const invocations = bodies.map((b) => `(${b})(e);`).join(' ');
  // Type the outer wrapper with the event-specific type so child handlers
  // typed `(e: KeyboardEvent) => ...` (from inline guards like `.enter`/`.escape`)
  // don't get a `Event`-typed `e` passed in — tsc flags TS2345 otherwise.
  return `(e: ${evtType}) => { ${invocations} }`;
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
      // Use quoted attribute — lit-html requires quotes for mixed static+dynamic values (CR-01 fix).
      parts.push(`class="${staticPart}\${(${expr})}"`);
    } else if (bindingClass.kind === 'interpolated') {
      const emitted = emitAttribute(bindingClass, ir, node.tagName, 'html', opts);
      if (emitted) parts.push(emitted);
    }
  } else if (staticClassValues.length > 0) {
    parts.push(`class="${staticClassValues.join(' ')}"`);
  }

  for (const attr of node.attributes) {
    if (attr.name === 'class') continue;
    if (attr.kind === 'static' && attr.name === 'ref') {
      refAttr = `data-rozie-ref="${attr.value}"`;
      continue;
    }
    if (attributeIsRModel(attr)) continue;
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

  for (const event of node.events) {
    const parts1 = buildEventParts(event, ir, opts);
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
    const merged = mergeHandlerBodies(bodies, eventTypeFor(name));
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

  if (refAttr) parts.push(refAttr);

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
      return emitInterpolation(node, ir);
    case 'TemplateStaticText':
      return emitStaticText(node);
    case 'TemplateElement':
      return emitElement(node, ir, hostListenerWiring, opts);
    case 'TemplateConditional':
      return emitConditional(node, ir, hostListenerWiring, opts);
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
  node: TemplateElementIR,
  ir: IRComponent,
  hostListenerWiring: string[],
  opts: EmitTemplateOpts,
): string {
  const tagName = resolveTagName(node, ir.name);
  const { open, selfClose } = emitElementOpenTag(node, ir, ir.name, opts);
  if (selfClose) return open;

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
    let needsObserveImport = false;
    for (const filler of node.slotFillers) {
      const out = emitSlotFiller(filler, fillerCtx);
      if (out.childTemplate) fillerChildren.push(out.childTemplate);
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
    return `${open}${fillerChildren.join('')}</${tagName}>`;
  }

  const children = node.children
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
    .join('');
  return `${open}${children}</${tagName}>`;
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
  const body = node.body
    .map((c) => emitNode(c, ir, hostListenerWiring, opts))
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
        // `() => void`) so they accept `e.detail` uniformly — otherwise tsc
        // flags TS2554 "Expected 0 arguments, but got 1" against
        // every `:close="close"` slot-arg binding.
        eventAttrs.push(
          `@${evt}=\${(e: CustomEvent) => ((${argCode}) as (...args: any[]) => any)(e.detail)}`,
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

  if (fallbackChildren.trim().length > 0) {
    return `<slot${slotName}${dataStr}${eventStr}>${fallbackChildren}</slot>`;
  }
  return `<slot${slotName}${dataStr}${eventStr}></slot>`;
}

function collectMethodNamesFromIR(ir: IRComponent): Set<string> {
  const names = new Set<string>();
  const reserved = new Set<string>([
    ...ir.state.map((s) => s.name),
    ...ir.computed.map((c) => c.name),
    ...ir.refs.map((r) => r.name),
    ...ir.props.map((p) => p.name),
  ]);
  for (const stmt of ir.setupBody.scriptProgram.program.body) {
    if (bt.isVariableDeclaration(stmt)) {
      for (const decl of stmt.declarations) {
        if (bt.isIdentifier(decl.id) && !reserved.has(decl.id.name)) {
          if (
            decl.init &&
            bt.isCallExpression(decl.init) &&
            bt.isIdentifier(decl.init.callee) &&
            decl.init.callee.name === '$computed'
          ) {
            continue;
          }
          if (
            decl.init &&
            (bt.isArrowFunctionExpression(decl.init) ||
              bt.isFunctionExpression(decl.init))
          ) {
            names.add(decl.id.name);
          }
        }
      }
    } else if (bt.isFunctionDeclaration(stmt) && stmt.id && !reserved.has(stmt.id.name)) {
      names.add(stmt.id.name);
    }
  }
  return names;
}

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
    debouncedFieldDecls: [] as string[],
    debounceCleanupWiring: [] as string[],
    slotFillerClassFields: [] as string[],
    slotFillerUpdatedBody: [] as string[],
    slotFillerDisconnectReset: [] as string[],
    diagnostics,
  };
  const optsWithState: EmitTemplateOpts = { ...opts, _state: state };

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
      debouncedFieldDecls: state.debouncedFieldDecls,
      slotFillerClassFields: state.slotFillerClassFields,
      slotFillerUpdatedBody: state.slotFillerUpdatedBody,
      slotFillerDisconnectReset: state.slotFillerDisconnectReset,
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
    debouncedFieldDecls: state.debouncedFieldDecls,
    slotFillerClassFields: state.slotFillerClassFields,
    slotFillerUpdatedBody: state.slotFillerUpdatedBody,
    slotFillerDisconnectReset: state.slotFillerDisconnectReset,
    diagnostics,
  };
}
