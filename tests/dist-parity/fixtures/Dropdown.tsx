import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState, useOutsideClick, useThrottledCallback } from '@rozie/runtime-react';
import './Dropdown.css';
import './Dropdown.global.css';

interface TriggerCtx { open: any; toggle: any; }

interface ChildrenCtx { close: any; }

interface DropdownProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  renderTrigger?: (ctx: TriggerCtx) => ReactNode;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DropdownHandle {
  toggle: (...args: any[]) => any;
  close: (...args: any[]) => any;
}

const Dropdown = forwardRef<DropdownHandle, DropdownProps>(function Dropdown(_props: DropdownProps, ref): JSX.Element {
  const props: Omit<DropdownProps, 'closeOnOutsideClick' | 'closeOnEscape'> & { closeOnOutsideClick: boolean; closeOnEscape: boolean } = {
    ..._props,
    closeOnOutsideClick: _props.closeOnOutsideClick ?? true,
    closeOnEscape: _props.closeOnEscape ?? true,
  };
  const attrs: Record<string, unknown> = (() => {
    const { open, closeOnOutsideClick, closeOnEscape, defaultValue, onOpenChange, defaultOpen, ...rest } = _props as DropdownProps & Record<string, unknown>;
    void open; void closeOnOutsideClick; void closeOnEscape; void defaultValue; void onOpenChange; void defaultOpen;
    return rest;
  })();
  const [open, setOpen] = useControllableState({
    value: props.open,
    defaultValue: props.defaultOpen ?? false,
    onValueChange: props.onOpenChange,
  });
  const _openRef = useRef(open);
  _openRef.current = open;
  const triggerEl = useRef<HTMLDivElement | null>(null);
  const panelEl = useRef<HTMLDivElement | null>(null);
  const _watch0First = useRef(true);

  const toggle = useCallback(() => {
    setOpen(prev => !prev);
  }, [setOpen]);
  const close = useCallback(() => {
    setOpen(false);
  }, [setOpen]);
  const reposition = useCallback(() => {
    if (!panelEl.current || !triggerEl.current) return;
    const rect = triggerEl.current!.getBoundingClientRect();
    Object.assign(panelEl.current!.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  }, []);

  useEffect(() => {
    // Initial reposition only if the panel is open at mount time.
    if (_openRef.current) reposition();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Example of integrating a vanilla JS library — $refs gives direct DOM access.
    // new Popper($refs.triggerEl, $refs.panelEl, { placement: 'bottom-start' })
  }, []);
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    if (open) reposition();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieThrottledLReposition = useThrottledCallback(reposition, [open, reposition], 100);

  useOutsideClick(
    [triggerEl, panelEl],
    close,
    () => !!(open && props.closeOnOutsideClick),
  );

  useEffect(() => {
    if (!(open && props.closeOnEscape)) return;
    const _rozieHandler = ($event: KeyboardEvent) => {
      if ($event.key !== 'Escape') return;
      ((close) as ((...args: any[]) => any))($event);
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  useEffect(() => {
    if (!(open)) return;
    window.addEventListener('resize', _rozieThrottledLReposition, { passive: true });
    return () => window.removeEventListener('resize', _rozieThrottledLReposition);
  }, [_rozieThrottledLReposition, open, reposition]);

  useImperativeHandle(ref, () => ({ toggle, close }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("dropdown", (attrs.className as string | undefined))} data-rozie-s-6d6bd882="">
      <div ref={triggerEl} onClick={toggle} data-rozie-s-6d6bd882="">
        {(props.renderTrigger ?? props.slots?.['trigger'])?.({ open, toggle })}
      </div>

      {(open) && <div ref={panelEl} className={"dropdown-panel"} role="menu" data-rozie-s-6d6bd882="">
        {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ close }) : (props.children ?? props.slots?.[''])}
      </div>}</div>
    </>
  );
});
export default Dropdown;
