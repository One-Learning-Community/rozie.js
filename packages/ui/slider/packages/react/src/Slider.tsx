import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Slider.css';

interface MarkCtx { value: any; label: any; position: any; }

interface BubbleCtx { value: any; }

interface SliderProps {
  /**
   * The current value (two-way `r-model`). A scalar number in single mode; a sorted `[lo, hi]` array in `range` mode, with each thumb neighbour-clamped so the pair stays sorted on every commit. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a Slider **is** a form control (`[(ngModel)]` / `[formControl]` bind directly).
   * @example
   * <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={1} ariaLabel="Volume" />
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
  formatValue?: ((...args: any[]) => any) | null;
  /**
   * Render the value-bubble overlay (one bubble per thumb in range mode). Headless and opt-in — there is no default-styled bubble; supply the `bubble` slot to control its appearance.
   */
  showValue?: boolean;
  onChange?: (...args: any[]) => void;
  renderMark?: (ctx: MarkCtx) => ReactNode;
  renderBubble?: (ctx: BubbleCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface SliderHandle {
  focus: (...args: any[]) => any;
  increment: (...args: any[]) => any;
  decrement: (...args: any[]) => any;
}

const Slider = forwardRef<SliderHandle, SliderProps>(function Slider(_props: SliderProps, ref): JSX.Element {
  const __defaultMarks = useState(() => (() => [])())[0];
  const props: Omit<SliderProps, 'range' | 'min' | 'max' | 'step' | 'orientation' | 'disabled' | 'marks' | 'ariaLabel' | 'pageStep' | 'formatValue' | 'showValue'> & { range: boolean; min: number; max: number; step: number; orientation: string; disabled: boolean; marks: any[]; ariaLabel: (string) | null; pageStep: (number) | null; formatValue: ((...args: any[]) => any) | null; showValue: boolean } = {
    ..._props,
    range: _props.range ?? false,
    min: _props.min ?? 0,
    max: _props.max ?? 100,
    step: _props.step ?? 1,
    orientation: _props.orientation ?? 'horizontal',
    disabled: _props.disabled ?? false,
    marks: _props.marks ?? __defaultMarks,
    ariaLabel: _props.ariaLabel ?? null,
    pageStep: _props.pageStep ?? null,
    formatValue: _props.formatValue ?? null,
    showValue: _props.showValue ?? false,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, range, min, max, step, orientation, disabled, marks, ariaLabel, pageStep, formatValue, showValue, defaultValue, onValueChange, onChange, ...rest } = _props as SliderProps & Record<string, unknown>;
    void value; void range; void min; void max; void step; void orientation; void disabled; void marks; void ariaLabel; void pageStep; void formatValue; void showValue; void defaultValue; void onValueChange; void onChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? null,
    onValueChange: props.onValueChange,
  });
  const inputEl = useRef<HTMLInputElement | null>(null);
  const fillStyle = useMemo(() => {
    let start, end;
    if (props.range) {
      const arr = Array.isArray(value) && value.length === 2 ? value : [props.min, props.max];
      start = pct(arr[0]);
      end = pct(arr[1]);
    } else {
      start = 0;
      end = pct(typeof value === 'number' && Number.isFinite(value) ? value : props.min);
    }
    return {
      '--rozie-slider-fill-start': start + '%',
      '--rozie-slider-fill-end': end + '%'
    };
  }, [Array, Number, pct, props.max, props.min, props.range, value]);

  // ---- numeric helpers ---------------------------------------------------
  // A plain function (not `$computed`) so it reads uniformly across all six
  // targets — it is called from both the fill $computed and the keyboard augment.
  function pct(v: any) {
    const span = props.max - props.min;
    if (span === 0) return 0;
    const p = (v - props.min) / span * 100;
    if (p < 0) return 0;
    if (p > 100) return 100;
    return p;
  }

  // Clamp a raw number into [min,max] and quantize to `step` (guarding against a
  // non-finite or zero step). Returns a finite number bounded by the scale.
  function clampStep(raw: any) {
    if (!Number.isFinite(raw)) return props.min;
    let v = raw;
    if (v < props.min) v = props.min;
    if (v > props.max) v = props.max;
    const step = props.step;
    if (Number.isFinite(step) && step > 0) {
      const steps = Math.round((v - props.min) / step);
      v = props.min + steps * step;
      if (v < props.min) v = props.min;
      if (v > props.max) v = props.max;
    }
    return v;
  }

  // The current range pair, defaulting to the full span when `value` is not yet a
  // 2-tuple. Read into a stable local before destructuring — `$props.value`
  // lowers to a `value()` accessor on Solid, so narrowing one local is uniform.
  function rangePair() {
    const cur = value;
    if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
    return [props.min, props.max];
  }

  // The single (scalar) value, defaulting to min when not yet a number.
  function singleValue() {
    const cur = value;
    return typeof cur === 'number' && Number.isFinite(cur) ? cur : props.min;
  }

  // ---- derived fill (pure $computed → inline CSS vars, D-06/D-07) ---------
  // Read BARE in the template via :style="fillStyle". Returns the fill extent as a
  // % of the track. The rotate-90 vertical wrapper maps X→Y, so the SAME
  // start/end vars drive the (rotated) fill — no separate vertical math.
  // The marks list, normalised to { value, label } objects. A bare value[] entry
  // becomes { value, label: String(value) }. A plain function (not $computed) so
  // it reads uniformly and can be called in the r-for.
  function normalizedMarks() {
    const list = Array.isArray(props.marks) ? props.marks : [];
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
    if (props.formatValue !== null) return props.formatValue(v);
    return String(v);
  }

  // ---- write-back (single emit funnel) -----------------------------------
  // The SOLE `$emit('change')` site, called from every commit path so the React
  // prop-destructure for `onChange` hoists exactly once.
  function fireChange(value: any) {
    return props.onChange && props.onChange({
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
  const onInputSingle = useCallback(($event: any) => commitSingle($event.target.valueAsNumber), [commitSingle]);
  // Range inputs (lo / hi).
  const onInputLo = useCallback(($event: any) => commitRange('lo', $event.target.valueAsNumber), [commitRange]);
  const onInputHi = useCallback(($event: any) => commitRange('hi', $event.target.valueAsNumber), [commitRange]);
  // ---- PageUp / PageDown augment (Open Q1 / RESEARCH A3) ------------------
  // Native PageUp/PageDown uses the browser's default large step, which may not
  // equal `pageStep`. Augment ONLY those two keys: apply ±pageStep (null → step×10),
  // quantize + clamp via clampStep, write back. Arrows / Home / End stay native.
  function effectivePageStep() {
    const ps = props.pageStep;
    if (Number.isFinite(ps) && ps > 0) return ps;
    const step = Number.isFinite(props.step) && props.step > 0 ? props.step : 1;
    return step * 10;
  }
  const onKeyDownSingle = useCallback(($event: any) => {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
    commitSingle(singleValue() + delta);
  }, [commitSingle, effectivePageStep, singleValue]);
  const onKeyDownRange = useCallback((which: any, $event: any) => {
    const key = $event.key;
    if (key !== 'PageUp' && key !== 'PageDown') return;
    $event.preventDefault();
    const delta = key === 'PageUp' ? effectivePageStep() : -effectivePageStep();
    const pair = rangePair();
    const base = which === 'lo' ? pair[0] : pair[1];
    commitRange(which, base + delta);
  }, [commitRange, effectivePageStep, rangePair]);
  // ---- imperative handle (D-05) ------------------------------------------
  // `focus` reads $refs in a post-mount callback (called via the handle) — safe,
  // never eager (ROZ123). It DELIBERATELY overrides HTMLElement.focus on Lit
  // (ROZ137 warns; accepted — see header).
  function focus() {
    return inputEl.current?.focus();
  }

  // Step a thumb by ±step. In range mode `thumb` selects 'lo' | 'hi' (default 'lo').
  function increment(thumb: any) {
    if (props.range) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      commitRange(which, base + props.step);
    } else {
      commitSingle(singleValue() + props.step);
    }
  }
  function decrement(thumb: any) {
    if (props.range) {
      const which = thumb === 'hi' ? 'hi' : 'lo';
      const pair = rangePair();
      const base = which === 'lo' ? pair[0] : pair[1];
      commitRange(which, base - props.step);
    } else {
      commitSingle(singleValue() - props.step);
    }
  }

  // Shorthand keys (aliased `{ focus: fn }` keys are dropped by the React emitter)
  // — every function is named exactly as its verb. `focus` triggers the accepted
  // ROZ137 warn.

  const _rozieExposeRef = useRef({ focus, increment, decrement });
  _rozieExposeRef.current = { focus, increment, decrement };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), increment: (...args: Parameters<typeof increment>): ReturnType<typeof increment> => _rozieExposeRef.current.increment(...args), decrement: (...args: Parameters<typeof decrement>): ReturnType<typeof decrement> => _rozieExposeRef.current.decrement(...args) }), []);

  return (
    <>
    <div style={parseInlineStyle(fillStyle)} {...attrs} className={clsx(clsx("rozie-slider", { "rozie-slider--vertical": props.orientation === 'vertical', "rozie-slider--horizontal": props.orientation !== 'vertical', "rozie-slider--range": props.range, "rozie-slider--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-4e6f0be6="">
      
      <div className={"rozie-slider-track"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-fill"} data-rozie-s-4e6f0be6="" />
      </div>

      
      {!!(normalizedMarks().length > 0) && <div className={"rozie-slider-marks"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        
        {normalizedMarks().map((mark) => <div key={mark.value} className={"rozie-slider-mark"} style={{ left: pct(mark.value) + '%' }} data-rozie-s-4e6f0be6="">
          {(props.renderMark ?? props.slots?.['mark']) ? ((props.renderMark ?? props.slots?.['mark']) as Function)({ value: mark.value, label: mark.label, position: pct(mark.value) }) : <span className={"rozie-slider-mark-label"} data-rozie-s-4e6f0be6="">{rozieDisplay(mark.label)}</span>}
        </div>)}
      </div>}{!!(props.showValue && !props.range) && <div className={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: singleValue() }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(singleValue()))}</span>}
        </div>
      </div>}{!!(props.showValue && props.range) && <div className={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-start)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: rangePair()[0] }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[0]))}</span>}
        </div>
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: rangePair()[1] }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[1]))}</span>}
        </div>
      </div>}{!!(!props.range) && <input ref={inputEl} className={"rozie-slider-input"} type="range" min={props.min} max={props.max} step={props.step} value={singleValue()} disabled={!!props.disabled} aria-label={rozieAttr(props.ariaLabel)} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(singleValue()) : undefined)} onInput={($event) => { onInputSingle($event); }} onKeyDown={($event) => { onKeyDownSingle($event); }} data-rozie-s-4e6f0be6="" />}{!!(props.range) && <input ref={inputEl} className={"rozie-slider-input rozie-slider-input--lo"} type="range" min={props.min} max={props.max} step={props.step} value={rangePair()[0]} disabled={!!props.disabled} aria-label={rozieAttr(props.ariaLabel)} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(rangePair()[0]) : undefined)} onInput={($event) => { onInputLo($event); }} onKeyDown={($event) => { onKeyDownRange('lo', $event); }} data-rozie-s-4e6f0be6="" />}{!!(props.range) && <input className={"rozie-slider-input rozie-slider-input--hi"} type="range" min={props.min} max={props.max} step={props.step} value={rangePair()[1]} disabled={!!props.disabled} aria-label={rozieAttr(props.ariaLabel)} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(rangePair()[1]) : undefined)} onInput={($event) => { onInputHi($event); }} onKeyDown={($event) => { onKeyDownRange('hi', $event); }} data-rozie-s-4e6f0be6="" />}</div>
    </>
  );
});
export default Slider;
