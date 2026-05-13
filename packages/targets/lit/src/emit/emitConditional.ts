/**
 * emitConditional — Lit target r-if/r-else inline-ternary emission (Plan 06.4-02 Task 1).
 *
 * Lit-html supports inline ternary expressions inside `${...}`; pure `r-else`
 * branches with no body produce a `nothing` sentinel (imported from `lit`).
 *
 * NOTE (WR-05 / WR-09): This module is NOT currently called by the
 * emitTemplate.ts orchestrator — the orchestrator has its own inline
 * emitConditional function. This standalone helper exists for unit-testing
 * and future Phase 7 unification with the inline version.
 * TODO(Phase 7): unify this module with the inline emitConditional in emitTemplate.ts.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateConditionalIR, IRComponent, TemplateNode } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { LitImportCollector } from '../rewrite/collectLitImports.js';

export function emitConditional(
  node: TemplateConditionalIR,
  ir: IRComponent,
  emitBody: (body: TemplateNode[]) => string,
  lit: LitImportCollector,
): string {
  let result = '';
  let hasElse = false;
  for (let i = node.branches.length - 1; i >= 0; i--) {
    const branch = node.branches[i]!;
    const body = emitBody(branch.body);
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
  if (!hasElse) lit.add('nothing');
  return `\${${result}}`;
}
