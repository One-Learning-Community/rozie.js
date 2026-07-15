<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ gridKeydownHandlersM(1, 2) }}</span>
  <span class="echo">{{ refreshRowModelM }}</span>
</div>

</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headM = (n: number): number => n + 1;
const gridKeydownHandlersM = (rIdx: number, cIdx: number): number => {
  const active = rIdx + cIdx;
  return active;
};
// the row-selection slice tracks which rows are checked
// across header-group and body rows alike

// inRange(rIdx, cIdx) gates the active cell within the
// current 2-D selection range before a keydown commits
let refreshRowModelM = 0;

onMounted(() => {
  refreshRowModelM = gridKeydownHandlersM(1, headM(2));
});
</script>
