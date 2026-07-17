import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, rozieAttr, useControllableState } from '@rozie/runtime-react';
import './NumberField.css';

interface NumberFieldProps {
  /**
   * The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit.
   * @example
   * <NumberField r-model:modelValue="qty" :min="0" :max="10" />
   */
  modelValue?: (number) | null;
  defaultModelValue?: (number) | null;
  onModelValueChange?: (modelValue: (number) | null) => void;
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
  formatOptions?: Record<string, any>;
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
  onChange?: (...args: any[]) => void;
}

export interface NumberFieldHandle {
  focus: (...args: any[]) => any;
  increment: (...args: any[]) => any;
  decrement: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const NumberField = forwardRef<NumberFieldHandle, NumberFieldProps>(function NumberField(_props: NumberFieldProps, ref): JSX.Element {
  const __defaultFormatOptions = useState(() => (() => ({}))())[0];
  const props: Omit<NumberFieldProps, 'min' | 'max' | 'step' | 'largeStep' | 'formatOptions' | 'allowScrub' | 'disabled' | 'readonly' | 'ariaLabel'> & { min: (number) | null; max: (number) | null; step: number; largeStep: number; formatOptions: Record<string, any>; allowScrub: boolean; disabled: boolean; readonly: boolean; ariaLabel: (string) | null } = {
    ..._props,
    min: _props.min ?? null,
    max: _props.max ?? null,
    step: _props.step ?? 1,
    largeStep: _props.largeStep ?? 10,
    formatOptions: _props.formatOptions ?? __defaultFormatOptions,
    allowScrub: _props.allowScrub ?? false,
    disabled: _props.disabled ?? false,
    readonly: _props.readonly ?? false,
    ariaLabel: _props.ariaLabel ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { modelValue, min, max, step, largeStep, formatOptions, allowScrub, disabled, readonly, ariaLabel, defaultValue, onModelValueChange, defaultModelValue, ...rest } = _props as NumberFieldProps & Record<string, unknown>;
    void modelValue; void min; void max; void step; void largeStep; void formatOptions; void allowScrub; void disabled; void readonly; void ariaLabel; void defaultValue; void onModelValueChange; void defaultModelValue;
    return rest;
  })();
  const scrubbing = useRef(false);
  const holdTimer = useRef<any>(null);
  const holdInterval = useRef(0);
  const scrubStartX = useRef(0);
  const scrubStartValue = useRef(0);
  const [modelValue, setModelValue] = useControllableState({
    value: props.modelValue,
    defaultValue: props.defaultModelValue ?? null,
    onValueChange: props.onModelValueChange,
  });
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);

