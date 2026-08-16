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
 * Phase 79 Plan 03 (R12/D-04): the key is quoted ONLY when the slot name is
 * not a valid JS identifier — an identifier-named or default slot keeps the
 * exact pre-phase unquoted key, byte-identical, while a non-identifier name
 * (e.g. `cell-status`) becomes representable as a single-quoted string
 * literal. This is Vue's ONLY change for R12; the shape-check itself is the
 * shared `isSlotNameIdentifier` predicate every R12 routing plan imports.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped),
 * then single quotes.
 */
function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Render a slot-block key: bare when `slotName` is a valid identifier
 * (pre-phase, byte-identical form), single-quoted-and-escaped otherwise
 * (Phase 79 R12/D-04).
 */
function renderSlotKey(slotName: string): string {
  return isSlotNameIdentifier(slotName)
    ? slotName
    : `'${escapeSingleQuotedKey(slotName)}'`;
}

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
    const key = renderSlotKey(slotName);
    const paramFields = s.params.map((p) => `${p.name}: any`).join('; ');
    // Match Plan 02 stub format: two-space indent, semicolon-terminated.
    lines.push(`  ${key}(props: { ${paramFields} }): any;`);
  }
  return lines.join('\n');
}
