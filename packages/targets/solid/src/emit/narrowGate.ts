/**
 * narrowGate — Solid target, SN-1 (quick 261019-ti9).
 *
 * Thin wrapper over the shared, framework-agnostic gate in core
 * (`core/src/codegen/narrowGate.ts`): binds the Solid ctx's shadowing facts (a
 * keyless-For value binding, an index accessor or a slot scope param re-binding a
 * `$computed` root) to the shared predicate. See emitConditional.ts for the
 * lowering this gate selects.
 */
import type * as t from '@babel/types';
import type { IRComponent, IRTemplateNode as TemplateNode } from '@rozie/core';
import { planNarrowGate as planSharedNarrowGate } from '../../../../core/src/codegen/narrowGate.js';
import type { NarrowGate } from '../../../../core/src/codegen/narrowGate.js';
import type { EmitNodeCtx } from './emitTemplateNode.js';

export type { NarrowGate };

/** Plan the gate for one branch test, or null when the branch stays a plain Show. */
export function planNarrowGate(
  test: t.Expression,
  body: readonly TemplateNode[],
  ir: IRComponent,
  ctx: EmitNodeCtx,
): NarrowGate | null {
  return planSharedNarrowGate(
    test,
    body,
    ir,
    (root) =>
      ctx.loopValueBindings?.has(root) === true ||
      ctx.invokeAccessors?.has(root) === true ||
      ctx.scopeAccessorParams?.has(root) === true,
  );
}
