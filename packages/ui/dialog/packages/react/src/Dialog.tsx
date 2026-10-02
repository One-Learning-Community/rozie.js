import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, mergeListeners, pickListeners, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Dialog.css';
import { applyScrollLock as applySharedScrollLock } from './internal/scrollLock';

// ---- native reconcile ---------------------------------------------------
// The <dialog> element, cached by sync() so $onUnmount can reach it without
// reading $refs during teardown.

interface DialogProps extends Omit<import('react').ComponentPropsWithoutRef<'dialog'>, 'open' | 'defaultOpen' | 'onOpenChange' | 'disableBackdropClose' | 'disableEscapeClose' | 'disableScrollLock' | 'initialFocus' | 'ariaLabel' | 'ariaLabelledby' | 'onClose' | 'children' | 'slots' | 'dangerouslySetInnerHTML'> {
  /**
   * Whether the dialog is shown (two-way `r-model`). The sole `model: true` prop — two-way bind it (`r-model:open` / `v-model:open` / `bind:open` / `[(open)]`) and Dialog reconciles the native `<dialog>` to it via `showModal()` / `close()`. Every close path (backdrop, Escape, programmatic `hide()`) writes `open = false` and emits `close`.
   * @example
   * <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} ariaLabelledby="confirm-title" />
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
   * What to focus when the dialog opens: a CSS selector matched inside the dialog content, or an Element. By default the native `showModal()` choice applies: the first element with `autofocus`, otherwise the first focusable element. Use it to start on a specific field (e.g. `initialFocus="input[name=title]"`) without waiting for the dialog to mount. A selector that matches nothing, or an element that is not focusable, leaves the native choice in place.
   * @example
   * <Dialog open={renameOpen} onOpenChange={setRenameOpen} initialFocus="#label-name" />
   */
  initialFocus?: (string | Element) | null;
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
  const props: Omit<DialogProps, 'disableBackdropClose' | 'disableEscapeClose' | 'disableScrollLock' | 'initialFocus' | 'ariaLabel' | 'ariaLabelledby'> & { disableBackdropClose: boolean; disableEscapeClose: boolean; disableScrollLock: boolean; initialFocus: (string | Element) | null; ariaLabel: (string) | null; ariaLabelledby: (string) | null } = {
    ..._props,
    disableBackdropClose: _props.disableBackdropClose ?? false,
    disableEscapeClose: _props.disableEscapeClose ?? false,
    disableScrollLock: _props.disableScrollLock ?? false,
    initialFocus: _props.initialFocus ?? null,
    ariaLabel: _props.ariaLabel ?? null,
    ariaLabelledby: _props.ariaLabelledby ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, disableBackdropClose, disableEscapeClose, disableScrollLock, initialFocus, ariaLabel, ariaLabelledby, defaultValue, onOpenChange, defaultOpen, onClose, ...rest } = _props as DialogProps & Record<string, unknown>;
    void open; void disableBackdropClose; void disableEscapeClose; void disableScrollLock; void initialFocus; void ariaLabel; void ariaLabelledby; void defaultValue; void onOpenChange; void defaultOpen; void onClose;
    return rest;
  })();
  const dialogEl = useRef<HTMLDialogElement | null>(null);
  const returnFocusTo = useRef<HTMLElement | null>(null);
  const holdsLock = useRef(false);
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const _openRef = useRef(open);
  _openRef.current = open;
  const panelEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);

  // The element focused when the dialog opened, for the unmount-while-open
  // focus return (a normal close gets the native return from close()).
  // Whether THIS instance currently holds one count of the shared scroll lock.
  // ---- native reconcile ---------------------------------------------------
  // The <dialog> element, cached by sync() so $onUnmount can reach it without
  // reading $refs during teardown.
  // Lock/unlock <html> scroll for this instance. The actual lock/unlock is
  // REF-COUNTED (./internal/scrollLock) across every Dialog instance sharing this
  // leaf's module, because a naive per-instance toggle unlocks scrolling the
  // moment ANY dialog closes, even while an OUTER dialog is still open. This
  // wrapper releases only a count this instance took: a dialog that mounts closed
  // (or closes twice) must not release a count another open dialog holds. The
  // opt-out is read when locking only, so toggling it while open still releases.
  const setScrollLock = useCallback((lock: any) => {
    if (lock === holdsLock.current) return;
    if (lock && props.disableScrollLock) return;
    holdsLock.current = lock;
    applySharedScrollLock(lock);
  }, [props.disableScrollLock]);
  // Focus `initialFocus` after showModal() has made its native choice. A selector
  // is matched inside the panel and, on Lit, inside the light-DOM content
  // assigned to the panel's <slot> (which panel.querySelector cannot see).
  function focusInitial(panel: any) {
    const target: any = props.initialFocus;
    if (!target) return;
    let node: any = null;
    if (typeof target === 'string') {
      node = panel.querySelector(target);
      const slot: any = node ? null : panel.querySelector('slot');
      const assigned: any[] = slot && typeof slot.assignedElements === 'function' ? slot.assignedElements({
        flatten: true
      }) : [];
      for (let i = 0; !node && i < assigned.length; i++) {
        node = assigned[i].matches(target) ? assigned[i] : assigned[i].querySelector(target);
      }
    } else {
      node = target;
    }
    if (node && typeof node.focus === 'function') node.focus();
  }

  // Reconcile the native <dialog> to the desired open state. Guarded on the
  // native `el.open` flag (showModal throws if already open; close is a no-op when
  // closed). Reads $refs in a post-mount callback (ROZ123-safe).
  //
  // The ref lives on the inner panel <div> (which the emitter types as
  // HTMLDivElement), and we reach the <dialog> via `panel.parentElement` cast to
  // HTMLDialogElement. This sidesteps an emitter gap: the per-target ref-type map
  // has no `dialog` case, so a ref placed directly on <dialog> would be typed the
  // generic HTMLElement (no `.open`/`.showModal()`/`.close()`), failing strict
  // leaf typecheck. Fixing it here keeps the change source-only (no emitter edit).
  const sync = useCallback((isOpen: any) => {
    const panel = panelEl.current;
    const el = (panel && panel.parentElement) as HTMLDialogElement | null;
    if (!el) return;
    dialogEl.current = el;
    if (isOpen) {
      if (!el.open) {
        const active = document.activeElement;
        returnFocusTo.current = active instanceof HTMLElement ? active : null;
        el.showModal();
        focusInitial(panel);
      }
      setScrollLock(true);
    } else {
      if (el.open) el.close();
      returnFocusTo.current = null;
      setScrollLock(false);
    }
  }, [focusInitial, setScrollLock]);
  // ---- close funnel (single $emit site) ----------------------------------
  function closeWith(reason: any) {
    setOpen(false);
    props.onClose && props.onClose({
      reason
    });
  }

  // ---- handlers ----------------------------------------------------------
  // Native Esc fires `cancel` on the <dialog>. preventDefault so WE drive the
  // close through the model (keeping `open` in sync); honor the opt-out.
  const onCancel = useCallback((e: any) => {
    if (e) e.preventDefault();
    if (props.disableEscapeClose) return;
    closeWith('escape');
  }, [closeWith, props.disableEscapeClose]);
  // A click whose target IS the <dialog> element (not its panel/children) is a
  // backdrop click — the ::backdrop is part of the dialog box. We compare the
  // real `e.target` (reliable even under Solid's event delegation) to the dialog
  // element resolved via the panel ref's parent.
  const onClick = useCallback((e: any) => {
    if (props.disableBackdropClose) return;
    const panel = panelEl.current;
    const el = panel && panel.parentElement;
    if (e && el && e.target === el) closeWith('backdrop');
  }, [closeWith, props.disableBackdropClose]);
  // ---- lifecycle ---------------------------------------------------------
  // ---- imperative handle -------------------------------------------------
  // show()/hide() — named to avoid the `open` model + `@close` event collisions.
  function show() {
    setOpen(true);
  }
  function hide() {
    closeWith('programmatic');
  }

  const _syncRef = useRef(sync);
  _syncRef.current = sync;
  useEffect(() => {
    _syncRef.current(_openRef.current);
  }, []);
  useEffect(() => {
    return () => {
      setScrollLock(false);
      const el = dialogEl.current;
      const back = returnFocusTo.current;
      dialogEl.current = null;
      returnFocusTo.current = null;
      if (!el || !el.open) return;
      if (el.isConnected) el.close();
      if (!back) return;
      setTimeout(() => {
        const active = document.activeElement;
        if (back.isConnected && (!active || active === document.body)) back.focus();
      }, 0);
    };
  }, []);
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
    <dialog aria-label={rozieAttr(props.ariaLabel)} aria-labelledby={rozieAttr(props.ariaLabelledby)} {...attrs} className={clsx("rozie-dialog", (attrs.className as string | undefined))} {...mergeListeners({ onCancel: ($event) => { onCancel($event); }, onClick: ($event) => { onClick($event); } } satisfies import('react').ComponentPropsWithoutRef<'dialog'> & Record<string, unknown>, pickListeners(attrs))} data-rozie-s-2a679072="">
      
      <div className={"rozie-dialog-panel"} ref={panelEl} data-rozie-s-2a679072="">
        {(typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)() : (props.children ?? props.slots?.['']))}
      </div>
    </dialog>
    </>
  );
});
export default Dialog;
