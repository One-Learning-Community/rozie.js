<template>

<div class="ticks" v-bind="$attrs">{{ ticks }}</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{ label?: string }>(),
  { label: '' }
);

const ticks = ref(0);

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  const timer = setInterval(() => {
    ticks.value += 1;
  }, 1000);
  _cleanup_0 = () => clearInterval(timer);
});
onBeforeUnmount(() => { _cleanup_0?.(); });
</script>

<style scoped>
.ticks { font-variant-numeric: tabular-nums; }
</style>
