/**
 * emitSlotDecl — Solid target (P2 complete implementation).
 *
 * Produces slot-prop field strings and ctx interface declarations from ir.slots.
 *
 * D-132 split implementation:
 *   - Default slot (`slot.name === ''`): `children?: JSX.Element` (D-131 reactive getter form)
 *   - Named slot WITHOUT context (`slot.params.length === 0`): `<name>Slot?: JSX.Element`
 *   - Named slot WITH context (`slot.params.length > 0`): `<name>Slot?: (ctx: <Name>SlotCtx) => JSX.Element`
 *     + emit a separate `interface <Name>SlotCtx { ... }` declaration
 *
 * The `Slot` suffix convention: slot `trigger` → `triggerSlot`, slot `header` → `headerSlot`.
 *
 * @experimental — shape may change before v1.0
 */
import type { IRComponent } from '../../../../core/src/ir/types.js';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';

export interface EmitSlotDeclResult {
  /** Interface field lines for each slot. */
  fields: string[];
  /** Standalone ctx interface declarations for context-bearing named slots. */
  ctxInterfaces: string[];
  diagnostics: Diagnostic[];
}

function capitalize(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function pascalCase(name: string): string {
  const parts = name.split(/[-_]/).filter(Boolean);
  return parts.map((p) => capitalize(p)).join('');
}

export function emitSlotDecl(ir: IRComponent): EmitSlotDeclResult {
  const fields: string[] = [];
  const ctxInterfaces: string[] = [];
  const diagnostics: Diagnostic[] = [];
  const seenInterfaces = new Set<string>();

  for (const slot of ir.slots) {
    if (slot.name === '') {
      // Default slot → children (D-131): Solid's children() accessor reads this.
      // Comment per plan instruction Step H.
      fields.push(`  // D-131: default slot resolved via children() at body top`);
      fields.push(`  children?: JSX.Element;`);
    } else {
      const hasCtx = slot.params && slot.params.length > 0;
      const slotFieldName = slot.name + 'Slot';
      const pascal = pascalCase(slot.name);
      const ctxName = pascal + 'SlotCtx';

      if (hasCtx) {
        // Named slot WITH context → function-prop signature per D-132.
        fields.push(`  ${slotFieldName}?: (ctx: ${ctxName}) => JSX.Element;`);

        // Emit a standalone interface for the ctx (deduplicated).
        if (!seenInterfaces.has(ctxName)) {
          const paramFields = slot.params
            .map((p) => `${p.name}: any;`)
            .join(' ');
          ctxInterfaces.push(`interface ${ctxName} { ${paramFields} }`);
          seenInterfaces.add(ctxName);
        }
      } else {
        // Named slot WITHOUT context → JSX.Element prop per D-132.
        fields.push(`  ${slotFieldName}?: JSX.Element;`);
      }
    }
  }

  return { fields, ctxInterfaces, diagnostics };
}
