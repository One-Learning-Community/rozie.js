/**
 * emitTemplateNode — Phase 3 Plan 03 Task 1.
 *
 * Recursive switch over the IR's TemplateNode discriminated union, producing
 * Vue-template-string fragments. Coordinator (`emitTemplate`) wires this with
 * imports/diagnostics/scriptInjections context.
 *
 * Per CONTEXT D-35 (slots), D-36 (r→v 1:1), D-37 (mustache-in-attribute),
 * D-39 (native modifier passthrough). Per RESEARCH.md Pattern 6/7/8.
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateElementIR,
  TemplateConditionalIR,
  TemplateMatchIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  AttributeBinding,
  Listener,
} from '../../../../core/src/ir/types.js';
// Phase 07.1 self-reference pattern (per Phase 07.1 type-identity fix):
// SlotFillerDecl MUST come from the `@rozie/core` barrel, not the deep-relative
// ../../../core/src/ir/types.js path. The deep path produces a distinct `.d.ts`
// SlotFillerDecl identity per target package and reintroduces the cross-package
// type-identity bug Phase 07.1 fixed.
import type { ModifierRegistry, SlotFillerDecl } from '@rozie/core';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { emitMergedAttributes } from './emitTemplateAttribute.js';
import { emitTemplateEvent, type ScriptInjection } from './emitTemplateEvent.js';

/**
 * HTML void elements (no closing tag, self-close `/>`).
 *
 * Per https://html.spec.whatwg.org/#void-elements
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

export interface EmitNodeCtx {
  ir: IRComponent;
  registry: ModifierRegistry;
  diagnostics: Diagnostic[];
  scriptInjections: ScriptInjection[];
  /** Per-component counter shared across all events for stable wrap-name suffixes. */
  injectionCounter: { next: number };
  /** Current indent prefix (two-space units). */
  indent: string;
}

/**
 * Render an indent at one level deeper than `ctx.indent`.
 */
function deeper(ctx: EmitNodeCtx): EmitNodeCtx {
  return { ...ctx, indent: ctx.indent + '  ' };
}

function emitStaticText(node: TemplateStaticTextIR, _ctx: EmitNodeCtx): string {
  // Preserve text verbatim (htmlparser2 already produced clean text). Strip
  // surrounding pure-whitespace runs of a single newline at section boundaries
  // — but conservatively render as-is for v1.
  return node.text;
}

function emitInterpolation(
  node: TemplateInterpolationIR,
  ctx: EmitNodeCtx,
): string {
  const expr = rewriteTemplateExpression(node.expression, ctx.ir);
  return `{{ ${expr} }}`;
}

function emitFragment(
  node: TemplateFragmentIR,
  ctx: EmitNodeCtx,
): string {
  return node.children.map((c) => emitNode(c, ctx)).join('');
}

/**
 * Emit a TemplateConditional as a sibling-group of elements, each carrying
 * a `v-if` / `v-else-if` / `v-else` directive on its FIRST child element.
 *
 * Per D-36: r-* → v-* 1:1. Phase 2 collapses r-if + r-else-if + r-else into
 * branches[]; we unroll them as adjacent elements with the corresponding
 * v-* directive.
 */
function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
): string {
  const parts: string[] = [];
  for (let i = 0; i < node.branches.length; i++) {
    const branch = node.branches[i]!;
    let directive: string;
    if (i === 0) {
      directive = branch.test
        ? `v-if="${rewriteTemplateExpression(branch.test, ctx.ir)}"`
        : 'v-if'; // shouldn't happen — first branch always has test
    } else if (branch.test) {
      directive = `v-else-if="${rewriteTemplateExpression(branch.test, ctx.ir)}"`;
    } else {
      directive = 'v-else';
    }

    // Each branch.body is a list of TemplateNode children. Per Vue's rule the
    // v-if/v-else directive applies to ONE element. If a branch has multiple
    // children, wrap in a <template> with the directive.
    if (branch.body.length === 1 && branch.body[0]!.type === 'TemplateElement') {
      parts.push(
        emitElementWithExtraDirective(branch.body[0]! as TemplateElementIR, directive, ctx),
      );
    } else {
      // Use <template v-...> wrapper.
      const inner = branch.body.map((c) => emitNode(c, ctx)).join('');
      parts.push(`<template ${directive}>${inner}</template>`);
    }
  }
  return parts.join('');
}

/**
 * Emit a TemplateLoop. The loop's `body[0]` is the bare element WITHOUT
 * r-for (Phase 2 lowerTemplate stripped it). We render it with a `v-for=...`
 * directive injected as the first attribute, plus optional `:key=...`.
 */
