/**
 * emitSlotInvocation — Lit `<slot>` element emission (Plan 06.4-02 Task 2).
 *
 * Per D-LIT-11:
 *   - Default slot:    <slot></slot>
 *   - Named slot:      <slot name="X"></slot>
 *   - Scoped slot:     <slot name="X" data-rozie-params=${JSON.stringify({...})}></slot>
 *
 * The real per-element walk is inside emitTemplate.ts; this helper renders a
 * single slot invocation for unit-test reach.
 *
 * Phase 07.2 Plan 05 — slot re-projection (R6 / D-06):
 *   When `node.context === 'fill-body'` (sticky-downward flag from Plan
 *   07.2-01), this emitter requires NO branch — Lit's `<slot name="X">`
 *   inside a fill body that emitSlotFiller.wrapWithSlotAttribute then
 *   decorates with `slot="<filler-name>"` produces shadow-DOM-native
 *   re-projection: the wrapper's `<slot name="title" slot="header">`
 *   relays Inner's `header` slot through to the wrapper's `title` slot
 *   (which receives content from the wrapper's consumer). Single-root
 *   passthrough in wrapWithSlotAttribute naturally lands on the `<slot>`
 *   element itself, producing the correct two-attribute form.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateSlotInvocationIR, IRComponent } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  fallbackChildren: string,
): string {
  const name = node.slotName;
  const slotName = name.length > 0 ? ` name="${name}"` : '';
  const dataAttrs: string[] = [];
  if (node.args.length > 0) {
    const dataEntries: string[] = [];
    for (const arg of node.args) {
      const code = rewriteTemplateExpression(arg.expression, ir);
      // CR-07 fix: removed `code.startsWith('this.')` — any this.* reference (including
      // non-function data properties) would incorrectly be classified as function-like,
      // silently dropping data bindings. Arrow functions are already detected by the regex.
      const isFnLike = /^\s*\(?\s*\(?\s*\)?\s*=>/.test(code);
      if (!isFnLike) dataEntries.push(`${arg.name}: ${code}`);
    }
    if (dataEntries.length > 0) {
      // Wrap in try/catch so non-JSON-safe values (BigInt, circular, undefined)
      // don't crash the render — CR-02 fix.
      dataAttrs.push(`data-rozie-params=\${(() => { try { return JSON.stringify({${dataEntries.join(', ')}}); } catch { return '{}'; } })()}`);
    }
  }
  const dataStr = dataAttrs.length > 0 ? ' ' + dataAttrs.join(' ') : '';
  if (fallbackChildren.trim().length > 0) {
    return `<slot${slotName}${dataStr}>${fallbackChildren}</slot>`;
  }
  return `<slot${slotName}${dataStr}></slot>`;
}
