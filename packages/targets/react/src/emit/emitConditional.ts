/**
 * emitConditional — Plan 04-03 Task 1 (React target).
 *
 * Builds a right-to-left ternary chain for r-if / r-else-if / r-else
 * branches per RESEARCH Pattern 5 line 676.
 *
 * Cases:
 *   - Single r-if (no else):  `{cond && body}`         (short-circuit)
 *   - r-if + r-else:          `{cond ? body1 : body2}` (ternary)
 *   - r-if + r-else-if + r-else: right-to-left chained ternary
 *
 * The output is wrapped in JSX expression braces `{...}` so the caller
 * can splice it directly into a JSX child position.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateConditionalIR, TemplateNode } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';

/**
 * Render a branch's body as a single JSX expression. Multiple children
 * become a fragment `<>...</>`.
 */
function renderBranchBody(
  body: TemplateNode[],
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  if (body.length === 0) return 'null';
  if (body.length === 1) {
    return emitNodeFn(body[0]!, ctx);
  }
  // Wrap multiple children in a fragment.
  const parts = body.map((c) => emitNodeFn(c, ctx)).join('');
  return `<>${parts}</>`;
}

export function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  const branches = node.branches;
  if (branches.length === 0) return '{null}';

  const lastBranch = branches[branches.length - 1]!;
  let out: string;

  if (lastBranch.test === null) {
    // Final r-else branch — base case (no condition wrapper)
    out = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
  } else {
    // No trailing r-else — short-circuit form `cond && body` for the last branch
    const testCode = rewriteTemplateExpression(lastBranch.test, ctx.ir);
    const bodyCode = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
    out = `${testCode} && ${bodyCode}`;
  }

  // Build right-to-left for any preceding branches.
  for (let i = branches.length - 2; i >= 0; i--) {
    const branch = branches[i]!;
    if (branch.test === null) {
      // r-else not at the end is malformed; emit body unconditionally.
      out = renderBranchBody(branch.body, ctx, emitNodeFn);
      continue;
    }
    const testCode = rewriteTemplateExpression(branch.test, ctx.ir);
    const bodyCode = renderBranchBody(branch.body, ctx, emitNodeFn);
    out = `${testCode} ? ${bodyCode} : ${out}`;
  }

  return `{${out}}`;
}
