/**
 * emitConditional — Phase 5 Plan 05-04a Task 2.
 *
 * Builds Angular 17+ block-syntax `@if (test) { ... } @else if (...) { ... }
 * @else { ... }` chains for `r-if` / `r-else-if` / `r-else` branches per
 * RESEARCH Pattern 9 line 438.
 *
 * NOT `*ngIf` (legacy v16-) — block syntax is the v17+ idiom.
 *
 * @experimental — shape may change before v1.0
 */
import type { TemplateConditionalIR, TemplateNode } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';

function renderBranchBody(
  body: TemplateNode[],
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  if (body.length === 0) return '';
  return body.map((c) => emitNodeFn(c, ctx)).join('');
}

export function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  const branches = node.branches;
  if (branches.length === 0) return '';

  const parts: string[] = [];
  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!;
    const body = renderBranchBody(branch.body, ctx, emitNodeFn);

    if (i === 0) {
      const test = branch.test
        ? rewriteTemplateExpression(branch.test, ctx.ir, {
            collisionRenames: ctx.collisionRenames,
            loopBindings: ctx.loopBindings,
          })
        : 'true';
      parts.push(`@if (${test}) {`);
      parts.push(body);
      // Last branch w/ test only: emit `}` at end below.
      if (i < branches.length - 1) {
        // Continue chain.
      }
    } else if (branch.test) {
      const test = rewriteTemplateExpression(branch.test, ctx.ir, {
        collisionRenames: ctx.collisionRenames,
        loopBindings: ctx.loopBindings,
      });
      parts.push(`} @else if (${test}) {`);
      parts.push(body);
    } else {
      parts.push(`} @else {`);
      parts.push(body);
    }
  }
  parts.push(`}`);
  return parts.join('\n');
}