function emitLoop(node: TemplateLoopIR, ctx: EmitNodeCtx): string {
  const iter = rewriteTemplateExpression(node.iterableExpression, ctx.ir);
  const itemDecl = node.indexAlias
    ? `(${node.itemAlias}, ${node.indexAlias})`
    : node.itemAlias;
  const vfor = `v-for="${itemDecl} in ${iter}"`;
  const keyDir = node.keyExpression
    ? ` :key="${rewriteTemplateExpression(node.keyExpression, ctx.ir)}"`
    : '';

  // body[0] is expected to be a TemplateElement (the loop target). If it's not
  // (rare/unusual IR), wrap children in a <template> with the directive.
  // Phase 2 lowerTemplate strips r-for/r-if/etc. from the inner element BUT
  // NOT `:key` — so we strip it here to avoid double-emission alongside the
  // loop's `:key` directive.
  if (node.body.length === 1 && node.body[0]!.type === 'TemplateElement') {
    const inner = node.body[0]! as TemplateElementIR;
    const stripped: TemplateElementIR = {
      ...inner,
      attributes: inner.attributes.filter(
        (a) => !(a.kind === 'binding' && a.name === 'key'),
      ),
    };
    return emitElementWithExtraDirective(
      stripped,
      `${vfor}${keyDir}`,
      ctx,
    );
  }

  const inner = node.body.map((c) => emitNode(c, ctx)).join('');
  return `<template ${vfor}${keyDir}>${inner}</template>`;
}

/**
 * Emit a TemplateSlotInvocation. Per D-35 — native Vue scoped-slot:
 *
 *   <slot[ name="..."][ :argName="<expr>"...]>fallback...</slot>
 *
 * Conditional-presence wrap: if the matching SlotDecl has presence='conditional',
 * wrap the whole emission in `<template v-if="$slots.X">...</template>`.
 *
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *   When `node.context === 'fill-body'` (sticky-downward flag from Plan 07.2-01),
 *   this emitter requires NO branch — Vue's `<slot name="X">…</slot>` markup
 *   inside a `<template #header>` fill body is exactly how Vue natively relays
 *   the wrapper's incoming `X` slot to the inner component's `header` slot.
 *   The scoped-slot machinery handles forwarding via the wrapper component's
 *   own `defineSlots<{ title(props): any }>` declaration (auto-generated by
 *   refineSlotTypes from the wrapper's own SlotDecl set).
 */
function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitNodeCtx,
): string {
  // Portal-slot primitive (Spike 003) — skip template emit entirely. Portal
  // slots are invoked from script via `$portals.<name>(...)` and rendered
  // imperatively into foreign engine containers.
  if (node.isPortal) return '';
  const slotKey = node.slotName === '' ? '' : node.slotName;
  const nameAttr = slotKey ? ` name="${slotKey}"` : '';
  const argAttrs = node.args
    .map((a) => ` :${a.name}="${rewriteTemplateExpression(a.expression, ctx.ir)}"`)
    .join('');

  const fallbackInner = node.fallback.map((c) => emitNode(c, ctx)).join('');
  const slotEl =
    fallbackInner.length > 0
      ? `<slot${nameAttr}${argAttrs}>${fallbackInner}</slot>`
      : `<slot${nameAttr}${argAttrs}></slot>`;

  return slotEl;
}

/**
 * Emit a TemplateElement. Walks attributes (via emitMergedAttributes for
 * D-37/Pitfall 7 class merge) and events (via emitTemplateEvent), then
 * children. Self-closes void elements with no children.
 *
 * Phase 06.2 P2: tagKind === 'component' | 'self' — Vue resolves the
 * verbatim PascalCase tag via setup-scope import (component) or
 * `defineOptions({ name })` (self). No template AST rewrite needed; the
 * existing tag-emit branch below handles all three tagKinds uniformly.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  return emitElementWithExtraDirective(node, null, ctx);
}

/**
 * Inner element renderer that allows the parent (loop/conditional) to inject
 * an extra directive (`v-if=...`, `v-for=...`) prepended before the element's
 * own attributes.
 *
 * Phase 07.2 — when `node.slotFillers` is populated (component-tag with
 * `<template #name>` children), render those fillers as the element's body via
 * `emitSlotFiller`. The IR's `node.children` array still holds the same
 * children in parallel (the lowerer doesn't strip them — `extractSlotFillers`
 * runs on the parallel pair), so we MUST emit fillers instead of children to
 * avoid double-emission. The fillers route to native Vue scoped-slot syntax
 * (`<template #header="{ close }">…</template>`); default-shorthand
 * (`{ name: '' }`) emits as bare children inside the component tag.
 */
