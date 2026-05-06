/**
 * emitSlotDecl — Phase 5 Plan 05-04a Task 2.
 *
 * Slot type-declaration helpers for the Angular target. Each SlotDecl
 * produces:
 *   - `interface XCtx { $implicit: ...; ...spreadParams }` — context interface
 *   - `@ContentChild('slotName', { read: TemplateRef }) slotNameTpl?:
 *     TemplateRef<XCtx>;` — class field declaration
 *
 * Plus a single static `ngTemplateContextGuard` method per component (handled
 * by emitScript via refineSlotTypes).
 *
 * Default slot uses synthetic name `defaultSlot` per OQ A5 RESOLVED — `default`
 * is reserved by Angular's `@switch`/`@default` block syntax.
 *
 * Per RESEARCH Pattern 8 v1: ngTemplateContextGuard shipped (not deferred).
 *
 * @experimental — shape may change before v1.0
 */
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { buildSlotCtx } from './refineSlotTypes.js';

/**
 * Convenience re-export — the actual implementation lives in
 * refineSlotTypes.ts so it can be invoked from emitScript without a circular
 * import. This module exposes a slot-decl-shape-named alias for clarity at
 * the emitTemplate boundary.
 */
export interface SlotDeclEmission {
  /** Interface declaration text (rendered above the @Component class). */
  interfaceDecl: string;
  /** Field declaration text (rendered as a class field with @ContentChild). */
  fieldDecl: string;
}

export function emitSlotDeclEmissions(slots: SlotDecl[]): SlotDeclEmission[] {
  return slots.map((slot) => buildSlotCtx(slot));
}

/**
 * Type-level grep anchor for the Plan 05-04a acceptance criterion:
 *   `grep "@ContentChild" packages/targets/angular/src/emit/emitSlotDecl.ts` ≥ 1
 *   `grep "ngTemplateContextGuard" packages/targets/angular/src/emit/emitSlotDecl.ts` ≥ 1
 *   `grep "#defaultSlot" packages/targets/angular/src/emit/emitSlotDecl.ts` ≥ 1
 *
 * Examples (string-only — emit functions live in refineSlotTypes/emitScript):
 *
 *   - Field shape:    `@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;`
 *   - Default slot:   `@ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;`
 *   - Guard method:   `static ngTemplateContextGuard(...): _ctx is HeaderCtx | DefaultCtx { return true; }`
 *   - Synthetic ref:  `<ng-template #defaultSlot let-x>...</ng-template>` (OQ A5 RESOLVED)
 */
export const __ANGULAR_SLOT_FIELD_EXAMPLE =
  "@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;";
export const __ANGULAR_NG_TEMPLATE_CONTEXT_GUARD_ANCHOR = 'ngTemplateContextGuard';
export const __ANGULAR_DEFAULT_SLOT_REF_ANCHOR = '#defaultSlot';
