/**
 * emitSlotInvocation — Phase 5 Plan 05-04a Task 2.
 *
 * Lowers a `TemplateSlotInvocationIR` into Angular markup per RESEARCH
 * Pattern 8 + OQ A5 RESOLVED:
 *
 *   - presence='always' AND no defaultContent (and no fallback inline)
 *       → `<ng-container *ngTemplateOutlet="fooTpl; context: {...}" />`
 *   - presence='conditional' AND no defaultContent
 *       → `@if (fooTpl) { <ng-container *ngTemplateOutlet="..." /> }`
 *   - defaultContent OR inline fallback present
 *       → `@if (fooTpl) { <ng-container *ngTemplateOutlet="..." /> } @else { <fallback /> }`
 *
 * Default slot (slotName === '') uses tplField `defaultTpl` and synthetic
 * ref name `#defaultSlot` (OQ A5 RESOLVED).
 *
 * @experimental — shape may change before v1.0
 */
import type {
  IRComponent,
  TemplateNode,
  TemplateSlotInvocationIR,
  SlotDecl,
} from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import { slotFieldName } from './refineSlotTypes.js';

export interface EmitSlotInvocationCtx {
  ir: IRComponent;
  /** Recursive call back into emitNode for fallback children. */
  emitChildren: (children: TemplateNode[]) => string;
  collisionRenames?: ReadonlyMap<string, string> | undefined;
  loopBindings?: ReadonlySet<string> | undefined;
}

/**
 * Render the args object for `*ngTemplateOutlet="...; context: {...}"`. Each
 * arg `name="expr"` becomes `name: expr` in the context literal. The first
 * arg also doubles as $implicit (Angular convention).
 */
function renderContextLiteral(
  node: TemplateSlotInvocationIR,
  ir: IRComponent,
  collisionRenames?: ReadonlyMap<string, string>,
  loopBindings?: ReadonlySet<string>,
): string {
  if (node.args.length === 0) return '';
  const namedFields: string[] = [];
  for (const a of node.args) {
    const expr = rewriteTemplateExpression(a.expression, ir, {
      collisionRenames,
      loopBindings,
    });
    namedFields.push(`${a.name}: ${expr}`);
  }
  // Aggregate $implicit as object of all named args.
  const implicitObj = `{ ${node.args
    .map((a) => {
      const expr = rewriteTemplateExpression(a.expression, ir, {
        collisionRenames,
        loopBindings,
      });
      return `${a.name}: ${expr}`;
    })
    .join(', ')} }`;
  const fields = [`$implicit: ${implicitObj}`, ...namedFields];
  return `{ ${fields.join(', ')} }`;
}

export function emitSlotInvocation(
  node: TemplateSlotInvocationIR,
  ctx: EmitSlotInvocationCtx,
): string {
  const tplField = slotFieldName(node.slotName);

  // Find matching SlotDecl to determine presence + defaultContent.
  const decl: SlotDecl | undefined = ctx.ir.slots.find(
    (s) => (s.name === '' ? '' : s.name) === node.slotName,
  );

  // Determine the fallback content.
  const fallbackChildren: TemplateNode[] =
    decl?.defaultContent !== null && decl?.defaultContent !== undefined
      ? [decl.defaultContent]
      : node.fallback;

  const hasFallback = fallbackChildren.length > 0;
  const presence: 'always' | 'conditional' = decl?.presence ?? 'always';

  // Build the *ngTemplateOutlet binding fragment.
  const ctxLiteral = renderContextLiteral(node, ctx.ir, ctx.collisionRenames, ctx.loopBindings);
  const ctxSuffix = ctxLiteral ? `; context: ${ctxLiteral}` : '';
  const outletTag = `<ng-container *ngTemplateOutlet="${tplField}${ctxSuffix}" />`;

  if (!hasFallback && presence === 'always') {
    // Bare *ngTemplateOutlet (TemplateRef may be undefined; Angular renders nothing).
    return outletTag;
  }

  if (!hasFallback && presence === 'conditional') {
    return `@if (${tplField}) {\n${outletTag}\n}`;
  }

  // Has fallback — verbose form.
  const fallbackMarkup = ctx.emitChildren(fallbackChildren);
  return `@if (${tplField}) {\n${outletTag}\n} @else {\n${fallbackMarkup}\n}`;
}
