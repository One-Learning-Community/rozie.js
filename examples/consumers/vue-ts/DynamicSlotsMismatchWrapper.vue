<!--
  vue-ts R6/AC-10 negative-path wrapper — proves vue-tsc rejects a misspelled
  param destructure inside a family slot fill. Mirrors
  SelectMismatchWrapper.vue's `@vue-expect-error` pattern.
-->
<script setup lang="ts">
import DynamicSlots from './fixtures/DynamicSlots.vue';
</script>

<template>
  <DynamicSlots :row="{ status: 'ok' }" :total="3">
    <!-- @vue-expect-error — 'rowx' does not exist on the cell- family's scope shape -->
    <template #cell-status="{ rowx, value }">
      <span>{{ rowx }}{{ value }}</span>
    </template>
  </DynamicSlots>
</template>
