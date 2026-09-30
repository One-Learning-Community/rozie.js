/**
 * Vue module-script builder — typed public surface phase 1.
 *
 * Exported types cannot live inside `<script setup>` (Vue forbids ES module
 * exports there), so when the component authors `<types>` or an `$expose`
 * signature, Vue emits a SEPARATE `<script lang="ts">` block BEFORE
 * `<script setup lang="ts">`. Module-scope declarations are visible inside
 * `<script setup>` (Vue merges both blocks into one module), so payload / slot
 * types that name a `<types>` entry resolve in `defineEmits` / `defineSlots`.
 *
 * Returns '' when there is nothing to emit (byte-identical for non-opt-in
 * components: no module script block at all).
 */
import type { IRComponent } from '@rozie/core';
import { renderTypesBlock } from '@rozie/core';
import { synthesizeHandleType } from '../../../../core/src/codegen/synthesizeHandleType.js';

export function buildVueModuleScript(ir: IRComponent): string {
  const hasSignatures = (ir.expose ?? []).some((e) => e.signature !== undefined);
  return [
    renderTypesBlock(ir),
    hasSignatures ? `export ${synthesizeHandleType(ir, `${ir.name}Handle`)}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}
