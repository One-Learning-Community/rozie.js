<template>

<div :class="['rozie-toaster', 'rozie-toaster--' + props.position]" role="region" :aria-label="regionLabel()" v-bind="$attrs" @mouseenter="onMouseEnter()" @mouseleave="onMouseLeave()">
  
  <div v-for="t in toasts" :key="t.id" :class="['rozie-toast', 'rozie-toast--' + t.type + (t.exiting ? ' rozie-toast--exiting' : '')]" role="status" :aria-live="liveFor(t.type)" @animationend="t.exiting && removeToast(t.id)">
    <slot name="toast" :toast="t" :dismiss="dismiss">
      <span v-if="t.type === 'loading'" class="rozie-toast-spinner" aria-hidden="true"></span><span class="rozie-toast-message">{{ t.message }}</span>
      <button type="button" class="rozie-toast-close" aria-label="Dismiss" @click="dismissBegin(t.id, 'close')">×</button>
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

const emit = defineEmits<{
  dismissed: [...args: any[]];
}>();

defineSlots<{
  toast(props: { toast: any; dismiss: any }): any;
}>();

const toasts = ref<any[]>([]);
const seq = ref(0);

// Mutable cross-render scratch (NOT reactive): per-id timer bookkeeping. A
// top-level `let` → React useRef (it escapes into $onUnmount's effect, so the
// emitter hoists it). The id counter lives in $data.seq instead (see <data>).
//
// Shape: { [id]: { handle, startedAt, remaining } }. `pauseTimers` clears the
// live setTimeout handle but KEEPS the entry with a decremented `remaining` —
// the remainder IS the state (this is what makes the hover pause PRECISE
// instead of a full restart). `resumeTimers` re-arms with exactly that
// remainder. `clearTimer`/the full-teardown helper below are the only ways an
// entry is actually removed from the map.
let timers = {};
// Set true in $onUnmount; read by promise()'s settle guard (never-resurrect
// a toast after the host itself is gone). A top-level `let` → React useRef
// (it escapes into $onUnmount's effect).
let unmounted = false;
// ---- timers ------------------------------------------------------------
const startTimer = (toast: any) => {
  if (!toast || !toast.duration || toast.duration <= 0) return;
  if (typeof window === 'undefined') return;
  const remaining = toast.duration;
  const handle = window.setTimeout(() => dismissBegin(toast.id, 'timeout'), remaining);
  timers[toast.id] = {
    handle,
    startedAt: Date.now(),
    remaining
  };
};
const clearTimer = (id: any) => {
  const entry = timers[id];
  if (entry && entry.handle != null && typeof window !== 'undefined') window.clearTimeout(entry.handle);
  delete timers[id];
};
// Pauses every live timer WITHOUT losing the remainder: clears the handle,
// decrements `remaining` by the elapsed time, and KEEPS the entry (does NOT
// delete it — the old v1 shortcut deleted entries here, which is why leave
// had to do a full restart).
const pauseTimers = () => {
  if (typeof window === 'undefined') return;
  for (const id in timers) {
    const entry = timers[id];
    window.clearTimeout(entry.handle);
    const elapsed = Date.now() - entry.startedAt;
    timers[id] = {
      handle: null,
      startedAt: entry.startedAt,
      remaining: entry.remaining - elapsed
    };
  }
};
// Re-arms every paused timer with EXACTLY its stored remainder (called on
// mouse leave). An entry with a non-positive remainder is left un-armed
// (it will be cleaned up by the next dismiss/clear pass) rather than firing
// immediately from inside this loop.
const resumeTimers = () => {
  if (typeof window === 'undefined') return;
  for (const id in timers) {
    const entry = timers[id];
    if (entry.remaining == null || entry.remaining <= 0) continue;
    const remaining = entry.remaining;
    const handle = window.setTimeout(() => dismissBegin(id, 'timeout'), remaining);
    timers[id] = {
      handle,
      startedAt: Date.now(),
      remaining
    };
  }
};
// FULL teardown: clears every live handle AND drops every entry (unlike
// pauseTimers, which deliberately keeps entries to hold their remainders).
// clear() and $onUnmount can no longer reuse pauseTimers for this reason.
const teardownTimers = () => {
  if (typeof window !== 'undefined') {
    for (const id in timers) {
      const entry = timers[id];
      if (entry.handle != null) window.clearTimeout(entry.handle);
    }
  }
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
// ---- exit lifecycle ------------------------------------------------------
// Deliberately exceeds the 200ms default --rozie-toast-exit-duration token
// comfortably; a consumer overriding the exit duration beyond ~350ms gets cut
// short by this failsafe (documented in docs/components/toast.md).
const EXIT_FAILSAFE_MS = 350;
// Idempotent removal: filters the entry out of $data.toasts. Safe to call
// twice (from the inline @animationend binding AND the failsafe) — the
// second call is a harmless no-op filter over an already-absent id.
const removeToast = (id: any) => {
  toasts.value = toasts.value.filter((t: any) => t.id !== id);
};
// The single dismissal funnel every path routes through: the `dismiss(id)`
// verb ('api'), the built-in close button ('close'), a timer expiry
// ('timeout'), and (Task 4) a swipe past threshold ('swipe'). Idempotent via
// the entry's `exiting` flag — a second call on an id already exiting (or
// already gone) is a no-op, so a stray timeout firing mid-exit never
// double-emits.
const dismissBegin = (id: any, reason: any) => {
  const entry = toasts.value.find((t: any) => t.id === id);
  if (!entry || entry.exiting) return;
  clearTimer(id);
  emit('dismissed', {
    toast: entry,
    reason
  });
  toasts.value = toasts.value.map((t: any) => t.id === id ? {
    ...t,
    exiting: true
  } : t);
  if (typeof window === 'undefined') {
    removeToast(id);
  } else {
    window.setTimeout(() => removeToast(id), EXIT_FAILSAFE_MS);
  }
};
const dismiss = (id: any) => {
  dismissBegin(id, 'api');
};
// clear() is bulk: immediate full teardown, NO per-toast exit animation and
// NO emit (documented — see docs/components/toast.md).
const clear = () => {
  teardownTimers();
  toasts.value = [];
};
// ---- patch / promise ------------------------------------------------------
// Update-in-place primitive: merges ONLY the present `{message,type,duration}`
// keys into the matching entry via a fresh-array map (never in-place
// mutation). Returns whether the id existed. A `duration` key clears+restarts
// the timer (0 → sticky/no-arm; positive → arm); any other key leaves a
// running timer untouched.
const patch = (id: any, changes: any) => {
  const c = changes || {};
  let existed = false;
  const next = toasts.value.map((t: any) => {
    if (t.id !== id) return t;
    existed = true;
    const merged = {
      ...t
    };
    if (c.message !== undefined) merged.message = c.message;
    if (c.type !== undefined) merged.type = c.type;
    if (c.duration !== undefined) merged.duration = c.duration;
    return merged;
  });
  if (!existed) return false;
  toasts.value = next;
  if (c.duration !== undefined) {
    clearTimer(id);
    const patched = next.find((t: any) => t.id === id);
    startTimer(patched);
  }
  return true;
};
// The settle guard: a no-op if the host unmounted OR the toast was already
// dismissed while the promise was still pending (never-resurrect).
const settlePromise = (id: any, type: any, messageOrFn: any, value: any) => {
  if (unmounted) return;
  const stillThere = toasts.value.some((t: any) => t.id === id);
  if (!stillThere) return;
  const message = typeof messageOrFn === 'function' ? messageOrFn(value) : messageOrFn;
  patch(id, {
    type,
    message,
    duration: props.duration
  });
};
// Sugar over show()+patch(): shows a sticky loading toast synchronously
// (returns its id immediately — the consumer already holds `p`), then patches
// the SAME entry to success/error on settle (the auto-dismiss timer starts AT
// SETTLE, via patch's duration-key restart). Never returns/derives a new
// promise — `p`'s own .then/.catch still fire for the consumer untouched.
const promise = (p: any, opts: any) => {
  const o = opts || {};
  const id = show({
    type: 'loading',
    duration: 0,
    message: o.loading
  });
  if (p && typeof p.then === 'function') {
    p.then((value: any) => settlePromise(id, 'success', o.success, value)).catch((err: any) => settlePromise(id, 'error', o.error, err));
  }
  return id;
};
// ---- hover pause -------------------------------------------------------
const onMouseEnter = () => {
  if (props.disablePauseOnHover) return;
  pauseTimers();
};
const onMouseLeave = () => {
  if (props.disablePauseOnHover) return;
  resumeTimers();
};
// ---- helpers -----------------------------------------------------------
const regionLabel = () => props.ariaLabel != null ? props.ariaLabel : 'Notifications';
// Type union: 'info' | 'success' | 'error' | 'warning' | 'loading'. Only
// error/warning interrupt (assertive); loading (like info/success) is polite.
const liveFor = (type: any) => type === 'error' || type === 'warning' ? 'assertive' : 'polite';

// ---- lifecycle + handle ------------------------------------------------

onBeforeUnmount(() => {
  unmounted = true;
  teardownTimers();
});

defineExpose({ show, dismiss, clear, patch, promise });
</script>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .rozie-toast {
    animation-name: rozie-toast-fade-in;
    animation-duration: 1ms;
  }
  .rozie-toast--exiting {
    animation-name: rozie-toast-fade-out;
    animation-duration: 1ms;
  }
}
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
from { opacity: 0; transform: translateY(-0.5rem); }
to { opacity: 1; transform: translateY(0); }
from { opacity: 0; transform: translateY(0.5rem); }
to { opacity: 1; transform: translateY(0); }
from { opacity: 1; transform: translateY(0); }
to { opacity: 0; transform: translateY(-0.5rem); }
from { opacity: 1; transform: translateY(0); }
to { opacity: 0; transform: translateY(0.5rem); }
.rozie-toast {
  animation: rozie-toast-enter var(--rozie-toast-enter-duration, 200ms) ease-out;
}
.rozie-toaster--bottom-left .rozie-toast,
.rozie-toaster--bottom-right .rozie-toast,
.rozie-toaster--bottom-center .rozie-toast {
  animation-name: rozie-toast-enter-from-bottom;
}
.rozie-toast--exiting {
  animation: rozie-toast-exit var(--rozie-toast-exit-duration, 200ms) ease-in forwards;
}
.rozie-toaster--bottom-left .rozie-toast--exiting,
.rozie-toaster--bottom-right .rozie-toast--exiting,
.rozie-toaster--bottom-center .rozie-toast--exiting {
  animation-name: rozie-toast-exit-to-bottom;
}
from { opacity: 0; }
to { opacity: 1; }
from { opacity: 1; }
to { opacity: 0; }
.rozie-toast-spinner {
  flex: 0 0 auto;
  width: var(--rozie-toast-spinner-size, 1em);
  height: var(--rozie-toast-spinner-size, 1em);
  border: 2px solid color-mix(in srgb, var(--rozie-toast-spinner-color, currentColor) 25%, transparent);
  border-top-color: var(--rozie-toast-spinner-color, currentColor);
  border-radius: 50%;
  animation: rozie-toast-spin 0.75s linear infinite;
}
to { transform: rotate(360deg); }
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
