/**
 * slotRecordKey — Lit target (Phase 79 Plan 09, R4/R12).
 *
 * Single source of truth for the escaped record-key text used on BOTH sides
 * of the `rozieSlots` record: the consumer's accumulated `.rozieSlots=${{ ... }}`
 * object literal (`emitSlotFiller.ts`) and the producer's `this.rozieSlots?.[key]`
 * lookup (`emitTemplate.ts`'s `emitSlot`). Mirrors the per-target
 * `refineSlotTypes.ts#renderRecordKey` convention already shipped on
 * React/Solid/Svelte/Angular/Vue (R12, T-79-07) — same escaping, own copy,
 * because Lit has no `refineSlotTypes.ts` of its own (D-13's real-type flow is
 * 79-12's job).
 *
 * @experimental — shape may change before v1.0
 */

/**
 * Escape a single-quoted string-literal key body: backslash first (so a
 * backslash inserted by the quote-escape step is not itself re-escaped), then
 * single quotes. Mirrors every other target's `escapeSingleQuotedKey` so a
 * quote/backslash in the author's slot name cannot break out of the emitted
 * string literal (T-79-07).
 */
function escapeSingleQuotedKey(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Render the record-lookup key for a STATIC slot/fill name: single-quoted and
 * escaped. Used as a plain (non-bracketed) object-literal key on the consumer
 * side (`'my-slot': (scope) => html\`…\`,`) and as a bracketed lookup on the
 * producer side (`this.rozieSlots?.[${renderRecordKey(name)}]`).
 */
export function renderRecordKey(name: string): string {
  return `'${escapeSingleQuotedKey(name)}'`;
}
