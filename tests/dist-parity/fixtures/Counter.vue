<template>

<div :class="['counter', { hovering: hovering }]" @mouseenter="hovering = true" @mouseleave="hovering = false">
  <button :disabled="!canDecrement" aria-label="Decrement" @click="decrement">−</button>
  <span class="value">{{ value }}</span>
  <button :disabled="!canIncrement" aria-label="Increment" @click="increment">+</button>
</div>

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

const props = withDefaults(
  defineProps<{ step?: number; min?: number; max?: number }>(),
  { step: 1, min: -Infinity, max: Infinity }
);

const value = defineModel<number>('value', { default: 0 });

const hovering = ref(false);

const canIncrement = computed(() => value.value + props.step <= props.max);
const canDecrement = computed(() => value.value - props.step >= props.min);

console.log("hello from rozie");
const increment = () => {
  if (canIncrement.value) value.value += props.step;
};
const decrement = () => {
  if (canDecrement.value) value.value -= props.step;
};
</script>

<style scoped>
.counter { display: inline-flex; gap: 0.5rem; align-items: center; }
.counter.hovering { background: rgba(0, 0, 0, 0.04); }
.value { font-variant-numeric: tabular-nums; min-width: 3ch; text-align: center; }
.counter button { padding: 0.25rem 0.5rem; }
.counter button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
