import type { JSX } from 'solid-js';
import { Show, createSignal, mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, mergeListeners, parseInlineStyle, pickListeners, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

/** A toast's visual/semantic kind. Only `error` is announced assertively (`role="alert"`); every other type is announced politely. */
export type ToastType = 'info' | 'success' | 'error' | 'warning' | 'loading';
/** Why a toast was dismissed: auto-dismiss timeout, a swipe past threshold, the built-in close button, the action button, or the `dismiss(id)` handle verb. */
export type ToastDismissReason = 'timeout' | 'swipe' | 'close' | 'action' | 'api';
/** A toast's action button: `onClick` runs with the toast's id and its `data`, then the toast dismisses (reason `'action'`). */
export interface ToastAction {
  label: string;
  onClick: (ctx: {
    id: string;
    data: unknown;
  }) => void;
}
/** One queue entry, as held by the Toaster and handed to the `#toast` slot and the `dismissed` event. */
export interface ToastEntry {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
  action: ToastAction | null;
  /** The consumer payload passed to `show({ data })`, carried untouched. `null` when none was given. */
  data: unknown;
  /** True once dismissal has begun (the exit animation is running). */
  exiting?: boolean;
  /** Set on a swipe dismissal: the direction sign the exit animation follows. */
  swipeExitSign?: number;
}
/** The `dismissed` event payload. */
export interface ToastDismissedPayload {
  toast: ToastEntry;
  reason: ToastDismissReason;
}

__rozieInjectStyle('Toaster-12d4265c', `@media (prefers-reduced-motion: reduce) {
  .rozie-toast[data-rozie-s-12d4265c] {
    animation-name: rozie-toast-fade-in;
    animation-duration: 1ms;
  }
  .rozie-toast--exiting[data-rozie-s-12d4265c] {
    animation-name: rozie-toast-fade-out;
    animation-duration: 1ms;
  }
}
.rozie-toaster[data-rozie-s-12d4265c] {
  position: fixed;
  z-index: var(--rozie-toast-z, var(--rto-z, 9999));
  display: flex;
  flex-direction: column;
  gap: var(--rozie-toast-gap, var(--rto-gap, 0.5rem));
  padding: var(--rozie-toast-region-padding, var(--rto-region-padding, 1rem));
  max-width: var(--rozie-toast-max-width, var(--rto-max-width, calc(100vw - 2rem)));
  pointer-events: none;
  font: var(--rozie-toast-font, inherit);
}
.rozie-toaster[data-rozie-s-12d4265c] > *[data-rozie-s-12d4265c] {
  pointer-events: auto;
}
.rozie-toaster[data-rozie-s-12d4265c] > .rozie-toaster-live[data-rozie-s-12d4265c] {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  pointer-events: none;
}
.rozie-toaster--top-left[data-rozie-s-12d4265c] { top: 0; left: 0; align-items: flex-start; }
.rozie-toaster--top-right[data-rozie-s-12d4265c] { top: 0; right: 0; align-items: flex-end; }
.rozie-toaster--top-center[data-rozie-s-12d4265c] { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] { bottom: 0; left: 0; align-items: flex-start; flex-direction: column-reverse; }
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
.rozie-toaster--stacked[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c] {
  grid-area: 1 / 1;
  z-index: calc(100 - var(--rozie-toast-depth, var(--rto-depth, 0)));
}
.rozie-toaster--stacked[data-rozie-s-12d4265c]:not([data-rozie-s-12d4265c]:hover):not([data-rozie-s-12d4265c]:focus-within) {
  display: grid;
}
.rozie-toaster--stacked[data-rozie-s-12d4265c]:not([data-rozie-s-12d4265c]:hover):not([data-rozie-s-12d4265c]:focus-within) .rozie-toast[data-rozie-s-12d4265c] {
  transform:
    translateY(calc(var(--rozie-toast-depth, var(--rto-depth, 0)) * var(--rozie-toast-stack-offset, var(--rto-stack-offset, 8px))))
    scale(calc(1 - var(--rozie-toast-depth, var(--rto-depth, 0)) * var(--rozie-toast-stack-scale-step, var(--rto-stack-scale-step, 0.05))));
  opacity: calc(1 - min(1, max(0, var(--rozie-toast-depth, var(--rto-depth, 0)) - 2)));
}
.rozie-toaster--stacked.rozie-toaster--bottom-left[data-rozie-s-12d4265c]:not([data-rozie-s-12d4265c]:hover):not([data-rozie-s-12d4265c]:focus-within) .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--stacked.rozie-toaster--bottom-right[data-rozie-s-12d4265c]:not([data-rozie-s-12d4265c]:hover):not([data-rozie-s-12d4265c]:focus-within) .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--stacked.rozie-toaster--bottom-center[data-rozie-s-12d4265c]:not([data-rozie-s-12d4265c]:hover):not([data-rozie-s-12d4265c]:focus-within) .rozie-toast[data-rozie-s-12d4265c] {
  transform:
    translateY(calc(var(--rozie-toast-depth, var(--rto-depth, 0)) * var(--rozie-toast-stack-offset, var(--rto-stack-offset, 8px)) * -1))
    scale(calc(1 - var(--rozie-toast-depth, var(--rto-depth, 0)) * var(--rozie-toast-stack-scale-step, var(--rto-stack-scale-step, 0.05))));
}
.rozie-toast[data-rozie-s-12d4265c] {
  display: flex;
  align-items: center;
  gap: var(--rozie-toast-content-gap, var(--rto-content-gap, 0.75rem));
  min-width: var(--rozie-toast-min-width, var(--rto-min-width, 16rem));
  max-width: var(--rozie-toast-toast-max-width, var(--rto-toast-max-width, 24rem));
  padding: var(--rozie-toast-padding, var(--rto-padding, 0.75rem 1rem));
  color: var(--rozie-toast-color, var(--rto-color, #fff));
  background: var(--rozie-toast-bg, var(--rto-bg, #333));
  border-radius: var(--rozie-toast-radius, var(--rto-radius, 0.5rem));
  box-shadow: var(--rozie-toast-shadow, var(--rto-shadow, 0 6px 20px rgba(0, 0, 0, 0.25)));
  /* Swipe: page scroll stays alive on touch along the axis the toast does
     NOT move on. The transition here drives the spring-back (the active-drag
     :style sets an inline \`transition: none\` to track the finger 1:1;
     releasing it without a further gesture falls back to this transition). */
  touch-action: pan-y;
  transition: transform 200ms ease, opacity 200ms ease;
}
.rozie-toaster--top-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c] {
  touch-action: pan-x;
}
.rozie-toast--success[data-rozie-s-12d4265c] { background: var(--rozie-toast-success-bg, var(--rto-success-bg, #16a34a)); }
.rozie-toast--error[data-rozie-s-12d4265c] { background: var(--rozie-toast-error-bg, var(--rto-error-bg, #dc2626)); }
.rozie-toast--warning[data-rozie-s-12d4265c] { background: var(--rozie-toast-warning-bg, var(--rto-warning-bg, #ca8a04)); }
.rozie-toast--info[data-rozie-s-12d4265c] { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, var(--rto-info-bg, var(--rto-bg, #333)))); }
from[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(-0.5rem); }
to[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
from[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(0.5rem); }
to[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(-0.5rem); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(0.5rem); }
.rozie-toast[data-rozie-s-12d4265c] {
  animation: rozie-toast-enter var(--rozie-toast-enter-duration, var(--rto-enter-duration, 200ms)) ease-out;
}
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-enter-from-bottom;
}
.rozie-toast--exiting[data-rozie-s-12d4265c] {
  animation: rozie-toast-exit var(--rozie-toast-exit-duration, var(--rto-exit-duration, 200ms)) ease-in forwards;
}
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c],
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast--exiting[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-exit-to-bottom;
}
from[data-rozie-s-12d4265c] { opacity: 0; }
to[data-rozie-s-12d4265c] { opacity: 1; }
from[data-rozie-s-12d4265c] { opacity: 1; }
to[data-rozie-s-12d4265c] { opacity: 0; }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateX(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateX(calc(var(--rozie-toast-swipe-exit, var(--rto-swipe-exit, 1)) * 100%)); }
from[data-rozie-s-12d4265c] { opacity: 1; transform: translateY(0); }
to[data-rozie-s-12d4265c] { opacity: 0; transform: translateY(calc(var(--rozie-toast-swipe-exit, var(--rto-swipe-exit, 1)) * 100%)); }
.rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-swipe-exit-x;
}
.rozie-toaster--top-center[data-rozie-s-12d4265c] .rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c],
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] .rozie-toast--exiting.rozie-toast--swipe-exit[data-rozie-s-12d4265c] {
  animation-name: rozie-toast-swipe-exit-y;
}
.rozie-toast-spinner[data-rozie-s-12d4265c] {
  flex: 0 0 auto;
  width: var(--rozie-toast-spinner-size, var(--rto-spinner-size, 1em));
  height: var(--rozie-toast-spinner-size, var(--rto-spinner-size, 1em));
  border: 2px solid color-mix(in srgb, var(--rozie-toast-spinner-color, var(--rto-spinner-color, currentColor)) 25%, transparent);
  border-top-color: var(--rozie-toast-spinner-color, var(--rto-spinner-color, currentColor));
  border-radius: 50%;
  animation: rozie-toast-spin 0.75s linear infinite;
}
to[data-rozie-s-12d4265c] { transform: rotate(360deg); }
.rozie-toast-message[data-rozie-s-12d4265c] {
  flex: 1 1 auto;
  font-size: var(--rozie-toast-font-size, var(--rto-font-size, 0.9rem));
}
.rozie-toast-action[data-rozie-s-12d4265c] {
  flex: 0 0 auto;
  padding: 0.2rem 0.6rem;
  font: inherit;
  font-weight: 600;
  line-height: 1.2;
  color: inherit;
  background: transparent;
  border: 1px solid currentColor;
  border-radius: 4px;
  cursor: pointer;
}
.rozie-toast-action[data-rozie-s-12d4265c]:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
.rozie-toast-close[data-rozie-s-12d4265c] {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--rozie-toast-close-size, var(--rto-close-size, 1.25rem));
  height: var(--rozie-toast-close-size, var(--rto-close-size, 1.25rem));
  padding: 0;
  font-size: 1.1rem;
  line-height: 1;
  color: inherit;
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  opacity: var(--rozie-toast-close-opacity, var(--rto-close-opacity, 0.75));
  cursor: pointer;
}
.rozie-toast-close[data-rozie-s-12d4265c]:hover {
  opacity: 1;
}`);

interface ToastSlotCtx { toast: ToastEntry; dismiss: (id: string) => void; }

interface ToasterProps extends Omit<import('solid-js').ComponentProps<'div'>, 'position' | 'duration' | 'max' | 'disablePauseOnHover' | 'ariaLabel' | 'disableSwipe' | 'stacked' | 'disableAnnounce' | 'onDismissed' | 'toastSlot' | 'slots' | 'ref' | 'children' | 'innerHTML' | 'innerText' | 'textContent'> {
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
   * Accessible name for the toaster's landmark (`role="region"`), applied as its `aria-label`. Defaults to `'Notifications'` when not set, so assistive tech can navigate to the toast stack as a landmark.
   */
  ariaLabel?: (string) | null;
  /**
   * Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes.
   */
  disableSwipe?: boolean;
  /**
   * Opt **in** to a sonner-style collapsed stack: a single-cell grid overlay with depth-driven transforms (toasts at depth 3+ fade to invisible), newest on top. Hovering the region or moving keyboard focus into it expands to the normal flex-column stack; leaving re-collapses. `false` (default) renders the plain flex column at all times.
   */
  stacked?: boolean;
  /**
   * Opt **out** of the toaster's own announcements. By default the toaster keeps two visually hidden live regions mounted — a polite `role="status"` one and an assertive `role="alert"` one — and writes each toast's `message` into one of them (`error` toasts into the assertive region, every other type into the polite one). Set this when the `#toast` slot content supplies its own `role` / `aria-live`: the toaster then renders no live regions, so nothing is announced twice or nested.
   */
  disableAnnounce?: boolean;
  onDismissed?: (payload: ToastDismissedPayload) => void;
  toastSlot?: (ctx: ToastSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ToasterHandle) => void;
}

export interface ToasterHandle {
  show(input?: { message?: string; type?: 'info' | 'success' | 'error' | 'warning' | 'loading'; duration?: number; id?: string | number; action?: { label?: string; onClick: (ctx: { id: string; data: unknown; }) => void; }; data?: unknown; }): string;
  dismiss(id: string): void;
  clear(): void;
  patch(id: string, changes?: { message?: string; type?: 'info' | 'success' | 'error' | 'warning' | 'loading'; duration?: number; action?: { label?: string; onClick: (ctx: { id: string; data: unknown; }) => void; }; data?: unknown; }): boolean;
  promise(p: Promise<unknown>, opts?: { loading?: string; success?: string | ((value: unknown) => string); error?: string | ((err: unknown) => string); }): string;
}

export default function Toaster(_props: ToasterProps): JSX.Element {
  const _merged = mergeProps({ position: 'bottom-right', duration: 4000, max: 0, disablePauseOnHover: false, ariaLabel: null, disableSwipe: false, stacked: false, disableAnnounce: false }, _props);
  const [local, attrs] = splitProps(_merged, ['position', 'duration', 'max', 'disablePauseOnHover', 'ariaLabel', 'disableSwipe', 'stacked', 'disableAnnounce', 'ref', 'onDismissed', 'toastSlot', 'slots']);
  onMount(() => { local.ref?.({ show, dismiss, clear, patch, promise }); });

  const [toasts, setToasts] = createSignal<any[]>([]);
  const [seq, setSeq] = createSignal(0);
  const [swipe, setSwipe] = createSignal<any>(null);
  onCleanup(() => {
    unmounted = true;
    teardownTimers();
  });

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

  // Per-id handles for the ~350ms exit-removal failsafe (the fallback that
  // removes a toast if its @animationend never fires). Tracked in a module map
  // — NOT an anonymous window.setTimeout — so teardownTimers ($onUnmount /
  // clear()) can cancel a pending failsafe (else it fires post-unmount and
  // writes $data on a torn-down instance) and removeToast can cancel it
  // first-wins when @animationend beats it. Escapes into $onUnmount's effect →
  // React hoists it to useRef alongside `timers`.
  let exitFailsafes = {};

  // Set true in $onUnmount; read by promise()'s settle guard (never-resurrect
  // a toast after the host itself is gone). A top-level `let` → React useRef
  // (it escapes into $onUnmount's effect).
  let unmounted = false;

  // Same-tick id-uniqueness guard for React. The id counter lives in reactive
  // $data.seq (persists across renders), but React batches setState so within a
  // SINGLE synchronous tick two show() calls read the SAME stale $data.seq →
  // duplicate ids. `seqLocal` is a plain counter incremented SYNCHRONOUSLY in
  // show(); it survives the same tick (and, because show() is an $expose verb,
  // the emitter hoists it to a persistent useRef on React too — but the design
  // does NOT depend on that: `Math.max($data.seq, seqLocal)` is correct whether
  // seqLocal persists OR resets per render, since the monotonic $data.seq
  // carries the high-water mark across any reset). On the other five targets
  // $data.seq is synchronous, so the two simply stay in lockstep. Result:
  // strictly-increasing, collision-free ids on all six with NO randomness.
  let seqLocal = 0;

  // Hover-pause flag: true while the pointer is over the stack (set by
  // pauseTimers, cleared by resumeTimers). Read by patch() so a duration change
  // arriving mid-hover stores the new remainder WITHOUT arming a live timer
  // (which would dismiss the toast while it is still hovered) — resume arms it
  // on leave. A top-level `let` reachable from the $expose verbs (patch/show →
  // startTimer) and the @mouseenter/@mouseleave handlers, so React hoists it to
  // useRef (persistent) like `timers`.
  let paused = false;

  // The ACTIVE pointer-drag gesture's non-visual bookkeeping: { id, axis, sign,
  // size, startX, startY, startTime } | null (set on @pointerdown, read on
  // @pointermove/@pointerup, cleared on @pointerup/@pointercancel). Referenced
  // ONLY from the four onToastPointer* handlers below, which are bound ONLY via
  // template `@pointerdown`/`@pointermove`/`@pointerup`/`@pointercancel` — the
  // template-@event-handler reachability root (Quick 260717-8zb Task 3 Item 6,
  // hoistModuleLet.ts) hoists this to useRef on React so it persists across the
  // re-renders the sibling `$data.swipe` write triggers mid-gesture. Never read
  // directly in the template — script-only bookkeeping.
  let swipeGesture: any = null;

  // ---- timers ------------------------------------------------------------
  function startTimer(toast: any) {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    // Belt-and-braces: clear any pre-existing live handle for this id before
    // overwriting the entry, so a re-arm never orphans a running timeout.
    const existing = timers[toast.id];
    if (existing && existing.handle != null) window.clearTimeout(existing.handle);
    const remaining = toast.duration;
    const handle = window.setTimeout(() => dismissBegin(toast.id, 'timeout'), remaining);
    timers[toast.id] = {
      handle,
      startedAt: Date.now(),
      remaining
    };
  }
  function clearTimer(id: any) {
    const entry = timers[id];
    if (entry && entry.handle != null && typeof window !== 'undefined') window.clearTimeout(entry.handle);
    delete timers[id];
  }

  // Pauses every live timer WITHOUT losing the remainder: clears the handle,
  // decrements `remaining` by the elapsed time, and KEEPS the entry (does NOT
  // delete it — the old v1 shortcut deleted entries here, which is why leave
  // had to do a full restart).
  function pauseTimers() {
    paused = true;
    if (typeof window === 'undefined') return;
    for (const id in timers) {
      const entry = timers[id];
      // Idempotent: an entry already paused (handle cleared) keeps its stored
      // remainder. A second pause must NOT re-subtract elapsed against the
      // original startedAt — that drove `remaining` negative and stranded the
      // toast forever once resume saw the non-positive value.
      if (entry.handle == null) continue;
      window.clearTimeout(entry.handle);
      const elapsed = Date.now() - entry.startedAt;
      // Clamp so a late pause (e.g. a background-tab timer that overran) can
      // never store a negative remainder.
      const remaining = Math.max(0, entry.remaining - elapsed);
      timers[id] = {
        handle: null,
        startedAt: entry.startedAt,
        remaining
      };
    }
  }

  // Re-arms every paused timer with EXACTLY its stored remainder (called on
  // mouse leave). An entry with a non-positive remainder is left un-armed
  // (it will be cleaned up by the next dismiss/clear pass) rather than firing
  // immediately from inside this loop.
  function resumeTimers() {
    paused = false;
    if (typeof window === 'undefined') return;
    for (const id in timers) {
      const entry = timers[id];
      // Only re-arm entries that are actually paused (handle cleared). A live
      // handle is left alone — re-arming it would orphan the running timeout.
      if (entry.handle != null) continue;
      if (entry.remaining == null || entry.remaining <= 0) {
        // Its deadline elapsed while paused (a background-tab overrun, or a
        // remainder clamped to 0): treat as EXPIRED and dismiss now — its time
        // is up — rather than leaving it un-armed and stranded forever.
        dismissBegin(id, 'timeout');
        continue;
      }
      const remaining = entry.remaining;
      const handle = window.setTimeout(() => dismissBegin(id, 'timeout'), remaining);
      timers[id] = {
        handle,
        startedAt: Date.now(),
        remaining
      };
    }
  }

  // FULL teardown: clears every live handle AND drops every entry (unlike
  // pauseTimers, which deliberately keeps entries to hold their remainders).
  // clear() and $onUnmount can no longer reuse pauseTimers for this reason.
  function teardownTimers() {
    if (typeof window !== 'undefined') {
      for (const id in timers) {
        const entry = timers[id];
        if (entry.handle != null) window.clearTimeout(entry.handle);
      }
      // Also cancel every pending exit failsafe — otherwise a removal timeout
      // scheduled just before unmount/clear() fires afterward and writes $data.
      for (const id in exitFailsafes) {
        if (exitFailsafes[id] != null) window.clearTimeout(exitFailsafes[id]);
      }
    }
    timers = {};
    exitFailsafes = {};
  }

  // ---- queue (imperative handle implementations) -------------------------
  // An action button's spec, normalized once at the entry points (show / patch). Kept only
  // when `onClick` is a function — a label with nothing to call would render a dead button.
  function normAction(a: any) {
    return a && typeof a.onClick === 'function' ? {
      label: a.label != null ? String(a.label) : '',
      onClick: a.onClick
    } : null;
  }
  function show(input?: {
    message?: string;
    type?: 'info' | 'success' | 'error' | 'warning' | 'loading';
    duration?: number;
    id?: string | number;
    action?: {
      label?: string;
      onClick: (ctx: {
        id: string;
        data: unknown;
      }) => void;
    };
    data?: unknown;
  }): string {
    const t = input || {};
    let id;
    if (t.id != null) {
      // Coerce a consumer-supplied id to a String once, at the single entry
      // point. Ids flow through the `timers` map (whose `for (const id in …)`
      // keys are ALWAYS strings) and every downstream `t.id === id` strict
      // comparison; a numeric consumer id (`show({ id: 42 })`) would otherwise
      // stop matching after a hover pause/resume re-arms with the string key.
      id = String(t.id);
    } else {
      // Take the high-water mark of the persistent-but-tick-stale $data.seq and
      // the synchronous-but-maybe-per-render seqLocal (see the <script> comment)
      // so same-tick multi-show yields DISTINCT ids on React too. Read both
      // BEFORE writing either (no read-after-write of $data.seq → ROZ138-safe).
      const s = Math.max(seq(), seqLocal);
      id = 't' + s;
      seqLocal = s + 1;
      setSeq(s + 1);
    }
    const toast = {
      id,
      message: t.message != null ? t.message : '',
      type: t.type || 'info',
      duration: t.duration != null ? t.duration : local.duration,
      // Rendered as a button in the default toast; see runAction().
      action: normAction(t.action),
      // Consumer payload, carried untouched: in the #toast slot scope, the `dismissed`
      // payload and the action callback (e.g. the thread an "Undo" restores).
      data: t.data !== undefined ? t.data : null
    };
    // ONE self-referential assignment so the React emitter lowers it to the
    // concurrent-safe functional updater `setToasts(prev => …)` (it only does so
    // when the RHS reads $data.toasts DIRECTLY — a via-a-local form lowered to a
    // stale-closure `setToasts(<value>)`, losing the first of two same-tick
    // toasts). slice() start: keep the newest `max` when over the cap
    // (Math.max(0, len+1-max)), else slice(0) = the whole fresh array.
    setToasts(toasts().concat([toast]).slice(local.max > 0 ? Math.max(0, toasts().length + 1 - local.max) : 0));
    startTimer(toast);
    return id;
  }

  // ---- exit lifecycle ------------------------------------------------------
  // Deliberately exceeds the 200ms default --rozie-toast-exit-duration token
  // comfortably; a consumer overriding the exit duration beyond ~350ms gets cut
  // short by this failsafe (documented in docs/components/toast.md).
  const EXIT_FAILSAFE_MS = 350;

  // Idempotent removal: filters the entry out of $data.toasts. Safe to call
  // twice (from the inline @animationend binding AND the failsafe) — the
  // second call is a harmless no-op filter over an already-absent id.
  function removeToast(id: any) {
    // Cancel any pending exit failsafe for this id (first-wins: @animationend
    // beating the ~350ms timeout, or vice-versa — either way, only one removal).
    if (typeof window !== 'undefined' && exitFailsafes[id] != null) {
      window.clearTimeout(exitFailsafes[id]);
    }
    delete exitFailsafes[id];
    setToasts(toasts().filter((t: any) => t.id !== id));
  }

  // The single dismissal funnel every path routes through: the `dismiss(id)`
  // verb ('api'), the built-in close button ('close'), a timer expiry
  // ('timeout'), and a swipe past threshold ('swipe'). Idempotent via the
  // entry's `exiting` flag — a second call on an id already exiting (or
  // already gone) is a no-op, so a stray timeout firing mid-exit never
  // double-emits. `extra` (swipe only) carries `{ swipeExitSign }` so the
  // template can apply the direction-matched swipe-exit animation.
  function dismissBegin(id: any, reason: any, extra?: {
    swipeExitSign?: number;
  }) {
    const entry = toasts().find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    clearTimer(id);
    _props.onDismissed?.({
      toast: entry,
      reason
    });
    setToasts(toasts().map((t: any) => t.id === id ? {
      ...t,
      exiting: true,
      ...(extra || {})
    } : t));
    if (typeof window === 'undefined') {
      removeToast(id);
    } else {
      exitFailsafes[id] = window.setTimeout(() => removeToast(id), EXIT_FAILSAFE_MS);
    }
  }

  // The default toast's action button: run the consumer's callback with the toast's id and
  // data, then dismiss with reason 'action'. Read before dismissing — the entry is replaced
  // (exiting: true) by dismissBegin. try/finally: dismissBegin MUST run even if onClick
  // throws (else the toast is stuck forever — it never dismisses and there is no other
  // event to route through the funnel). The error itself is NOT swallowed: it is left to
  // propagate out of the click handler like any other native DOM handler exception (every
  // target's own event-dispatch reports it — e.g. Vue logs "Unhandled error during
  // execution of native event handler" — matching the field's existing convention of never
  // wrapping a consumer callback in a silencing try/catch elsewhere in this codebase).
  function runAction(t: any) {
    const a = t.action;
    if (!a) return;
    try {
      a.onClick({
        id: t.id,
        data: t.data
      });
    } finally {
      dismissBegin(t.id, 'action');
    }
  }
  function dismiss(id: string): void {
    dismissBegin(id, 'api');
  }

  // clear() is bulk: immediate full teardown, NO per-toast exit animation and
  // NO emit (documented — see docs/components/toast.md).
  function clear(): void {
    teardownTimers();
    setToasts([]);
  }

  // ---- patch / promise ------------------------------------------------------
  // Update-in-place primitive: merges ONLY the present `{message,type,duration}`
  // keys into the matching entry via a fresh-array map (never in-place
  // mutation). Returns whether the id existed. A `duration` key clears+restarts
  // the timer (0 → sticky/no-arm; positive → arm); any other key leaves a
  // running timer untouched.
  function patch(id: string, changes?: {
    message?: string;
    type?: 'info' | 'success' | 'error' | 'warning' | 'loading';
    duration?: number;
    action?: {
      label?: string;
      onClick: (ctx: {
        id: string;
        data: unknown;
      }) => void;
    };
    data?: unknown;
  }): boolean {
    const c = changes || {};
    let existed = false;
    const next = toasts().map((t: any) => {
      if (t.id !== id) return t;
      // Treat an EXITING entry as absent — never resurrect a toast whose
      // dismissal is already in flight (removal deferred to @animationend / the
      // failsafe). `existed` stays false → patch returns false, writes nothing,
      // arms no timer.
      if (t.exiting) return t;
      existed = true;
      const merged = {
        ...t
      };
      if (c.message !== undefined) merged.message = c.message;
      if (c.type !== undefined) merged.type = c.type;
      if (c.duration !== undefined) merged.duration = c.duration;
      if (c.action !== undefined) merged.action = normAction(c.action);
      if (c.data !== undefined) merged.data = c.data;
      return merged;
    });
    if (!existed) return false;
    setToasts(next);
    if (c.duration !== undefined) {
      clearTimer(id);
      const patched = next.find((t: any) => t.id === id);
      if (paused) {
        // Hovered: store the new duration as the pending remainder WITHOUT
        // arming a live timer (which would dismiss the toast while the pointer
        // is still over the stack). resumeTimers() arms it on leave.
        if (patched && patched.duration > 0 && typeof window !== 'undefined') {
          timers[id] = {
            handle: null,
            startedAt: Date.now(),
            remaining: patched.duration
          };
        }
      } else {
        startTimer(patched);
      }
    }
    return true;
  }

  // The settle guard: a no-op if the host unmounted OR the toast was already
  // dismissed while the promise was still pending (never-resurrect).
  function settlePromise(id: any, type: any, messageOrFn: any, value: any) {
    if (unmounted) return;
    // Never-resurrect: no-op if the toast is gone OR already exiting (its
    // dismissal is in flight — settling now would flip it back to a live
    // success/error toast and re-arm a timer).
    const entry = toasts().find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    const message = typeof messageOrFn === 'function' ? messageOrFn(value) : messageOrFn;
    patch(id, {
      type,
      message,
      duration: local.duration
    });
  }

  // Sugar over show()+patch(): shows a sticky loading toast synchronously
  // (returns its id immediately — the consumer already holds `p`), then patches
  // the SAME entry to success/error on settle (the auto-dismiss timer starts AT
  // SETTLE, via patch's duration-key restart). Never returns/derives a new
  // promise — `p`'s own .then/.catch still fire for the consumer untouched.
  function promise(p: Promise<unknown>, opts?: {
    loading?: string;
    success?: string | ((value: unknown) => string);
    error?: string | ((err: unknown) => string);
  }): string {
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
  }

  // ---- swipe-to-dismiss ------------------------------------------------------
  // Axis + dismiss-direction sign, purely derived from the corner (no per-
  // gesture state needed for these two — they only depend on $props.position).
  function swipeAxisFor(position: any) {
    return position === 'top-center' || position === 'bottom-center' ? 'y' : 'x';
  }
  function swipeSignFor(position: any) {
    if (position === 'top-right' || position === 'bottom-right') return 1;
    if (position === 'top-left' || position === 'bottom-left') return -1;
    if (position === 'bottom-center') return 1;
    return -1; // top-center
  }
  function onToastPointerDown(t: any, event: any) {
    if (local.disableSwipe) return;
    if (event.button != null && event.button !== 0) return;
    // Ignore drags starting on the close button / any button-or-link chrome.
    const chrome = event.target && event.target.closest ? event.target.closest('button, a') : null;
    if (chrome) return;
    const axis = swipeAxisFor(local.position);
    const sign = swipeSignFor(local.position);
    const el = event.currentTarget;
    const size = axis === 'x' ? el.offsetWidth : el.offsetHeight;
    swipeGesture = {
      id: t.id,
      axis,
      sign,
      size,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now()
    };
    if (el && el.setPointerCapture) {
      try {
        el.setPointerCapture(event.pointerId);
      } catch (e: any) {
        // Some embedded contexts throw on setPointerCapture — swipe still
        // works without capture (just loses "keeps tracking off-element").
      }
    }
  }
  function onToastPointerMove(t: any, event: any) {
    if (local.disableSwipe) return;
    const gesture = swipeGesture;
    if (!gesture || gesture.id !== t.id) return;
    const raw = gesture.axis === 'x' ? event.clientX - gesture.startX : event.clientY - gesture.startY;
    const towardDismiss = raw * gesture.sign > 0;
    const d = towardDismiss ? raw : raw * 0.15;
    setSwipe({
      id: t.id,
      d,
      axis: gesture.axis,
      sign: gesture.sign,
      size: gesture.size
    });
  }
  function onToastPointerUp(t: any, event: any) {
    if (local.disableSwipe) return;
    const gesture = swipeGesture;
    swipeGesture = null;
    // Local named `dragState`, NOT `swipe` — a local `swipe` would shadow the
    // reactive `$data.swipe` key on Svelte 5 (top-level `let swipe = $state(…)`
    // self-shadow TDZ: `const swipe = swipe` then `swipe = null` throws
    // "Cannot assign to constant"). Same collision class as the documented
    // $refs/$props self-shadow, just for a $data key.
    const dragState = swipe();
    setSwipe(null);
    if (!gesture || gesture.id !== t.id || !dragState) return;
    const elapsed = Math.max(1, Date.now() - gesture.startTime);
    const magnitude = dragState.d * gesture.sign;
    const velocity = magnitude / elapsed;
    if (magnitude > 0 && (magnitude > gesture.size * 0.45 || velocity > 0.11)) {
      dismissBegin(t.id, 'swipe', {
        swipeExitSign: gesture.sign
      });
    }
  }
  function onToastPointerCancel(t: any) {
    if (local.disableSwipe) return;
    if (swipeGesture && swipeGesture.id === t.id) swipeGesture = null;
    if (swipe() && swipe().id === t.id) setSwipe(null);
  }

  // ---- stacked mode ----------------------------------------------------------
  // Depth from newest: the newest toast (last in the array — show() appends)
  // is depth 0; each older toast is one deeper. Corner-independent — the
  // collapsed grid overlay ignores flex-direction/column-reverse entirely, so
  // this needs no position-aware math.
  //
  // quick 260716-npt Finding 3 (perf): depth USED to be a per-toast
  // `$data.toasts.findIndex(...)` scan invoked from toastStyle() for every row
  // — O(n) work × n toasts rendered = O(n^2) per render. The template's r-for
  // already computes each row's array index for free (the r-for bare-comma
  // index form, `t, ti in ...` — see TreeNode.rozie/Table.rozie precedent), so
  // depth(ti) is now O(1) arithmetic off that index — no scan, and `t`'s id
  // can never be "not found" via this call path (ti IS t's own index), so the
  // old idx===-1→0 fallback collapses to unreachable-by-construction (same
  // observable semantics: newest=depth 0, older=length-1-idx).
  function depth(ti: any) {
    return toasts().length - 1 - ti;
  }

  // String-form `:style` for the toast row. ALWAYS carries `--rozie-toast-depth`
  // (a no-op unless `stacked` is on — CSS reads it only inside
  // `.rozie-toaster--stacked`), plus EITHER the active drag transform (while
  // $data.swipe tracks this id) OR the swipe-exit sign custom property (once
  // `dismissBegin('swipe')` flipped `t.swipeExitSign`). Drag/exit never overlap.
  function toastStyle(t: any, ti: any) {
    const depthDecl = '--rozie-toast-depth: ' + depth(ti) + ';';
    if (t.exiting) {
      return t.swipeExitSign != null ? depthDecl + ' --rozie-toast-swipe-exit: ' + t.swipeExitSign + ';' : depthDecl;
    }
    // Local named `dragState`, NOT `swipe` — see the onToastPointerUp comment
    // above (Svelte 5 $data-key self-shadow).
    const dragState = swipe();
    if (!dragState || dragState.id !== t.id) return depthDecl;
    const translate = dragState.axis === 'x' ? 'translateX(' + dragState.d + 'px)' : 'translateY(' + dragState.d + 'px)';
    const magnitude = dragState.d * dragState.sign;
    const opacity = magnitude > 0 && dragState.size > 0 ? Math.max(0.3, 1 - magnitude / dragState.size) : 1;
    return depthDecl + ' transform: ' + translate + '; opacity: ' + opacity + '; transition: none;';
  }

  // ---- hover pause + keyboard-focus pause (WCAG 2.2.1) -------------------
  // `hovering`/`focusedWithin` are independent pause SOURCES that must compose:
  // leaving one must NOT resume the timers while the other is still active
  // (else a keyboard user tabbing to the action button while the pointer has
  // already left loses the toast to the timeout mid-interaction — the exact
  // 2.2.1 failure this fixes). Keyboard focus ALWAYS pauses regardless of
  // `disablePauseOnHover` — that prop's docs scope it to "the pointer is over
  // the stack"; gating the keyboard-only equivalent behind the same opt-out
  // would let an author silently ship a stack that fails 2.2.1 for
  // assistive-tech users while remaining "compliant-looking" for mouse users.
  // Both are top-level `let`s reachable only from these template-bound
  // handlers, same hoisting class as `paused`/`swipeGesture` above.
  let hovering = false;
  let focusedWithin = false;
  function onMouseEnter() {
    hovering = true;
    if (local.disablePauseOnHover) return;
    pauseTimers();
  }
  function onMouseLeave() {
    hovering = false;
    if (local.disablePauseOnHover) return;
    // Focus is still inside the region — do not resume out from under it.
    if (focusedWithin) return;
    resumeTimers();
  }
  function onFocusIn() {
    focusedWithin = true;
    pauseTimers();
  }
  function onFocusOut(event: any) {
    // focusout bubbles for EVERY focus change, including one child of the
    // region handing off to another (action button → close button). Only a
    // relatedTarget outside the region counts as actually leaving it.
    const region = event && event.currentTarget;
    const next = event && event.relatedTarget;
    if (region && next && region.contains && region.contains(next)) return;
    focusedWithin = false;
    // The pointer is still hovering (and hover-pause is enabled) — do not
    // resume out from under it.
    if (hovering && !local.disablePauseOnHover) return;
    resumeTimers();
  }

  // ---- helpers -----------------------------------------------------------
  function regionLabel() {
    return local.ariaLabel != null ? local.ariaLabel : 'Notifications';
  }

  // ---- live-region projection ----------------------------------------------
  // The standing polite/assertive regions are a PURE PROJECTION of the toast
  // queue: each region renders one keyed line per matching toast, so a line lives
  // exactly as long as its toast (no second state, no timers, nothing to tear
  // down). A `patch()` that changes the message rewrites that toast's line in
  // place — that text change is what a screen reader announces — and a change to
  // or from 'error' moves the line between regions. Only 'error' is assertive;
  // every other type ('info' | 'success' | 'warning' | 'loading') is polite. The
  // regions are explicitly aria-atomic="false" so a new toast does not re-read
  // the lines of toasts still on screen. Plain functions called with `()` — NOT
  // $computed (playbook section 8) — and no $data write: render purity.
  function politeToasts() {
    return toasts().filter((t: any) => t.message && t.type !== 'error');
  }
  function assertiveToasts() {
    return toasts().filter((t: any) => t.message && t.type === 'error');
  }

  // ---- lifecycle + handle ------------------------------------------------

  return (
    <>
    <div role="region" aria-label={rozieAttr(regionLabel())} {...attrs} class={"rozie-toaster" + " " + rozieClass('rozie-toaster--' + local.position + (local.stacked ? ' rozie-toaster--stacked' : '')) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onMouseEnter: ($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onMouseEnter(); }, onMouseLeave: ($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onMouseLeave(); }, onFocusIn: ($event: FocusEvent & { currentTarget: HTMLDivElement; target: Element }) => { onFocusIn(); }, onFocusOut: ($event: FocusEvent & { currentTarget: HTMLDivElement; target: Element }) => { onFocusOut($event); } }, pickListeners(attrs))} data-rozie-s-12d4265c="">
      
      {<Show when={!local.disableAnnounce}><div class={"rozie-toaster-live"} data-rozie-s-12d4265c="">
        <div role="status" aria-live="polite" aria-atomic="false" data-rozie-s-12d4265c="">
          <Key each={politeToasts() as readonly any[]} by={(line) => line.id}>{(line) => <div data-rozie-s-12d4265c="">{rozieDisplay(line().message)}</div>}</Key>
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="false" data-rozie-s-12d4265c="">
          <Key each={assertiveToasts() as readonly any[]} by={(line) => line.id}>{(line) => <div data-rozie-s-12d4265c="">{rozieDisplay(line().message)}</div>}</Key>
        </div>
      </div></Show>}<Key each={toasts() as readonly any[]} by={(t) => t.id}>{(t, ti) => <div class={"rozie-toast" + " " + rozieClass('rozie-toast--' + t().type + (t().exiting ? ' rozie-toast--exiting' : '') + (t().swipeExitSign != null ? ' rozie-toast--swipe-exit' : ''))} style={parseInlineStyle(toastStyle(t(), ti()))} onAnimationEnd={($event: AnimationEvent & { currentTarget: HTMLDivElement; target: Element }) => { t().exiting && removeToast(t().id); }} onPointerDown={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { onToastPointerDown(t(), $event); }} onPointerMove={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { onToastPointerMove(t(), $event); }} onPointerUp={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { onToastPointerUp(t(), $event); }} onPointerCancel={($event: PointerEvent & { currentTarget: HTMLDivElement; target: Element }) => { onToastPointerCancel(t()); }} data-rozie-s-12d4265c="">
        {(_props.toastSlot ?? _props.slots?.['toast'])?.({ get toast() { return t(); }, dismiss }) ?? <>{<Show when={t().type === 'loading'}><span class={"rozie-toast-spinner"} aria-hidden="true" data-rozie-s-12d4265c="" /></Show>}<span class={"rozie-toast-message"} data-rozie-s-12d4265c="">{rozieDisplay(t().message)}</span>{<Show when={t().action}><button type="button" class={"rozie-toast-action"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { runAction(t()); }} data-rozie-s-12d4265c="">{rozieDisplay(t().action.label)}</button></Show>}<button type="button" aria-label="Dismiss" class={"rozie-toast-close"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { dismissBegin(t().id, 'close'); }} data-rozie-s-12d4265c="">×</button></>}
      </div>}</Key>
    </div>
    </>
  );
}
