<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ usedNameE(1) }}</span>
  <span class="echo">{{ hostTailE(1) }}</span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headE = (n: number): number => n + 1;
const usedNameE = (k: number): number => k * 2;
// leading: the inline host successor trails the spliced partial decl
const hostTailE = (n: number): number => usedNameE(n) + headE(n);
</script>
