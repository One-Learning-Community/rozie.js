import type { JSX } from 'solid-js';
import { createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass } from '@rozie/runtime-solid';
import { clampPercent, percentFromPointer, nudge } from './internal/resizeMath';

// ---- derived view (plain functions, uniform ×6) ------------------------
// The current size, normalized + clamped. Plain function (called in template
// bindings AND handlers) — never $computed (a $computed is a value on React but
// an accessor on Solid; a plain fn reads uniformly).

__rozieInjectStyle('Resizable-8330bc5a', `.rozie-resizable[data-rozie-s-8330bc5a] {
  display: flex;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  font: var(--rozie-resizable-font, inherit);
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] {
  flex-direction: row;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] {
  flex-direction: column;
}
.rozie-resizable-panel[data-rozie-s-8330bc5a] {
  box-sizing: border-box;
  overflow: auto;
}
.rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  flex: 0 0 auto;
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  width: var(--rozie-resizable-size, 50%);
  height: 100%;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-panel--start[data-rozie-s-8330bc5a] {
  height: var(--rozie-resizable-size, 50%);
  width: 100%;
}
.rozie-resizable-panel--end[data-rozie-s-8330bc5a] {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
.rozie-resizable-handle[data-rozie-s-8330bc5a] {
  flex: 0 0 var(--rozie-resizable-handle-size, 0.5rem);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--rozie-resizable-handle-bg, rgba(0, 0, 0, 0.08));
  outline: none;
  transition: background-color 0.15s;
  touch-action: none;
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: col-resize;
  align-self: stretch;
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: row-resize;
}
.rozie-resizable-handle[data-rozie-s-8330bc5a]:hover {
  background: var(--rozie-resizable-handle-hover-bg, rgba(0, 0, 0, 0.16));
}
.rozie-resizable-handle[data-rozie-s-8330bc5a]:focus-visible {
  box-shadow: 0 0 0 var(--rozie-resizable-focus-ring-width, 2px)
    var(--rozie-resizable-focus-ring-color, rgba(0, 102, 204, 0.5));
  z-index: 1;
}
.rozie-resizable--dragging[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  background: var(--rozie-resizable-handle-active-bg, var(--rozie-resizable-accent, #0066cc));
}
.rozie-resizable-grip[data-rozie-s-8330bc5a] {
  display: block;
  border-radius: 999px;
  background: var(--rozie-resizable-grip-bg, rgba(0, 0, 0, 0.35));
}
.rozie-resizable--horizontal[data-rozie-s-8330bc5a] .rozie-resizable-grip[data-rozie-s-8330bc5a] {
  width: var(--rozie-resizable-grip-thickness, 2px);
  height: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--vertical[data-rozie-s-8330bc5a] .rozie-resizable-grip[data-rozie-s-8330bc5a] {
  height: var(--rozie-resizable-grip-thickness, 2px);
  width: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--disabled[data-rozie-s-8330bc5a] .rozie-resizable-handle[data-rozie-s-8330bc5a] {
  cursor: default;
  opacity: var(--rozie-resizable-disabled-opacity, 0.55);
}`);

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
  onResize?: (...args: unknown[]) => void;
  startSlot?: JSX.Element;
  handleSlot?: JSX.Element;
  endSlot?: JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: ResizableHandle) => void;
}

export interface ResizableHandle {
  applySize: (...args: any[]) => any;
  reset: (...args: any[]) => any;
}

