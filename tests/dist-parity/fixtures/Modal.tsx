import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';
import styles from './Modal.module.css';
import './Modal.global.css';

interface HeaderCtx { close: any; }

interface ChildrenCtx { close: any; }

interface FooterCtx { close: any; }

interface ModalProps {
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  lockBodyScroll?: boolean;
  title?: string;
  onClose?: (...args: any[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  renderFooter?: (ctx: FooterCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function Modal(_props: ModalProps): JSX.Element {
  const props: ModalProps & { closeOnEscape: boolean; closeOnBackdrop: boolean; lockBodyScroll: boolean; title: string } = {
    ..._props,
    closeOnEscape: _props.closeOnEscape ?? true,
    closeOnBackdrop: _props.closeOnBackdrop ?? true,
    lockBodyScroll: _props.lockBodyScroll ?? true,
    title: _props.title ?? '',
  };
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
    lockScroll();
    return () => unlockScroll();
  }, [lockScroll, unlockScroll]);
  useEffect(() => {
    dialogEl.current?.focus();
  }, []);

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      ((close) as ((...args: any[]) => any))($event);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  return (
    <>
    {(open) && <div className={styles["modal-backdrop"]} ref={backdropEl} onClick={($event) => { if ($event.target !== $event.currentTarget) return; props.closeOnBackdrop && close(); }} data-rozie-s-fc45feb2="">
      <div ref={dialogEl} className={styles["modal-dialog"]} role="dialog" aria-modal="true" aria-label={props.title || undefined} tabIndex={-1} data-rozie-s-fc45feb2="">
        {(props.title || (props.renderHeader ?? props.slots?.['header'])) && <header data-rozie-s-fc45feb2="">
          {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)({ close }) : <h2 data-rozie-s-fc45feb2="">{props.title}</h2>}
          <button className={styles["close-btn"]} aria-label="Close" onClick={close} data-rozie-s-fc45feb2="">×</button>
        </header>}<div className={styles["modal-body"]} data-rozie-s-fc45feb2="">
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ close }) : (props.children ?? props.slots?.[''])}
        </div>

        {((props.renderFooter ?? props.slots?.['footer'])) && <footer data-rozie-s-fc45feb2="">
          {(props.renderFooter ?? props.slots?.['footer'])?.({ close })}
        </footer>}</div>
    </div>}</>
  );
}
