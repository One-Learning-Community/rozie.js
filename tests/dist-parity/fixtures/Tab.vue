<template>

<button :class="['tab', { 'is-active': tabs && tabs.active === myIndex }]" data-tab="" type="button" role="tab" :data-active="tabs && tabs.active === myIndex" v-bind="$attrs" @click="tabs && tabs.setActive(myIndex)">
  {{ props.label }}
</button>

</template>

<script setup lang="ts">
import { inject } from 'vue';

const props = withDefaults(
  defineProps<{ label?: string }>(),
  { label: '' }
);

const tabs = inject('tabs');

// Claim a stable index at setup time. Guarded for the Lit async edge — if the
// context has not resolved yet, fall back to 0 (it re-resolves on connect).
const myIndex = tabs ? tabs.register() : 0;
</script>

<style scoped>
.tab {
  font-family: system-ui, -apple-system, sans-serif;
  padding: 0.375rem 0.75rem;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
.tab.is-active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}
</style>
