import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './Dialog.css';

interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disableBackdropClose?: boolean;
  disableEscapeClose?: boolean;
  disableScrollLock?: boolean;
  ariaLabel?: (string) | null;
  ariaLabelledby?: (string) | null;
  onClose?: (...args: any[]) => void;
  children?: ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DialogHandle {
  show: (...args: any[]) => any;
  hide: (...args: any[]) => any;
}

const Dialog = forwardRef<DialogHandle, DialogProps>(function Dialog(_props: DialogProps, ref): JSX.Element {
  const props: Omit<DialogProps, 'disableBackdropClose' | 'disableEscapeClose' | 'disableScrollLock' | 'ariaLabel' | 'ariaLabelledby'> & { disableBackdropClose: boolean; disableEscapeClose: boolean; disableScrollLock: boolean; ariaLabel: (string) | null; ariaLabelledby: (string) | null } = {
    ..._props,
    disableBackdropClose: _props.disableBackdropClose ?? false,
    disableEscapeClose: _props.disableEscapeClose ?? false,
    disableScrollLock: _props.disableScrollLock ?? false,
    ariaLabel: _props.ariaLabel ?? null,
    ariaLabelledby: _props.ariaLabelledby ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, disableBackdropClose, disableEscapeClose, disableScrollLock, ariaLabel, ariaLabelledby, defaultValue, onOpenChange, defaultOpen, ...rest } = _props as DialogProps & Record<string, unknown>;
    void open; void disableBackdropClose; void disableEscapeClose; void disableScrollLock; void ariaLabel; void ariaLabelledby; void defaultValue; void onOpenChange; void defaultOpen;
    return rest;
  })();
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const _openRef = useRef(open);
  _openRef.current = open;
  const panelEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);

  function applyScrollLock(lock: any) {
    if (props.disableScrollLock) return;
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (root) root.style.overflow = lock ? 'hidden' : '';
  }
  const sync = useCallback((isOpen: any) => {
    const panel = panelEl.current;
    const el = (panel && panel.parentElement) as HTMLDialogElement | null;
    if (!el) return;
    if (isOpen) {
      if (!el.open) el.showModal();
      applyScrollLock(true);
    } else {
      if (el.open) el.close();
      applyScrollLock(false);
    }
  }, [applyScrollLock]);
  function closeWith(reason: any) {
    setOpen(false);
    props.onClose && props.onClose({
      reason
    });
  }
  const onCancel = useCallback((e: any) => {
    if (e) e.preventDefault();
    if (props.disableEscapeClose) return;
    closeWith('escape');
  }, [closeWith, props.disableEscapeClose]);
  const onClick = useCallback((e: any) => {
    if (props.disableBackdropClose) return;
    const panel = panelEl.current;
    const el = panel && panel.parentElement;
    if (e && el && e.target === el) closeWith('backdrop');
  }, [closeWith, props.disableBackdropClose]);
  function show() {
    setOpen(true);
  }
  function hide() {
    closeWith('programmatic');
  }

  useEffect(() => {
    sync(_openRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const isOpen = open;
    sync(isOpen);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ show, hide });
  _rozieExposeRef.current = { show, hide };
  useImperativeHandle(ref, () => ({ show: (...args: Parameters<typeof show>): ReturnType<typeof show> => _rozieExposeRef.current.show(...args), hide: (...args: Parameters<typeof hide>): ReturnType<typeof hide> => _rozieExposeRef.current.hide(...args) }), []);

  return (
    <>
    <dialog aria-label={props.ariaLabel} aria-labelledby={props.ariaLabelledby} {...attrs} className={clsx("rozie-dialog", (attrs.className as string | undefined))} onCancel={($event) => { onCancel($event); }} onClick={($event) => { onClick($event); }} data-rozie-s-2a679072="">
      
      <div className={"rozie-dialog-panel"} ref={panelEl} data-rozie-s-2a679072="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </dialog>
    </>
  );
});
export default Dialog;
