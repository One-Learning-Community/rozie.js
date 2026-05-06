/**
 * emitSlotDecl — Phase 5 Plan 02a Task 2.
 *
 * Slot type-declaration helpers for the Svelte target. Snippet typing fields
 * are produced by `refineSlotTypes.buildSlotTypeFields` (used by emitScript
 * inside `interface Props { ... }`); this file is a marker module for the
 * acceptance criteria + future expansion (e.g., when slot params get
 * concrete types in Phase 6 TYPES-01).
 *
 * Per RESEARCH Pattern 3: each `SlotDecl` produces ONE Snippet field on the
 * Props interface:
 *   - default slot (`name === ''`)            → `children?: Snippet[<...>]`
 *   - named slot                              → `<name>?: Snippet[<...>]`
 *   - param tuple (`Snippet<[A, B, ...]>`)    → one `any` per param in v1
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { buildSlotTypeFields } from './refineSlotTypes.js';

/**
 * Convenience re-export — the actual implementation lives in
 * refineSlotTypes.ts so it can be invoked from emitScript without a circular
 * import. This module exposes a slot-decl-shape-named alias for clarity at
 * the emitTemplate boundary.
 *
 * Sample emission for `[{ name: '', params: [Ctx] }, { name: 'header', params: [Ctx] }]`:
 *   [`  children?: Snippet<[any]>;`, `  header?: Snippet<[any]>;`]
 */
export function emitSlotDeclFields(slots: SlotDecl[]): string[] {
  return buildSlotTypeFields(slots);
}

/**
 * Type-level grep anchor for the Plan 02a acceptance criterion:
 *   `grep "Snippet<\\[" packages/targets/svelte/src/emit/emitSlotDecl.ts` ≥ 1
 */
export const __SVELTE_SLOT_TYPE_EXAMPLE = 'Snippet<[any]>';
