<script lang="ts">
import { applyListeners, rozieAttr } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  /**
   * The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit.
   * @example
   * <NumberField r-model:modelValue="qty" :min="0" :max="10" />
   */
  modelValue?: (number) | null;
  /**
   * Inclusive lower bound. Every commit clamps the value to `>= min`, and the **Home** key jumps to `min`. `null` (the default) means no lower bound. Also emitted as `aria-valuemin`.
   */
  min?: (number) | null;
  /**
   * Inclusive upper bound. Every commit clamps the value to `<= max`, and the **End** key jumps to `max`. `null` (the default) means no upper bound. Also emitted as `aria-valuemax`.
   */
  max?: (number) | null;
  /**
   * The increment/decrement granularity. **ArrowUp** / **ArrowDown** and the +/- buttons change the value by `step`, and every commit snaps the value to the nearest multiple of `step` measured from `min` (or `0` when `min` is `null`).
   */
  step?: number;
  /**
   * The coarse step applied by **PageUp** / **PageDown**, for fast traversal of a wide range.
   */
  largeStep?: number;
  /**
   * Options forwarded to `Intl.NumberFormat` for locale-aware **display** formatting (e.g. `{ style: "currency", currency: "USD" }` or `{ minimumFractionDigits: 2 }`). The displayed text is formatted while the field is unfocused; on commit the formatting is stripped back off and the raw number is parsed.
   * @example
   * :formatOptions="{ style: 'currency', currency: 'USD' }"
   */
  formatOptions?: any;
  /**
   * Opt in to **scrub-on-drag**: press and drag horizontally on the field to change the value by `step` per few pixels (a power-user affordance). Off by default.
   */
  allowScrub?: boolean;
  /**
   * Disable the whole control — the input, both steppers, the keyboard, and scrubbing. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Make the field read-only — the value is shown and focusable but cannot be changed by typing, the steppers, the keyboard, or scrubbing.
   */
  readonly?: boolean;
  /**
   * Accessible name applied to the `role="spinbutton"` input (`aria-label`). Provide this (or an external `<label>`) so the control is announced.
   */
  ariaLabel?: (string) | null;
  onchange?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultFormatOptions = (() => ({}))();

let {
  modelValue = $bindable(null),
  min = null,
  max = null,
  step = 1,
  largeStep = 10,
  formatOptions = __defaultFormatOptions,
  allowScrub = false,
  disabled = false,
  readonly = false,
  ariaLabel = null,
  onchange,
  ...__rozieAttrs
}: Props = $props();

let text = $state('');
let focused = $state(false);

let input = $state<HTMLInputElement | undefined>(undefined);

