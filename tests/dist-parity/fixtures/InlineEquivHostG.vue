<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ selectAllBoxG }}</span>
  <span class="echo">{{ afterDeclG(1) }}</span>
  <span class="echo">{{ rangeTransitionG }}</span>
  <span class="echo">{{ beforeDeclG(1) }}</span>
  <span class="echo">{{ fillDragUpG }}</span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headG = (n: number): number => n + 1;
let selectAllBoxG = headG(1);
const afterDeclG = (k: number): number => k * 2;
const midDeclG = (k: number): number => k + 3;
// before-side: the sandwiched host let trails the spliced midDeclG above
let rangeTransitionG = midDeclG(1);
const beforeDeclG = (k: number): number => k * 5;
// before-side: the sandwiched host let trails the spliced beforeDeclG above
let fillDragUpG = beforeDeclG(1);
</script>
