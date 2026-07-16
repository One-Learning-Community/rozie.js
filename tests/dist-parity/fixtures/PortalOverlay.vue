<template>

<Teleport :to="__roziePortalTo0" :disabled="!__roziePortalTo0"><div v-if="props.open" class="rozie-portal-overlay-backdrop">
  <div class="rozie-portal-overlay-box">
    <slot>Portalled content</slot>
  </div>
</div></Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{ open?: boolean; to?: boolean | string }>(),
  { open: false, to: false }
);

defineSlots<{
  default(props: {  }): any;
}>();

function resolveTo(to: any) {
  if (!to) return null;
  if (typeof document === 'undefined') return null;
  if (to === true || to === 'body') return document.body;
  return document.querySelector(to);
}

const __roziePortalTo0 = computed(() => (typeof document === 'undefined' ? null : (resolveTo(props.to))));
</script>

<style scoped>
.rozie-portal-overlay-backdrop {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  z-index: var(--rozie-portal-overlay-z, 3000);
}
.rozie-portal-overlay-box {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 16rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
</style>

<style>
:root {
  --rozie-portal-overlay-z: 3000;
}
</style>