// ---- top-level mutable handles (hook-referenced → React useRef hoist) -------
// The press-hold repeat timer + its current interval (the ramp). Declared at the
// top level so React hoists them to useRef and the Solid onMount/onCleanup split
// sees them in teardown. `null`/0 when no repeat is running.
let holdTimer: any = null;
let holdInterval = 0;
// Scrub-on-drag state (also top-level so teardown sees it).
let scrubbing = false;
let scrubStartX = 0;
let scrubStartValue = 0;
// ---- numeric helpers (plain functions, uniform ×6) -------------------------
// The current value as a real number, or null when empty. Named readValue, NOT
// valueOf — a `valueOf` binding cascades TS1240/1271 across the Lit class via
// Object.prototype.
const readValue = () => {
  const v = modelValue;
  return typeof v === 'number' && !Number.isNaN(v) ? v : null;
};
const hasMin = () => typeof min === 'number' && !Number.isNaN(min);
const hasMax = () => typeof max === 'number' && !Number.isNaN(max);
// Clamp n to [min, max] (whichever bounds are set).
const clampValue = (n: any) => {
  let out = n;
  if (hasMin() && out < min) out = min;
  if (hasMax() && out > max) out = max;
  return out;
};
// Snap n to the nearest multiple of `step` measured from `min` (or 0).
const snapValue = (n: any) => {
  const stepSize = typeof step === 'number' && step > 0 ? step : 1;
  const base = hasMin() ? min : 0;
  const snapped = base + Math.round((n - base) / stepSize) * stepSize;
  // Avoid binary-float drift (e.g. 0.1 + 0.2) by rounding to step precision.
  const decimals = (String(stepSize).split('.')[1] || '').length;
  return decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped;
};
// ---- locale formatting (plain functions, uniform ×6) -----------------------
const formatter = () => {
  try {
    return new Intl.NumberFormat(undefined, formatOptions || {});
  } catch {
    return new Intl.NumberFormat();
  }
};
// The value formatted for display (empty string when null).
const formatted = () => {
  const n = readValue();
  return n === null ? '' : formatter().format(n);
};
// Parse a user-typed string back to a number, or null when it is not a number.
// Strips grouping separators + any non-numeric currency/percent chrome, keeping
// digits, a sign, a decimal point, and an exponent.
const parseText = (raw: any) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  const cleaned = s.replace(/[^0-9eE+\-.,]/g, '').replace(/,/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
};
// What the <input> should show: the live edit buffer while focused, otherwise
// the locale-formatted value. A plain function (read in the template + handlers).
const displayText = () => focused ? text : formatted();
// ---- aria helpers (numbers/strings bound cleanly) --------------------------
const ariaText = () => {
  const n = readValue();
  return n === null ? '' : formatted();
};
// ---- write funnel (single $emit site) --------------------------------------
// Clamp + snap, write the model, mirror into the edit buffer, emit change. Named
// commitValue (NOT writeValue) so it does not collide with the generated Angular
// ControlValueAccessor.writeValue (TS2300).
const commitValue = (n: any) => {
  let next = n;
  if (next !== null) {
    next = snapValue(next);
    next = clampValue(next);
  }
  modelValue = next;
  // Keep the edit buffer in sync so a focused field reflects a programmatic step.
  text = next === null ? '' : String(next);
  onchange?.({
    value: next
  });
};
// Step by a signed multiple of `step` (used by buttons + arrows). A null value
// seeds from min (or 0) so the first step lands on a sensible number.
const stepBy = (dir: any, size: any) => {
  if (disabled || readonly) return;
  const cur = readValue();
  const stepSize = typeof size === 'number' ? size : typeof step === 'number' ? step : 1;
  const base = cur === null ? hasMin() ? min : 0 : cur;
  commitValue(base + dir * stepSize);
};
// ---- press-hold acceleration ----------------------------------------------
// Stop any running repeat (pointerup / pointerleave / unmount).
const stopHold = () => {
  if (holdTimer !== null) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }
  holdInterval = 0;
};
// Start a repeating step that ramps from slow to fast while the button is held.
const startHold = (dir: any) => {
  if (disabled || readonly) return;
  stopHold();
  stepBy(dir, step);
  holdInterval = 300;
  const tick = () => {
    stepBy(dir, step);
    // Ramp: shorten the interval down to a floor for accelerating repeats.
    holdInterval = Math.max(40, Math.round(holdInterval * 0.8));
    holdTimer = setTimeout(tick, holdInterval);
  };
  holdTimer = setTimeout(tick, holdInterval);
};
// ---- input + keyboard handlers ---------------------------------------------
const onInput = (e: any) => {
  if (readonly) return;
  const raw = e && e.target ? e.target.value : '';
  text = raw;
};
// Commit the edit buffer on blur: parse → commit (or clear to null when empty).
const onBlur = () => {
  focused = false;
  const parsed = parseText(text);
  commitValue(parsed);
};
const onFocus = (e: any) => {
  focused = true;
  // Seed the edit buffer with the raw (unformatted) number so editing is clean.
  const n = readValue();
  text = n === null ? '' : String(n);
  if (e && e.target && e.target.select) e.target.select();
};
const onKeydown = (e: any) => {
  if (disabled || readonly) return;
  const key = e ? e.key : '';
  if (key === 'ArrowUp') {
    if (e) e.preventDefault();
    stepBy(1, step);
  } else if (key === 'ArrowDown') {
    if (e) e.preventDefault();
    stepBy(-1, step);
  } else if (key === 'PageUp') {
    if (e) e.preventDefault();
    stepBy(1, largeStep);
  } else if (key === 'PageDown') {
    if (e) e.preventDefault();
    stepBy(-1, largeStep);
  } else if (key === 'Home') {
    if (hasMin()) {
      if (e) e.preventDefault();
      commitValue(min);
    }
  } else if (key === 'End') {
    if (hasMax()) {
      if (e) e.preventDefault();
      commitValue(max);
    }
  } else if (key === 'Enter') {
    // Commit the buffer without losing focus.
    const parsed = parseText(text);
    commitValue(parsed);
  }
};
// ---- scrub-on-drag (opt-in) ------------------------------------------------
// Uses POINTER CAPTURE on the input element itself (set on pointerdown) so the
// pointermove/pointerup keep firing on the same element through the whole drag,
// even when the pointer leaves the element — no document-level <listeners> (which
// would also avoid the React-effect `$event`-in-deps emitter edge). The handlers
// are bound directly on the <input> in the template, where `@event` passes a
// properly-typed `$event`.
const onScrubDown = (e: any) => {
  if (!allowScrub || disabled || readonly) return;
  scrubbing = true;
  scrubStartX = e && typeof e.clientX === 'number' ? e.clientX : 0;
  const cur = readValue();
  scrubStartValue = cur === null ? hasMin() ? min : 0 : cur;
  // Capture the pointer so move/up stay on this element for the whole drag.
  if (e && e.target && e.target.setPointerCapture && typeof e.pointerId === 'number') {
    try {
      e.target.setPointerCapture(e.pointerId);
    } catch {}
  }
};
const onScrubMove = (e: any) => {
  if (!scrubbing) return;
  const x = e && typeof e.clientX === 'number' ? e.clientX : 0;
  const dx = x - scrubStartX;
  const stepSize = typeof step === 'number' && step > 0 ? step : 1;
  // One step per 8px of horizontal travel.
  const delta = Math.round(dx / 8) * stepSize;
  commitValue(scrubStartValue + delta);
};
const onScrubUp = () => {
  scrubbing = false;
};

