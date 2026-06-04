// Hand-derived from packages/targets/react/fixtures/Modal.tsx.snap with the
// addition of a `styles` shim and a small `data-testid` on the backdrop.
// Used by modal-strictmode.test.tsx + strictmode-all.test.tsx
// (Phase 4 SC4 / REACT-T-06 / Pitfall 3 anchor).
//
// Drift detection: src/__tests__/compiled-fixtures-drift.test.ts compares the
// surface area (component name, props interface, runtime imports) between
// .snap and .compiled.tsx and fails if they diverge. If that test fails after
// an emitter change, audit this file against the new .snap and update by hand.
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { rozieDisplay, useControllableState } from '@rozie/runtime-react';

const styles: Record<string, string> = new Proxy({}, { get: (_t, k) => String(k) });

interface HeaderCtx { close: any }
interface ChildrenCtx { close: any }
interface FooterCtx { close: any }

interface ModalProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
  renderFooter?: (ctx: FooterCtx) => ReactNode;
  // Phase 07.3.2 — surface-only field for compiled-fixtures-drift parity
  // with the canonical Modal.tsx.snap (D-SV-16 cross-target port). The
  // behavior tests using this hand-tuned variant never exercise the
  // dynamic slots map, so the field exists purely to satisfy the
  // propsFields set-equality check in compiled-fixtures-drift.test.ts.
  // Phase 07.3.2 Plan 07 (CR-01) — zero-args form matches the no-params
  // named-slot invocation form (emitSlotInvocation.ts:302 `?.()`).
  slots?: Record<string, () => ReactNode>;
}

export default function Modal(props: ModalProps): JSX.Element | null {
  const savedBodyOverflow = useRef('');
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const backdropEl = useRef<HTMLDivElement | null>(null);
  const dialogEl = useRef<HTMLDivElement | null>(null);

  const { onClose: _rozieProp_onClose } = props;
  const close = useCallback(() => {
    setOpen(false);
    _rozieProp_onClose && _rozieProp_onClose();
  }, [_rozieProp_onClose, setOpen]);

  const lockScroll = useCallback(() => {
    if (!props.lockBodyScroll) return;
    savedBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }, [props.lockBodyScroll]);

  const unlockScroll = useCallback(() => {
    if (!props.lockBodyScroll) return;
    document.body.style.overflow = savedBodyOverflow.current;
  }, [props.lockBodyScroll]);

  useEffect(() => {
    if (!open) return;
    lockScroll();
    return () => unlockScroll();
  }, [open, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!open) return;
    dialogEl.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  if (!open) return null;
  return (
    <div
      className={styles['modal-backdrop']}
      ref={backdropEl}
      data-testid="modal-backdrop"
      onClick={(e) => {
        if ($event.target !== $event.currentTarget) return;
        if (props.closeOnBackdrop) close();
      }}
    >
      <div
        ref={dialogEl}
        className={styles['modal-dialog']}
        role="dialog"
        aria-modal="true"
        aria-label={rozieDisplay(props.title || undefined)}
        tabIndex={-1}
      >
        {(props.title || props.renderHeader) && (
          <header>
            {props.renderHeader?.({ close }) ?? <h2>{props.title}</h2>}
            <button
              className={styles['close-btn']}
              aria-label="Close"
              onClick={close}
            >
              ×
            </button>
          </header>
        )}
        <div className={styles['modal-body']}>
          {props.children?.({ close })}
        </div>
        {props.renderFooter && (
          <footer>{props.renderFooter?.({ close })}</footer>
        )}
      </div>
    </div>
  );
}
