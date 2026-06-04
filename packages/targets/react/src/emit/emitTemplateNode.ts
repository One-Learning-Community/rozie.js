/**
 * emitTemplateNode — Plan 04-03 Task 1 (React target).
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * JSX-string fragments per RESEARCH Pattern 5 emission map (lines 671-679).
 *
 * Element-level special-cases (handled in emitTemplateElement):
 *   - r-show on element → wrap with style={{ display: cond ? '' : 'none' }}
 *   - r-html on element → emit dangerouslySetInnerHTML; ROZ520 if children present
 *   - r-text on element → replace children with {expr}
 *   - r-model on element → delegate to emitRModel for value/onChange pair
 *   - @event attributes → delegate to emitTemplateEvent
 *   - class/:class → composeClassName via emitTemplateAttribute (D-53/D-55)
 *
 * Component-scope attribute injection (paired with `emitStyle`'s `scopeCss`):
 *   When `ctx.scopeAttr` is set, every emitted HTML host element (i.e.
 *   `tagKind === 'html'`) gets a bare attribute (e.g. `data-rozie-s-abc123`).
 *   This matches the attribute appended to every selector by `scopeCss`, so
 *   the component's CSS rules apply only to elements it actually renders —
 *   mirroring Vue's `<style scoped>` data-v-* semantics. Component tags
 *   (`tagKind === 'component'` / `'self'`) intentionally DO NOT get the
 *   attribute: child components carry their own scope.
 *
 * @experimental — shape may change before v1.0
 */
import * as t from '@babel/types';
import _generate from '@babel/generator';
import type { GeneratorOptions } from '@babel/generator';
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  AttributeBinding,
  Listener,
  ListenerSpreadIR,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { RozieErrorCode } from '../../../../core/src/diagnostics/codes.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import {
  emitAttributes,
  emitListenerSpread,
  emitListenerSpreadAsMergePartial,
} from './emitTemplateAttribute.js';
import { emitConditional } from './emitConditional.js';
import { emitTemplateEvent } from './emitTemplateEvent.js';
import { emitRModel } from './emitRModel.js';
import { emitSlotInvocation } from './emitSlotInvocation.js';
// Phase 07.2 — consumer-side slot-fill emission for component-tag elements.
import { emitSlotFiller, emitDynamicSlotsProp } from './emitSlotFiller.js';

type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

const GEN_OPTS: GeneratorOptions = { retainLines: false, compact: false };

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'source', 'track', 'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  collectors: { react: ReactImportCollector; runtime: RuntimeReactImportCollector };
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  /** Top-of-component-body lines (e.g., wrapped helper consts, default-content lifts) */
  scriptInjections: string[];
  /** Per-component counter for stable wrap-name suffixes */
  injectionCounter: { next: number };
  /** Optional key expression to inject into the immediate next TemplateElement (used by r-for) */
  pendingKey?: string | null;
  /**
   * Component-scope attribute name (e.g. `data-rozie-s-abc12345`) to inject on
   * every emitted HTML host element. Paired with `emitStyle`'s `scopeCss`
   * selector rewriter so this component's CSS rules apply only to elements
   * it actually renders. Empty string (or undefined) disables injection —
   * back-compat for callers that don't thread a scope hash.
   */
  scopeAttr?: string;
}

function emitStaticText(node: TemplateStaticTextIR, _ctx: EmitNodeCtx): string {
  // JSX preserves whitespace inside elements; htmlparser2 already produced
  // clean text. Pass through verbatim. Note: bare text containing JSX-meta
  // chars like `{` or `}` would be problematic, but our examples don't.
  return node.text;
}

function emitInterpolation(node: TemplateInterpolationIR, ctx: EmitNodeCtx): string {
  const code = rewriteTemplateExpression(node.expression, ctx.ir);
  // Phase 26 (D-06/D-07) — gate on the IR-precomputed wrap decision. When
  // `wrapForDisplay` is true the value may be a non-primitive (object/array/
  // unknown) which React cannot render directly ("Objects are not valid as a
  // React child"); `rozieDisplay` pretty-prints it as portable JSON. When
  // false the expression is provably string|number|boolean (or
  // safeInterpolation is off) → emit raw, byte-identical to pre-phase (SPEC-3).
  if (node.wrapForDisplay) {
    ctx.collectors.runtime.add('rozieDisplay');
    return `{rozieDisplay(${code})}`;
  }
  return `{${code}}`;
}

