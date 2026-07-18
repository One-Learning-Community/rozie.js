<template>

<div class="partial-inline-host" v-bind="$attrs">
  <span class="echo">{{ ariaSortK(1) }}</span>
  <span class="echo">{{ sortIndicatorK(1) }}</span>
</div>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ base?: number }>(),
  { base: 1 }
);

const tickK = () => props.base * 2;
// columnChromeK — the run-LEADING comment that flows directly below the host `const tickK`
// arrow const (gap-0 seam; no hoisted import — the arrow bodies close over host scope, the
// real DataTable columnChrome shape). This block is the partial's first surviving decl's
// leading comment; it transfers into the host verbatim (doubled on svelte/vue per-statement),
// so the inline oracle carries the IDENTICAL block directly below its own `const tickK`.
const ariaSortK = (n: number): number => tickK() + n;
const sortIndicatorK = (n: number): number => ariaSortK(n) + 1;
</script>
