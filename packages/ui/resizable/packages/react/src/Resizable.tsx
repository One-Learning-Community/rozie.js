import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './Resizable.css';
import { clampPercent, percentFromPointer, nudge } from './internal/resizeMath';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current size, normalized + clamped. Plain function (called in template
// bindings AND handlers) — never $computed (a $computed is a value on React but
// an accessor on Solid; a plain fn reads uniformly).

interface ResizableProps {
  /**
   * The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back.
   * @example
   * <Resizable r-model:size="split" :min="20" :max="80" direction="horizontal" />
   */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (size: number) => void;
  /**
   * The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`.
   */
  direction?: string;
  /**
   * The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit.
   */
  min?: number;
  /**
   * The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit.
   */
  max?: number;
  /**
   * Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  onResize?: (...args: any[]) => void;
  renderStart?: () => ReactNode;
  renderHandle?: () => ReactNode;
  renderEnd?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface ResizableHandle {
  applySize: (...args: any[]) => any;
  reset: (...args: any[]) => any;
}

const Resizable = forwardRef<ResizableHandle, ResizableProps>(function Resizable(_props: ResizableProps, ref): JSX.Element {
  const props: Omit<ResizableProps, 'direction' | 'min' | 'max' | 'disabled'> & { direction: string; min: number; max: number; disabled: boolean } = {
    ..._props,
    direction: _props.direction ?? 'horizontal',
    min: _props.min ?? 10,
    max: _props.max ?? 90,
    disabled: _props.disabled ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { size, direction, min, max, disabled, defaultValue, onSizeChange, defaultSize, ...rest } = _props as ResizableProps & Record<string, unknown>;
    void size; void direction; void min; void max; void disabled; void defaultValue; void onSizeChange; void defaultSize;
    return rest;
  })();
  const [size, setSize] = useControllableState({
    value: props.size,
    defaultValue: props.defaultSize ?? 50,
    onValueChange: props.onSizeChange,
  });
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  function currentSize() {
    const raw = typeof size === 'number' ? size : props.min;
    return clampPercent(raw, props.min, props.max);
  }
  function isVertical() {
    return props.direction === 'vertical';
  }
  function sizeStyle() {
    return {
      '--rozie-resizable-size': currentSize() + '%'
    };
  }
  function commitSize(raw: any) {
    const next = clampPercent(raw, props.min, props.max);
    setSize(next);
    props.onResize && props.onResize({
      size: next
    });
  }
  const onPointerDown = useCallback((e: any) => {
    if (props.disabled) return;
    if (e && e.preventDefault) e.preventDefault();
    setDragging(true);
    // Capture the pointer on the handle so move/up keep firing on it even when the
    // pointer leaves the handle mid-drag.
    if (e && e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [props.disabled]);
  const onPointerMove = useCallback((e: any) => {
    if (!dragging || props.disabled) return;
    const root$local = root.current;
    if (!root$local) return;
    const rect = root$local.getBoundingClientRect();
    const pct = isVertical() ? percentFromPointer(e.clientY, rect.top, rect.height) : percentFromPointer(e.clientX, rect.left, rect.width);
    commitSize(pct);
  }, [commitSize, dragging, isVertical, props.disabled]);
  const onPointerUp = useCallback((e: any) => {
    if (!dragging) return;
    setDragging(false);
    if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
      if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  }, [dragging]);
  const onKeydown = useCallback((e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    const vertical = isVertical();
    const decKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const incKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (key === decKey) {
      if (e) e.preventDefault();
      commitSize(nudge(currentSize(), -1, props.min, props.max));
    } else if (key === incKey) {
      if (e) e.preventDefault();
      commitSize(nudge(currentSize(), 1, props.min, props.max));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      commitSize(props.min);
    } else if (key === 'End') {
      if (e) e.preventDefault();
      commitSize(props.max);
    }
  }, [commitSize, currentSize, isVertical, props.disabled, props.max, props.min]);
  function applySize(percent: any) {
    return commitSize(percent);
  }
  function reset() {
    return commitSize((props.min + props.max) / 2);
  }

  const _rozieExposeRef = useRef({ applySize, reset });
  _rozieExposeRef.current = { applySize, reset };
  useImperativeHandle(ref, () => ({ applySize: (...args: Parameters<typeof applySize>): ReturnType<typeof applySize> => _rozieExposeRef.current.applySize(...args), reset: (...args: Parameters<typeof reset>): ReturnType<typeof reset> => _rozieExposeRef.current.reset(...args) }), []);

  return (
    <>
    <div ref={root} style={parseInlineStyle(sizeStyle())} {...attrs} className={clsx(clsx("rozie-resizable", { "rozie-resizable--vertical": isVertical(), "rozie-resizable--horizontal": !isVertical(), "rozie-resizable--dragging": dragging, "rozie-resizable--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-8330bc5a="">
      
      <div className={"rozie-resizable-panel rozie-resizable-panel--start"} data-rozie-s-8330bc5a="">
        {(props.renderStart ?? props.slots?.['start'])?.()}
      </div>

      
      <div className={"rozie-resizable-handle"} role="separator" tabIndex={0} aria-orientation={rozieAttr(isVertical() ? 'horizontal' : 'vertical')} aria-valuenow={size} aria-valuemin={props.min} aria-valuemax={props.max} aria-disabled={!!props.disabled} onPointerDown={($event) => { onPointerDown($event); }} onPointerMove={($event) => { onPointerMove($event); }} onPointerUp={($event) => { onPointerUp($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-8330bc5a="">
        {(props.renderHandle ?? props.slots?.['handle']) ? ((props.renderHandle ?? props.slots?.['handle']) as Function)() : <span className={"rozie-resizable-grip"} aria-hidden="true" data-rozie-s-8330bc5a="" />}
      </div>

      
      <div className={"rozie-resizable-panel rozie-resizable-panel--end"} data-rozie-s-8330bc5a="">
        {(props.renderEnd ?? props.slots?.['end'])?.()}
      </div>
    </div>
    </>
  );
});
export default Resizable;
