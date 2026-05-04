// Hand-copied from packages/targets/react/fixtures/Dropdown.tsx.snap with
// the addition of a `styles` shim so the .tsx is a valid runnable module
// (Plan 04-05 will emit a real CSS-module import; until then the integration
// test stubs styles to an empty object).
//
// Per Plan 04-04 success criterion 1, this file is consumed by
// dropdown-stale-closure.test.tsx to verify the LATEST closure wins when a
// document.click fires after a parent re-render — the marquee D-61 anchor.
//
// Drift detection: src/__tests__/compiled-fixtures-drift.test.ts compares the
// surface area (component name, props interface, runtime imports) between
// .snap and .compiled.tsx and fails if they diverge. If that test fails after
// an emitter change, audit this file against the new .snap and update by hand.
import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  useControllableState,
  useOutsideClick,
  useThrottledCallback,
} from '@rozie/runtime-react';

const styles: Record<string, string> = new Proxy({}, { get: (_t, k) => String(k) });

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

export default function Dropdown(props: DropdownProps): JSX.Element {
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
      left: `${rect.left}px`,
    });
  }, []);

  useEffect(() => {
    reposition();
  }, [reposition]);

  const _rozieThrottledLReposition = useThrottledCallback(reposition, [open, reposition], 100);

  useOutsideClick(
    [triggerEl, panelEl],
    close,
    () => Boolean(open && (props.closeOnOutsideClick ?? true)),
  );

  useEffect(() => {
    if (!(open && (props.closeOnEscape ?? true))) return;
    const _rozieHandler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      close();
    };
    document.addEventListener('keydown', _rozieHandler);
    return () => document.removeEventListener('keydown', _rozieHandler);
  }, [close, open, props.closeOnEscape]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener('resize', _rozieThrottledLReposition, { passive: true });
    return () => window.removeEventListener('resize', _rozieThrottledLReposition);
  }, [_rozieThrottledLReposition, open]);

  return (
    <div className={styles.dropdown}>
      <div ref={triggerEl} onClick={toggle}>
        {props.renderTrigger?.({ open, toggle })}
      </div>
      {open && (
        <div ref={panelEl} className={styles['dropdown-panel']} role="menu">
          {props.children?.({ close })}
        </div>
      )}
    </div>
  );
}