// ---- lifecycle + imperative handle -----------------------------------------
// focus() — move DOM focus to the input. DELIBERATELY overrides
// HTMLElement.focus on Lit (ROZ137 warn, accepted). increment()/decrement() —
// step once by `step`. clear() — set the value to null and clear the buffer.
export const focus = () => {
  const el = input;
  // NOTE: $refs.input types to the generic HTMLElement on the tsdown/vue leaves
  // (the emitter ref-type map has no `input` → HTMLInputElement entry), so we
  // only touch HTMLElement members here (`focus`). Text selection happens in the
  // onFocus handler, where `e.target` is `any` and `.select()` typechecks.
  if (el && el.focus) el.focus();
};
export const increment = () => stepBy(1, step);
export const decrement = () => stepBy(-1, step);
export const clear = () => {
  commitValue(null);
  text = '';
};

onMount(() => {
  // Seed the edit buffer so a programmatic focus shows the right text.
  const n = readValue();
  text = n === null ? '' : String(n);
  // Tear down any running repeat / scrub on unmount.
  return () => {
    stopHold();
    scrubbing = false;
  };
});
</script>

<div {...__rozieAttrs} class={["rozie-number-field", { 'rozie-number-field--disabled': disabled }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-ceb089aa><button type="button" class="rozie-number-field-btn rozie-number-field-btn--dec" tabindex="-1" aria-label="Decrement" disabled={!!disabled || !!readonly} onpointerdown={($event) => { startHold(-1); }} onpointerup={($event) => { stopHold(); }} onpointerleave={($event) => { stopHold(); }} data-rozie-s-ceb089aa>−</button><input bind:this={input} class="rozie-number-field-input" type="text" inputmode="decimal" autocomplete="off" role="spinbutton" value={displayText()} disabled={!!disabled} readonly={!!readonly} aria-label={ariaLabel} aria-valuemin={min} aria-valuemax={max} aria-valuenow={modelValue} aria-valuetext={rozieAttr(ariaText())} aria-disabled={!!disabled} oninput={($event) => { onInput($event); }} onfocus={($event) => { onFocus($event); }} onblur={($event) => { onBlur(); }} onkeydown={($event) => { onKeydown($event); }} onpointerdown={($event) => { onScrubDown($event); }} onpointermove={($event) => { onScrubMove($event); }} onpointerup={($event) => { onScrubUp(); }} data-rozie-s-ceb089aa /><button type="button" class="rozie-number-field-btn rozie-number-field-btn--inc" tabindex="-1" aria-label="Increment" disabled={!!disabled || !!readonly} onpointerdown={($event) => { startHold(1); }} onpointerup={($event) => { stopHold(); }} onpointerleave={($event) => { stopHold(); }} data-rozie-s-ceb089aa>+</button></div>

<style>
:global {
  .rozie-number-field[data-rozie-s-ceb089aa] {
    display: inline-flex;
    align-items: stretch;
    gap: var(--rozie-number-field-gap, 0);
    font: var(--rozie-number-field-font, inherit);
    border: var(--rozie-number-field-border-width, 1px) solid var(--rozie-number-field-border-color, rgba(0, 0, 0, 0.25));
    border-radius: var(--rozie-number-field-radius, 0.5rem);
    background: var(--rozie-number-field-bg, #fff);
    overflow: hidden;
  }
  .rozie-number-field-input[data-rozie-s-ceb089aa] {
    box-sizing: border-box;
    width: var(--rozie-number-field-width, 4.5rem);
    min-width: 0;
    padding: var(--rozie-number-field-padding, 0.375rem 0.5rem);
    text-align: var(--rozie-number-field-text-align, right);
    font: inherit;
    font-size: var(--rozie-number-field-font-size, 1rem);
    color: var(--rozie-number-field-color, inherit);
    background: transparent;
    border: none;
    outline: none;
  }
  .rozie-number-field-input[data-rozie-s-ceb089aa]:focus {
    box-shadow: inset 0 0 0 var(--rozie-number-field-focus-ring-width, 2px) var(--rozie-number-field-focus-ring-color, rgba(0, 102, 204, 0.35));
  }
  .rozie-number-field-btn[data-rozie-s-ceb089aa] {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--rozie-number-field-btn-size, 2rem);
    padding: 0;
    font-size: var(--rozie-number-field-btn-font-size, 1.1rem);
    line-height: 1;
    color: var(--rozie-number-field-btn-color, inherit);
    background: var(--rozie-number-field-btn-bg, rgba(0, 0, 0, 0.04));
    border: none;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.15s;
  }
  .rozie-number-field-btn[data-rozie-s-ceb089aa]:hover {
    background: var(--rozie-number-field-btn-hover-bg, rgba(0, 0, 0, 0.08));
  }
  .rozie-number-field-btn[data-rozie-s-ceb089aa]:disabled {
    cursor: not-allowed;
    opacity: var(--rozie-number-field-disabled-opacity, 0.55);
  }
  .rozie-number-field--disabled[data-rozie-s-ceb089aa] {
    cursor: not-allowed;
    opacity: var(--rozie-number-field-disabled-opacity, 0.55);
  }
}
</style>
