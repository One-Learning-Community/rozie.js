// Hand-derived from packages/targets/react/fixtures/Modal.tsx.snap with the
// addition of a `styles` shim and a small `data-testid` on the backdrop.
// Used by modal-strictmode.test.tsx + strictmode-all.test.tsx
// (Phase 4 SC4 / REACT-T-06 / Pitfall 3 anchor).
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';

const styles: Record<string, string> = new Proxy({}, { get: (_t, k) => String(k) });

interface HeaderCtx { close: any }
interface ChildrenCtx { close: any }
interface FooterCtx { close: any }

interface ModalProps {
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: unknown[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
  renderFooter?: (ctx: FooterCtx) => ReactNode;
}

export default function Modal(props: ModalProps): JSX.Element | null {
  const savedBodyOverflow = useRef('');
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultValue ?? false,
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
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
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
        if (e.target !== e.currentTarget) return;
        if (props.closeOnBackdrop) close();
      }}
    >
      <div
        ref={dialogEl}
        className={styles['modal-dialog']}
        role="dialog"
        aria-modal="true"
        aria-label={props.title || undefined}
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
