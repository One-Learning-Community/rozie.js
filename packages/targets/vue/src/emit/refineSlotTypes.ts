/**
 * refineSlotTypes — Phase 3 Plan 03 Task 2.
 *
 * Replaces the Plan 02 `defineSlots<{ x(props: any): any }>` stub with real
 * scoped-slot signatures. Each SlotDecl emits one method-style signature where
 * the `props` parameter type literal lists each ParamDecl name.
 *
 * v1: every param type is `any` (RESEARCH.md line 452 — TYPES-01 / Phase 6
 * refines once Phase 6 type-flow lands). Default slot (`name === ''`) keys as
 * `'default'` per Vue's slot model (RESEARCH.md A1).
 *
 * Plan 04 owns the regenerate-of-script-snap responsibility: this module's
 * output is composed into the final `<script setup>` text by emitScript via
 * a follow-up call from emitVue. Plan 03 ships the function + unit tests
 * (in emitTemplate.test.ts under "buildSlotTypeBlock — slot type signatures")
 * that lock the literal substring; whole-script snapshot regeneration falls
 * to Plan 04.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';

/**
 * Build the `defineSlots<{ ... }>()` interior block from SlotDecl[].
 *
 * Returns a multi-line string (each line indented two spaces) suitable for
 * splicing inside `defineSlots<{\n${block}\n}>();`.
 *
 * Empty input returns the empty string (caller is expected to skip the
 * defineSlots emission entirely).
 */
export function buildSlotTypeBlock(slots: SlotDecl[]): string {
  if (slots.length === 0) return '';

  const lines: string[] = [];
  for (const s of slots) {
    const slotName = s.name === '' ? 'default' : s.name;
    const paramFields = s.params.map((p) => `${p.name}: any`).join('; ');
    // Match Plan 02 stub format: two-space indent, semicolon-terminated.
    lines.push(`  ${slotName}(props: { ${paramFields} }): any;`);
  }
  return lines.join('\n');
}
