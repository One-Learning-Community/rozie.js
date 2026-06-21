<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ verbL(1) }}</span>
  <span class="echo">{{ verb2L(1) }}</span>
</div>

</template>

<script setup lang="ts">
import { provide } from 'vue';

const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const headL = () => props.base + 1;
// the registry API handed to children (the $provide leading comment that STAYS in
// residual position when $provide lowers to provide()/Provider — the real shape).
// imperative handle (consumer-callable) — the run-LEADING comment block that is
// SEPARATED from the host predecessor by one blank line (beforeGap=2). Inline, the
// blank breaks @babel's prev-trailing attachment, so this block attaches to verbL's
// leadingComments ONLY → single-emit on svelte/vue. The partial-splice mirror must
// NOT re-create the prev-trailing copy (doubling it = the R10 bug this guards).
const verbL = (n: number): number => headL() + n;
const verb2L = (n: number): number => verbL(n) + 1;

provide('themeL', {
  v: 1
});
</script>
