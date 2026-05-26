<template>

<div class="pdc" v-bind="$attrs">
  <pre data-rozie-pdc-output="">{{ JSON.stringify(observed) }}</pre>
  
  <span data-rozie-pdc-e-identity="">{{ props.e === props.e ? 'true' : 'false' }}</span>
  <span data-rozie-pdc-f-identity="">{{ props.f === props.f ? 'true' : 'false' }}</span>
</div>

</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const props = withDefaults(
  defineProps<{ a?: Record<string, any> | null; b?: number; c?: string; d?: boolean; e?: any[]; f?: Record<string, any> }>(),
  { a: null, b: 0, c: '', d: false, e: () => [], f: () => ({
  k: 1
}) }
);

const observed = ref(null);

onMounted(() => {
  observed.value = {
    a: props.a,
    b: props.b,
    c: props.c,
    d: props.d,
    e: props.e,
    f: props.f
  };
});
</script>

<style scoped>
.pdc {
  display: inline-flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.25rem;
  font-family: ui-monospace, monospace;
}
.pdc pre {
  margin: 0;
}
</style>
