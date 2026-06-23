import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay } from '@rozie/runtime-react';
import './Toaster.css';

interface ToastCtx { toast: any; dismiss: any; }

interface ToasterProps {
  position?: string;
  duration?: number;
  max?: number;
  disablePauseOnHover?: boolean;
  ariaLabel?: (string) | null;
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

  let nextId = 0;

  // ---- timers ------------------------------------------------------------
  function startTimer(toast: any) {
    if (!toast || !toast.duration || toast.duration <= 0) return;
    if (typeof window === 'undefined') return;
    timers.current[toast.id] = window.setTimeout(() => dismiss(toast.id), toast.duration);
  }
  function clearTimer(id: any) {
    if (timers.current[id] && typeof window !== 'undefined') window.clearTimeout(timers.current[id]);
    delete timers.current[id];
  }
  const pauseTimers = useCallback(() => {
    if (typeof window === 'undefined') return;
    for (const k in timers.current) window.clearTimeout(timers.current[k]);
    timers.current = {};
  }, []);
  function show(input: any) {
    const t = input || {};
    const id = t.id != null ? t.id : 't' + nextId++;
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
  const dismiss = useCallback((id: any) => {
    clearTimer(id);
    setToasts(prev => prev.filter((t: any) => t.id !== id));
  }, [clearTimer]);
  function clear() {
    pauseTimers();
    setToasts([]);
  }
  const onMouseEnter = useCallback(() => {
    if (props.disablePauseOnHover) return;
    pauseTimers();
  }, [pauseTimers, props.disablePauseOnHover]);
  const onMouseLeave = useCallback(() => {
    if (props.disablePauseOnHover) return;
    for (const t of toasts as any) startTimer(t);
  }, [props.disablePauseOnHover, startTimer, toasts]);
  function regionLabel() {
    return props.ariaLabel != null ? props.ariaLabel : 'Notifications';
  }
  function liveFor(type: any) {
    return type === 'error' || type === 'warning' ? 'assertive' : 'polite';
  }

  useEffect(() => {
    return () => {
      pauseTimers();
    };
  }, []);

  const _rozieExposeRef = useRef({ show, dismiss, clear });
  _rozieExposeRef.current = { show, dismiss, clear };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), dismiss: (...args: Parameters<typeof dismiss>): ReturnType<typeof dismiss> => _rozieExposeRef.current.dismiss(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div role="region" aria-label={rozieAttr(regionLabel())} {...attrs} className={clsx(clsx("rozie-toaster", 'rozie-toaster--' + props.position), (attrs.className as string | undefined))} onMouseEnter={($event) => { onMouseEnter(); }} onMouseLeave={($event) => { onMouseLeave(); }} data-rozie-s-12d4265c="">
      {toasts.map((toast) => <div key={toast.id} className={clsx("rozie-toast", 'rozie-toast--' + toast.type)} role="status" aria-live={rozieAttr(liveFor(toast.type))} data-rozie-s-12d4265c="">
        {(props.renderToast ?? props.slots?.['toast']) ? ((props.renderToast ?? props.slots?.['toast']) as Function)({ toast, dismiss }) : <><span className={"rozie-toast-message"} data-rozie-s-12d4265c="">{rozieDisplay(toast.message)}</span><button type="button" className={"rozie-toast-close"} aria-label="Dismiss" onClick={($event) => { dismiss(toast.id); }} data-rozie-s-12d4265c="">×</button></>}
      </div>)}
    </div>
    </>
  );
});
export default Toaster;
