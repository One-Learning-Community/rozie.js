/**
 * emitConditional — Solid target (P2 complete implementation).
 *
 * Builds `<Show when={...}>` JSX for r-if / r-else-if / r-else branches.
 * Solid uses `<Show>` instead of React's ternary chain.
 *
 * Cases:
 *   - Single r-if (no else): `<Show when={cond}>{body}</Show>`
 *   - r-if + r-else: `<Show when={cond} fallback={elseBody}>{body}</Show>`
 *   - r-if + r-else-if + ...: nested `<Show>` elements in fallback
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
  const parts = body.map((c) => emitNodeFn(c, ctx)).join('');
  return `<>${parts}</>`;
}

/**
 * Build a <Show> element for a single branch. The `fallback` prop is
 * optional — omit when no else branch.
 */
function buildShow(
  testCode: string,
  bodyJsx: string,
  fallbackJsx: string | null,
): string {
  if (fallbackJsx !== null) {
    return `<Show when={${testCode}} fallback={${fallbackJsx}}>${bodyJsx}</Show>`;
  }
  return `<Show when={${testCode}}>${bodyJsx}</Show>`;
}

export function emitConditional(
  node: TemplateConditionalIR,
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  const { solid: solidImports } = ctx.collectors;
  solidImports.add('Show');

  const branches = node.branches;
  if (branches.length === 0) return '{null}';

  // Build from right to left. The last branch is either:
  //   - A plain r-else (test === null): used as fallback for the second-to-last Show
  //   - A r-else-if or lone r-if: wrapped in Show with no fallback
  //
  // Strategy: walk branches left-to-right, building nested <Show> elements.
  // The rightmost branch with test === null is the r-else fallback.

  // Find trailing r-else (if any).
  const lastBranch = branches[branches.length - 1]!;
  let currentFallback: string | null = null;

  if (lastBranch.test === null) {
    // r-else — render as the initial fallback body (no Show wrapper)
    currentFallback = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
  } else {
    // No trailing r-else — last branch becomes a Show with no fallback
    const testCode = rewriteTemplateExpression(lastBranch.test, ctx.ir);
    const bodyJsx = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
    currentFallback = null;
    // Build from second-to-last going left
    const startIdx = branches.length - 1;
    const show = buildShow(testCode, bodyJsx, null);
    if (startIdx === 0) {
      // Only one branch
      return `{${show}}`;
    }
    // Continue with remaining branches
    for (let i = startIdx - 1; i >= 0; i--) {
      const branch = branches[i]!;
      if (branch.test === null) {
        // r-else at a non-tail position (malformed; emit body unconditionally)
        currentFallback = renderBranchBody(branch.body, ctx, emitNodeFn);
        continue;
      }
      const bTestCode = rewriteTemplateExpression(branch.test, ctx.ir);
      const bBodyJsx = renderBranchBody(branch.body, ctx, emitNodeFn);
      // The "show" we built for the next branch becomes the fallback here
      const innerShow = buildShow(bTestCode, bBodyJsx, i === startIdx - 1 ? show : currentFallback!);
      currentFallback = innerShow;
    }
    if (currentFallback === show) {
      return `{${show}}`;
    }
    return `{${currentFallback}}`;
  }

  // Build from right to left with r-else as base fallback
  let result: string = '';
  for (let i = branches.length - 2; i >= 0; i--) {
    const branch = branches[i]!;
    if (branch.test === null) {
      // r-else not at the end is malformed; treat as fallback
      currentFallback = renderBranchBody(branch.body, ctx, emitNodeFn);
      continue;
    }
    const testCode = rewriteTemplateExpression(branch.test, ctx.ir);
    const bodyJsx = renderBranchBody(branch.body, ctx, emitNodeFn);
    result = buildShow(testCode, bodyJsx, currentFallback);
    currentFallback = result;
  }

  return `{${result}}`;
}
