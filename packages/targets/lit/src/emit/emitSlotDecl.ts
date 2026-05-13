/**
 * emitSlotDecl.ts — P1 stub for slot declaration emission.
 *
 * P2 emits per-slot class-body fields:
 *   - `@queryAssignedElements({ slot: 'name', flatten: true })` query field
 *   - `@state() private _slot_name_present = false` presence boolean updated
 *     by a `slotchange` listener (D-LIT-14)
 *   - per-slot context interfaces (`interface FooCtx { ... }`) when scoped-slot
 *     params are declared (D-LIT-11 data-rozie-params transport)
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitSlotDeclResult {
  /** Class field declarations for slot presence + queryAssigned. */
  fields: string;
  /** Standalone `interface XCtx { ... }` decls hoisted above the class. */
  ctxInterfaces: string[];
  diagnostics: Diagnostic[];
}

export function emitSlotDecl(_ir: IRComponent): EmitSlotDeclResult {
  return { fields: '', ctxInterfaces: [], diagnostics: [] };
}