  const readValue = useCallback(() => {
    const v = modelValue;
    return typeof v === 'number' && !Number.isNaN(v) ? v : null;
  }, [modelValue]);
  function hasMin() {
    return typeof props.min === 'number' && !Number.isNaN(props.min);
  }
  function hasMax() {
    return typeof props.max === 'number' && !Number.isNaN(props.max);
  }
  function clampValue(n: any) {
    let out = n;
    if (hasMin() && out < props.min) out = props.min;
    if (hasMax() && out > props.max) out = props.max;
    return out;
  }
  function snapValue(n: any) {
    const stepSize = typeof props.step === 'number' && props.step > 0 ? props.step : 1;
    const base = hasMin() ? props.min : 0;
    const snapped = base + Math.round((n - base) / stepSize) * stepSize;
    // Avoid binary-float drift (e.g. 0.1 + 0.2) by rounding to step precision.
    const decimals = (String(stepSize).split('.')[1] || '').length;
    return decimals > 0 ? Number(snapped.toFixed(decimals)) : snapped;
  }
  function formatter() {
    try {
      return new Intl.NumberFormat(undefined, props.formatOptions || {});
    } catch {
      return new Intl.NumberFormat();
    }
  }
  function formatted() {
    const n = readValue();
    return n === null ? '' : formatter().format(n);
  }
  function parseText(raw: any) {
    if (raw == null) return null;
    const s = String(raw).trim();
    if (s === '') return null;
    const cleaned = s.replace(/[^0-9eE+\-.,]/g, '').replace(/,/g, '');
    const n = Number.parseFloat(cleaned);
    return Number.isNaN(n) ? null : n;
  }
  function displayText() {
    return focused ? text : formatted();
  }
  function ariaText() {
    const n = readValue();
    return n === null ? '' : formatted();
  }
  function commitValue(n: any) {
    let next = n;
    if (next !== null) {
      next = snapValue(next);
      next = clampValue(next);
    }
    setModelValue(next);
    // Keep the edit buffer in sync so a focused field reflects a programmatic step.
    setText(next === null ? '' : String(next));
    props.onChange && props.onChange({
      value: next
    });
  }
  function stepBy(dir: any, size: any) {
    if (props.disabled || props.readonly) return;
    const cur = readValue();
    const stepSize = typeof size === 'number' ? size : typeof props.step === 'number' ? props.step : 1;
    const base = cur === null ? hasMin() ? props.min : 0 : cur;
    commitValue(base + dir * stepSize);
  }
  const stopHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    holdInterval.current = 0;
  }, []);
  const startHold = useCallback((dir: any) => {
    if (props.disabled || props.readonly) return;
    stopHold();
    stepBy(dir, props.step);
    holdInterval.current = 300;
    const tick = () => {
      stepBy(dir, props.step);
      // Ramp: shorten the interval down to a floor for accelerating repeats.
      holdInterval.current = Math.max(40, Math.round(holdInterval.current * 0.8));
      holdTimer.current = setTimeout(tick, holdInterval.current);
    };
    holdTimer.current = setTimeout(tick, holdInterval.current);
  }, [props.disabled, props.readonly, props.step, stepBy, stopHold]);
  const onInput = useCallback((e: any) => {
    if (props.readonly) return;
    const raw = e && e.target ? e.target.value : '';
    setText(raw);
  }, [props.readonly]);
  const onBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseText(text);
    commitValue(parsed);
  }, [commitValue, parseText, text]);
  const onFocus = useCallback((e: any) => {
    setFocused(true);
    // Seed the edit buffer with the raw (unformatted) number so editing is clean.
    const n = readValue();
    setText(n === null ? '' : String(n));
    if (e && e.target && e.target.select) e.target.select();
  }, [readValue]);
  const onKeydown = useCallback((e: any) => {
    if (props.disabled || props.readonly) return;
    const key = e ? e.key : '';
    if (key === 'ArrowUp') {
      if (e) e.preventDefault();
      stepBy(1, props.step);
    } else if (key === 'ArrowDown') {
      if (e) e.preventDefault();
      stepBy(-1, props.step);
    } else if (key === 'PageUp') {
      if (e) e.preventDefault();
      stepBy(1, props.largeStep);
    } else if (key === 'PageDown') {
      if (e) e.preventDefault();
      stepBy(-1, props.largeStep);
    } else if (key === 'Home') {
      if (hasMin()) {
        if (e) e.preventDefault();
        commitValue(props.min);
      }
    } else if (key === 'End') {
      if (hasMax()) {
        if (e) e.preventDefault();
        commitValue(props.max);
      }
    } else if (key === 'Enter') {
      // Commit the buffer without losing focus.
      const parsed = parseText(text);
      commitValue(parsed);
    }
  }, [commitValue, hasMax, hasMin, parseText, props.disabled, props.largeStep, props.max, props.min, props.readonly, props.step, stepBy, text]);
  const onScrubDown = useCallback((e: any) => {
    if (!props.allowScrub || props.disabled || props.readonly) return;
    scrubbing.current = true;
    scrubStartX.current = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const cur = readValue();
    scrubStartValue.current = cur === null ? hasMin() ? props.min : 0 : cur;
    // Capture the pointer so move/up stay on this element for the whole drag.
    if (e && e.target && e.target.setPointerCapture && typeof e.pointerId === 'number') {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch {}
    }
  }, [hasMin, props.allowScrub, props.disabled, props.min, props.readonly, readValue]);
  const onScrubMove = useCallback((e: any) => {
    if (!scrubbing.current) return;
    const x = e && typeof e.clientX === 'number' ? e.clientX : 0;
    const dx = x - scrubStartX.current;
    const stepSize = typeof props.step === 'number' && props.step > 0 ? props.step : 1;
    // One step per 8px of horizontal travel.
    const delta = Math.round(dx / 8) * stepSize;
    commitValue(scrubStartValue.current + delta);
  }, [commitValue, props.step]);
  const onScrubUp = useCallback(() => {
    scrubbing.current = false;
  }, []);
  function focus() {
    const el = input.current;
    // NOTE: $refs.input types to the generic HTMLElement on the tsdown/vue leaves
    // (the emitter ref-type map has no `input` → HTMLInputElement entry), so we
    // only touch HTMLElement members here (`focus`). Text selection happens in the
    // onFocus handler, where `e.target` is `any` and `.select()` typechecks.
    if (el && el.focus) el.focus();
  }
  function increment() {
    return stepBy(1, props.step);
  }
  function decrement() {
    return stepBy(-1, props.step);
  }
  function clear() {
    commitValue(null);
    setText('');
  }

  useEffect(() => {
    // Seed the edit buffer so a programmatic focus shows the right text.
    const n = readValue();
    setText(n === null ? '' : String(n));
    // Tear down any running repeat / scrub on unmount.
    return () => {
      stopHold();
      scrubbing.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, increment, decrement, clear });
  _rozieExposeRef.current = { focus, increment, decrement, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), increment: (...args: Parameters<typeof increment>): ReturnType<typeof increment> => _rozieExposeRef.current.increment(...args), decrement: (...args: Parameters<typeof decrement>): ReturnType<typeof decrement> => _rozieExposeRef.current.decrement(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx(clsx("rozie-number-field", { "rozie-number-field--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-ceb089aa="">
      <button type="button" className={"rozie-number-field-btn rozie-number-field-btn--dec"} tabIndex={-1} aria-label="Decrement" disabled={!!props.disabled || !!props.readonly} onPointerDown={($event) => { startHold(-1); }} onPointerUp={($event) => { stopHold(); }} onPointerLeave={($event) => { stopHold(); }} data-rozie-s-ceb089aa="">−</button>

      <input ref={input} className={"rozie-number-field-input"} type="text" inputMode="decimal" autoComplete="off" role="spinbutton" value={displayText()} disabled={!!props.disabled} readOnly={!!props.readonly} aria-label={rozieAttr(props.ariaLabel)} aria-valuemin={(props.min) ?? undefined} aria-valuemax={(props.max) ?? undefined} aria-valuenow={(modelValue) ?? undefined} aria-valuetext={rozieAttr(ariaText())} aria-disabled={!!props.disabled} onInput={($event) => { onInput($event); }} onFocus={($event) => { onFocus($event); }} onBlur={($event) => { onBlur(); }} onKeyDown={($event) => { onKeydown($event); }} onPointerDown={($event) => { onScrubDown($event); }} onPointerMove={($event) => { onScrubMove($event); }} onPointerUp={($event) => { onScrubUp(); }} data-rozie-s-ceb089aa="" />

      <button type="button" className={"rozie-number-field-btn rozie-number-field-btn--inc"} tabIndex={-1} aria-label="Increment" disabled={!!props.disabled || !!props.readonly} onPointerDown={($event) => { startHold(1); }} onPointerUp={($event) => { stopHold(); }} onPointerLeave={($event) => { stopHold(); }} data-rozie-s-ceb089aa="">+</button>
    </div>
    </>
  );
});
export default NumberField;