function emitFragment(node: TemplateFragmentIR, ctx: EmitNodeCtx): string {
  if (node.children.length === 1) return emitNode(node.children[0]!, ctx);
  const parts = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<>${parts}</>`;
}

/**
 * Emit a TemplateLoop as `{items.map((item) => <El key={...}>...</El>)}`.
 * The body[0] is the bare element; we inject `key={...}` into its attribute
 * list via the pendingKey context channel.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  const iterableCode = rewriteTemplateExpression(node.iterableExpression, ctx.ir);
  const aliasStr = node.indexAlias
    ? `(${node.itemAlias}, ${node.indexAlias})`
    : `(${node.itemAlias})`;
  const keyCode = node.keyExpression
    ? rewriteTemplateExpression(node.keyExpression, ctx.ir)
    : null;

  // Inject the key into the next element via pendingKey.
  const childCtx: EmitNodeCtx = { ...ctx, pendingKey: keyCode };
  let bodyJsx: string;
  if (node.body.length === 1) {
    bodyJsx = emitNode(node.body[0]!, childCtx);
  } else {
    // Multiple children — use React.Fragment with key= injected, since the
    // parent needs a single keyed JSX element. We use the JSX shorthand
    // `<Fragment key={k}>...</Fragment>` only if pendingKey was not consumed;
    // otherwise concatenate.
    const parts = node.body.map((c) => emitNode(c, childCtx)).join('');
    if (keyCode !== null) {
      bodyJsx = `<React.Fragment key={${keyCode}}>${parts}</React.Fragment>`;
      // We'd need React.Fragment — skip the import dance for v1; assume rare.
    } else {
      bodyJsx = parts;
    }
  }
  return `{${iterableCode}.map(${aliasStr} => ${bodyJsx})}`;
}

/**
 * Find an attribute by name (returns the first match).
 */
function findAttribute(attrs: AttributeBinding[], name: string): AttributeBinding | null {
  for (const a of attrs) {
    // Phase 14 — `spreadBinding` is the name-less kind; it never matches a
    // by-name lookup.
    if (a.kind === 'spreadBinding') continue;
    if (a.name === name) return a;
  }
  return null;
}

/**
 * Build the bare component-scope attribute JSX fragment (e.g.
 * `data-rozie-s-abc12345=""`). Returns `null` only when the context has no
 * scope attr. Applies to both host elements AND child-component invocations
 * (Phase 14.1 cross-target scope propagation): the child's auto-fallthrough
 * spread (or manual `r-bind="$attrs"`) carries the consumer's scope attr onto
 * the child's root element, so the consumer's scoped CSS rules
 * (`.foo[data-rozie-s-CONSUMER]`) match elements styled via consumer-passed
 * `class=` on a child-component invocation. Mirrors Vue's `__scopeId`
 * runtime propagation, baked into the consumer-side emit.
 */
function scopeAttrForElement(node: TemplateElementIR, ctx: EmitNodeCtx): string | null {
  if (!ctx.scopeAttr) return null;
  // tagKind 'html' → bare DOM element; 'component'/'self' → child component
  // invocation (consumer-side). Both receive the scope attr so consumer
  // styled-via-class propagates onto the child's root.
  void node.tagKind;
  // Empty-string attribute value is the canonical "boolean attribute"
  // selector-friendly form. CSS `[data-rozie-s-xyz]` matches it.
  return `${ctx.scopeAttr}=""`;
}

/**
 * Emit a TemplateElement. Applies element-level special-cases (r-show, r-html,
 * r-text, r-model) before falling through to the standard tag/attr/children form.
 *
 * Phase 06.2 P2: tagKind === 'component' resolves to a top-of-file
 * `import {LocalName} from './LocalName';` (synthesized by emitReact); 'self'
 * resolves to the enclosing named-function declaration (Pitfall 7 — function
 * declarations are hoisted within their containing scope). Both emit the tag
 * verbatim PascalCase below; no template AST rewrite needed.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  // Capture and clear pendingKey for this element ONLY.
  const pendingKey = ctx.pendingKey ?? null;
  const childCtx: EmitNodeCtx = { ...ctx, pendingKey: null };

  // Build a working set of attributes — start with element's own.
  let workingAttrs: AttributeBinding[] = [...node.attributes];

  const scopeAttrJsx = scopeAttrForElement(node, ctx);

  // Inject the loop key BEFORE emitAttributes is called. We synthesise a
  // binding-kind attr with name=':key' and a placeholder identifier whose
  // expression is parsed back from the keyCode string. To stay safe, we
  // inject the key as a SPECIAL attribute that emitAttributes treats specially.
  // Simpler approach: append a key={...} jsx attribute directly to the head.

  // r-html special-case
  const rHtmlAttr = findAttribute(workingAttrs, 'r-html');
  if (rHtmlAttr && rHtmlAttr.kind === 'binding') {
    if (node.children.length > 0) {
      ctx.diagnostics.push({
        code: RozieErrorCode.TARGET_REACT_RHTML_WITH_CHILDREN,
        severity: 'warning',
        message: `<${node.tagName}> r-html on element with children — children dropped (Pitfall 10).`,
        loc: rHtmlAttr.sourceLoc,
      });
    }
    const exprCode = rewriteTemplateExpression(rHtmlAttr.expression, ctx.ir);
    // Strip r-html from emitted attrs.
    workingAttrs = workingAttrs.filter((a) => a !== rHtmlAttr);
    const attrsResult = emitAttributes(workingAttrs, {
      ir: ctx.ir,
      collectors: ctx.collectors,
      elementTagKind: node.tagKind,
      tagName: node.tagName,
    });
    for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);
    const listenerResult = emitElementListeners(node, childCtx);
    const headParts = [
      attrsResult.jsx,
      listenerResult.eventsJsx,
      ...listenerResult.extraSpreads,
      `dangerouslySetInnerHTML={{ __html: ${exprCode} }}`,
    ].filter(Boolean);
    if (scopeAttrJsx) headParts.push(scopeAttrJsx);
    if (pendingKey !== null) headParts.unshift(`key={${pendingKey}}`);
    const head = headParts.length > 0 ? ' ' + headParts.join(' ') : '';
    return `<${node.tagName}${head} />`;
  }

  // r-text special-case: replace children with {expr}
  const rTextAttr = findAttribute(workingAttrs, 'r-text');
  let rTextChildren: string | null = null;
  if (rTextAttr && rTextAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rTextAttr.expression, ctx.ir);
    rTextChildren = `{${exprCode}}`;
    workingAttrs = workingAttrs.filter((a) => a !== rTextAttr);
  }

  // r-show special-case: emit style={{ display: cond ? '' : 'none' }}.
  // Wrap the rewritten expression in parens so any inner low-precedence
  // operators (`||`, `??`, `&&`) bind correctly relative to the trailing `?`.
  const rShowAttr = findAttribute(workingAttrs, 'r-show');
  let rShowStyleAttr: string | null = null;
  if (rShowAttr && rShowAttr.kind === 'binding') {
    const exprCode = rewriteTemplateExpression(rShowAttr.expression, ctx.ir);
    rShowStyleAttr = `style={{ display: (${exprCode}) ? '' : 'none' }}`;
    workingAttrs = workingAttrs.filter((a) => a !== rShowAttr);
  }

  // r-model special-case: lower to value+onChange (or checked+onChange)
  const rModelAttr = findAttribute(workingAttrs, 'r-model');
  if (rModelAttr) {
    const rModelResult = emitRModel(node, ctx.ir);
    for (const d of rModelResult.diagnostics) ctx.diagnostics.push(d);
    if (rModelResult.replacementAttributes.length > 0) {
      // Replace the r-model attribute with the emitted pair.
      workingAttrs = workingAttrs.filter((a) => a !== rModelAttr);
      workingAttrs = [...workingAttrs, ...rModelResult.replacementAttributes];
    }
  }

  // Standard attribute emission
  const attrsResult = emitAttributes(workingAttrs, {
    ir: ctx.ir,
    collectors: ctx.collectors,
    elementTagKind: node.tagKind,
    tagName: node.tagName,
  });
  for (const d of attrsResult.diagnostics) ctx.diagnostics.push(d);

  const listenerResult = emitElementListeners(node, childCtx);

  const headParts = [
    attrsResult.jsx,
    listenerResult.eventsJsx,
    ...listenerResult.extraSpreads,
  ];
  if (rShowStyleAttr) headParts.push(rShowStyleAttr);
  if (scopeAttrJsx) headParts.push(scopeAttrJsx);
  if (pendingKey !== null) headParts.unshift(`key={${pendingKey}}`);

  // Phase 07.2 consumer-side slot-fill emit (R3 + R4 + R5).
  //
  // When this element is a component-tag (tagKind 'component' | 'self') and
  // carries SlotFillerDecl[] from the lowerer (lowerSlotFillers.ts L186-310),
  // the body content lives in node.slotFillers. The same body content is ALSO
  // present in node.children (the lowerer doesn't strip it — extractSlotFillers
  // walks a parallel array). To avoid double-emission we MUST emit fillers
  // via JSX-attribute assignments and SKIP the raw children path below.
  //
  // Per producer-side dual-shape (emitSlotInvocation.ts L22-32), the React
  // mapping is:
  //   - default-shorthand → `children={…JSX…}` prop (raw ReactNode form)
  //   - default scoped     → `children={(args) => …}` (function form)
  //   - named static       → `render<Pascal>={() => …}`
  //   - named scoped       → `render<Pascal>={(args) => …}`
  //   - dynamic-name (R5)  → `slots={{ [expr]: (args) => … }}`
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const fillerAttrs: string[] = [];
    for (const filler of node.slotFillers) {
      if (filler.isDynamic) continue; // merged into a single slots={…} below
      fillerAttrs.push(emitSlotFiller(filler, childCtx));
    }
    const dynamicSlotsAttr = emitDynamicSlotsProp(node.slotFillers, childCtx);
    if (dynamicSlotsAttr !== null) fillerAttrs.push(dynamicSlotsAttr);

    const headWithFills = [
      ...headParts.filter(Boolean),
      ...fillerAttrs,
    ].join(' ');
    const headOutFills = headWithFills.length > 0 ? ' ' + headWithFills : '';
    // Component tags with slot fills self-close — body content is wholly
    // represented by the slot-prop assignments above.
    return `<${node.tagName}${headOutFills} />`;
  }

  const head = headParts.filter(Boolean).join(' ');
  const headOut = head.length > 0 ? ' ' + head : '';

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  // Children emission (or rTextChildren replacement)
  if (rTextChildren !== null) {
    return `<${node.tagName}${headOut}>${rTextChildren}</${node.tagName}>`;
  }

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${headOut} />`;
    return `<${node.tagName}${headOut} />`;
  }

  const inner = node.children.map((c) => emitNode(c, childCtx)).join('');
  return `<${node.tagName}${headOut}>${inner}</${node.tagName}>`;
}

