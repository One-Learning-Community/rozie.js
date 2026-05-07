<template>

<div class="dropdown">
  <div ref="triggerElRef" @click="toggle">
    <slot name="trigger" :open="open" :toggle="toggle"></slot>
  </div>

  <div v-if="open" ref="panelElRef" class="dropdown-panel" role="menu">
    <slot :close="close"></slot>
  </div></div>

</template>

<script setup lang="ts">
import { onMounted, ref, watchEffect } from 'vue';
import { throttle, useOutsideClick } from '@rozie/runtime-vue';

const props = withDefaults(
  defineProps<{ closeOnOutsideClick?: boolean; closeOnEscape?: boolean }>(),
  { closeOnOutsideClick: true, closeOnEscape: true }
);

const open = defineModel<boolean>('open', { default: false });

defineSlots<{
  trigger(props: { open: any; toggle: any }): any;
  default(props: { close: any }): any;
}>();

const triggerElRef = ref<HTMLElement>();
const panelElRef = ref<HTMLElement>();

const toggle = () => {
  open.value = !open.value;
};
const close = () => {
  open.value = false;
};
const reposition = () => {
  if (!panelElRef.value || !triggerElRef.value) return;
  const rect = triggerElRef.value.getBoundingClientRect();
  Object.assign(panelElRef.value.style, {
    top: `${rect.bottom}px`,
    left: `${rect.left}px`
  });
};

// Multiple $onMount calls run in source order. Useful for colocating setup
// with the logic it serves.

onMounted(() => {
  reposition();
});
onMounted(() => {
  // Example of integrating a vanilla JS library — $refs gives direct DOM access.
  // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
});

useOutsideClick(
  [triggerElRef, panelElRef],
  () => close(),
  () => open.value && props.closeOnOutsideClick,
);

watchEffect((onCleanup) => {
  if (!(open.value && props.closeOnEscape)) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    close();
  };
  document.addEventListener('keydown', handler);
  onCleanup(() => document.removeEventListener('keydown', handler));
});

const throttledLReposition = throttle(reposition, 100);
watchEffect((onCleanup) => {
  if (!(open.value)) return;
  window.addEventListener('resize', throttledLReposition, { passive: true });
  onCleanup(() => window.removeEventListener('resize', throttledLReposition, { passive: true }));
});
</script>

<style scoped>
.dropdown { position: relative; display: inline-block; }
.dropdown-panel {
  position: fixed;
  z-index: var(--rozie-dropdown-z, 1000);
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
</style>

<style>
:root {
  --rozie-dropdown-z: 1000;
}
</style>
