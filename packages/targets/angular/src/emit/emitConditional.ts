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
import type { TemplateConditionalIR, IRTemplateNode as TemplateNode } from '@rozie/core';
import {
  classifyNarrowTest,
  componentStatePath,
} from '../../../../core/src/codegen/narrowGate.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';

/**
 * SN-1 parity (quick 261019-ti9, add-on G) — the ctx a branch BODY renders with.
 *
 * `@if (picked()) { … picked().name … }` is TS2531 under `strictTemplates`: the
 * test and the re-read are two separate signal CALLS, which TypeScript never
 * narrows (React / Vue / Svelte / Lit narrow the plain property read). When the
 * test is a recognised nullish guard over a component-state value (bare
 * truthiness, `!!x`, `x != null`, `x !== null`, `x !== undefined`, either operand
 * order), the branch body records that path in `nonNullReads`; the template
 * rewriter then asserts the read non-null (`picked()!.name`) at the positions
 * that need it. The idiomatic `@if (x; as v)` alias cannot express the
 * null-comparison shapes (`0` / `''` must still render, and a template cannot
 * hold the boxing arrow function AOT rejects), so one uniform, type-only `!`
 * covers every shape with zero runtime change. The branch's OWN test and its
 * siblings render with the outer ctx.
 */
function branchBodyCtx(
  test: TemplateConditionalIR['branches'][number]['test'],
  ctx: EmitNodeCtx,
): EmitNodeCtx {
  if (test === null) return ctx;
  const cand = classifyNarrowTest(test);
  if (cand === null) return ctx;
  const path = componentStatePath(
    cand.value,
    ctx.ir,
    (root) => ctx.loopBindings?.has(root) === true,
  );
  if (path === null) return ctx;
  return { ...ctx, nonNullReads: new Set([...(ctx.nonNullReads ?? []), path]) };
}

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
    const body = renderBranchBody(branch.body, branchBodyCtx(branch.test, ctx), emitNodeFn);

    if (i === 0) {
      const test = branch.test
        ? rewriteTemplateExpression(branch.test, ctx.ir, {
            collisionRenames: ctx.collisionRenames,
            loopBindings: ctx.loopBindings,
            cvaModelProp: ctx.cvaModelProp,
            cvaMergeDisabled: ctx.cvaMergeDisabled,
            nonNullReads: ctx.nonNullReads,
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
        cvaModelProp: ctx.cvaModelProp,
        cvaMergeDisabled: ctx.cvaMergeDisabled,
        nonNullReads: ctx.nonNullReads,
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
