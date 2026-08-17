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
 * Phase 79 Plan 12 (R6/D-13): a SlotDecl carrying `dynamicNameExpr` shares
 * the `''` default-slot sentinel (79-06 Assumption A1) but is NOT the
 * genuine default slot — the old `s.name === '' ? 'default' : s.name` key
 * resolution used to mint a spurious `default(...)` member for it (the bug
 * documented in 79-SPEC.md R6: "the four regression fixtures emit an
 * incorrect `default(props: { name: any })` entry"). It is routed through a
 * template-literal-keyed index signature when a static `namePrefix` is
 * derivable, or a plain `string` index signature when it is not — checked
 * BEFORE the static-name key resolution below, mirroring Angular's
 * established "record-only check before dedup" ordering (79-11). Param
 * types flow through the shared `lowerSlotParamType` helper (D-13) rather
 * than the pre-phase hardcoded `any` — `any` remains the floor for a
 * genuinely un-inferable param.
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { isSlotNameIdentifier } from '../../../../core/src/codegen/slotNameIdentifier.js';
import { lowerSlotParamType } from '../../../../core/src/codegen/slotParamTypeLowering.js';

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
/**
 * Build the value type of a family member (Phase 79 Plan 12, R6/AC-10): a
 * zero-param family types its value as a genuine zero-argument function
 * (`() => any`) — NOT a function accepting an empty object, which is the
 * (unrelated, pre-existing, byte-identity-pinned) shape a zero-param STATIC
 * member keeps. A param-bearing family lowers each param via the shared
 * `lowerSlotParamType` helper (D-13).
 */
function buildFamilyValueType(s: SlotDecl): string {
  if (s.params.length === 0) return '() => any';
  const paramFields = s.params
    .map((p, i) => `${p.name}: ${lowerSlotParamType(s.paramTypes?.[i])}`)
    .join('; ');
  return `(props: { ${paramFields} }) => any`;
}

export function buildSlotTypeBlock(slots: SlotDecl[]): string {
  if (slots.length === 0) return '';

  const lines: string[] = [];
  const emittedFamilyKeys = new Set<string>();
  for (const s of slots) {
    // Phase 79 Plan 12 (R6/D-13) — checked BEFORE the static-name key
    // resolution below; a dynamic-name slot never falls through to the
    // `'default'` branch even though it shares the '' sentinel.
    if (s.dynamicNameExpr !== undefined) {
      const familyKey =
        s.namePrefix !== undefined && s.namePrefix.length > 0
          ? `\`${s.namePrefix}\${string}\``
          : 'string';
      // Two dynamic-name slots deriving the SAME family key (identical
      // namePrefix, or both no-prefix) would otherwise mint a duplicate
      // index signature — invalid TS. ROZ093 (79-07) already hard-errors on
      // a duplicate namePrefix at the diagnostic layer; this dedup is a
      // defensive backstop so the TYPE SURFACE never emits the duplicate
      // even for an IR that reaches this function directly (unit tests).
      if (emittedFamilyKeys.has(familyKey)) continue;
      emittedFamilyKeys.add(familyKey);
      lines.push(`  [key: ${familyKey}]: (${buildFamilyValueType(s)}) | undefined;`);
      continue;
    }
    const slotName = s.name === '' ? 'default' : s.name;
    const key = renderSlotKey(slotName);
    const paramFields = s.params
      .map((p, i) => `${p.name}: ${lowerSlotParamType(s.paramTypes?.[i])}`)
      .join('; ');
    // Match Plan 02 stub format: two-space indent, semicolon-terminated.
    lines.push(`  ${key}(props: { ${paramFields} }): any;`);
  }
  return lines.join('\n');
}
