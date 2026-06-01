import type { JSX } from 'solid-js';
import { createEffect, mergeProps, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
import flatpickr from 'flatpickr';

__rozieInjectStyle('Flatpickr-159070d4', `.rozie-flatpickr[data-rozie-s-159070d4] {
  padding: 0.375rem 0.5rem;
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  font: inherit;
  width: 100%;
  box-sizing: border-box;
}
.rozie-flatpickr[data-rozie-s-159070d4]:focus {
  outline: 2px solid rgba(0, 100, 255, 0.4);
  outline-offset: -1px;
}`);

interface FlatpickrProps {
  date?: string;
  defaultDate?: string;
  onDateChange?: (date: string) => void;
  mode?: string;
  dateFormat?: string;
  altInput?: boolean;
  altFormat?: string;
  enableTime?: boolean;
  enableSeconds?: boolean;
  time24hr?: boolean;
  noCalendar?: boolean;
  minDate?: (string) | null;
  maxDate?: (string) | null;
  placeholder?: string;
  disabled?: boolean;
  commitOn?: string;
  options?: Record<string, any>;
  onChange?: (...args: unknown[]) => void;
  onReady?: (...args: unknown[]) => void;
  onOpen?: (...args: unknown[]) => void;
  onClose?: (...args: unknown[]) => void;
  onMonthChange?: (...args: unknown[]) => void;
  onYearChange?: (...args: unknown[]) => void;
  onValueUpdate?: (...args: unknown[]) => void;
  onDayCreate?: (...args: unknown[]) => void;
}

export default function Flatpickr(_props: FlatpickrProps): JSX.Element {
  const _merged = mergeProps({ mode: 'single', dateFormat: 'Y-m-d', altInput: false, altFormat: 'F j, Y', enableTime: false, enableSeconds: false, time24hr: false, noCalendar: false, minDate: null, maxDate: null, placeholder: 'Select a date…', disabled: false, commitOn: 'complete', options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['date', 'mode', 'dateFormat', 'altInput', 'altFormat', 'enableTime', 'enableSeconds', 'time24hr', 'noCalendar', 'minDate', 'maxDate', 'placeholder', 'disabled', 'commitOn', 'options']);

  const [date, setDate] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'date', '');
  onMount(() => {
    const _cleanup = (() => {
    instance = flatpickr(inputElRef, {
      mode: local.mode,
      dateFormat: local.dateFormat,
      altInput: local.altInput,
      altFormat: local.altFormat,
      enableTime: local.enableTime,
      enableSeconds: local.enableSeconds,
      time_24hr: local.time24hr,
      noCalendar: local.noCalendar,
      minDate: local.minDate,
      maxDate: local.maxDate,
      defaultDate: date() || null,
      ...local.options,
      onChange: (selectedDates: any, dateStr: any) => {
        // Value contract + range-commit semantics. In range mode flatpickr fires
        // onChange on the FIRST click (partial range) — committing then is the
        // bug every wrapper ships. Commit the string only when the range is
        // complete (2 dates) unless the consumer opted into commitOn:'change'.
        const isRange = local.mode === 'range';
        const complete = !isRange || selectedDates.length === 2;
        if ((local.commitOn === 'change' || complete) && dateStr !== date()) {
          setDate(dateStr);
        }
        // Always surface BOTH the formatted string and the Date[] so consumers
        // that need the parsed objects (range bounds, multi-select) get them.
        _props.onChange?.({
          value: dateStr,
          selectedDates
        });
      },
      onReady: (d: any, s: any) => _props.onReady?.({
        value: s,
        selectedDates: d
      }),
      onOpen: () => _props.onOpen?.(),
      onClose: () => _props.onClose?.(),
      onMonthChange: () => _props.onMonthChange?.(),
      onYearChange: () => _props.onYearChange?.(),
      onValueUpdate: (d: any, s: any) => _props.onValueUpdate?.({
        value: s,
        selectedDates: d
      }),
      onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => _props.onDayCreate?.(dayElem)
    });
    if (local.disabled) instance.input.disabled = true;
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => instance?.destroy());
  });
  createEffect(() => { const __watchVal = (() => date())(); untrack(() => ((v: any) => {
    if (!instance) return;
    if (v !== instance.input.value) instance.setDate(v, false);
  })(__watchVal)); });
  createEffect(() => { const __watchVal = (() => local.mode)(); untrack(() => ((v: any) => instance?.set('mode', v))(__watchVal)); });
  createEffect(() => { const __watchVal = (() => local.minDate)(); untrack(() => ((v: any) => instance?.set('minDate', v))(__watchVal)); });
  createEffect(() => { const __watchVal = (() => local.maxDate)(); untrack(() => ((v: any) => instance?.set('maxDate', v))(__watchVal)); });
  createEffect(() => { const __watchVal = (() => local.dateFormat)(); untrack(() => ((v: any) => instance?.set('dateFormat', v))(__watchVal)); });
  createEffect(() => { const __watchVal = (() => local.disabled)(); untrack(() => ((v: any) => {
    if (instance) instance.input.disabled = v;
  })(__watchVal)); });
  let inputElRef: HTMLElement | null = null;

  let instance: any = null;

  return (
    <>
    <input ref={(el) => { inputElRef = el as HTMLElement; }} type="text" placeholder={local.placeholder} {...attrs} class={"rozie-flatpickr" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-159070d4="" />
    </>
  );
}
