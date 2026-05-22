<template>

<button :class="['btn', props.variant]" :style="{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }" v-bind="$attrs">
  {{ props.label }}
</button>

</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ label?: string; variant?: string }>(),
  { label: 'Click me', variant: 'primary' }
);
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  background: var(--btn-bg, #3b82f6);
  color: var(--btn-fg, #ffffff);
  font: inherit;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
