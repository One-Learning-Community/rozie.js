import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay } from '@rozie/runtime-react';
import './Toaster.css';

interface ToastCtx { toast: any; dismiss: any; }

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
  /**
   * Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes.
   */
  disableSwipe?: boolean;
  /**
   * Opt **in** to a sonner-style collapsed stack: a single-cell grid overlay with depth-driven transforms (toasts at depth 3+ fade to invisible), newest on top. Hovering the region or moving keyboard focus into it expands to the normal flex-column stack; leaving re-collapses. `false` (default) renders the plain flex column at all times.
   */
  stacked?: boolean;
  onDismissed?: (...args: any[]) => void;
  renderToast?: (ctx: ToastCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ToasterHandle {
  show: (...args: any[]) => any;
  dismiss: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  patch: (...args: any[]) => any;
  promise: (...args: any[]) => any;
}

const Toaster = forwardRef<ToasterHandle, ToasterProps>(function Toaster(_props: ToasterProps, ref): JSX.Element {
  const props: Omit<ToasterProps, 'position' | 'duration' | 'max' | 'disablePauseOnHover' | 'ariaLabel' | 'disableSwipe' | 'stacked'> & { position: string; duration: number; max: number; disablePauseOnHover: boolean; ariaLabel: (string) | null; disableSwipe: boolean; stacked: boolean } = {
    ..._props,
    position: _props.position ?? 'bottom-right',
    duration: _props.duration ?? 4000,
    max: _props.max ?? 0,
    disablePauseOnHover: _props.disablePauseOnHover ?? false,
    ariaLabel: _props.ariaLabel ?? null,
    disableSwipe: _props.disableSwipe ?? false,
    stacked: _props.stacked ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { position, duration, max, disablePauseOnHover, ariaLabel, disableSwipe, stacked, ...rest } = _props as ToasterProps & Record<string, unknown>;
    void position; void duration; void max; void disablePauseOnHover; void ariaLabel; void disableSwipe; void stacked;
    return rest;
  })();
  const unmounted = useRef(false);
  const timers = useRef({});
  const paused = useRef(false);
  const [toasts, setToasts] = useState<any[]>([]);
  const [seq, setSeq] = useState(0);
  const [swipe, setSwipe] = useState<any>(null);
  const [swipeGesture, setSwipeGesture] = useState<any>(null);

  function startTimer(toast: any) {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    // Belt-and-braces: clear any pre-existing live handle for this id before
    // overwriting the entry, so a re-arm never orphans a running timeout.
    const existing = timers.current[toast.id];
    if (existing && existing.handle != null) window.clearTimeout(existing.handle);
    const remaining = toast.duration;
    const handle = window.setTimeout(() => dismissBegin(toast.id, 'timeout'), remaining);
    timers.current[toast.id] = {
      handle,
      startedAt: Date.now(),
      remaining
    };
  }
  function clearTimer(id: any) {
    const entry = timers.current[id];
    if (entry && entry.handle != null && typeof window !== 'undefined') window.clearTimeout(entry.handle);
    delete timers.current[id];
  }
  function pauseTimers() {
    paused.current = true;
    if (typeof window === 'undefined') return;
    for (const id in timers.current) {
      const entry = timers.current[id];
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
      timers.current[id] = {
        handle: null,
        startedAt: entry.startedAt,
        remaining
      };
    }
  }
  function resumeTimers() {
    paused.current = false;
    if (typeof window === 'undefined') return;
    for (const id in timers.current) {
      const entry = timers.current[id];
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
      timers.current[id] = {
        handle,
        startedAt: Date.now(),
        remaining
      };
    }
  }
  const teardownTimers = useCallback(() => {
    if (typeof window !== 'undefined') {
      for (const id in timers.current) {
        const entry = timers.current[id];
        if (entry.handle != null) window.clearTimeout(entry.handle);
      }
    }
    timers.current = {};
  }, []);
  function show(input: any) {
    const t = input || {};
    // Derive the id from the reactive $data.seq counter (persists on React, unlike
    // a module-let referenced only here). Read seq into a local BEFORE writing it
    // back (no read-after-write of the same key in one fn → ROZ138-safe).
    let id;
    if (t.id != null) {
      // Coerce a consumer-supplied id to a String once, at the single entry
      // point. Ids flow through the `timers` map (whose `for (const id in …)`
      // keys are ALWAYS strings) and every downstream `t.id === id` strict
      // comparison; a numeric consumer id (`show({ id: 42 })`) would otherwise
      // stop matching after a hover pause/resume re-arms with the string key.
      id = String(t.id);
    } else {
      const s = seq;
      id = 't' + s;
      setSeq(s + 1);
    }
    const toast = {
      id,
      message: t.message != null ? t.message : '',
      type: t.type || 'info',
      duration: t.duration != null ? t.duration : props.duration
    };
    const next = toasts.concat([toast]);
    const max = props.max;
    setToasts(max > 0 && next.length > max ? next.slice(next.length - max) : next);
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
  const removeToast = useCallback((id: any) => {
    setToasts(prev => prev.filter((t: any) => t.id !== id));
  }, []);
  const { onDismissed: _rozieProp_onDismissed } = props;
    const dismissBegin = useCallback((id: any, reason: any, extra?: {
    swipeExitSign?: number;
  }) => {
    const entry = toasts.find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    clearTimer(id);
    _rozieProp_onDismissed && _rozieProp_onDismissed({
      toast: entry,
      reason
    });
    setToasts(prev => prev.map((t: any) => t.id === id ? {
      ...t,
      exiting: true,
      ...(extra || {})
    } : t));
    if (typeof window === 'undefined') {
      removeToast(id);
    } else {
      window.setTimeout(() => removeToast(id), EXIT_FAILSAFE_MS);
    }
  }, [_rozieProp_onDismissed, clearTimer, removeToast, toasts]);
  function dismiss(id: any) {
    dismissBegin(id, 'api');
  }
  function clear() {
    teardownTimers();
    setToasts([]);
  }
  function patch(id: any, changes: any) {
    const c = changes || {};
    let existed = false;
    const next = toasts.map((t: any) => {
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
      return merged;
    });
    if (!existed) return false;
    setToasts(next);
    if (c.duration !== undefined) {
      clearTimer(id);
      const patched = next.find((t: any) => t.id === id);
      if (paused.current) {
        // Hovered: store the new duration as the pending remainder WITHOUT
        // arming a live timer (which would dismiss the toast while the pointer
        // is still over the stack). resumeTimers() arms it on leave.
        if (patched && patched.duration > 0 && typeof window !== 'undefined') {
          timers.current[id] = {
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
  function settlePromise(id: any, type: any, messageOrFn: any, value: any) {
    if (unmounted.current) return;
    // Never-resurrect: no-op if the toast is gone OR already exiting (its
    // dismissal is in flight — settling now would flip it back to a live
    // success/error toast and re-arm a timer).
    const entry = toasts.find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    const message = typeof messageOrFn === 'function' ? messageOrFn(value) : messageOrFn;
    patch(id, {
      type,
      message,
      duration: props.duration
    });
  }
  function promise(p: any, opts: any) {
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
  function swipeAxisFor(position: any) {
    return position === 'top-center' || position === 'bottom-center' ? 'y' : 'x';
  }
  function swipeSignFor(position: any) {
    if (position === 'top-right' || position === 'bottom-right') return 1;
    if (position === 'top-left' || position === 'bottom-left') return -1;
    if (position === 'bottom-center') return 1;
    return -1; // top-center
  }
  const onToastPointerDown = useCallback((t: any, event: any) => {
    if (props.disableSwipe) return;
    if (event.button != null && event.button !== 0) return;
    // Ignore drags starting on the close button / any button-or-link chrome.
    const chrome = event.target && event.target.closest ? event.target.closest('button, a') : null;
    if (chrome) return;
    const axis = swipeAxisFor(props.position);
    const sign = swipeSignFor(props.position);
    const el = event.currentTarget;
    const size = axis === 'x' ? el.offsetWidth : el.offsetHeight;
    setSwipeGesture({
      id: t.id,
      axis,
      sign,
      size,
      startX: event.clientX,
      startY: event.clientY,
      startTime: Date.now()
    });
    if (el && el.setPointerCapture) {
      try {
        el.setPointerCapture(event.pointerId);
      } catch (e: any) {
        // Some embedded contexts throw on setPointerCapture — swipe still
        // works without capture (just loses "keeps tracking off-element").
      }
    }
  }, [props.disableSwipe, props.position, swipeAxisFor, swipeSignFor]);
  const onToastPointerMove = useCallback((t: any, event: any) => {
    if (props.disableSwipe) return;
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
  }, [props.disableSwipe, swipeGesture]);
  const onToastPointerUp = useCallback((t: any, event: any) => {
    if (props.disableSwipe) return;
    const gesture = swipeGesture;
    setSwipeGesture(null);
    // Local named `dragState`, NOT `swipe` — a local `swipe` would shadow the
    // reactive `$data.swipe` key on Svelte 5 (top-level `let swipe = $state(…)`
    // self-shadow TDZ: `const swipe = swipe` then `swipe = null` throws
    // "Cannot assign to constant"). Same collision class as the documented
    // $refs/$props self-shadow, just for a $data key.
    const dragState = swipe;
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
  }, [dismissBegin, props.disableSwipe, swipe, swipeGesture]);
  const onToastPointerCancel = useCallback((t: any) => {
    if (props.disableSwipe) return;
    if (swipeGesture && swipeGesture.id === t.id) setSwipeGesture(null);
    if (swipe && swipe.id === t.id) setSwipe(null);
  }, [props.disableSwipe, swipe, swipeGesture]);
  function depth(t: any) {
    const idx = toasts.findIndex((x: any) => x.id === t.id);
    return idx === -1 ? 0 : toasts.length - 1 - idx;
  }
  function toastStyle(t: any) {
    const depthDecl = '--rozie-toast-depth: ' + depth(t) + ';';
    if (t.exiting) {
      return t.swipeExitSign != null ? depthDecl + ' --rozie-toast-swipe-exit: ' + t.swipeExitSign + ';' : depthDecl;
    }
    // Local named `dragState`, NOT `swipe` — see the onToastPointerUp comment
    // above (Svelte 5 $data-key self-shadow).
    const dragState = swipe;
    if (!dragState || dragState.id !== t.id) return depthDecl;
    const translate = dragState.axis === 'x' ? 'translateX(' + dragState.d + 'px)' : 'translateY(' + dragState.d + 'px)';
    const magnitude = dragState.d * dragState.sign;
    const opacity = magnitude > 0 && dragState.size > 0 ? Math.max(0.3, 1 - magnitude / dragState.size) : 1;
    return depthDecl + ' transform: ' + translate + '; opacity: ' + opacity + '; transition: none;';
  }
  const onMouseEnter = useCallback(() => {
    if (props.disablePauseOnHover) return;
    pauseTimers();
  }, [pauseTimers, props.disablePauseOnHover]);
  const onMouseLeave = useCallback(() => {
    if (props.disablePauseOnHover) return;
    resumeTimers();
  }, [props.disablePauseOnHover, resumeTimers]);
  function regionLabel() {
    return props.ariaLabel != null ? props.ariaLabel : 'Notifications';
  }
  function liveFor(type: any) {
    return type === 'error' || type === 'warning' ? 'assertive' : 'polite';
  }

  useEffect(() => {
    return () => {
      unmounted.current = true;
      teardownTimers();
    };
  }, []);

  const _rozieExposeRef = useRef({ show, dismiss, clear, patch, promise });
  _rozieExposeRef.current = { show, dismiss, clear, patch, promise };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), dismiss: (...args: Parameters<typeof dismiss>): ReturnType<typeof dismiss> => _rozieExposeRef.current.dismiss(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), patch: (...args: Parameters<typeof patch>): ReturnType<typeof patch> => _rozieExposeRef.current.patch(...args), promise: (...args: Parameters<typeof promise>): ReturnType<typeof promise> => _rozieExposeRef.current.promise(...args) }), []);

  return (
    <>
    <div role="region" aria-label={rozieAttr(regionLabel())} {...attrs} className={clsx(clsx("rozie-toaster", 'rozie-toaster--' + props.position + (props.stacked ? ' rozie-toaster--stacked' : '')), (attrs.className as string | undefined))} onMouseEnter={($event) => { onMouseEnter(); }} onMouseLeave={($event) => { onMouseLeave(); }} data-rozie-s-12d4265c="">
      
      {toasts.map((t) => <div key={t.id} className={clsx("rozie-toast", 'rozie-toast--' + t.type + (t.exiting ? ' rozie-toast--exiting' : '') + (t.swipeExitSign != null ? ' rozie-toast--swipe-exit' : ''))} style={parseInlineStyle(toastStyle(t))} role="status" aria-live={rozieAttr(liveFor(t.type))} onAnimationEnd={($event) => { t.exiting && removeToast(t.id); }} onPointerDown={($event) => { onToastPointerDown(t, $event); }} onPointerMove={($event) => { onToastPointerMove(t, $event); }} onPointerUp={($event) => { onToastPointerUp(t, $event); }} onPointerCancel={($event) => { onToastPointerCancel(t); }} data-rozie-s-12d4265c="">
        {(props.renderToast ?? props.slots?.['toast']) ? ((props.renderToast ?? props.slots?.['toast']) as Function)({ toast: t, dismiss }) : <>{!!(t.type === 'loading') && <span className={"rozie-toast-spinner"} aria-hidden="true" data-rozie-s-12d4265c="" />}<span className={"rozie-toast-message"} data-rozie-s-12d4265c="">{rozieDisplay(t.message)}</span><button type="button" className={"rozie-toast-close"} aria-label="Dismiss" onClick={($event) => { dismissBegin(t.id, 'close'); }} data-rozie-s-12d4265c="">×</button></>}
      </div>)}
    </div>
    </>
  );
});
export default Toaster;
