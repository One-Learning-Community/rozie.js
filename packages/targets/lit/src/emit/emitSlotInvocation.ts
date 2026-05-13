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
      const isFnLike = /^\s*\(?\s*\(?\s*\)?\s*=>/.test(code) || code.startsWith('this.');
      if (!isFnLike) dataEntries.push(`${arg.name}: ${code}`);
    }
    if (dataEntries.length > 0) {
      dataAttrs.push(`data-rozie-params=\${JSON.stringify({${dataEntries.join(', ')}})}`);
    }
  }
  const dataStr = dataAttrs.length > 0 ? ' ' + dataAttrs.join(' ') : '';
  if (fallbackChildren.trim().length > 0) {
    return `<slot${slotName}${dataStr}>${fallbackChildren}</slot>`;
  }
  return `<slot${slotName}${dataStr}></slot>`;
}
