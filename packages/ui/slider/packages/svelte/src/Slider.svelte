<script lang="ts">
import { applyListeners, rozieAttr, rozieDisplay } from '@rozie/runtime-svelte';

import type { Snippet } from 'svelte';

interface Props {
  value?: (unknown) | null;
  range?: boolean;
  min?: number;
  max?: number;
  step?: number;
  orientation?: string;
  disabled?: boolean;
  marks?: any[];
  ariaLabel?: (string) | null;
  pageStep?: (number) | null;
  formatValue?: ((...args: any[]) => any) | null;
  showValue?: boolean;
  mark?: Snippet<[{ value: any; label: any; position: any }]>;
  bubble?: Snippet<[{ value: any }]>;
  snippets?: Record<string, any>;
  onchange?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultMarks = (() => [])();

let {
  value = $bindable(null),
  range = false,
  min = 0,
  max = 100,
  step = 1,
  orientation = 'horizontal',
  disabled = false,
  marks = __defaultMarks,
  ariaLabel = null,
  pageStep = null,
  formatValue = null,
  showValue = false,
  mark: __markProp,
  bubble: __bubbleProp,
  snippets,
  onchange,
  ...__rozieAttrs
}: Props = $props();

const mark = $derived(__markProp ?? snippets?.mark);
const bubble = $derived(__bubbleProp ?? snippets?.bubble);

let inputEl = $state<HTMLInputElement | undefined>(undefined);

// ---- numeric helpers ---------------------------------------------------
// A plain function (not `$computed`) so it reads uniformly across all six
// targets — it is called from both the fill $computed and the keyboard augment.
const pct = (v: any) => {
  const span = max - min;
  if (span === 0) return 0;
  const p = (v - min) / span * 100;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
};

// Clamp a raw number into [min,max] and quantize to `step` (guarding against a
// non-finite or zero step). Returns a finite number bounded by the scale.
// Clamp a raw number into [min,max] and quantize to `step` (guarding against a
// non-finite or zero step). Returns a finite number bounded by the scale.
const clampStep = (raw: any) => {
  if (!Number.isFinite(raw)) return min;
  let v = raw;
  if (v < min) v = min;
  if (v > max) v = max;
  const step$local = step;
  if (Number.isFinite(step$local) && step$local > 0) {
    const steps = Math.round((v - min) / step$local);
    v = min + steps * step$local;
    if (v < min) v = min;
    if (v > max) v = max;
  }
  return v;
};

// The current range pair, defaulting to the full span when `value` is not yet a
// 2-tuple. Read into a stable local before destructuring — `$props.value`
// lowers to a `value()` accessor on Solid, so narrowing one local is uniform.
// The current range pair, defaulting to the full span when `value` is not yet a
// 2-tuple. Read into a stable local before destructuring — `$props.value`
// lowers to a `value()` accessor on Solid, so narrowing one local is uniform.
const rangePair = () => {
  const cur = value;
  if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
  return [min, max];
};

// The single (scalar) value, defaulting to min when not yet a number.
// The single (scalar) value, defaulting to min when not yet a number.
const singleValue = () => {
  const cur = value;
  return typeof cur === 'number' && Number.isFinite(cur) ? cur : min;
};

// ---- derived fill (pure $computed → inline CSS vars, D-06/D-07) ---------
// Read BARE in the template via :style="fillStyle". Returns the fill extent as a
// % of the track. The rotate-90 vertical wrapper maps X→Y, so the SAME
// start/end vars drive the (rotated) fill — no separate vertical math.
// The marks list, normalised to { value, label } objects. A bare value[] entry
// becomes { value, label: String(value) }. A plain function (not $computed) so
// it reads uniformly and can be called in the r-for.
const normalizedMarks = () => {
  const list = Array.isArray(marks) ? marks : [];
  return list.map((m: any) => {
    if (m !== null && typeof m === 'object' && 'value' in m) {
      return {
        value: m.value,
        label: 'label' in m && m.label != null ? m.label : String(m.value)
      };
    }
    return {
      value: m,
      label: String(m)
    };
  });
};

// Format a value for the bubble / aria-valuetext. A plain function: `$props.x`
// reads uniformly inside it.
// Format a value for the bubble / aria-valuetext. A plain function: `$props.x`
// reads uniformly inside it.
const display = (v: any) => {
  if (formatValue !== null) return formatValue(v);
  return String(v);
};

// ---- write-back (single emit funnel) -----------------------------------
// The SOLE `$emit('change')` site, called from every commit path so the React
// prop-destructure for `onChange` hoists exactly once.
// ---- write-back (single emit funnel) -----------------------------------
// The SOLE `$emit('change')` site, called from every commit path so the React
// prop-destructure for `onChange` hoists exactly once.
const fireChange = (value: any) => onchange?.({
  value
});

// Single-mode commit: capture the fresh number, write the scalar, emit. Never
// re-read $data after the write (ROZ138: React setState is async).
// Single-mode commit: capture the fresh number, write the scalar, emit. Never
// re-read $data after the write (ROZ138: React setState is async).
const commitSingle = (raw: any) => {
  const v = clampStep(raw);
  value = v;
  fireChange(v);
};

// Range-mode commit: keep the [lo, hi] array SORTED and clamp each thumb at its
// neighbour, then write a FRESH array (in-place mutation is dropped on
// React/Solid/Lit/Angular change detectors — listbox precedent).
// Range-mode commit: keep the [lo, hi] array SORTED and clamp each thumb at its
// neighbour, then write a FRESH array (in-place mutation is dropped on
// React/Solid/Lit/Angular change detectors — listbox precedent).
const commitRange = (which: any, raw: any) => {
  const pair = rangePair();
  let lo = pair[0];
  let hi = pair[1];
  const v = clampStep(raw);
  if (which === 'lo') lo = Math.min(v, hi);else hi = Math.max(v, lo);
  const next = [lo, hi];
  value = next;
  fireChange(next);
};

// ---- native input handlers ---------------------------------------------
// Single input. `valueAsNumber` is a number (never the string `.value`).
// ---- native input handlers ---------------------------------------------
// Single input. `valueAsNumber` is a number (never the string `.value`).
const onInputSingle = ($event: any) => commitSingle($event.target.valueAsNumber);
// Range inputs (lo / hi).
// Range inputs (lo / hi).
const onInputLo = ($event: any) => commitRange('lo', $event.target.valueAsNumber);
const onInputHi = ($event: any) => commitRange('hi', $event.target.valueAsNumber);

// ---- PageUp / PageDown augment (Open Q1 / RESEARCH A3) ------------------
// Native PageUp/PageDown uses the browser's default large step, which may not
// equal `pageStep`. Augment ONLY those two keys: apply ±pageStep (null → step×10),
// quantize + clamp via clampStep, write back. Arrows / Home / End stay native.
// ---- PageUp / PageDown augment (Open Q1 / RESEARCH A3) ------------------
// Native PageUp/PageDown uses the browser's default large step, which may not
// equal `pageStep`. Augment ONLY those two keys: apply ±pageStep (null → step×10),
// quantize + clamp via clampStep, write back. Arrows / Home / End stay native.
const effectivePageStep = () => {
  const ps = pageStep;
  if (Number.isFinite(ps) && ps > 0) return ps;
  const step$local = Number.isFinite(step) && step > 0 ? step : 1;
  return step$local * 10;
};
const onKeyDownSingle = ($event: any) => {
  const key = $event.key;
  if (key !== 'PageUp' && key !== 'PageDown') return;
  $event.preventDefault();
  const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
  commitSingle(singleValue() + delta);
};
const onKeyDownRange = (which: any, $event: any) => {
  const key = $event.key;
  if (key !== 'PageUp' && key !== 'PageDown') return;
  $event.preventDefault();
  const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
  const pair = rangePair();
  const base = which === 'lo' ? pair[0] : pair[1];
  commitRange(which, base + delta);
};

// ---- imperative handle (D-05) ------------------------------------------
// `focus` reads $refs in a post-mount callback (called via the handle) — safe,
// never eager (ROZ123). It DELIBERATELY overrides HTMLElement.focus on Lit
// (ROZ137 warns; accepted — see header).
// ---- imperative handle (D-05) ------------------------------------------
// `focus` reads $refs in a post-mount callback (called via the handle) — safe,
// never eager (ROZ123). It DELIBERATELY overrides HTMLElement.focus on Lit
// (ROZ137 warns; accepted — see header).
export const focus = () => inputEl?.focus();

// Step a thumb by ±step. In range mode `thumb` selects 'lo' | 'hi' (default 'lo').
// Step a thumb by ±step. In range mode `thumb` selects 'lo' | 'hi' (default 'lo').
export const increment = (thumb: any) => {
  if (range) {
    const which = thumb === 'hi' ? 'hi' : 'lo';
    const pair = rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    commitRange(which, base + step);
  } else {
    commitSingle(singleValue() + step);
  }
};
export const decrement = (thumb: any) => {
  if (range) {
    const which = thumb === 'hi' ? 'hi' : 'lo';
    const pair = rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    commitRange(which, base - step);
  } else {
    commitSingle(singleValue() - step);
  }
};

// Shorthand keys (aliased `{ focus: fn }` keys are dropped by the React emitter)
// — every function is named exactly as its verb. `focus` triggers the accepted
// ROZ137 warn.

const fillStyle = $derived.by(() => {
  let start, end;
  if (range) {
    const arr = Array.isArray(value) && value.length === 2 ? value : [min, max];
    start = pct(arr[0]);
    end = pct(arr[1]);
  } else {
    start = 0;
    end = pct(typeof value === 'number' && Number.isFinite(value) ? value : min);
  }
  return {
    '--rozie-slider-fill-start': start + '%',
    '--rozie-slider-fill-end': end + '%'
  };
});
</script>

<div style={fillStyle} {...__rozieAttrs} class={["rozie-slider", { 'rozie-slider--vertical': orientation === 'vertical', 'rozie-slider--horizontal': orientation !== 'vertical', 'rozie-slider--range': range, 'rozie-slider--disabled': disabled }, (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-4e6f0be6><div class="rozie-slider-track" aria-hidden="true" data-rozie-s-4e6f0be6><div class="rozie-slider-fill" data-rozie-s-4e6f0be6></div></div>{#if normalizedMarks().length > 0}<div class="rozie-slider-marks" aria-hidden="true" data-rozie-s-4e6f0be6>{#each normalizedMarks() as tick (tick.value)}<div class="rozie-slider-mark" style:left={pct(tick.value) + '%'} data-rozie-s-4e6f0be6>{#if mark}{@render mark({ value: tick.value, label: tick.label, position: pct(tick.value) })}{:else}<span class="rozie-slider-mark-label" data-rozie-s-4e6f0be6>{rozieDisplay(tick.label)}</span>{/if}</div>{/each}</div>{/if}{#if showValue && !range}<div class="rozie-slider-bubbles" aria-hidden="true" data-rozie-s-4e6f0be6><div class="rozie-slider-bubble" style:left={'var(--rozie-slider-fill-end)'} data-rozie-s-4e6f0be6>{#if bubble}{@render bubble({ value: singleValue() })}{:else}<span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>{rozieDisplay(display(singleValue()))}</span>{/if}</div></div>{/if}{#if showValue && range}<div class="rozie-slider-bubbles" aria-hidden="true" data-rozie-s-4e6f0be6><div class="rozie-slider-bubble" style:left={'var(--rozie-slider-fill-start)'} data-rozie-s-4e6f0be6>{#if bubble}{@render bubble({ value: rangePair()[0] })}{:else}<span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>{rozieDisplay(display(rangePair()[0]))}</span>{/if}</div><div class="rozie-slider-bubble" style:left={'var(--rozie-slider-fill-end)'} data-rozie-s-4e6f0be6>{#if bubble}{@render bubble({ value: rangePair()[1] })}{:else}<span class="rozie-slider-bubble-text" data-rozie-s-4e6f0be6>{rozieDisplay(display(rangePair()[1]))}</span>{/if}</div></div>{/if}{#if !range}<input bind:this={inputEl} class="rozie-slider-input" type="range" min={min} max={max} step={step} value={singleValue()} disabled={!!disabled} aria-label={ariaLabel} aria-orientation={rozieAttr(orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(formatValue !== null ? display(singleValue()) : null)} oninput={($event) => { onInputSingle($event); }} onkeydown={($event) => { onKeyDownSingle($event); }} data-rozie-s-4e6f0be6 />{/if}{#if range}<input bind:this={inputEl} class="rozie-slider-input rozie-slider-input--lo" type="range" min={min} max={max} step={step} value={rangePair()[0]} disabled={!!disabled} aria-label={ariaLabel} aria-orientation={rozieAttr(orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(formatValue !== null ? display(rangePair()[0]) : null)} oninput={($event) => { onInputLo($event); }} onkeydown={($event) => { onKeyDownRange('lo', $event); }} data-rozie-s-4e6f0be6 />{/if}{#if range}<input class="rozie-slider-input rozie-slider-input--hi" type="range" min={min} max={max} step={step} value={rangePair()[1]} disabled={!!disabled} aria-label={ariaLabel} aria-orientation={rozieAttr(orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(formatValue !== null ? display(rangePair()[1]) : null)} oninput={($event) => { onInputHi($event); }} onkeydown={($event) => { onKeyDownRange('hi', $event); }} data-rozie-s-4e6f0be6 />{/if}</div>

<style>
:global {
  .rozie-slider[data-rozie-s-4e6f0be6] {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-height: var(--rozie-slider-thumb-size, 1rem);
    padding: var(--rozie-slider-pad, 0.5rem 0);
    font: var(--rozie-slider-font, inherit);
  }
  .rozie-slider-track[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    height: var(--rozie-slider-track-height, 0.375rem);
    border-radius: var(--rozie-slider-track-radius, 999px);
    background: var(--rozie-slider-track-bg, rgba(0, 0, 0, 0.18));
    pointer-events: none;
  }
  .rozie-slider-fill[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--rozie-slider-fill-start, 0%);
    right: calc(100% - var(--rozie-slider-fill-end, 0%));
    border-radius: inherit;
    background: var(--rozie-slider-fill-bg, var(--rozie-slider-accent, #0066cc));
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6] {
    -webkit-appearance: none;
    appearance: none;
    position: absolute;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    width: 100%;
    height: var(--rozie-slider-thumb-size, 1rem);
    margin: 0;
    background: none;
    pointer-events: none;
    cursor: pointer;
    accent-color: var(--rozie-slider-accent, #0066cc);
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6]:focus { outline: none; z-index: 2; }
  .rozie-slider--range[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] { pointer-events: none; }
  .rozie-slider--disabled[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] { cursor: not-allowed; }
  .rozie-slider--disabled[data-rozie-s-4e6f0be6] { opacity: var(--rozie-slider-disabled-opacity, 0.55); }
  .rozie-slider-input[data-rozie-s-4e6f0be6]::-webkit-slider-runnable-track {
    background: none;
    height: var(--rozie-slider-track-height, 0.375rem);
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-track {
    background: none;
    height: var(--rozie-slider-track-height, 0.375rem);
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-progress {
    background: none;
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    pointer-events: auto;
    width: var(--rozie-slider-thumb-size, 1rem);
    height: var(--rozie-slider-thumb-size, 1rem);
    border: var(--rozie-slider-thumb-border, 2px solid #fff);
    border-radius: 50%;
    background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
    box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
    margin-top: var(--rozie-slider-thumb-offset, calc((0.375rem - 1rem) / 2));
    cursor: pointer;
  }
  .rozie-slider-input[data-rozie-s-4e6f0be6]::-moz-range-thumb {
    pointer-events: auto;
    width: var(--rozie-slider-thumb-size, 1rem);
    height: var(--rozie-slider-thumb-size, 1rem);
    border: var(--rozie-slider-thumb-border, 2px solid #fff);
    border-radius: 50%;
    background: var(--rozie-slider-thumb-bg, var(--rozie-slider-accent, #0066cc));
    box-shadow: var(--rozie-slider-thumb-shadow, 0 1px 3px rgba(0, 0, 0, 0.3));
    cursor: pointer;
  }
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] {
    width: var(--rozie-slider-thickness, 2.5rem);
    height: var(--rozie-slider-length, 12rem);
    padding: 0;
  }
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-track[data-rozie-s-4e6f0be6],
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-input[data-rozie-s-4e6f0be6] {
    top: 50%;
    left: 50%;
    width: var(--rozie-slider-length, 12rem);
    transform: translate(-50%, -50%) rotate(-90deg);
    transform-origin: center center;
  }
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-fill[data-rozie-s-4e6f0be6] {
    /* The fill still spans start→end along the (now rotated) input axis. */
  }
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-marks[data-rozie-s-4e6f0be6],
  .rozie-slider--vertical[data-rozie-s-4e6f0be6] .rozie-slider-bubbles[data-rozie-s-4e6f0be6] {
    /* Overlays follow the rotated axis; left:%-of-length maps to the visual Y. */
    top: 50%;
    left: 50%;
    width: var(--rozie-slider-length, 12rem);
    transform: translate(-50%, -50%) rotate(-90deg);
    transform-origin: center center;
  }
  .rozie-slider-marks[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 0;
    pointer-events: none;
  }
  .rozie-slider-mark[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: 0;
    transform: translateX(-50%);
    color: var(--rozie-slider-mark-color, rgba(0, 0, 0, 0.55));
  }
  .rozie-slider-mark-label[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: var(--rozie-slider-mark-offset, 0.75rem);
    left: 50%;
    transform: translateX(-50%);
    font-size: var(--rozie-slider-mark-font-size, 0.6875rem);
    white-space: nowrap;
  }
  .rozie-slider-bubbles[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 0;
    pointer-events: none;
  }
  .rozie-slider-bubble[data-rozie-s-4e6f0be6] {
    position: absolute;
    top: var(--rozie-slider-bubble-offset, -1.25rem);
    transform: translateX(-50%);
  }
  .rozie-slider-bubble-text[data-rozie-s-4e6f0be6] {
    display: inline-block;
    padding: var(--rozie-slider-bubble-padding, 0.0625rem 0.375rem);
    font-size: var(--rozie-slider-bubble-font-size, 0.6875rem);
    color: var(--rozie-slider-bubble-fg, #fff);
    background: var(--rozie-slider-bubble-bg, var(--rozie-slider-accent, #0066cc));
    border-radius: var(--rozie-slider-bubble-radius, 4px);
    white-space: nowrap;
  }
}
</style>
