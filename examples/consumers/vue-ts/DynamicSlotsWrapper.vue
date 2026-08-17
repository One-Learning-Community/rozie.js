<!--
  vue-ts R6/AC-10 wrapper — exercises DynamicSlots' template-literal-keyed
  family slot type surface under vue-tsc, mirroring SelectStringWrapper.vue's
  established pattern (template-level type assertions live in a dedicated
  wrapper .vue file, not test.ts's h() calls, because vue-tsc's strongest
  slot/generic narrowing happens at the template consumption site).

  Covers AC-10's positive, zero-param-family, and coexistence cases. The
  negative (`@ts-expect-error`) case lives in the sibling
  DynamicSlotsMismatchWrapper.vue, matching the Select* pair's split.
-->
<script setup lang="ts">
import DynamicSlots from './fixtures/DynamicSlots.vue';

function onCellStatus(scope: { row: unknown; value: unknown }): void {
  const r: unknown = scope.row;
  const v: unknown = scope.value;
  void r;
  void v;
}
</script>

<template>
  <DynamicSlots :row="{ status: 'ok' }" :total="3">
    <!-- Positive — family destructure carries real param types. -->
    <template #cell-status="{ row, value }">
      <span>{{ onCellStatus({ row, value }) }}</span>
    </template>
    <!-- Zero-param family ('row-') types its value as a zero-argument slot. -->
    <template #row-anything>
      <em>fallback</em>
    </template>
    <!-- Coexistence — the static cell-total slot typechecks against ITS OWN
         one-param shape, not the overlapping cell- family's two-param one. -->
    <template #cell-total="{ value }">
      <strong>{{ value }}</strong>
    </template>
  </DynamicSlots>
</template>
