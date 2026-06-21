<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ setColumnFilterJ(1, 2) }}</span>
  <span class="echo">{{ refreshRowModelJ }}</span>
</div>

</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headJ = (n: number): number => n + 1;
const setColumnFilterJ = (colId: number, value: number): number => {
  const next = colId + value;
  return next;
};

// Re-read the row model + header groups into $data
// Re-read the row model + header groups into $data
let refreshRowModelJ = 0;

onMounted(() => {
  refreshRowModelJ = setColumnFilterJ(1, headJ(2));
});
</script>