/**
 * Phase 15 — synthesize a virtual `Listener` from a `ListenerSpreadIR`'s
 * `literalKeys[i]` entry so the per-key dispatcher merge in
 * `emitElementEvents` can fold literal-key spread handlers in alongside
 * `@event` handlers.
 *
 * Each literal-key entry carries `{ eventName, modifierPipeline, valueExpr }`
 * — enough to fabricate a Listener with the same shape `emitTemplateEvent`
 * already consumes from `node.events`. `target` defaults to `'self'` (the
 * element this spread lives on); `when` is null (template `@event` Listener
 * lowering also leaves it null); `deps` is the parent spread's deps array
 * (deps are over-approximate but never under-approximate for reactivity
 * accounting); `source` is `'template-event'` (the codegen path treats both
 * sources identically).
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

/**
 * Phase 15 R6 — does this element have at least one dynamic
 * `ListenerSpreadIR` (no `literalKeys` field, OR explicitly empty)? Drives
 * the per-element merge classification.
 *
 *   - All-literal (no dynamic spread): the per-key dispatcher emit in
 *     `emitElementEvents` handles R6 via the existing same-name merge,
 *     after we splice literal-key entries into the events list.
 *   - Mixed / dynamic: a single `{...mergeListeners(...)}` runtime call
 *     replaces the per-event JSX-prop emit so JSX last-wins cannot
 *     silently drop one of the handlers.
 */
