<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ rangeTransitionI }}</span>
  <span class="echo">{{ afterDeclI(1) }}</span>
  <span class="echo">{{ fillDragUpI }}</span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headI = (n: number): number => n + 1;
let rangeTransitionI = headI(1);
// after-side: comment trails the host let rangeTransitionI and leads the spliced afterDeclI below
// after-side: comment trails the host let rangeTransitionI and leads the spliced afterDeclI below
const afterDeclI = (k: number): number => k * 2;
let fillDragUpI = afterDeclI(1);
</script>
