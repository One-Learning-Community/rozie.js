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
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  TemplateFragmentIR,
  AttributeBinding,
  Listener,
} from '../../../../core/src/ir/types.js';
import type { ModifierRegistry } from '../../../../core/src/modifiers/ModifierRegistry.js';
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
 */
function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitNodeCtx,
): string {
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

  // Find the matching SlotDecl in the IR. Default-slot sentinel is ''.
  const slotDecl = ctx.ir.slots.find(
    (s) => s.name === (slotKey === '' ? '' : slotKey),
  );
  if (slotDecl && slotDecl.presence === 'conditional') {
    const slotsKey = slotKey === '' ? 'default' : slotKey;
    return `<template v-if="$slots.${slotsKey}">${slotEl}</template>`;
  }
  return slotEl;
}

/**
 * Emit a TemplateElement. Walks attributes (via emitMergedAttributes for
 * D-37/Pitfall 7 class merge) and events (via emitTemplateEvent), then
 * children. Self-closes void elements with no children.
 */
function emitElement(node: TemplateElementIR, ctx: EmitNodeCtx): string {
  return emitElementWithExtraDirective(node, null, ctx);
}

/**
 * Inner element renderer that allows the parent (loop/conditional) to inject
 * an extra directive (`v-if=...`, `v-for=...`) prepended before the element's
 * own attributes.
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

  if (node.children.length === 0) {
    if (isVoid) return `<${node.tagName}${head} />`;
    return `<${node.tagName}${head}></${node.tagName}>`;
  }

  const inner = node.children.map((c) => emitNode(c, ctx)).join('');
  return `<${node.tagName}${head}>${inner}</${node.tagName}>`;
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