function hasDynamicListenerSpread(node: TemplateElementIR): boolean {
  for (const spread of node.listenerSpreads) {
    if (spread.literalKeys === undefined || spread.literalKeys.length === 0) {
      return true;
    }
  }
  return false;
}

/**
 * Phase 15 follow-up Bug B — `$attrs` / `$listeners` collapse-to-`attrs`
 * dedup. React doesn't syntactically separate listener props from attribute
 * props (a consumer-passed `onClick` lands in the SAME `_props` rest bucket
 * as `id`/`className`), so both `$attrs` and `$listeners` lower to the same
 * bare `attrs` identifier (see `rewriteTemplateExpression` Identifier
 * visitor — Phase 14 D-04 + Phase 15 D-19). When an element carries BOTH
 * a bare-`$attrs` attribute-spread AND a bare-`$listeners` listener-spread,
 * the naive emit produces a duplicate `{...attrs}` JSX spread — and JSX is
 * last-write-wins per key, so the second spread silently re-applies
 * `attrs.className` over the Phase 14.1 R6 className merge (and re-applies
 * every other attrs key over any local attribute too). For the standard
 * auto-fallthrough case (`<rozie>` defaults, no opt-outs) this drops
 * locally-styled CSS module classes entirely — the ThemedButton fixture
 * loses its `.btn` styling.
 *
 * Returns the source-order-preserving listenerSpreads list with bare
 * `$listeners` entries DROPPED when the element has a bare-`$attrs`
 * spreadBinding. The dropped listener cluster is already covered by the
 * `$attrs` spread (same `attrs` identifier) — both carry the entire splitProps
 * rest bucket, attrs + listeners alike. Returns the unchanged list when no
 * collapse is needed.
 *
 * KNOWN LIMITATION — when an element carries `$attrs` + `$listeners` AND
 * local `@event` handlers, dropping the listener-spread side means the
 * per-key dispatcher merge (emitElementEvents) no longer captures the
 * consumer's onClick (which lives inside attrs). The trailing `{...attrs}`
 * spread then overrides the local `@click` with the consumer's onClick
 * (last-wins). This is a known regression from the R6 listener all-fire
 * intent for the narrow attrs-auto+listeners-auto+local-event case, but
 * is the lesser-of-two-evils trade vs the className-clobber bug. A future
 * fix could inline `attrs.onClick?.($event)` into the local event dispatcher
 * to restore all-fire without re-spreading attrs.
 */
