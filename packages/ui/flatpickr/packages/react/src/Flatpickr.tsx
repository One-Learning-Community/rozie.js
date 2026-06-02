import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './Flatpickr.module.css';
import flatpickr from 'flatpickr';

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
  name?: string;
  inline?: boolean;
  staticPosition?: boolean;
  position?: string;
  appendTo?: (Record<string, any>) | null;
  showMonths?: number;
  weekNumbers?: boolean;
  monthSelectorType?: string;
  prevArrow?: (string) | null;
  nextArrow?: (string) | null;
  allowInput?: boolean;
  disable?: any[];
  enable?: any[];
  locale?: (Record<string, any>) | null;
  firstDayOfWeek?: number;
  parseDate?: ((...args: any[]) => any) | null;
  formatDate?: ((...args: any[]) => any) | null;
  plugins?: any[];
  onChange?: (...args: any[]) => void;
  onReady?: (...args: any[]) => void;
  onOpen?: (...args: any[]) => void;
  onClose?: (...args: any[]) => void;
  onMonthChange?: (...args: any[]) => void;
  onYearChange?: (...args: any[]) => void;
  onValueUpdate?: (...args: any[]) => void;
  onDayCreate?: (...args: any[]) => void;
}

export interface FlatpickrHandle {
  clear: (...args: any[]) => any;
  openPicker: (...args: any[]) => any;
  closePicker: (...args: any[]) => any;
  selectDate: (...args: any[]) => any;
  jumpToDate: (...args: any[]) => any;
}