function emitElementWithExtraDirective(
  node: TemplateElementIR,
  extraDirective: string | null,
  ctx: EmitNodeCtx,
): string {
  const attrText = emitMergedAttributes(node.attributes, {
    ir: ctx.ir,
    registry: ctx.registry,
  });
  const eventText = emitEvents(node.events, ctx);

  const partsHead: string[] = [];
  if (extraDirective) partsHead.push(extraDirective);
  if (attrText) partsHead.push(attrText);
  if (eventText) partsHead.push(eventText);

  const head = partsHead.length > 0 ? ' ' + partsHead.join(' ') : '';

  const isVoid = VOID_ELEMENTS.has(node.tagName.toLowerCase());

  // Phase 07.2 — component-tag with slot fillers: render fillers, not children.
  // The parallel-array lowering invariant (lowerSlotFillers.ts L186-310) means
  // node.children and node.slotFillers reference the SAME underlying body
  // content; emit only the structured `slotFillers` view to avoid duplication.
  if (node.slotFillers !== undefined && node.slotFillers.length > 0) {
    const inner = node.slotFillers
      .map((f) => emitSlotFiller(f, ctx))
      .join('');
    if (inner.length === 0) {
      return `<${node.tagName}${head}></${node.tagName}>`;
    }
    return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
  }

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${head} />`;
    return `<${node.tagName}${head}></${node.tagName}>`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
}

/**
 * Emit a single consumer-side `SlotFillerDecl` as Vue scoped-slot markup.
 *
 * Vue is the 1:1 mapping per RESEARCH §"Pattern 3.a Vue": consumer's
 * `<template #header="{ close }">…</template>` lowers verbatim to Vue's native
 * scoped-slot syntax. No re-shaping required.
 *
 * Cases (D-03 default-shorthand, R5 dynamic-name, R4 scoped params):
 *   - default-shorthand `{ name: '' }` → bare children inside the component
 *     tag (Vue treats `name`-less children as default-slot content)
 *   - named static `{ name: 'header' }` → `<template #header>…</template>`
 *   - named scoped `{ name: 'header', params: [{name:'close'}, ...] }` →
 *     `<template #header="{ close, ... }">…</template>`
 *   - dynamic `{ isDynamic: true, dynamicNameExpr }` →
 *     `<template #[<rewrittenExpr>]>…</template>` (Vue handles natively)
 *
 * Body recursion uses `emitNode` so magic-identifier rewrites
 * (`$props.x` → `props.x`, `$data.x` → `x`) apply naturally via
 * `rewriteTemplateExpression` on any `TemplateInterpolation` / attribute
 * binding inside the fill body — no separate rewrite pass needed.
 */
function emitSlotFiller(filler: SlotFillerDecl, ctx: EmitNodeCtx): string {
  const bodyText = filler.body.map((c) => emitNode(c, ctx)).join('');

  // Default-shorthand: bare children, NO <template> wrapper. Vue treats
  // children-without-`#name` as the default-slot fill.
  //
  // SCOPE-PARAM CARVE-OUT: the shorthand is only valid when the consumer
  // didn't introduce slot-scope bindings. `<template #default="{ item }">`
  // MUST emit the explicit `<template #default="{ item }">` form — dropping
  // the wrapper there loses the scope-parameter binding entirely (Vue's
  // template compiler then treats `item` as a top-level instance reference
  // and renders `_ctx.item.label`, which is undefined).
  if (!filler.isDynamic && filler.name === '' && filler.params.length === 0) {
    return bodyText;
  }

  // Scoped-param attribute string. Empty when no params.
  const paramsAttr =
    filler.params.length > 0
      ? `="{ ${filler.params.map((p) => p.name).join(', ')} }"`
      : '';

  // Dynamic-name form `<template #[expr]>`. Vue's compiler-sfc handles the
  // bracketed-name form natively (Vue 3.4+).
  if (filler.isDynamic && filler.dynamicNameExpr) {
    const rewritten = rewriteTemplateExpression(
      filler.dynamicNameExpr,
      ctx.ir,
    );
    return `<template #[${rewritten}]${paramsAttr}>${bodyText}</template>`;
  }

  // Named static form `<template #name>` / `<template #name="{ a, b }">`.
  // For the default slot with scope params (the new carve-out branch from
  // above), normalize the empty IR name to the explicit `default` so the
  // emitted text reads `<template #default="{ a, b }">`.
  const slotName = filler.name === '' ? 'default' : filler.name;
  return `<template #${slotName}${paramsAttr}>${bodyText}</template>`;
}

/**
 * Emit element events. Each Listener returns one event-attribute string plus
 * an optional scriptInjection (debounce/throttle wrap) which we accumulate on
 * the shared ctx.scriptInjections list.
 */
function emitEvents(events: Listener[], ctx: EmitNodeCtx): string {
  if (events.length === 0) return '';
  const out: string[] = [];
  for (const ev of events) {
    const result = emitTemplateEvent(ev, {
      ir: ctx.ir,
      registry: ctx.registry,
      injectionCounter: ctx.injectionCounter,
    });
    out.push(result.eventAttr);
    if (result.scriptInjection) {
      ctx.scriptInjections.push(result.scriptInjection);
    }
    for (const d of result.diagnostics) ctx.diagnostics.push(d);
  }
  return out.join(' ');
}

/**
 * Emit a TemplateMatch (Phase 11 `r-match` / `r-case` / `r-default`).
 *
 * D-02 — pure delegation: the `r-match` construct lowers to a node whose
 * `branches[]` is byte-identical to `TemplateConditionalIR.branches[]`, with
 * the discriminant already folded into each `r-case` test by core (plan 11-01).
 * We construct a synthetic `TemplateConditionalIR` and hand it straight to the
 * existing inline `emitConditional` — no bespoke match emit logic (RESEARCH
 * Open Question 2 recommendation (a)).
 *
 * `discriminantMode === 'hoist'` (D-04 — plan 11-06): an impure
 * `CallExpression` discriminant must be evaluated EXACTLY ONCE per render. Vue
 * has no template-level `computed` precedent (`computed` appears only in
 * `emitScript.ts`), so the hoist temp is synthesized as a `<script setup>`
 * injection: `const <tempName> = computed(() => <rewritten-discriminant>);`.
 * The `v-if` ladder references `<tempName>` by name — core (plan 11-01) already
 * folded each `r-case` test to `<tempName> === <caseValue>`, and a `computed`
 * ref is auto-unwrapped inside a Vue template, so no `.value` is needed.
 *
 * `hostElement` (real-element `<div r-match>` host): the wrapper element must
 * survive emission. We render the host's tag/attributes via `emitElement` with
 * the `v-if`/`v-else-if`/`v-else` sibling group spliced in as a single verbatim
 * child — `emitStaticText` passes its `text` through unchanged.
 */
function delegateMatchToConditional(node: TemplateMatchIR, ctx: EmitNodeCtx): string {
  // D-04 hoist: synthesize the `computed` script injection BEFORE the ladder is
  // emitted, so `<tempName>` is declared in `<script setup>` and the ladder's
  // folded branch tests resolve. Nested hoisting matches recurse through
  // `emitNode`/`emitConditional` and push their own distinct-`tempName`
  // injections — the core per-component counter (plan 11-01) guarantees the
  // names never collide.
  //
  // r-for LIMITATION: a `computed` is created once and shared across all loop
  // iterations — wrong for a per-iteration discriminant. The correct fix inside
  // an `r-for` is a METHOD injection taking the loop variables as args, but the
  // Vue `EmitNodeCtx` carries no loop-bindings signal to detect that context.
  // Per plan 11-06 we emit the `computed` form unconditionally (correct for the
  // common non-loop case) and record the in-`r-for` gap as a SUMMARY follow-up
  // rather than emitting code that silently mis-detects the context.
  if (node.discriminantMode === 'hoist' && node.tempName !== undefined) {
    const rewritten = rewriteTemplateExpression(node.discriminant, ctx.ir);
    ctx.scriptInjections.push({
      wrapName: node.tempName,
      import: { from: 'vue', name: 'computed' },
      decl: `const ${node.tempName} = computed(() => ${rewritten});`,
    });
  }
  const synthetic: TemplateConditionalIR = {
    type: 'TemplateConditional',
    branches: node.branches,
    sourceLoc: node.sourceLoc,
  };
  const ladder = emitConditional(synthetic, ctx);
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
 * Top-level recursive dispatch over TemplateNode discriminator.
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
      return emitConditional(node, ctx);
    case 'TemplateMatch':
      return delegateMatchToConditional(node, ctx);
    case 'TemplateLoop':
      return emitLoop(node, ctx);
    case 'TemplateSlotInvocation':
      return emitSlotInvocation(node, ctx);
    case 'TemplateElement':
      return emitElement(node, ctx);
    default: {
      // Exhaustiveness — never expected at runtime.
      const _exhaustive: never = node;
      void _exhaustive;
      return '';
    }
  }
}
