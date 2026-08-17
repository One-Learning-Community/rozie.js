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
 * Phase 79 Plan 04 (R12/D-03): a slot name that is not a valid JS identifier
 * (e.g. `cell-status`) mints NO named field or ctx interface here at all — it
 * is reachable only through the bracket-keyed record built in
 * emitSlotInvocation.ts. Gated directly on the shared `isSlotNameIdentifier`
 * predicate (imported from core, never redeclared).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { refineSlotTypes, isDynamicOnlySlot } from './refineSlotTypes.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';

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
    // Phase 79 Plan 12 (R6) — a dynamic-name slot shares the '' default-slot
    // sentinel (79-06 Assumption A1) but is NOT the genuine default slot; it
    // is reachable only through the `slots?:` record (emitSlotInvocation.ts
    // never reads `props.children` for it). Checked BEFORE the non-identifier
    // check below (that check would not fire for it anyway, since its name
    // IS '' — but ordering matches the "record-only check before dedup"
    // precedent Angular's refineSlotTypes.ts established in 79-11).
    if (isDynamicOnlySlot(slot)) continue;
    // D-03 — a non-identifier, non-default slot name has no named prop path;
    // it is reachable only through the record (emitSlotInvocation.ts). Skip
    // minting a field/ctx-interface for it entirely.
    if (slot.name !== '' && !isSlotNameIdentifier(slot.name)) continue;
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
