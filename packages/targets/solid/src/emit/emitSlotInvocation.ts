/**
 * emitSlotInvocation — Solid target (P2 complete implementation).
 *
 * Lowers a TemplateSlotInvocationIR to a JSX expression per D-133 patterns:
 *
 * | Pattern                       | JSX form                                            |
 * |-------------------------------|-----------------------------------------------------|
 * | Default, no params            | `{resolved()}` (children() accessor per D-131)      |
 * | Default with params           | `{resolved?.({ param })}` (rare; treated as named)  |
 * | Named, no params              | `{_props.headerSlot}` (direct JSX.Element access)   |
 * | Named with params             | `{_props.triggerSlot?.({ open: open() })}`          |
 * | Named with fallback           | `{_props.headerSlot ?? <fallback>}`                 |
 *
 * Slot field name convention: slot `trigger` → `triggerSlot`, slot `header` → `headerSlot`.
 *
 * NOTE: For the default slot, shell.ts declares `const resolved = children(() => local.children)`
 * and the body uses `{resolved()}`. This module emits that accessor reference.
 *
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *
 *   When `node.context === 'fill-body'` (sticky-downward flag set by the
 *   lowerer in Plan 07.2-01 for any <slot> nested inside a SlotFillerDecl.body),
 *   this emitter requires NO branch. The producer-side `{_props.<X>Slot}` /
 *   `{_props.<X>Slot?.(ctx)}` shape IS the correct re-projection shape
 *   because `_props` refers to the wrapper's OWN props scope. When a wrapper
 *   re-projects its consumer's `title` slot into Inner's `header` slot via
 *   `<Inner><template #header><slot name="title"/></template></Inner>`,
 *   the emitted Solid reads `{_props.titleSlot ?? "default title"}` — the
 *   wrapper's OWN titleSlot prop, which is its incoming slot from its
 *   consumer.
 *
 *   D-07 wrapper-only-params semantics are honored by construction: the emit
 *   references ONLY `_props.titleSlot`, never the enclosing fill body's
 *   scoped params.
 *
 *   No parent-chain walking is needed (D-SM-01 anti-pattern avoided).
 *
 * @experimental — shape may change before v1.0
 */
import type {
  TemplateSlotInvocationIR,
  IRComponent,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
// Late-import to avoid circular reference; both modules initialize independently.
import * as _emitTemplateNodeModule from './emitTemplateNode.js';

function findSlotDecl(name: string, ir: IRComponent): SlotDecl | null {
  for (const s of ir.slots) {
    if (s.name === name) return s;
  }
  return null;
}

/**
 * Build the param-object literal text from invocation args.
 *   args = [{name:'open', expression: <ID('open')>}]  → `{ open: open() }`
 * Shorthand collapse: when arg.name === renderedExpression, emit `{ open }` form.
 */
function buildParamObj(
  args: TemplateSlotInvocationIR['args'],
  ir: IRComponent,
): string {
  if (args.length === 0) return '{}';
  const parts = args.map((a) => {
    const code = rewriteTemplateExpression(a.expression, ir);
    if (code === a.name) return a.name;
    return `${a.name}: ${code}`;
  });
  return `{ ${parts.join(', ')} }`;
}

/**
 * Render the invocation-site fallback children (inline <slot>children</slot>)
 * as a JSX expression. Returns 'null' when no meaningful children.
 */
function renderInvocationFallback(
  fallback: TemplateSlotInvocationIR['fallback'],
  ctx: EmitNodeCtx,
): string {
  const realChildren = fallback.filter(
    (c) => !(c.type === 'TemplateStaticText' && c.text.trim() === ''),
  );
  if (realChildren.length === 0) return 'null';
  const emitNodeFn = _emitTemplateNodeModule.emitNode;
  const parts = realChildren.map((child) => emitNodeFn(child, ctx));
  if (parts.length === 1) {
    const single = parts[0]!;
    if (single.startsWith('{') && single.endsWith('}') && single.length > 2) {
      return single.slice(1, -1);
    }
    const trimmed = single.trim();
    if (
      realChildren[0]!.type === 'TemplateStaticText' &&
      !trimmed.startsWith('<')
    ) {
      return JSON.stringify(trimmed);
    }
    return single;
  }
  return `<>${parts.join('')}</>`;
}

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitNodeCtx,
): string {
  const slotName = node.slotName;
  const slot = findSlotDecl(slotName, ctx.ir);
  const invocationFallback = renderInvocationFallback(node.fallback, ctx);
  const hasInvocationFallback = invocationFallback !== 'null';

  // Default slot: use the children() accessor declared by shell.ts (D-131).
  if (slotName === '') {
    if (hasInvocationFallback) {
      return `{resolved() ?? ${invocationFallback}}`;
    }
    return `{resolved()}`;
  }

  // Named slot — build the prop field name with Slot suffix.
  const slotFieldName = slotName + 'Slot';
  const hasParams = slot ? slot.params.length > 0 : false;
  const paramObj = slot && hasParams ? buildParamObj(node.args, ctx.ir) : null;

  // No SlotDecl found — best-effort fallback using naming convention.
  if (!slot) {
    if (hasInvocationFallback) {
      return `{_props.${slotFieldName} ?? ${invocationFallback}}`;
    }
    return `{_props.${slotFieldName}}`;
  }

  if (!hasParams) {
    // Named slot WITHOUT context → `{_props.headerSlot}` (D-133 static form)
    if (hasInvocationFallback) {
      return `{_props.${slotFieldName} ?? ${invocationFallback}}`;
    }
    return `{_props.${slotFieldName}}`;
  }

  // Named slot WITH context → `{_props.triggerSlot?.({ open: open() })}` (D-133 function call)
  if (hasInvocationFallback) {
    return `{_props.${slotFieldName} ? _props.${slotFieldName}(${paramObj!}) : ${invocationFallback}}`;
  }
  return `{_props.${slotFieldName}?.(${paramObj!})}`;
}
