/**
 * slotRecordKey — Lit target (Phase 79 Plan 09, R4/R12).
 *
 * Single source of truth for the escaped record-key text used on BOTH sides
 * of the `rozieSlots` record: the consumer's accumulated `.rozieSlots=${{ ... }}`
 * object literal (`emitSlotFiller.ts`) and the producer's `this.rozieSlots?.[key]`
 * lookup (`emitTemplate.ts`'s `emitSlot`).
 *
 * WR-05 fix (79-REVIEW-FIX): `escapeSingleQuotedKey`/`renderRecordKey` used to
 * be defined here as Lit's own copy — mirroring the per-target
 * `refineSlotTypes.ts#renderRecordKey` convention already shipped on
 * React/Solid/Svelte/Angular/Vue (R12, T-79-07), each with its own identical
 * copy. Six independent byte-identical copies of security-relevant escaping
 * logic is exactly the drift risk this phase's own `isSlotNameIdentifier` /
 * `lowerSlotParamType` precedent was meant to avoid — consolidated into
 * `core/src/codegen/escapeSingleQuotedKey.ts`; this module now re-exports it
 * (mirrors the identical re-export pattern already used by
 * `packages/targets/svelte/src/emit/emitSlotDecl.ts` for
 * `isSlotNameIdentifier`), so this file's existing import sites
 * (`emitSlotFiller.ts`, `emitTemplate.ts`) keep working unchanged.
 *
 * @experimental — shape may change before v1.0
 */
export { renderRecordKey } from '../../../../core/src/codegen/escapeSingleQuotedKey.js';
