/**
 * emitSlotDecl — Plan 04-03 Task 2 (React target).
 *
 * Produces interface FooProps slot fields + standalone XCtx interface
 * declarations from ir.slots, using refineSlotTypes for the per-slot
 * type synthesis.
 *
 * Returns:
 *   - slotPropFields — lines like `'  children?: (ctx: ChildrenCtx) => ReactNode;'`
 *   - slotCtxInterfaces — lines like `'interface TriggerCtx { open: any; toggle: any; }'`
 *
 * Per REACT-T-04 (strict children:(ctx)=>ReactNode shape), REACT-T-07
 * (interface FooProps gets render-prop slot fields), and CONTEXT D-67
 * (default slot called 'children'; named slot called 'renderName').
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { refineSlotTypes } from './refineSlotTypes.js';

export interface EmitSlotDeclResult {
  slotPropFields: string[];
  slotCtxInterfaces: string[];
}

export function emitSlotDecl(ir: IRComponent): EmitSlotDeclResult {
  const slotPropFields: string[] = [];
  const slotCtxInterfaces: string[] = [];
  const seenInterfaces = new Set<string>();
  // Dedupe by render-prop field name — a template may legitimately declare the
  // same `<slot name="X">` more than once (e.g. one value-bubble per thumb in a
  // range slider). The render-time invocation is emitted per-occurrence by
  // emitSlotInvocation, but the `interface Props` render-prop field
  // (`renderX?: (ctx: XCtx) => ReactNode`) must be declared EXACTLY ONCE per
  // distinct slot name, otherwise the props interface has a duplicate
  // identifier (TS2300). Matches the already-existing ctx-interface dedup below.
  const seenPropFields = new Set<string>();

  for (const slot of ir.slots) {
    const refined = refineSlotTypes(slot);
    if (!seenPropFields.has(refined.propFieldName)) {
      slotPropFields.push(`  ${refined.propFieldName}?: ${refined.propFieldType};`);
      seenPropFields.add(refined.propFieldName);
    }
    if (refined.ctxInterface !== null && !seenInterfaces.has(refined.ctxInterface)) {
      slotCtxInterfaces.push(refined.ctxInterface);
      seenInterfaces.add(refined.ctxInterface);
    }
  }

  return { slotPropFields, slotCtxInterfaces };
}
