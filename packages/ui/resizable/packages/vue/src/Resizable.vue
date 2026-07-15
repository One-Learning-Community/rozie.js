<template>

<div :class="['rozie-resizable', { 'rozie-resizable--vertical': isVertical(), 'rozie-resizable--horizontal': !isVertical(), 'rozie-resizable--dragging': dragging, 'rozie-resizable--disabled': props.disabled }]" ref="rootRef" :style="sizeStyle()" v-bind="$attrs">
  
  <div class="rozie-resizable-panel rozie-resizable-panel--start">
    <slot name="start"></slot>
  </div>

  
  <div class="rozie-resizable-handle" role="separator" tabindex="0" :aria-orientation="isVertical() ? 'horizontal' : 'vertical'" :aria-valuenow="size" :aria-valuemin="(props.min) ?? undefined" :aria-valuemax="(props.max) ?? undefined" :aria-disabled="!!props.disabled" @pointerdown="onPointerDown($event)" @pointermove="onPointerMove($event)" @pointerup="onPointerUp($event)" @keydown="onKeydown($event)">
    <slot name="handle">
      <span class="rozie-resizable-grip" aria-hidden="true"></span>
    </slot>
  </div>

  
  <div class="rozie-resizable-panel rozie-resizable-panel--end">
    <slot name="end"></slot>
  </div>
</div>

</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(
  defineProps<{
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
  }>(),
  { direction: 'horizontal', min: 10, max: 90, disabled: false }
);

/**
 * The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back.
 * @example
 * <Resizable r-model:size="split" :min="20" :max="80" direction="horizontal" />
 */
const size = defineModel<number>('size', { default: 50 });

const emit = defineEmits<{
  resize: [...args: any[]];
}>();

defineSlots<{
  start(props: {  }): any;
  handle(props: {  }): any;
  end(props: {  }): any;
}>();

const dragging = ref(false);

const rootRef = ref<HTMLElement>();

import { clampPercent, percentFromPointer, nudge } from './internal/resizeMath';
// ---- derived view (plain functions, uniform ×6) ------------------------
// The current size, normalized + clamped. Plain function (called in template
// bindings AND handlers) — never $computed (a $computed is a value on React but
// an accessor on Solid; a plain fn reads uniformly).
const currentSize = () => {
  const raw = typeof size.value === 'number' ? size.value : props.min;
  return clampPercent(raw, props.min, props.max);
};
const isVertical = () => props.direction === 'vertical';
// Inline CSS custom property positioning the panels. Read BARE in the template
// via :style — a plain object literal, recomputed each render.
const sizeStyle = () => ({
  '--rozie-resizable-size': currentSize() + '%'
});
// ---- write funnel (single $emit site) ----------------------------------
// Clamp, write the model, emit resize. The SOLE $emit('resize') site so the
// React prop-destructure for onResize hoists exactly once.
const commitSize = (raw: any) => {
  const next = clampPercent(raw, props.min, props.max);
  size.value = next;
  emit('resize', {
    size: next
  });
};
// ---- pointer drag (template @event + pointer capture) ------------------
// $refs.root is post-mount-only (ROZ123-safe): read inside these handlers.
const onPointerDown = (e: any) => {
  if (props.disabled) return;
  if (e && e.preventDefault) e.preventDefault();
  dragging.value = true;
  // Capture the pointer on the handle so move/up keep firing on it even when the
  // pointer leaves the handle mid-drag.
  if (e && e.currentTarget && e.currentTarget.setPointerCapture && e.pointerId != null) {
    e.currentTarget.setPointerCapture(e.pointerId);
  }
};
const onPointerMove = (e: any) => {
  if (!dragging.value || props.disabled) return;
  const root = rootRef.value;
  if (!root) return;
  const rect = root.getBoundingClientRect();
  const pct = isVertical() ? percentFromPointer(e.clientY, rect.top, rect.height) : percentFromPointer(e.clientX, rect.left, rect.width);
  commitSize(pct);
};
const onPointerUp = (e: any) => {
  if (!dragging.value) return;
  dragging.value = false;
  if (e && e.currentTarget && e.currentTarget.releasePointerCapture && e.pointerId != null) {
    if (e.currentTarget.hasPointerCapture && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }
};
// ---- keyboard (role="separator") ---------------------------------------
// Arrow keys nudge by 1% (toward/away from the start panel along the axis);
// Home/End jump to min/max. Matches the WAI-ARIA window-splitter pattern.
const onKeydown = (e: any) => {
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
};
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
const applySize = (percent: any) => commitSize(percent);
const reset = () => commitSize((props.min + props.max) / 2);

defineExpose({ applySize, reset });
</script>

<style scoped>
.rozie-resizable {
  display: flex;
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  font: var(--rozie-resizable-font, inherit);
}
.rozie-resizable--horizontal {
  flex-direction: row;
}
.rozie-resizable--vertical {
  flex-direction: column;
}
.rozie-resizable-panel {
  box-sizing: border-box;
  overflow: auto;
}
.rozie-resizable-panel--start {
  flex: 0 0 auto;
}
.rozie-resizable--horizontal .rozie-resizable-panel--start {
  width: var(--rozie-resizable-size, 50%);
  height: 100%;
}
.rozie-resizable--vertical .rozie-resizable-panel--start {
  height: var(--rozie-resizable-size, 50%);
  width: 100%;
}
.rozie-resizable-panel--end {
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
}
.rozie-resizable-handle {
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
.rozie-resizable--horizontal .rozie-resizable-handle {
  cursor: col-resize;
  align-self: stretch;
}
.rozie-resizable--vertical .rozie-resizable-handle {
  cursor: row-resize;
}
.rozie-resizable-handle:hover {
  background: var(--rozie-resizable-handle-hover-bg, rgba(0, 0, 0, 0.16));
}
.rozie-resizable-handle:focus-visible {
  box-shadow: 0 0 0 var(--rozie-resizable-focus-ring-width, 2px)
    var(--rozie-resizable-focus-ring-color, rgba(0, 102, 204, 0.5));
  z-index: 1;
}
.rozie-resizable--dragging .rozie-resizable-handle {
  background: var(--rozie-resizable-handle-active-bg, var(--rozie-resizable-accent, #0066cc));
}
.rozie-resizable-grip {
  display: block;
  border-radius: 999px;
  background: var(--rozie-resizable-grip-bg, rgba(0, 0, 0, 0.35));
}
.rozie-resizable--horizontal .rozie-resizable-grip {
  width: var(--rozie-resizable-grip-thickness, 2px);
  height: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--vertical .rozie-resizable-grip {
  height: var(--rozie-resizable-grip-thickness, 2px);
  width: var(--rozie-resizable-grip-length, 1.5rem);
}
.rozie-resizable--disabled .rozie-resizable-handle {
  cursor: default;
  opacity: var(--rozie-resizable-disabled-opacity, 0.55);
}
</style>
