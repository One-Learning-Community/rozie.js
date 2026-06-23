<template>

<div :class="['rozie-toaster', 'rozie-toaster--' + props.position]" role="region" :aria-label="regionLabel()" v-bind="$attrs" @mouseenter="onMouseEnter()" @mouseleave="onMouseLeave()">
  <div v-for="toast in toasts" :key="toast.id" :class="['rozie-toast', 'rozie-toast--' + toast.type]" role="status" :aria-live="liveFor(toast.type)">
    <slot name="toast" :toast="toast" :dismiss="dismiss">
      <span class="rozie-toast-message">{{ toast.message }}</span>
      <button type="button" class="rozie-toast-close" aria-label="Dismiss" @click="dismiss(toast.id)">×</button>
    </slot>
  </div>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

const props = withDefaults(
  defineProps<{ position?: string; duration?: number; max?: number; disablePauseOnHover?: boolean; ariaLabel?: string | null }>(),
  { position: 'bottom-right', duration: 4000, max: 0, disablePauseOnHover: false, ariaLabel: null }
);

defineSlots<{
  toast(props: { toast: any; dismiss: any }): any;
}>();

const toasts = ref<any[]>([]);

// Mutable cross-render scratch (NOT reactive): the per-id timeout handles and the
// id counter. Top-level lets → React useRef (setup-once persistence).
let timers = {};
let nextId = 0;

// ---- timers ------------------------------------------------------------
// ---- timers ------------------------------------------------------------
const startTimer = (toast: any) => {
  if (!toast || !toast.duration || toast.duration <= 0) return;
  if (typeof window === 'undefined') return;
  timers[toast.id] = window.setTimeout(() => dismiss(toast.id), toast.duration);
};
const clearTimer = (id: any) => {
  if (timers[id] && typeof window !== 'undefined') window.clearTimeout(timers[id]);
  delete timers[id];
};
const pauseTimers = () => {
  if (typeof window === 'undefined') return;
  for (const k in timers) window.clearTimeout(timers[k]);
  timers = {};
};

// ---- queue (imperative handle implementations) -------------------------
// ---- queue (imperative handle implementations) -------------------------
const show = (input: any) => {
  const t = input || {};
  const id = t.id != null ? t.id : 't' + nextId++;
  const toast = {
    id,
    message: t.message != null ? t.message : '',
    type: t.type || 'info',
    duration: t.duration != null ? t.duration : props.duration
  };
  const next = toasts.value.concat([toast]);
  const max = props.max;
  toasts.value = max > 0 && next.length > max ? next.slice(next.length - max) : next;
  startTimer(toast);
  return id;
};
const dismiss = (id: any) => {
  clearTimer(id);
  toasts.value = toasts.value.filter((t: any) => t.id !== id);
};
const clear = () => {
  pauseTimers();
  toasts.value = [];
};

// ---- hover pause -------------------------------------------------------
// ---- hover pause -------------------------------------------------------
const onMouseEnter = () => {
  if (props.disablePauseOnHover) return;
  pauseTimers();
};
const onMouseLeave = () => {
  if (props.disablePauseOnHover) return;
  for (const t of toasts.value as any) startTimer(t);
};

// ---- helpers -----------------------------------------------------------
// ---- helpers -----------------------------------------------------------
const regionLabel = () => props.ariaLabel != null ? props.ariaLabel : 'Notifications';
const liveFor = (type: any) => type === 'error' || type === 'warning' ? 'assertive' : 'polite';

// ---- lifecycle + handle ------------------------------------------------

onBeforeUnmount(() => {
  pauseTimers();
});

defineExpose({ show, dismiss, clear });
</script>

<style scoped>
.rozie-toaster {
  position: fixed;
  z-index: var(--rozie-toast-z, 9999);
  display: flex;
  flex-direction: column;
  gap: var(--rozie-toast-gap, 0.5rem);
  padding: var(--rozie-toast-region-padding, 1rem);
  max-width: var(--rozie-toast-max-width, calc(100vw - 2rem));
  pointer-events: none;
  font: var(--rozie-toast-font, inherit);
}
.rozie-toaster > * {
  pointer-events: auto;
}
.rozie-toaster--top-left { top: 0; left: 0; align-items: flex-start; }
.rozie-toaster--top-right { top: 0; right: 0; align-items: flex-end; }
.rozie-toaster--top-center { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
.rozie-toaster--bottom-left { bottom: 0; left: 0; align-items: flex-start; flex-direction: column-reverse; }
.rozie-toaster--bottom-right { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
.rozie-toaster--bottom-center { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
.rozie-toast {
  display: flex;
  align-items: center;
  gap: var(--rozie-toast-content-gap, 0.75rem);
  min-width: var(--rozie-toast-min-width, 16rem);
  max-width: var(--rozie-toast-toast-max-width, 24rem);
  padding: var(--rozie-toast-padding, 0.75rem 1rem);
  color: var(--rozie-toast-color, #fff);
  background: var(--rozie-toast-bg, #333);
  border-radius: var(--rozie-toast-radius, 0.5rem);
  box-shadow: var(--rozie-toast-shadow, 0 6px 20px rgba(0, 0, 0, 0.25));
}
.rozie-toast--success { background: var(--rozie-toast-success-bg, #16a34a); }
.rozie-toast--error { background: var(--rozie-toast-error-bg, #dc2626); }
.rozie-toast--warning { background: var(--rozie-toast-warning-bg, #ca8a04); }
.rozie-toast--info { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
.rozie-toast-message {
  flex: 1 1 auto;
  font-size: var(--rozie-toast-font-size, 0.9rem);
}
.rozie-toast-close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-toast-close-size, 1.25rem);
  height: var(--rozie-toast-close-size, 1.25rem);
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  color: inherit;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  opacity: var(--rozie-toast-close-opacity, 0.75);
  cursor: pointer;
}
.rozie-toast-close:hover {
  opacity: 1;
}
</style>
