/**
 * emitSlotDecl — Solid target (P1 minimal).
 *
 * Produces slot-prop field strings and ctx interface declarations from ir.slots
 * for use in the emitted component's interface.
 *
 * P1 minimum: for each slot, emit a `JSX.Element` field (no context) per D-132;
 * tag context-bearing slots with a `// TODO(P2): function-prop signature` comment.
 * P2 implements the full D-132 split (with-context slots → function props).
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitSlotDeclResult {
  /** Interface field lines for each slot (e.g., `'  children?: JSX.Element;'`). */
  fields: string[];
  /** Standalone ctx interface declarations (empty in P1 stub). */
  ctxInterfaces: string[];
  diagnostics: Diagnostic[];
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function emitSlotDecl(ir: IRComponent): EmitSlotDeclResult {
  const fields: string[] = [];
  const ctxInterfaces: string[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const slot of ir.slots) {
    if (slot.name === '') {
      // Default slot → children (D-131).
      fields.push(`  children?: JSX.Element;`);
    } else {
      const hasCtx = slot.params && slot.params.length > 0;
      if (hasCtx) {
        // TODO(P2): emit (ctx: SlotCtx) => JSX.Element function-prop signature per D-132.
        fields.push(`  ${slot.name}?: JSX.Element;`);
      } else {
        // Named slot without context → JSX.Element prop per D-132.
        fields.push(`  ${slot.name}?: JSX.Element;`);
      }
    }
  }

  return { fields, ctxInterfaces, diagnostics };
}
