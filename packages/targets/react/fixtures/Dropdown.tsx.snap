import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useControllableState, useOutsideClick, useThrottledCallback } from '@rozie/runtime-react';
import styles from './Dropdown.module.css';
import './Dropdown.global.css';

interface TriggerCtx { open: any; toggle: any; }

interface ChildrenCtx { close: any; }

interface DropdownProps {
  open?: boolean;
  defaultValue?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  renderTrigger?: (ctx: TriggerCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
}

export default function Dropdown(_props: DropdownProps): JSX.Element {
  const props: DropdownProps = {
    ..._props,
    closeOnOutsideClick: _props.closeOnOutsideClick ?? true,
    closeOnEscape: _props.closeOnEscape ?? true,
  };
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultValue ?? false,
    onValueChange: props.onOpenChange,
  });
  const triggerEl = useRef<HTMLDivElement | null>(null);
  const panelEl = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
  const reposition = useCallback(() => {
    if (!panelEl.current || !triggerEl.current) return;
    const rect = triggerEl.current.getBoundingClientRect();
    Object.assign(panelEl.current.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  }, []);

  useEffect(() => {
    reposition();
  }, [reposition]);
  useEffect(() => {
    
  }, []);

  const _rozieThrottledLReposition = useThrottledCallback(reposition, [open, reposition], 100);

  useOutsideClick(
    [triggerEl, panelEl],
    close,
    () => open && props.closeOnOutsideClick,
  );

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close(e);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  useEffect(() => {
    if (!(open)) return;
    window.addEventListener('resize', _rozieThrottledLReposition, { passive: true });
    return () => window.removeEventListener('resize', _rozieThrottledLReposition, { passive: true });
  }, [_rozieThrottledLReposition, open, reposition]);

  return (
    <>
    <div className={styles.dropdown}>
      <div ref={triggerEl} onClick={toggle}>
        {props.renderTrigger?.({ open, toggle })}
      </div>

      {(open) && <div ref={panelEl} className={styles["dropdown-panel"]} role="menu">
        {props.children?.({ close })}
      </div>}</div>
    </>
  );
}