function isBareListenersSpread(spread: ListenerSpreadIR): boolean {
  return t.isIdentifier(spread.expression, { name: '$listeners' });
}

function elementHasBareAttrsSpread(node: TemplateElementIR): boolean {
  for (const a of node.attributes) {
    if (a.kind !== 'spreadBinding') continue;
    if (t.isIdentifier(a.expression, { name: '$attrs' })) return true;
  }
  return false;
}

function dedupListenersAgainstAttrs(
  node: TemplateElementIR,
): TemplateElementIR {
  if (node.listenerSpreads.length === 0) return node;
  if (!elementHasBareAttrsSpread(node)) return node;
  const filtered = node.listenerSpreads.filter((s) => !isBareListenersSpread(s));
  if (filtered.length === node.listenerSpreads.length) return node;
  return { ...node, listenerSpreads: filtered };
}

/**
 * Phase 15 R6 — assemble the per-element listener emit.
 *
 * Returns `{ eventsJsx, extraSpreads }`:
 *   - `eventsJsx`     — string for placement alongside other JSX attributes.
 *                       In the all-literal merge case this includes per-key
 *                       dispatcher emits for both `@event` and literal-key
 *                       spread entries. In the mixed/dynamic merge case it
 *                       is empty (events fold into the merged spread).
 *   - `extraSpreads`  — JSX spread tokens (e.g. `{...$listeners}` or
 *                       `{...mergeListeners(...)}` ) for placement after
 *                       attributes / events. Empty when no spreads exist or
 *                       all are folded into the merge.
 *
 * Three cases:
 *
 *   1. No spreads: classic Plan 04-04 dispatcher-merge over `node.events`.
 *
 *   2. All-literal (every spread has populated `literalKeys`): synthesize
 *      virtual Listeners from each literal-key entry, splice into the events
 *      list (preserving source order via the spread's index in
 *      `node.listenerSpreads`), and run the existing per-key dispatcher
 *      merge. Zero runtime cost — every collision resolves to an inline
 *      arrow `(e) => { f1(e); f2(e); }` at compile time.
 *
 *   3. Mixed / dynamic (at least one spread is dynamic): emit a single
 *      `{...mergeListeners(<events-partial>, <spread-1>, <spread-2>, ...)}`
 *      spread — the runtime merge collapses all colliding keys into source-
 *      order dispatchers at first-render time. Each partial is built using
 *      the same key conventions: the events-partial uses target-native
 *      `onClick` keys via `emitTemplateEvent`; each spread-partial is
 *      `normalizeListeners(<expr>)` (or the raw `$listeners` identifier for
 *      D-19 exempt spreads).
 *
 * D-19 bare-$listeners handling: a bare `$listeners` spread is emitted as
 * `{...$listeners}` (no normalizeListeners wrap) when it does NOT participate
 * in a runtime merge, and is passed through to `mergeListeners(...)` un-
 * wrapped when it does (the consumer's $listeners already carries target-
 * native keys).
 */
