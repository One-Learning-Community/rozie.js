import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Dialog.css';

interface DialogProps {
  /**
   * Whether the dialog is shown (two-way `r-model`). The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Dialog reconciles the native `<dialog>` to it via `showModal()` / `close()`. Every close path (backdrop, Escape, programmatic `hide()`) writes `open = false` and emits `close`.
   * @example
   * <Dialog r-model:open="confirmOpen" ariaLabelledby="confirm-title" />
   */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Opt **out** of backdrop-click-to-dismiss. By default a click on the scrim (the `<dialog>` element itself, outside the content panel) closes the dialog with `reason: 'backdrop'`; set this to require an explicit action.
   */
  disableBackdropClose?: boolean;
  /**
   * Opt **out** of Escape-to-dismiss. By default the native `cancel` event (Esc) closes with `reason: 'escape'`; the component `preventDefault()`s it so the close always flows through the `open` model. Set this to keep the dialog open on Escape (e.g. a required confirmation).
   */
  disableEscapeClose?: boolean;
  /**
   * Opt **out** of locking `<html>` scroll while the dialog is open. By default `document.documentElement` `overflow` is set to `hidden` for the duration the dialog is shown; set this to leave background scrolling enabled.
   */
  disableScrollLock?: boolean;
  /**
   * Accessible name for the dialog (`aria-label`) when there is no visible title to point at. Prefer `ariaLabelledby` when a visible heading exists.
   */
  ariaLabel?: (string) | null;
  /**
   * The `id` of the element that titles the dialog (`aria-labelledby`) — preferred over `ariaLabel` when a visible heading exists inside the dialog.
   */
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
    <dialog aria-label={rozieAttr(props.ariaLabel)} aria-labelledby={rozieAttr(props.ariaLabelledby)} {...attrs} className={clsx("rozie-dialog", (attrs.className as string | undefined))} onCancel={($event) => { onCancel($event); }} onClick={($event) => { onClick($event); }} data-rozie-s-2a679072="">
      
      <div className={"rozie-dialog-panel"} ref={panelEl} data-rozie-s-2a679072="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </dialog>
    </>
  );
});
export default Dialog;
