<template>

<button :class="['tab', { 'is-active': tabs && tabs.active === props.index }]" data-tab="" type="button" role="tab" :data-active="tabs && tabs.active === props.index" v-bind="$attrs" @click="tabs && tabs.setActive(props.index)">
  {{ props.label }}
</button>

</template>

<script setup lang="ts">
import { inject } from 'vue';

const props = withDefaults(
  defineProps<{ label?: string; index?: number }>(),
  { label: '', index: 0 }
);

const tabs = inject('tabs');
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
