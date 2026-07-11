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
import { stripBalancedMustache } from './unwrapMustache.js';

/**
 * Render a branch's body as a single JSX expression. Multiple children
 * become a fragment `<>...</>`.
 *
 * R10-1 fix (260710-uwr): a single-child body that emits as a bare `{...}`
 * mustache (a `<slot>` or interpolation) is un-wrapped and re-parenthesized
 * before being handed to the caller. Every composition site below (the
 * short-circuit `&&`, the ternary consequent/alternate, and the base-case
 * r-else wrapped by the outer `{...}` at the bottom of emitConditional)
 * splices renderBranchBody's return value into JS-EXPRESSION position — a
 * `{...}` mustache there collapses into a block/object-literal
 * (`{cond && {expr}}`), which is invalid JSX. Fragment/element bodies start
 * with `<` and are left byte-identical. Parens are required, not optional:
 * some slot returns are unparenthesized (`typeof x === 'function' ? … : …`)
 * and both `&&`/`??` mixing and ternary precedence need them — mirrors the
 * existing un-wrap precedent in emitSlotInvocation.ts's renderInvocationFallback.
 *
 * 260711-ad5 — routed through the shared `stripBalancedMustache` primitive
 * (also used by `emitLoop`'s R11-1 fix). Byte-identical to the original
 * inline `startsWith/endsWith/length` check — same heuristic, same `(inner)`
 * wrap.
 */
function renderBranchBody(
  body: TemplateNode[],
  ctx: EmitNodeCtx,
  emitNodeFn: (n: TemplateNode, ctx: EmitNodeCtx) => string,
): string {
  if (body.length === 0) return 'null';
  if (body.length === 1) {
    const rendered = emitNodeFn(body[0]!, ctx);
    const inner = stripBalancedMustache(rendered);
    if (inner !== null) {
      return `(${inner})`;
    }
    return rendered;
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
    // No trailing r-else — short-circuit form `cond && body` for the last branch.
    // Boolean-coerce the test with `!!(...)`: React renders a falsy-but-non-boolean
    // short-circuit result LITERALLY — `{0 && <x>}` paints "0", `{'' && <x>}` paints
    // nothing but is still fragile, `{NaN && <x>}` paints "NaN". A bare `r-if="list.length"`
    // (0 when empty) is the common trap. `!!(...)` collapses any falsy value to `false`
    // (which React drops) while keeping truthy values gating the body. The other five
    // targets don't need this — only React's `cond && jsx` idiom leaks the raw value.
    // (The ternary branches below are already safe: a falsy test routes to `: alternate`.)
    // The `!!(...)` also supplies the precedence parens the old `(test)` form provided,
    // so inner `||` / `??` still can't bind tighter than the trailing `&&`.
    const testCode = rewriteTemplateExpression(lastBranch.test, ctx.ir);
    const bodyCode = renderBranchBody(lastBranch.body, ctx, emitNodeFn);
    out = `!!(${testCode}) && ${bodyCode}`;
  }

  // Build right-to-left for any preceding branches.
  for (let i = branches.length - 2; i >= 0; i--) {
    const branch = branches[i]!;
    if (branch.test === null) {
      // r-else not at the end is malformed; emit body unconditionally.
      out = renderBranchBody(branch.body, ctx, emitNodeFn);
      continue;
    }
    // Same parenthesization rule as above for ternary tests.
    const testCode = rewriteTemplateExpression(branch.test, ctx.ir);
    const bodyCode = renderBranchBody(branch.body, ctx, emitNodeFn);
    out = `(${testCode}) ? ${bodyCode} : ${out}`;
  }

  return `{${out}}`;
}