const Flatpickr = forwardRef<FlatpickrHandle, FlatpickrProps>(function Flatpickr(_props: FlatpickrProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const __defaultDisable = useState(() => (() => [])())[0];
  const __defaultEnable = useState(() => (() => [])())[0];
  const __defaultPlugins = useState(() => (() => [])())[0];
  const props: Omit<FlatpickrProps, 'mode' | 'dateFormat' | 'altInput' | 'altFormat' | 'enableTime' | 'enableSeconds' | 'time24hr' | 'noCalendar' | 'minDate' | 'maxDate' | 'placeholder' | 'disabled' | 'commitOn' | 'options' | 'name' | 'inline' | 'staticPosition' | 'position' | 'appendTo' | 'showMonths' | 'weekNumbers' | 'monthSelectorType' | 'prevArrow' | 'nextArrow' | 'allowInput' | 'disable' | 'enable' | 'locale' | 'firstDayOfWeek' | 'parseDate' | 'formatDate' | 'plugins'> & { mode: string; dateFormat: string; altInput: boolean; altFormat: string; enableTime: boolean; enableSeconds: boolean; time24hr: boolean; noCalendar: boolean; minDate: (string) | null; maxDate: (string) | null; placeholder: string; disabled: boolean; commitOn: string; options: Record<string, any>; name: string; inline: boolean; staticPosition: boolean; position: string; appendTo: (Record<string, any>) | null; showMonths: number; weekNumbers: boolean; monthSelectorType: string; prevArrow: (string) | null; nextArrow: (string) | null; allowInput: boolean; disable: any[]; enable: any[]; locale: (Record<string, any>) | null; firstDayOfWeek: number; parseDate: ((...args: any[]) => any) | null; formatDate: ((...args: any[]) => any) | null; plugins: any[] } = {
    ..._props,
    mode: _props.mode ?? 'single',
    dateFormat: _props.dateFormat ?? 'Y-m-d',
    altInput: _props.altInput ?? false,
    altFormat: _props.altFormat ?? 'F j, Y',
    enableTime: _props.enableTime ?? false,
    enableSeconds: _props.enableSeconds ?? false,
    time24hr: _props.time24hr ?? false,
    noCalendar: _props.noCalendar ?? false,
    minDate: _props.minDate ?? null,
    maxDate: _props.maxDate ?? null,
    placeholder: _props.placeholder ?? 'Select a date…',
    disabled: _props.disabled ?? false,
    commitOn: _props.commitOn ?? 'complete',
    options: _props.options ?? __defaultOptions,
    name: _props.name ?? '',
    inline: _props.inline ?? false,
    staticPosition: _props.staticPosition ?? false,
    position: _props.position ?? 'auto',
    appendTo: _props.appendTo ?? null,
    showMonths: _props.showMonths ?? 1,
    weekNumbers: _props.weekNumbers ?? false,
    monthSelectorType: _props.monthSelectorType ?? 'dropdown',
    prevArrow: _props.prevArrow ?? null,
    nextArrow: _props.nextArrow ?? null,
    allowInput: _props.allowInput ?? false,
    disable: _props.disable ?? __defaultDisable,
    enable: _props.enable ?? __defaultEnable,
    locale: _props.locale ?? null,
    firstDayOfWeek: _props.firstDayOfWeek ?? 0,
    parseDate: _props.parseDate ?? null,
    formatDate: _props.formatDate ?? null,
    plugins: _props.plugins ?? __defaultPlugins,
  };
  const attrs: Record<string, unknown> = (() => {
    const { date, mode, dateFormat, altInput, altFormat, enableTime, enableSeconds, time24hr, noCalendar, minDate, maxDate, placeholder, disabled, commitOn, options, name, inline, staticPosition, position, appendTo, showMonths, weekNumbers, monthSelectorType, prevArrow, nextArrow, allowInput, disable, enable, locale, firstDayOfWeek, parseDate, formatDate, plugins, defaultValue, onDateChange, defaultDate, ...rest } = _props as FlatpickrProps & Record<string, unknown>;
    void date; void mode; void dateFormat; void altInput; void altFormat; void enableTime; void enableSeconds; void time24hr; void noCalendar; void minDate; void maxDate; void placeholder; void disabled; void commitOn; void options; void name; void inline; void staticPosition; void position; void appendTo; void showMonths; void weekNumbers; void monthSelectorType; void prevArrow; void nextArrow; void allowInput; void disable; void enable; void locale; void firstDayOfWeek; void parseDate; void formatDate; void plugins; void defaultValue; void onDateChange; void defaultDate;
    return rest;
  })();
  const instance = useRef<any>(null);
  const [date, setDate] = useControllableState({
    value: props.date,
    defaultValue: props.defaultDate ?? '',
    onValueChange: props.onDateChange,
  });
  const _dateFormatRef = useRef(props.dateFormat);
  _dateFormatRef.current = props.dateFormat;
  const _disableRef = useRef(props.disable);
  _disableRef.current = props.disable;
  const _disabledRef = useRef(props.disabled);
  _disabledRef.current = props.disabled;
  const _enableRef = useRef(props.enable);
  _enableRef.current = props.enable;
  const _firstDayOfWeekRef = useRef(props.firstDayOfWeek);
  _firstDayOfWeekRef.current = props.firstDayOfWeek;
  const _localeRef = useRef(props.locale);
  _localeRef.current = props.locale;
  const _maxDateRef = useRef(props.maxDate);
  _maxDateRef.current = props.maxDate;
  const _minDateRef = useRef(props.minDate);
  _minDateRef.current = props.minDate;
  const _modeRef = useRef(props.mode);
  _modeRef.current = props.mode;
  const _dateRef = useRef(date);
  _dateRef.current = date;
  const inputEl = useRef<HTMLInputElement | null>(null);

  // Imperative handle (Phase 21 $expose). The five flatpickr instance methods a
  // consumer can't drive through props alone — exposed uniformly to all 6 targets
  // (Vue defineExpose / React useImperativeHandle / Svelte instance export /
  // Angular+Lit public method / Solid callback ref). Each guards on `instance`
  // (null before $onMount and after destroy). selectDate forwards flatpickr's own
  // triggerChange arg; leaving it undefined keeps flatpickr's default (no
  // onChange refire), so a programmatic selectDate does not bounce through the
  // round-trip-guarded $watch above.
  //
  // Two method names are deliberately NOT flatpickr's own, to avoid collisions
  // with this component's emitted surface (a real cross-target footgun — see the
  // Step-4 gap report):
  //   - `selectDate` (not `setDate`): the `date` prop is `model: true`, so React's
  //     emitter auto-generates a `setDate` setter for it (useControllableState
  //     destructure). A user `setDate` collides — ROZ524 ("already declared" +
  //     infinite-recursion of the model-write rewrite). selectDate wraps
  //     flatpickr's instance.setDate.
  //   - `openPicker` / `closePicker` (not `open` / `close`): this component emits
  //     `open` and `close` EVENTS (onOpen/onClose -> $emit). On targets that
  //     materialize events as named members (Angular `output()`), a method named
  //     `open`/`close` collides with the event member and the emitter silently
  //     renames the method to `_open`/`_close` — breaking the uniform handle. No
  //     diagnostic fires today (unlike the model-setter ROZ524); flagged for a
  //     future ROZ "expose-name vs event-name collision" check. Prefixing the
  //     methods sidesteps it.
  function clear() {
    instance.current?.clear();
  }
  function openPicker() {
    instance.current?.open();
  }
  function closePicker() {
    instance.current?.close();
  }
  function selectDate(date: any, triggerChange: any) {
    instance.current?.setDate(date, triggerChange);
  }
  function jumpToDate(date: any) {
    instance.current?.jumpToDate(date);
  }

  useEffect(() => {
    instance.current = flatpickr(inputEl.current!, {
      mode: _modeRef.current,
      dateFormat: _dateFormatRef.current,
      altInput: props.altInput,
      altFormat: props.altFormat,
      enableTime: props.enableTime,
      enableSeconds: props.enableSeconds,
      time_24hr: props.time24hr,
      noCalendar: props.noCalendar,
      minDate: _minDateRef.current,
      maxDate: _maxDateRef.current,
      defaultDate: _dateRef.current || null,
      // GAP-5 UI passthrough (construction-time only) + GAP-6a allowInput.
      // These match flatpickr's own defaults so passing them is render-neutral.
      inline: props.inline,
      static: props.staticPosition,
      position: props.position,
      showMonths: props.showMonths,
      weekNumbers: props.weekNumbers,
      monthSelectorType: props.monthSelectorType,
      allowInput: props.allowInput,
      // `appendTo` / `prevArrow` / `nextArrow` default to null here but flatpickr
      // expects them ABSENT (its own defaults are `undefined` for appendTo and
      // built-in SVG strings for the arrows). Passing an explicit null breaks
      // construction, so include each ONLY when the consumer set a real value.
      ...(props.appendTo != null ? {
        appendTo: props.appendTo
      } : {}),
      ...(props.prevArrow != null ? {
        prevArrow: props.prevArrow
      } : {}),
      ...(props.nextArrow != null ? {
        nextArrow: props.nextArrow
      } : {}),
      // GAP-2/3/4/6b conditional-spread passthrough. NEVER pass an empty array /
      // null / default-0, because flatpickr treats `enable: []` as "nothing
      // enabled" and a null locale/parseDate/formatDate breaks construction —
      // each guard keeps the default render byte-identical to before.
      ...(_disableRef.current.length ? {
        disable: _disableRef.current
      } : {}),
      ...(_enableRef.current.length ? {
        enable: _enableRef.current
      } : {}),
      ...(props.parseDate != null ? {
        parseDate: props.parseDate
      } : {}),
      ...(props.formatDate != null ? {
        formatDate: props.formatDate
      } : {}),
      ...(props.plugins.length ? {
        plugins: props.plugins
      } : {}),
      // locale + firstDayOfWeek merge: emit a single `locale` entry present when
      // EITHER a locale object is set OR firstDayOfWeek is non-default (0). The
      // merge folds firstDayOfWeek INTO the locale object so it overrides the
      // locale's own. Kept a PURE expression (no statements) so Angular can splice
      // it into a binding context safely.
      ...(_localeRef.current != null || _firstDayOfWeekRef.current !== 0 ? {
        locale: {
          ...(_localeRef.current ?? {}),
          ...(_firstDayOfWeekRef.current !== 0 ? {
            firstDayOfWeek: _firstDayOfWeekRef.current
          } : {})
        }
      } : {}),
      ...props.options,
      onChange: (selectedDates: any, dateStr: any) => {
        // Value contract + range-commit semantics. In range mode flatpickr fires
        // onChange on the FIRST click (partial range) — committing then is the
        // bug every wrapper ships. Commit the string only when the range is
        // complete (2 dates) unless the consumer opted into commitOn:'change'.
        const isRange = _modeRef.current === 'range';
        const complete = !isRange || selectedDates.length === 2;
        if ((props.commitOn === 'change' || complete) && dateStr !== _dateRef.current) {
          setDate(dateStr);
        }
        // Always surface BOTH the formatted string and the Date[] so consumers
        // that need the parsed objects (range bounds, multi-select) get them.
        props.onChange && props.onChange({
          value: dateStr,
          selectedDates
        });
      },
      onReady: (d: any, s: any) => props.onReady && props.onReady({
        value: s,
        selectedDates: d
      }),
      onOpen: () => props.onOpen && props.onOpen(),
      onClose: () => props.onClose && props.onClose(),
      onMonthChange: () => props.onMonthChange && props.onMonthChange(),
      onYearChange: () => props.onYearChange && props.onYearChange(),
      onValueUpdate: (d: any, s: any) => props.onValueUpdate && props.onValueUpdate({
        value: s,
        selectedDates: d
      }),
      onDayCreate: (_d: any, _s: any, _fp: any, dayElem: any) => props.onDayCreate && props.onDayCreate(dayElem)
    });
    if (_disabledRef.current) instance.current.input.disabled = true;
    return () => instance.current?.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = date;
    if (!instance.current) return;
    if (v !== instance.current.input.value) instance.current.setDate(v, false);
  }, [date]);
  useEffect(() => {
    const v = props.mode;
    instance.current?.set('mode', v);
  }, [props.mode]);
  useEffect(() => {
    const v = props.minDate;
    instance.current?.set('minDate', v);
  }, [props.minDate]);
  useEffect(() => {
    const v = props.maxDate;
    instance.current?.set('maxDate', v);
  }, [props.maxDate]);
  useEffect(() => {
    const v = props.dateFormat;
    instance.current?.set('dateFormat', v);
  }, [props.dateFormat]);
  useEffect(() => {
    const v = props.disabled;
    if (instance.current) instance.current.input.disabled = v;
  }, [props.disabled]);
  useEffect(() => {
    const v = props.disable;
    instance.current?.set('disable', v);
  }, [props.disable]);
  useEffect(() => {
    const v = props.enable;
    instance.current?.set('enable', v);
  }, [props.enable]);
  useEffect(() => {
    const v = props.locale;
    instance.current?.set('locale', {
    ...(v ?? {}),
    ...(props.firstDayOfWeek !== 0 ? {
      firstDayOfWeek: props.firstDayOfWeek
    } : {})
  });
  }, [props.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = props.firstDayOfWeek;
    instance.current?.set('locale', {
    ...(props.locale ?? {}),
    ...(v !== 0 ? {
      firstDayOfWeek: v
    } : {})
  });
  }, [props.firstDayOfWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ clear, openPicker, closePicker, selectDate, jumpToDate }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <input ref={inputEl} type="text" name={props.name} placeholder={props.placeholder} {...attrs} className={clsx(styles["rozie-flatpickr"], (attrs.className as string | undefined))} data-rozie-s-159070d4="" />
    </>
  );
});
export default Flatpickr;