function emitElementListeners(
  origNode: TemplateElementIR,
  ctx: EmitNodeCtx,
): { eventsJsx: string; extraSpreads: string[] } {
  // Phase 15 follow-up Bug B — when a bare `$attrs` spread is already
  // present on this element, drop any bare-`$listeners` listenerSpread
  // (both lower to the same `attrs` identifier in React; the `$attrs`
  // spread already carries the whole splitProps rest bucket, listeners
  // included). Prevents the duplicate `{...attrs}` JSX spread that
  // silently re-applies `attrs.className` over the R6 className merge.
  const node = dedupListenersAgainstAttrs(origNode);
  const hasEvents = node.events.length > 0;
  const hasSpreads = node.listenerSpreads.length > 0;

  if (!hasEvents && !hasSpreads) {
    return { eventsJsx: '', extraSpreads: [] };
  }

  // No spreads → classic events-only path.
  if (!hasSpreads) {
    return { eventsJsx: emitElementEvents(node, ctx), extraSpreads: [] };
  }

  const dynamic = hasDynamicListenerSpread(node);

  // CASE: all-literal merge — synthesize virtual Listeners from each
  // literal-key entry, run the existing per-key dispatcher merge. Bare
  // `$listeners` cannot have `literalKeys` populated (it's an Identifier,
  // not an ObjectExpression), so it is always classified as dynamic; the
  // all-literal branch implicitly excludes it.
  if (!dynamic) {
    const syntheticEvents: Listener[] = [];
    for (const spread of node.listenerSpreads) {
      for (const lk of spread.literalKeys ?? []) {
        syntheticEvents.push(listenerFromLiteralKey(spread, lk));
      }
    }
    const merged: TemplateElementIR = {
      ...node,
      events: [...node.events, ...syntheticEvents],
    };
    return { eventsJsx: emitElementEvents(merged, ctx), extraSpreads: [] };
  }

  // CASE: single dynamic-spread, no events, no other spreads — direct emit
  // with no runtime merge overhead. Bare `$listeners` emits as
  // `{...$listeners}` (D-19); dynamic expr emits as
  // `{...normalizeListeners(expr)}`. This covers the `r-on="$listeners"`
  // auto-fallthrough case (synthesized by lowerTemplate) on an element with
  // no `@event` handlers — extremely common.
  if (!hasEvents && node.listenerSpreads.length === 1) {
    const only = node.listenerSpreads[0]!;
    const attrCtx: import('./emitTemplateAttribute.js').EmitAttrCtx = {
      ir: ctx.ir,
      collectors: ctx.collectors,
    };
    return { eventsJsx: '', extraSpreads: [emitListenerSpread(only, attrCtx)] };
  }

  // CASE: mixed / dynamic merge — build a runtime `mergeListeners(...)` call.
  // Walk node.attributes / events / listenerSpreads in source order to keep
  // the dispatcher's invocation order matching the author's source order.
  //
  // The events-partial is an object literal whose keys are target-native
  // JSX listener-prop names (`onClick`, `onMouseEnter`) and whose values
  // are the handler expressions `emitTemplateEvent` produces. Each event
  // emits independently; if two events on the element collide on the same
  // JSX prop (e.g. two `@keydown` listeners), they pre-merge into a single
  // dispatcher arrow via the existing Plan 04-04 per-key dispatcher emit
  // BEFORE going into the partial — so the runtime mergeListeners never
  // sees collisions inside the events-partial.

  // 1. Emit each @event listener individually and group by JSX-prop name.
  type EmittedAttr = { jsxName: string; body: string };
  const emitted: EmittedAttr[] = [];
  for (const ev of node.events) {
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
    });
    if (result.scriptInjection !== null) {
      ctx.scriptInjections.push(result.scriptInjection);
    }
    for (const d of result.diagnostics) ctx.diagnostics.push(d);
    const match = result.jsxAttr.match(/^([A-Za-z][\w]*)=\{(.*)\}$/s);
    if (!match) continue;
    emitted.push({ jsxName: match[1]!, body: match[2]! });
  }
  // 2. Same-JSX-name pre-merge inside the events-partial (so the runtime
  // mergeListeners never receives a key collision INSIDE one partial).
  const eventGroups = new Map<string, EmittedAttr[]>();
  const eventOrder: string[] = [];
  for (const e of emitted) {
    if (!eventGroups.has(e.jsxName)) {
      eventGroups.set(e.jsxName, []);
      eventOrder.push(e.jsxName);
    }
    eventGroups.get(e.jsxName)!.push(e);
  }

  const eventsPartialEntries: string[] = [];
  for (const name of eventOrder) {
    const items = eventGroups.get(name)!;
    if (items.length === 1) {
      eventsPartialEntries.push(`${name}: ${items[0]!.body}`);
      continue;
    }
    const branches = items.map((it) =>
      /^[A-Za-z_$][\w$]*$/.test(it.body)
        ? `${it.body}($event);`
        : `(${it.body})($event);`,
    );
    eventsPartialEntries.push(
      `${name}: ($event) => { ${branches.join(' ')} }`,
    );
  }

  // 3. Build the mergeListeners argument list. Source-order traversal of
  // node.listenerSpreads ensures the runtime merge dispatcher invokes
  // handlers in source order across spreads.
  const mergeArgs: string[] = [];
  if (eventsPartialEntries.length > 0) {
    mergeArgs.push(`{ ${eventsPartialEntries.join(', ')} }`);
  }
  const attrCtx: import('./emitTemplateAttribute.js').EmitAttrCtx = {
    ir: ctx.ir,
    collectors: ctx.collectors,
  };
  for (const spread of node.listenerSpreads) {
    mergeArgs.push(emitListenerSpreadAsMergePartial(spread, attrCtx));
  }

  // 4. Single mergeListeners runtime helper call.
  ctx.collectors.runtime.add('mergeListeners');
  const spreadToken = `{...mergeListeners(${mergeArgs.join(', ')})}`;
  return { eventsJsx: '', extraSpreads: [spreadToken] };
}

