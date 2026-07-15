<template>

<div :class="['rozie-toaster', 'rozie-toaster--' + props.position]" role="region" :aria-label="regionLabel()" v-bind="$attrs" @mouseenter="onMouseEnter()" @mouseleave="onMouseLeave()">
  
  <div v-for="t in toasts" :key="t.id" :class="['rozie-toast', 'rozie-toast--' + t.type]" role="status" :aria-live="liveFor(t.type)">
    <slot name="toast" :toast="t" :dismiss="dismiss">
      <span class="rozie-toast-message">{{ t.message }}</span>
      <button type="button" class="rozie-toast-close" aria-label="Dismiss" @click="dismiss(t.id)">×</button>
    </slot>
  </div>
</div>

</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Which corner the toast stack renders in: `'top-left'`, `'top-right'`, `'top-center'`, `'bottom-left'`, `'bottom-right'`, or `'bottom-center'`. Drives the fixed-position layout and the stack direction.
     */
    position?: string;
    /**
     * Default auto-dismiss time in milliseconds, applied to any toast that does not pass its own `duration`. `0` (or a per-toast `duration` of `0`) makes the toast sticky — it stays until explicitly dismissed.
     */
    duration?: number;
    /**
     * Maximum number of visible toasts (`0` = unlimited). When the queue exceeds this, the oldest toasts drop off the stack.
     */
    max?: number;
    /**
     * Opt **out** of pausing the auto-dismiss timers while the pointer is over the stack. By default hovering pauses every timer and leaving restarts them; set this to keep toasts dismissing on schedule regardless of hover.
     */
    disablePauseOnHover?: boolean;
    /**
     * Accessible name for the live region (`role="region"`), applied as its `aria-label`. Defaults to `'Notifications'` when not set, so assistive tech can navigate to the toast stack as a landmark.
     */
    ariaLabel?: string | null;
  }>(),
  { position: 'bottom-right', duration: 4000, max: 0, disablePauseOnHover: false, ariaLabel: null }
);

defineSlots<{
  toast(props: { toast: any; dismiss: any }): any;
}>();

const toasts = ref<any[]>([]);
const seq = ref(0);

// Mutable cross-render scratch (NOT reactive): the per-id timeout handles. A
// top-level `let` → React useRef (it escapes into $onUnmount's effect, so the
// emitter hoists it). The id counter lives in $data.seq instead (see <data>).
let timers = {};
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
const show = (input: any) => {
  const t = input || {};
  // Derive the id from the reactive $data.seq counter (persists on React, unlike
  // a module-let referenced only here). Read seq into a local BEFORE writing it
  // back (no read-after-write of the same key in one fn → ROZ138-safe).
  let id;
  if (t.id != null) {
    id = t.id;
  } else {
    const s = seq.value;
    id = 't' + s;
    seq.value = s + 1;
  }
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
const onMouseEnter = () => {
  if (props.disablePauseOnHover) return;
  pauseTimers();
};
const onMouseLeave = () => {
  if (props.disablePauseOnHover) return;
  for (const t of toasts.value as any) startTimer(t);
};
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
