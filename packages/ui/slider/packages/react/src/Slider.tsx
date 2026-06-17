import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, parseInlineStyle, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './Slider.css';

interface MarkCtx { value: any; label: any; position: any; }

interface BubbleCtx { value: any; }

interface SliderProps {
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (value: (unknown) | null) => void;
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
    const { value, range, min, max, step, orientation, disabled, marks, ariaLabel, pageStep, formatValue, showValue, defaultValue, onValueChange, ...rest } = _props as SliderProps & Record<string, unknown>;
    void value; void range; void min; void max; void step; void orientation; void disabled; void marks; void ariaLabel; void pageStep; void formatValue; void showValue; void defaultValue; void onValueChange;
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

  function pct(v: any) {
    const span = props.max - props.min;
    if (span === 0) return 0;
    const p = (v - props.min) / span * 100;
    if (p < 0) return 0;
    if (p > 100) return 100;
    return p;
  }
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
  function rangePair() {
    const cur = value;
    if (Array.isArray(cur) && cur.length === 2) return [cur[0], cur[1]];
    return [props.min, props.max];
  }
  function singleValue() {
    const cur = value;
    return typeof cur === 'number' && Number.isFinite(cur) ? cur : props.min;
  }
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
  function display(v: any) {
    if (props.formatValue !== null) return props.formatValue(v);
    return String(v);
  }
  function fireChange(value: any) {
    return props.onChange && props.onChange({
      value
    });
  }
  function commitSingle(raw: any) {
    const v = clampStep(raw);
    setValue(v);
    fireChange(v);
  }
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
  const onInputSingle = useCallback(($event: any) => commitSingle($event.target.valueAsNumber), [commitSingle]);
  const onInputLo = useCallback(($event: any) => commitRange('lo', $event.target.valueAsNumber), [commitRange]);
  const onInputHi = useCallback(($event: any) => commitRange('hi', $event.target.valueAsNumber), [commitRange]);
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
  function focus() {
    return inputEl.current?.focus();
  }
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

  useImperativeHandle(ref, () => ({ focus, increment, decrement }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div style={parseInlineStyle(fillStyle)} {...attrs} className={clsx(clsx("rozie-slider", { "rozie-slider--vertical": props.orientation === 'vertical', "rozie-slider--horizontal": props.orientation !== 'vertical', "rozie-slider--range": props.range, "rozie-slider--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-4e6f0be6="">
      
      <div className={"rozie-slider-track"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-fill"} data-rozie-s-4e6f0be6="" />
      </div>

      
      {(normalizedMarks().length > 0) && <div className={"rozie-slider-marks"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        
        {normalizedMarks().map((tick) => <div key={tick.value} className={"rozie-slider-mark"} style={{ left: pct(tick.value) + '%' }} data-rozie-s-4e6f0be6="">
          {(props.renderMark ?? props.slots?.['mark']) ? ((props.renderMark ?? props.slots?.['mark']) as Function)({ value: tick.value, label: tick.label, position: pct(tick.value) }) : <span className={"rozie-slider-mark-label"} data-rozie-s-4e6f0be6="">{rozieDisplay(tick.label)}</span>}
        </div>)}
      </div>}{(props.showValue && !props.range) && <div className={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: singleValue() }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(singleValue()))}</span>}
        </div>
      </div>}{(props.showValue && props.range) && <div className={"rozie-slider-bubbles"} aria-hidden="true" data-rozie-s-4e6f0be6="">
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-start)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: rangePair()[0] }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[0]))}</span>}
        </div>
        <div className={"rozie-slider-bubble"} style={{ left: 'var(--rozie-slider-fill-end)' }} data-rozie-s-4e6f0be6="">
          {(props.renderBubble ?? props.slots?.['bubble']) ? ((props.renderBubble ?? props.slots?.['bubble']) as Function)({ value: rangePair()[1] }) : <span className={"rozie-slider-bubble-text"} data-rozie-s-4e6f0be6="">{rozieDisplay(display(rangePair()[1]))}</span>}
        </div>
      </div>}{(!props.range) && <input ref={inputEl} className={"rozie-slider-input"} type="range" min={props.min} max={props.max} step={props.step} value={singleValue()} disabled={!!props.disabled} aria-label={props.ariaLabel} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(singleValue()) : undefined)} onInput={($event) => { onInputSingle($event); }} onKeyDown={($event) => { onKeyDownSingle($event); }} data-rozie-s-4e6f0be6="" />}{(props.range) && <input ref={inputEl} className={"rozie-slider-input rozie-slider-input--lo"} type="range" min={props.min} max={props.max} step={props.step} value={rangePair()[0]} disabled={!!props.disabled} aria-label={props.ariaLabel} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(rangePair()[0]) : undefined)} onInput={($event) => { onInputLo($event); }} onKeyDown={($event) => { onKeyDownRange('lo', $event); }} data-rozie-s-4e6f0be6="" />}{(props.range) && <input className={"rozie-slider-input rozie-slider-input--hi"} type="range" min={props.min} max={props.max} step={props.step} value={rangePair()[1]} disabled={!!props.disabled} aria-label={props.ariaLabel} aria-orientation={rozieAttr(props.orientation === 'vertical' ? 'vertical' : 'horizontal')} aria-valuetext={rozieAttr(props.formatValue !== null ? display(rangePair()[1]) : undefined)} onInput={($event) => { onInputHi($event); }} onKeyDown={($event) => { onKeyDownRange('hi', $event); }} data-rozie-s-4e6f0be6="" />}</div>
    </>
  );
});
export default Slider;