/**
 * Emit all template @event listeners on an element.
 *
 * **Plan 04-04 dispatcher-merge** (Plan 04-03 deferred limitation #2):
 * Multiple `@event` bindings on the SAME element that resolve to the SAME
 * JSX prop name (e.g., `@keydown.enter` + `@keydown.escape` both map to
 * `onKeyDown`) are combined into a single dispatcher arrow:
 *
 *   onKeyDown={($event) => {
 *     // Branch 1 (from @keydown.enter):
 *     if ($event.key === 'Enter') { onSearch($event); return; }
 *     // Branch 2 (from @keydown.escape):
 *     if ($event.key === 'Escape') { clear($event); return; }
 *   }}
 *
 * Without this merge, JSX silently keeps only the LAST attribute when keys
 * collide — losing the first listener and producing surprising behavior.
 *
 * Phase 15 R6 extension: when a literal-key `r-on` spread contributes
 * synthetic Listener entries (via `listenerFromLiteralKey`), they participate
 * in the same per-key merge — `@click` + `r-on="{ click: fn }"` collide on
 * `onClick` and produce a single inline dispatcher arrow at compile time.
 */
function emitElementEvents(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  if (node.events.length === 0) return '';

  // Pass 1: emit each listener individually. Capture jsxName + handler body.
  type EmittedAttr = { jsxName: string; body: string };
  const emitted: EmittedAttr[] = [];
  for (const ev of node.events) {
    if (ev === null || ev === undefined) continue;
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      collectors: ctx.collectors,
      injectionCounter: ctx.injectionCounter,
    });
    if (result.scriptInjection !== null) {
      ctx.scriptInjections.push(result.scriptInjection);
    }
    for (const d of result.diagnostics) ctx.diagnostics.push(d);

    // Parse `<jsxName>={<body>}` so we can re-group when names collide.
    // emitTemplateEvent guarantees `${jsxName}={${handlerExpr}}`.
    const match = result.jsxAttr.match(/^([A-Za-z][\w]*)=\{(.*)\}$/s);
    if (!match) {
      // Defensive — pass through unchanged if parse failed.
      emitted.push({ jsxName: '', body: result.jsxAttr });
      continue;
    }
    emitted.push({ jsxName: match[1]!, body: match[2]! });
  }

  // Pass 2: group by jsxName, preserving original order.
  const groups = new Map<string, EmittedAttr[]>();
  const order: string[] = [];
  for (const e of emitted) {
    if (!groups.has(e.jsxName)) {
      groups.set(e.jsxName, []);
      order.push(e.jsxName);
    }
    groups.get(e.jsxName)!.push(e);
  }

  const out: string[] = [];
  for (const name of order) {
    const items = groups.get(name)!;
    if (items.length === 1) {
      const it = items[0]!;
      if (it.jsxName === '') out.push(it.body);
      else out.push(`${it.jsxName}={${it.body}}`);
      continue;
    }
    // Multi-listener merge: build a dispatcher arrow that calls each branch
    // in source order. Each `body` is a handler expression — wrap it so the
    // event arg `e` is forwarded.
    const branches = items.map((it) => {
      const body = it.body;
      // If body is a plain identifier (e.g. `close`), call as `body(e)`.
      // If body is an arrow `($event) => {...}`, invoke as `(body)($event)`.
      if (/^[A-Za-z_$][\w$]*$/.test(body)) {
        return `${body}($event);`;
      }
      return `(${body})($event);`;
    });
    const dispatcher = `($event) => { ${branches.join(' ')} }`;
    out.push(`${name}={${dispatcher}}`);
  }
  return out.join(' ');
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
 * Emit a TemplateMatch (Phase 11 `r-match` / `r-case` / `r-default`).
 *
 * D-02 — pure delegation: the `r-match` construct lowers to a node whose
 * `branches[]` is byte-identical to `TemplateConditionalIR.branches[]`, with
 * the discriminant already folded into each `r-case` test by core (plan 11-01).
 * We construct a synthetic `TemplateConditionalIR` and hand it straight to the
 * existing `emitConditional` — no bespoke match emit logic (RESEARCH Open
 * Question 2 recommendation (a)).
 *
 * `discriminantMode === 'hoist'` (D-04 — plan 11-05): an expensive
 * `CallExpression` discriminant must be evaluated EXACTLY ONCE per render. We
 * wrap the conditional ladder in a return-position IIFE that binds the
 * discriminant to `node.tempName` (`__rozieMatch_N`, allocated by core):
 * `{(() => { const <tempName> = <discriminant>; return <ladder>; })()}`. The
 * folded branch tests already reference `t.identifier(node.tempName)`, so the
 * rungs read the temp, never re-invoke the call. JSX return-position IIFE is
 * idiomatic React. `inline`-mode discriminants — and `hoist`-classified
 * literal predicate chains whose rungs never reference the temp — need no
 * wrapper (pure delegation).
 *
 * `hostElement` (real-element `<div r-match>` host): the wrapper element must
 * survive emission. We render the host's tag/attributes via `emitElement` with
 * the conditional ladder spliced in as a single verbatim child — `emitStaticText`
 * passes its `text` through unchanged, so the `{...}` JSX expression produced by
 * `emitConditional` (or the hoist IIFE) lands intact inside the wrapper.
 */