export default function Resizable(_props: ResizableProps): JSX.Element {
  const _merged = mergeProps({ direction: 'horizontal', min: 10, max: 90, disabled: false }, _props);
  const [local, attrs] = splitProps(_merged, ['size', 'direction', 'min', 'max', 'disabled', 'ref']);
  onMount(() => { local.ref?.({ applySize, reset }); });

  const [size, setSize] = createControllableSignal<number>(_props as unknown as Record<string, unknown>, 'size', 50);
  const [dragging, setDragging] = createSignal(false);
  let rootRef: HTMLElement | null = null;

  // ---- derived view (plain functions, uniform ×6) ------------------------
  // The current size, normalized + clamped. Plain function (called in template
  // bindings AND handlers) — never $computed (a $computed is a value on React but
  // an accessor on Solid; a plain fn reads uniformly).
  function currentSize() {
    const raw = typeof size() === 'number' ? size() : local.min;
    return clampPercent(raw, local.min, local.max);
  }
  function isVertical() {
    return local.direction === 'vertical';
  }

  // Inline CSS custom property positioning the panels. Read BARE in the template
  // via :style — a plain object literal, recomputed each render.
  function sizeStyle() {
    return {
      '--rozie-resizable-size': currentSize() + '%'
    };
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Clamp, write the model, emit resize. The SOLE $emit('resize') site so the
  // React prop-destructure for onResize hoists exactly once.
  function commitSize(raw: any) {
    const next = clampPercent(raw, local.min, local.max);
    setSize(next);
    _props.onResize?.({
      size: next
    });
  }

  // ---- pointer drag (template @event + pointer capture) ------------------
  // $refs.root is post-mount-only (ROZ123-safe): read inside these handlers.
  function onPointerDown(e: any) {
    if (local.disabled) return;
    if (e && e.preventDefault) e.preventDefault();
    setDragging(true);
    // Capture the pointer on the handle so move/up keep firing on it even when the
    // pointer leaves the handle mid-drag.
    if (e && e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }
  function onPointerMove(e: any) {
    if (!dragging() || local.disabled) return;
    const root = rootRef;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const pct = isVertical() ? percentFromPointer(e.clientY, rect.top, rect.height) : percentFromPointer(e.clientX, rect.left, rect.width);
    commitSize(pct);
  }
  function onPointerUp(e: any) {
    if (!dragging()) return;
    setDragging(false);
    if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
      if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  }

  // ---- keyboard (role="separator") ---------------------------------------
  // Arrow keys nudge by 1% (toward/away from the start panel along the axis);
  // Home/End jump to min/max. Matches the WAI-ARIA window-splitter pattern.
  function onKeydown(e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    const vertical = isVertical();
    const decKey = vertical ? 'ArrowUp' : 'ArrowLeft';
    const incKey = vertical ? 'ArrowDown' : 'ArrowRight';
    if (key === decKey) {
      if (e) e.preventDefault();
      commitSize(nudge(currentSize(), -1, local.min, local.max));
    } else if (key === incKey) {
      if (e) e.preventDefault();
      commitSize(nudge(currentSize(), 1, local.min, local.max));
    } else if (key === 'Home') {
      if (e) e.preventDefault();
      commitSize(local.min);
    } else if (key === 'End') {
      if (e) e.preventDefault();
      commitSize(local.max);
    }
  }

  // ---- imperative handle -------------------------------------------------
  // applySize(percent) — set the split programmatically (clamped + emits resize).
  // reset() — recentre to the midpoint of [min, max].
  // COLLISION NOTE: the verb is `applySize`, NOT the natural `setSize` — the model
  // prop is `size`, so the React emitter auto-generates a `setSize` state setter.
  // A `$expose` verb named `setSize` collapses onto that setter ident and trips
  // ROZ524 (it fires as an INTERNAL diagnostic because the Phase-46 deconfliction
  // pass does NOT rename inside an `$expose`-verb closure — see the emitter-gap
  // note in the family README). `apply<X>` is the listbox/data-table precedent for
  // dodging a generated React setter. It is also NOT `resize` (→ ROZ121 emit clash)
  // and NOT a host-element member.
  function applySize(percent: any) {
    return commitSize(percent);
  }
  function reset() {
    return commitSize((local.min + local.max) / 2);
  }

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} style={parseInlineStyle(sizeStyle())} {...attrs} class={"rozie-resizable" + " " + rozieClass({ 'rozie-resizable--vertical': isVertical(), 'rozie-resizable--horizontal': !isVertical(), 'rozie-resizable--dragging': dragging(), 'rozie-resizable--disabled': local.disabled }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-8330bc5a="">
      
      <div class={"rozie-resizable-panel rozie-resizable-panel--start"} data-rozie-s-8330bc5a="">
        {(_props.startSlot ?? _props.slots?.['start']?.({}))}
      </div>

      
      <div role="separator" aria-orientation={rozieAttr(isVertical() ? 'horizontal' : 'vertical')} aria-valuenow={size()} aria-valuemin={local.min} aria-valuemax={local.max} aria-disabled={!!local.disabled} class={"rozie-resizable-handle"} tabIndex={0} onPointerDown={($event) => { onPointerDown($event); }} onPointerMove={($event) => { onPointerMove($event); }} onPointerUp={($event) => { onPointerUp($event); }} onKeyDown={($event) => { onKeydown($event); }} data-rozie-s-8330bc5a="">
        {(_props.handleSlot ?? _props.slots?.['handle']?.({})) ?? <span class={"rozie-resizable-grip"} aria-hidden="true" data-rozie-s-8330bc5a="" />}
      </div>

      
      <div class={"rozie-resizable-panel rozie-resizable-panel--end"} data-rozie-s-8330bc5a="">
        {(_props.endSlot ?? _props.slots?.['end']?.({}))}
      </div>
    </div>
    </>
  );
}
