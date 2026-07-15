import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay } from '@rozie/runtime-react';
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
  onDismissed?: (...args: any[]) => void;
  renderToast?: (ctx: ToastCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ToasterHandle {
  show: (...args: any[]) => any;
  dismiss: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const Toaster = forwardRef<ToasterHandle, ToasterProps>(function Toaster(_props: ToasterProps, ref): JSX.Element {
  const props: Omit<ToasterProps, 'position' | 'duration' | 'max' | 'disablePauseOnHover' | 'ariaLabel'> & { position: string; duration: number; max: number; disablePauseOnHover: boolean; ariaLabel: (string) | null } = {
    ..._props,
    position: _props.position ?? 'bottom-right',
    duration: _props.duration ?? 4000,
    max: _props.max ?? 0,
    disablePauseOnHover: _props.disablePauseOnHover ?? false,
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { position, duration, max, disablePauseOnHover, ariaLabel, ...rest } = _props as ToasterProps & Record<string, unknown>;
    void position; void duration; void max; void disablePauseOnHover; void ariaLabel;
    return rest;
  })();
  const timers = useRef({});
  const [toasts, setToasts] = useState<any[]>([]);
  const [seq, setSeq] = useState(0);

  function startTimer(toast: any) {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
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
    if (typeof window === 'undefined') return;
    for (const id in timers.current) {
      const entry = timers.current[id];
      window.clearTimeout(entry.handle);
      const elapsed = Date.now() - entry.startedAt;
      timers.current[id] = {
        handle: null,
        startedAt: entry.startedAt,
        remaining: entry.remaining - elapsed
      };
    }
  }
  function resumeTimers() {
    if (typeof window === 'undefined') return;
    for (const id in timers.current) {
      const entry = timers.current[id];
      if (entry.remaining == null || entry.remaining <= 0) continue;
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
      id = t.id;
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
    const dismissBegin = useCallback((id: any, reason: any) => {
    const entry = toasts.find((t: any) => t.id === id);
    if (!entry || entry.exiting) return;
    clearTimer(id);
    _rozieProp_onDismissed && _rozieProp_onDismissed({
      toast: entry,
      reason
    });
    setToasts(prev => prev.map((t: any) => t.id === id ? {
      ...t,
      exiting: true
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
      teardownTimers();
    };
  }, []);

  const _rozieExposeRef = useRef({ show, dismiss, clear });
  _rozieExposeRef.current = { show, dismiss, clear };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), dismiss: (...args: Parameters<typeof dismiss>): ReturnType<typeof dismiss> => _rozieExposeRef.current.dismiss(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div role="region" aria-label={rozieAttr(regionLabel())} {...attrs} className={clsx(clsx("rozie-toaster", 'rozie-toaster--' + props.position), (attrs.className as string | undefined))} onMouseEnter={($event) => { onMouseEnter(); }} onMouseLeave={($event) => { onMouseLeave(); }} data-rozie-s-12d4265c="">
      
      {toasts.map((t) => <div key={t.id} className={clsx("rozie-toast", 'rozie-toast--' + t.type + (t.exiting ? ' rozie-toast--exiting' : ''))} role="status" aria-live={rozieAttr(liveFor(t.type))} onAnimationEnd={($event) => { t.exiting && removeToast(t.id); }} data-rozie-s-12d4265c="">
        {(props.renderToast ?? props.slots?.['toast']) ? ((props.renderToast ?? props.slots?.['toast']) as Function)({ toast: t, dismiss }) : <><span className={"rozie-toast-message"} data-rozie-s-12d4265c="">{rozieDisplay(t.message)}</span><button type="button" className={"rozie-toast-close"} aria-label="Dismiss" onClick={($event) => { dismissBegin(t.id, 'close'); }} data-rozie-s-12d4265c="">×</button></>}
      </div>)}
    </div>
    </>
  );
});
export default Toaster;