function delegateMatchToConditional(node: TemplateMatchIR, ctx: EmitNodeCtx): string {
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  let ladder = emitConditional(synthetic, ctx, emitNode);
  if (
    node.discriminantMode === 'hoist' &&
    node.tempName !== undefined &&
    tempNameIsReferenced(node, node.tempName)
  ) {
    // D-04 hoist — `emitConditional` returns a `{...}`-wrapped JSX expression;
    // strip the braces and re-wrap as a return-position IIFE binding the
    // discriminant temp once. `node.discriminant` is routed through the SAME
    // `rewriteTemplateExpression` the folded branch tests use, so magic
    // accessors (`$data.x()`) are rewritten identically.
    const inner = ladder.startsWith('{') && ladder.endsWith('}')
      ? ladder.slice(1, -1)
      : ladder;
    const discriminantCode = rewriteTemplateExpression(node.discriminant, ctx.ir);
    ladder = `{(() => { const ${node.tempName} = ${discriminantCode}; return ${inner}; })()}`;
  }
  if (node.hostElement === undefined) {
    return ladder;
  }
  const verbatim: TemplateStaticTextIR = {
    type: 'TemplateStaticText',
    text: ladder,
    sourceLoc: node.hostElement.sourceLoc,
  };
  const hostWithLadder: TemplateElementIR = {
    ...node.hostElement,
    children: [verbatim],
  };
  return emitElement(hostWithLadder, ctx);
}

/**
 * Top-level dispatch.
 */
export function emitNode(node: TemplateNode, ctx: EmitNodeCtx): string {
  switch (node.type) {
    case 'TemplateStaticText':
      return emitStaticText(node, ctx);
    case 'TemplateInterpolation':
      return emitInterpolation(node, ctx);
    case 'TemplateFragment':
      return emitFragment(node, ctx);
    case 'TemplateConditional':
      return emitConditional(node, ctx, emitNode);
    case 'TemplateMatch':
      return delegateMatchToConditional(node, ctx);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node, ctx);
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}

// Re-export generator / GEN_OPTS so other emit/* modules can share them.
export { generate, GEN_OPTS };
