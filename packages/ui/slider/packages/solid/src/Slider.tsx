import type { JSX } from 'solid-js';
import { For, Show, createMemo, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, parseInlineStyle, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('Slider-4e6f0be6', `.rozie-slider[data-rozie-s-4e6f0be6] {
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
}`);

interface MarkSlotCtx { value: any; label: any; position: any; }

interface BubbleSlotCtx { value: any; }

interface SliderProps {
  /**
   * The current value (two-way `r-model`). A scalar number in single mode; a sorted `[lo, hi]` array in `range` mode, with each thumb neighbour-clamped so the pair stays sorted on every commit. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Slider **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Slider r-model:value="volume" :min="0" :max="100" :step="1" ariaLabel="Volume" />
   */
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
  /**
   * Switch to dual-thumb range mode: `value` becomes a sorted `[lo, hi]` array driven by two overlapping native inputs. The exact analog of listbox's `multiple` (scalar↔array). A bare attribute (`<Slider range>`) coerces to `true`.
   */
  range?: boolean;
  /**
   * The lower bound of the scale, forwarded to the native input as the `min` attribute (the browser derives `aria-valuemin` from it — not set by hand, per MDN slider-role guidance).
   */
  min?: number;
  /**
   * The upper bound of the scale, forwarded to the native input as the `max` attribute (the browser derives `aria-valuemax` from it — not set by hand, per MDN slider-role guidance).
   */
  max?: number;
  /**
   * The granularity of the scale, forwarded as the native `step` attribute; every write-back is quantized to it.
   */
  step?: number;
  /**
   * Layout orientation — `'horizontal'` (default) or `'vertical'`. Vertical rotates the wrapper `-90deg` so up = increase and sets `aria-orientation="vertical"` explicitly (a native range input always reports itself as horizontal even when visually rotated).
   */
  orientation?: string;
  /**
   * Disable the control — it becomes non-interactive and dimmed. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * Tick marks over the track — either a bare `value[]` (positions only) or a `{ value, label }[]` (positioned and labelled). Rendered as a decorative overlay above the track; override per-mark rendering via the `mark` scoped slot (`{ value, label, position }`).
   */
  marks?: any[];
  /**
   * Accessible name for each native input when there is no visible `<label for>`, reflected onto the input's `aria-label`.
   */
  ariaLabel?: (string) | null;
  /**
   * The jump applied on `PageUp` / `PageDown`. `null` falls back to `step × 10`. Applied by a thin `@keydown` augment so it honours this value (native browsers otherwise use their own large step); arrows / `Home` / `End` stay native.
   */
  pageStep?: (number) | null;
  /**
   * A `(value) => string` formatter for the value shown in the `bubble` slot and surfaced as `aria-valuetext`. Receives the numeric value and returns a string; `null` uses the raw value.
   */
  formatValue?: ((...args: unknown[]) => unknown) | null;
  /**
   * Render the value-bubble overlay (one bubble per thumb in range mode). Headless and opt-in — there is no default-styled bubble; supply the `bubble` slot to control its appearance.
   */
  showValue?: boolean;
  onChange?: (...args: unknown[]) => void;
  markSlot?: (ctx: MarkSlotCtx) => JSX.Element;
  bubbleSlot?: (ctx: BubbleSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: SliderHandle) => void;
}

export interface SliderHandle {
  focus: (...args: any[]) => any;
  increment: (...args: any[]) => any;
  decrement: (...args: any[]) => any;
}

export default function Slider(_props: SliderProps): JSX.Element {
  const _merged = mergeProps({ range: false, min: 0, max: 100, step: 1, orientation: 'horizontal', disabled: false, marks: (() => [])(), ariaLabel: null, pageStep: null, formatValue: null, showValue: false }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'range', 'min', 'max', 'step', 'orientation', 'disabled', 'marks', 'ariaLabel', 'pageStep', 'formatValue', 'showValue', 'ref']);
  onMount(() => { local.ref?.({ focus, increment, decrement }); });

  const [value, setValue] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'value', null);
  const fillStyle = createMemo(() => {
    let start, end;
    if (local.range) {
      const arr = Array.isArray(value()) && (value() as any).length === 2 ? value() : [local.min, local.max];
      start = pct(arr[0]);
      end = pct(arr[1]);
    } else {
      start = 0;
      end = pct(typeof value() === 'number' && Number.isFinite(value()) ? value() : local.min);
    }
    return {
      '--rozie-slider-fill-start': start + '%',
      '--rozie-slider-fill-end': end + '%'
    };
  });
  let inputElRef: HTMLElement | null = null;

  // ---- numeric helpers ---------------------------------------------------
  // A plain function (not `$computed`) so it reads uniformly across all six
  // targets — it is called from both the fill $computed and the keyboard augment.
  function pct(v: any) {
    const span = local.max - local.min;
    if (span === 0) return 0;
    const p = (v - local.min) / span * 100;
    if (p < 0) return 0;
    if (p > 100) return 100;
    return p;
  }

  // Clamp a raw number into [min,max] and quantize to `step` (guarding against a
  // non-finite or zero step). Returns a finite number bounded by the scale.
  function clampStep(raw: any) {
    if (!Number.isFinite(raw)) return local.min;
    let v = raw;
    if (v < local.min) v = local.min;
    if (v > local.max) v = local.max;
    const step$local = local.step;
    if (Number.isFinite(step$local) && step$local > 0) {
      const steps = Math.round((v - local.min) / step$local);
      v = local.min + steps * step$local;
      if (v < local.min) v = local.min;
      if (v > local.max) v = local.max;
    }
    return v;
  }

  // The current range pair, defaulting to the full span when `value` is not yet a
  // 2-tuple. Read into a stable local before destructuring — `$props.value`
  // lowers to a `value()` accessor on Solid, so narrowing one local is uniform.
  function rangePair() {
    const cur = value();
    if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
    return [local.min, local.max];
  }

  // The single (scalar) value, defaulting to min when not yet a number.
  function singleValue() {
    const cur = value();
    return typeof cur === 'number' && Number.isFinite(cur) ? cur : local.min;
  }

  // ---- derived fill (pure $computed → inline CSS vars, D-06/D-07) ---------
  // Read BARE in the template via :style="fillStyle". Returns the fill extent as a
  // % of the track. The rotate-90 vertical wrapper maps X→Y, so the SAME
  // start/end vars drive the (rotated) fill — no separate vertical math.

  // The marks list, normalised to { value, label } objects. A bare value[] entry
  // becomes { value, label: String(value) }. A plain function (not $computed) so
  // it reads uniformly and can be called in the r-for.
  function normalizedMarks() {
    const list = Array.isArray(local.marks) ? local.marks : [];
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
  }

  // Format a value for the bubble / aria-valuetext. A plain function: `$props.x`
  // reads uniformly inside it.
  function display(v: any) {
    if (local.formatValue !== null) return local.formatValue(v);
    return String(v);
  }

  // ---- write-back (single emit funnel) -----------------------------------
  // The SOLE `$emit('change')` site, called from every commit path so the React
  // prop-destructure for `onChange` hoists exactly once.
  function fireChange(value: any) {
    return _props.onChange?.({
      value
    });
  }

  // Single-mode commit: capture the fresh number, write the scalar, emit. Never
  // re-read $data after the write (ROZ138: React setState is async).
  function commitSingle(raw: any) {
    const v = clampStep(raw);
    setValue(v);
    fireChange(v);
  }

  // Range-mode commit: keep the [lo, hi] array SORTED and clamp each thumb at its
  // neighbour, then write a FRESH array (in-place mutation is dropped on
  // React/Solid/Lit/Angular change detectors — listbox precedent).
  function commitRange(which: any, raw: any) {
    const pair = rangePair();
    let lo = pair[0];
    let hi = pair[1];
    const v = clampStep(raw);
    if (which === 'lo') lo = Math.min(v, hi);else hi = Math.max(v, lo);
    const next = [lo, hi];
    setValue(next);
    fireChange(next);
  }

  // ---- native input handlers ---------------------------------------------
  // Single input. `valueAsNumber` is a number (never the string `.value`).
  function onInputSingle($event: any) {
    return commitSingle($event.target.valueAsNumber);
  }
  // Range inputs (lo / hi).
  function onInputLo($event: any) {
    return commitRange('lo', $event.target.valueAsNumber);
  }
  function onInputHi($event: any) {
    return commitRange('hi', $event.target.valueAsNumber);
  }

  // ---- PageUp / PageDown augment (Open Q1 / RESEARCH A3) ------------------
  // Native PageUp/PageDown uses the browser's default large step, which may not
  // equal `pageStep`. Augment ONLY those two keys: apply ±pageStep (null → step×10),
  // quantize + clamp via clampStep, write back. Arrows / Home / End stay native.
  function effectivePageStep() {
    const ps = local.pageStep;
    if (Number.isFinite(ps) && ps > 0) return ps;
    const step$local = Number.isFinite(local.step) && local.step > 0 ? local.step : 1;
    return step$local * 10;
  }
  function onKeyDownSingle($event: any) {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
    commitSingle(singleValue() + delta);
  }
  function onKeyDownRange(which: any, $event: any) {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
    const pair = rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    commitRange(which, base + delta);
  }

  // ---- imperative handle (D-05) ------------------------------------------
  // `focus` reads $refs in a post-mount callback (called via the handle) — safe,
  // never eager (ROZ123). It DELIBERATELY overrides HTMLElement.focus on Lit
  // (ROZ137 warns; accepted — see header).
  function focus() {
    return inputElRef?.focus();
  }

  // Step a thumb by ±step. In range mode `thumb` selects 'lo' | 'hi' (default 'lo').
  function increment(thumb: any) {
    if (local.range) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      commitRange(which, base + local.step);
    } else {
      commitSingle(singleValue() + local.step);
    }
  }
  function decrement(thumb: any) {
    if (local.range) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      commitRange(which, base - local.step);
    } else {
      commitSingle(singleValue() - local.step);
    }
  }

  // Shorthand keys (aliased `{ focus: fn }` keys are dropped by the React emitter)
  // — every function is named exactly as its verb. `focus` triggers the accepted
  // ROZ137 warn.

  return (
    <>
    <div style={parseInlineStyle(fillStyle())} {...attrs} class={"rozie-slider" + " " + rozieClass({ 'rozie-slider--vertical': local.orientation === 'vertical', 'rozie-slider--horizontal': local.orientation !== 'vertical', 'rozie-slider--range': local.range, 'rozie-slider--disabled': local.disabled }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-4e6f0be6="">
      
      <div class={"rozie-slider-track"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div class={"rozie-slider-fill"} data-rozie-s-4e6f0be6="" />
      </div>

      
      {<Show when={normalizedMarks().length > 0}><div class={"rozie-slider-marks"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        
        <For each={normalizedMarks()}>{(tick) => <div class={"rozie-slider-mark"} style={{ left: pct(tick.value) + '%' }} data-rozie-s-4e6f0be6="">
          {(_props.markSlot ?? _props.slots?.['mark'])?.({ value: tick.value, label: tick.label, position: pct(tick.value) }) ?? <span class={"rozie-slider-mark-label"} data-rozie-s-4e6f0be6="">{rozieDisplay(tick.label)}</span>}
        </div>}</For>
      </div></Show>}{<Show when={local.showValue && !local.range}><div class={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div class={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(_props.bubbleSlot ?? _props.slots?.['bubble'])?.({ value: singleValue() }) ?? <span class={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(singleValue()))}</span>}
        </div>
      </div></Show>}{<Show when={local.showValue && local.range}><div class={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div class={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-start)' }} data-rozie-s-4e6f0be6="">
          {(_props.bubbleSlot ?? _props.slots?.['bubble'])?.({ value: rangePair()[0] }) ?? <span class={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[0]))}</span>}
        </div>
        <div class={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(_props.bubbleSlot ?? _props.slots?.['bubble'])?.({ value: rangePair()[1] }) ?? <span class={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[1]))}</span>}
        </div>
      </div></Show>}{<Show when={!local.range}><input type="range" aria-label={local.ariaLabel} aria-orientation={rozieAttr(local.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(local.formatValue !== null ? display(singleValue()) : null)} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-slider-input"} min={local.min} max={local.max} step={local.step} value={singleValue()} disabled={!!local.disabled} onInput={($event) => { onInputSingle($event); }} onKeyDown={($event) => { onKeyDownSingle($event); }} data-rozie-s-4e6f0be6="" /></Show>}{<Show when={local.range}><input type="range" aria-label={local.ariaLabel} aria-orientation={rozieAttr(local.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(local.formatValue !== null ? display(rangePair()[0]) : null)} ref={(el) => { inputElRef = el as HTMLElement; }} class={"rozie-slider-input rozie-slider-input--lo"} min={local.min} max={local.max} step={local.step} value={rangePair()[0]} disabled={!!local.disabled} onInput={($event) => { onInputLo($event); }} onKeyDown={($event) => { onKeyDownRange('lo', $event); }} data-rozie-s-4e6f0be6="" /></Show>}{<Show when={local.range}><input type="range" aria-label={local.ariaLabel} aria-orientation={rozieAttr(local.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(local.formatValue !== null ? display(rangePair()[1]) : null)} class={"rozie-slider-input rozie-slider-input--hi"} min={local.min} max={local.max} step={local.step} value={rangePair()[1]} disabled={!!local.disabled} onInput={($event) => { onInputHi($event); }} onKeyDown={($event) => { onKeyDownRange('hi', $event); }} data-rozie-s-4e6f0be6="" /></Show>}</div>
    </>
  );
}
