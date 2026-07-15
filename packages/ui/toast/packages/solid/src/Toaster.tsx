import type { JSX } from 'solid-js';
import { createSignal, mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, mergeListeners, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Toaster-12d4265c', `.rozie-toaster[data-rozie-s-12d4265c] {
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
.rozie-toaster[data-rozie-s-12d4265c] > *[data-rozie-s-12d4265c] {
  pointer-events: auto;
}
.rozie-toaster--top-left[data-rozie-s-12d4265c] { top: 0; left: 0; align-items: flex-start; }
.rozie-toaster--top-right[data-rozie-s-12d4265c] { top: 0; right: 0; align-items: flex-end; }
.rozie-toaster--top-center[data-rozie-s-12d4265c] { top: 0; left: 50%; transform: translateX(-50%); align-items: center; }
.rozie-toaster--bottom-left[data-rozie-s-12d4265c] { bottom: 0; left: 0; align-items: flex-start; flex-direction: column-reverse; }
.rozie-toaster--bottom-right[data-rozie-s-12d4265c] { bottom: 0; right: 0; align-items: flex-end; flex-direction: column-reverse; }
.rozie-toaster--bottom-center[data-rozie-s-12d4265c] { bottom: 0; left: 50%; transform: translateX(-50%); align-items: center; flex-direction: column-reverse; }
.rozie-toast[data-rozie-s-12d4265c] {
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
.rozie-toast--success[data-rozie-s-12d4265c] { background: var(--rozie-toast-success-bg, #16a34a); }
.rozie-toast--error[data-rozie-s-12d4265c] { background: var(--rozie-toast-error-bg, #dc2626); }
.rozie-toast--warning[data-rozie-s-12d4265c] { background: var(--rozie-toast-warning-bg, #ca8a04); }
.rozie-toast--info[data-rozie-s-12d4265c] { background: var(--rozie-toast-info-bg, var(--rozie-toast-bg, #333)); }
.rozie-toast-message[data-rozie-s-12d4265c] {
  flex: 1 1 auto;
  font-size: var(--rozie-toast-font-size, 0.9rem);
}
.rozie-toast-close[data-rozie-s-12d4265c] {
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
.rozie-toast-close[data-rozie-s-12d4265c]:hover {
  opacity: 1;
}`);

interface ToastSlotCtx { toast: any; dismiss: any; }

interface ToasterProps {
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
  ariaLabel?: (string) | null;
  toastSlot?: (ctx: ToastSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ToasterHandle) => void;
}

export interface ToasterHandle {
  show: (...args: any[]) => any;
  dismiss: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function Toaster(_props: ToasterProps): JSX.Element {
  const _merged = mergeProps({ position: 'bottom-right', duration: 4000, max: 0, disablePauseOnHover: false, ariaLabel: null }, _props);
  const [local, attrs] = splitProps(_merged, ['position', 'duration', 'max', 'disablePauseOnHover', 'ariaLabel', 'ref']);
  onMount(() => { local.ref?.({ show, dismiss, clear }); });

  const [toasts, setToasts] = createSignal<any[]>([]);
  const [seq, setSeq] = createSignal(0);
  onCleanup(() => {
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

  // ---- timers ------------------------------------------------------------
  function startTimer(toast: any) {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    const remaining = toast.duration;
    const handle = window.setTimeout(() => dismiss(toast.id), remaining);
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
  }

  // Re-arms every paused timer with EXACTLY its stored remainder (called on
  // mouse leave). An entry with a non-positive remainder is left un-armed
  // (it will be cleaned up by the next dismiss/clear pass) rather than firing
  // immediately from inside this loop.
  function resumeTimers() {
    if (typeof window === 'undefined') return;
    for (const id in timers) {
      const entry = timers[id];
      if (entry.remaining == null || entry.remaining <= 0) continue;
      const remaining = entry.remaining;
      const handle = window.setTimeout(() => dismiss(id), remaining);
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
    }
    timers = {};
  }

  // ---- queue (imperative handle implementations) -------------------------
  function show(input: any) {
    const t = input || {};
    // Derive the id from the reactive $data.seq counter (persists on React, unlike
    // a module-let referenced only here). Read seq into a local BEFORE writing it
    // back (no read-after-write of the same key in one fn → ROZ138-safe).
    let id;
    if (t.id != null) {
      id = t.id;
    } else {
      const s = seq();
      id = 't' + s;
      setSeq(s + 1);
    }
    const toast = {
      id,
      message: t.message != null ? t.message : '',
      type: t.type || 'info',
      duration: t.duration != null ? t.duration : local.duration
    };
    const next = toasts().concat([toast]);
    const max$local = local.max;
    setToasts(max$local > 0 && next.length > max$local ? next.slice(next.length - max$local) : next);
    startTimer(toast);
    return id;
  }
  function dismiss(id: any) {
    clearTimer(id);
    setToasts(toasts().filter((t: any) => t.id !== id));
  }
  function clear() {
    teardownTimers();
    setToasts([]);
  }

  // ---- hover pause -------------------------------------------------------
  function onMouseEnter() {
    if (local.disablePauseOnHover) return;
    pauseTimers();
  }
  function onMouseLeave() {
    if (local.disablePauseOnHover) return;
    resumeTimers();
  }

  // ---- helpers -----------------------------------------------------------
  function regionLabel() {
    return local.ariaLabel != null ? local.ariaLabel : 'Notifications';
  }
  function liveFor(type: any) {
    return type === 'error' || type === 'warning' ? 'assertive' : 'polite';
  }

  // ---- lifecycle + handle ------------------------------------------------

  return (
    <>
    <div role="region" aria-label={rozieAttr(regionLabel())} {...attrs} class={"rozie-toaster" + " " + rozieClass('rozie-toaster--' + local.position) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} {...mergeListeners({ onMouseEnter: ($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onMouseEnter(); }, onMouseLeave: ($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { onMouseLeave(); } }, attrs)} data-rozie-s-12d4265c="">
      
      <Key each={toasts() as readonly any[]} by={(t) => t.id}>{(t) => <div class={"rozie-toast" + " " + rozieClass('rozie-toast--' + t().type)} role="status" aria-live={rozieAttr(liveFor(t().type))} data-rozie-s-12d4265c="">
        {(_props.toastSlot ?? _props.slots?.['toast'])?.({ toast: t(), dismiss }) ?? <><span class={"rozie-toast-message"} data-rozie-s-12d4265c="">{rozieDisplay(t().message)}</span><button type="button" aria-label="Dismiss" class={"rozie-toast-close"} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { dismiss(t().id); }} data-rozie-s-12d4265c="">×</button></>}
      </div>}</Key>
    </div>
    </>
  );
}
