import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './Flatpickr.css';
import flatpickr from 'flatpickr';

interface FlatpickrProps {
  /**
   * The two-way value (`r-model:date`) — the **formatted string** flatpickr produces, not a `Date`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Consumers that need the parsed `Date[]` read them off the `change` event payload instead.
   * @example
   * <Flatpickr r-model:date="picked" @change="onChange" />
   */
  date?: string;
  defaultDate?: string;
  onDateChange?: (date: string) => void;
  /**
   * Selection mode: `'single'`, `'multiple'`, `'range'`, or `'time'`. In `'range'` mode the two-way `date` commits per `commitOn`. Runtime-updatable via flatpickr's `set()`.
   */
  mode?: string;
  /**
   * flatpickr date-format token string controlling how the value is formatted and parsed. Runtime-updatable via `set()`.
   */
  dateFormat?: string;
  /**
   * Show a human-readable alt input (formatted with `altFormat`) while submitting the machine-format value. flatpickr creates a hidden mirror input and moves the original `name` onto it. **Construction-time only** — re-key the component to retune live.
   */
  altInput?: boolean;
  /**
   * Format token string for the human-readable alt input (used only when `altInput` is on).
   */
  altFormat?: string;
  /**
   * Add a time picker alongside the calendar. **Construction-time only** — re-key the component to retune live.
   */
  enableTime?: boolean;
  /**
   * Add a seconds input to the time picker (used with `enableTime`).
   */
  enableSeconds?: boolean;
  /**
   * Display time in 24-hour format instead of the AM/PM clock.
   */
  time24hr?: boolean;
  /**
   * Hide the calendar to make a time-only picker (pair with `enableTime`). **Construction-time only** — re-key the component to retune live.
   */
  noCalendar?: boolean;
  /**
   * Earliest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
   */
  minDate?: (string) | null;
  /**
   * Latest selectable date (a `dateFormat`-formatted string). Runtime-updatable via `set()`.
   */
  maxDate?: (string) | null;
  /**
   * Placeholder text for the rendered input when no date is selected.
   */
  placeholder?: string;
  /**
   * Disable the underlying input so the picker cannot be opened or edited. On Angular it OR-merges with the form `setDisabledState`. Runtime-updatable.
   */
  disabled?: boolean;
  /**
   * When to commit the two-way `date` in `mode="range"`: `'complete'` (the default — only once both ends are picked) or `'change'` (on every click, including the partial first click). The `change` event always fires on every click regardless, so partial ranges are observable off the event without polluting the two-way value.
   */
  commitOn?: string;
  /**
   * Verbatim flatpickr options pass-through for anything the named props do not cover. It is spread **after** the named props, so a key here overrides the equivalent named prop on conflict.
   */
  options?: Record<string, any>;
  /**
   * HTML form-control `name` forwarded onto the rendered input — the forms drop-in, so `Flatpickr` submits like a native control. When `altInput` is on, flatpickr moves the `name` onto the hidden mirror input, so the submitted value carries it either way.
   */
  name?: string;
  /**
   * Render an always-visible calendar inline instead of a popup — useful for dashboards and embedded pickers. **Construction-time only** — re-key the component to toggle live.
   */
  inline?: boolean;
  /**
   * flatpickr's `static` option — positions the calendar relative to the input rather than absolutely off `<body>`. Exposed as `staticPosition` because `static` is a JS reserved word. **Construction-time only**.
   */
  staticPosition?: boolean;
  /**
   * Calendar popup position: `'auto'`, `'above'`, `'below'`, or per-axis forms like `'above center'`. **Construction-time only**.
   */
  position?: string;
  /**
   * A DOM element to append the calendar popup to, useful for escaping `overflow: hidden` ancestors. **Construction-time only**.
   */
  appendTo?: (Record<string, any>) | null;
  /**
   * Number of calendar months to render side by side. **Construction-time only**.
   */
  showMonths?: number;
  /**
   * Show ISO week numbers down the left edge of the calendar. **Construction-time only**.
   */
  weekNumbers?: boolean;
  /**
   * Month-selector style in the calendar header: `'dropdown'` or `'static'`. **Construction-time only**.
   */
  monthSelectorType?: string;
  /**
   * HTML string for the previous-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
   */
  prevArrow?: (string) | null;
  /**
   * HTML string for the next-month navigation arrow, overriding flatpickr's built-in SVG. **Construction-time only**.
   */
  nextArrow?: (string) | null;
  /**
   * Allow the user to type a date directly into the input instead of only picking from the calendar. **Construction-time only**.
   */
  allowInput?: boolean;
  /**
   * Dates to disable: a mixed array of `Date` objects, `"Y-m-d"` strings, `{ from, to }` range objects, and/or predicate functions `(date: Date) => boolean`. Runtime-updatable via `set()` — a runtime `disable: []` clears the exclusion set.
   */
  disable?: any[];
  /**
   * Allow-list (the inverse of `disable`): when non-empty, ONLY these dates/ranges/predicates are selectable and everything else is disabled. Same element shapes as `disable`. Runtime-updatable via `set()`.
   */
  enable?: any[];
  /**
   * A flatpickr locale object (e.g. `import fr from 'flatpickr/dist/l10n/fr.js'`). The consumer lazy-imports it themselves — the wrapper adds no locale dependency. Runtime-updatable via `set('locale', …)`.
   */
  locale?: (Record<string, any>) | null;
  /**
   * First weekday of the calendar (`0` = Sunday … `1` = Monday). Folded into the `locale` option and overrides the locale's own first weekday when set. Runtime-updatable.
   */
  firstDayOfWeek?: number;
  /**
   * Custom parser `(dateStr: string, format: string) => Date` for input formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  parseDate?: ((...args: any[]) => any) | null;
  /**
   * Custom formatter `(date: Date, format: string, locale) => string` for output formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  formatDate?: ((...args: any[]) => any) | null;
  /**
   * An array of flatpickr plugin instances (imported from `flatpickr/dist/plugins/…`); the headline use is `rangePlugin` for two-input ranges. **Construction-time only** — re-key the component to swap plugins live.
   */
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
  getSelectedDates: (...args: any[]) => any;
  togglePicker: (...args: any[]) => any;
  changeMonth: (...args: any[]) => any;
  changeYear: (...args: any[]) => any;
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
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);
  const _watch5First = useRef(true);
  const _watch6First = useRef(true);
  const _watch7First = useRef(true);
  const _watch8First = useRef(true);
  const _watch9First = useRef(true);

  // Imperative handle (Phase 21 $expose). The flatpickr instance methods a
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
  // getSelectedDates closes a real asymmetry: the two-way `date` model is a
  // formatted STRING, but the parsed Date[] is otherwise only delivered on the
  // `change` event payload — a consumer needing the current Date objects on demand
  // (range bounds, multi-select, validation) had no path. `[]` before mount.
  // getSelectedDates closes a real asymmetry: the two-way `date` model is a
  // formatted STRING, but the parsed Date[] is otherwise only delivered on the
  // `change` event payload — a consumer needing the current Date objects on demand
  // (range bounds, multi-select, validation) had no path. `[]` before mount.
  function getSelectedDates() {
    return instance.current ? instance.current.selectedDates : [];
  }
  // togglePicker = open-or-close in one call (natural for a single trigger button).
  // `toggle` is not an emit, but suffixed `togglePicker` for symmetry with
  // openPicker/closePicker.
  // togglePicker = open-or-close in one call (natural for a single trigger button).
  // `toggle` is not an emit, but suffixed `togglePicker` for symmetry with
  // openPicker/closePicker.
  function togglePicker() {
    instance.current?.toggle();
  }
  // Programmatic calendar navigation for custom prev/next / "jump N months" UI.
  // changeMonth(value, isOffset?) — isOffset defaults to true (flatpickr). NOT
  // `monthChange`, which is the emitted event (so ROZ121-clear).
  // Programmatic calendar navigation for custom prev/next / "jump N months" UI.
  // changeMonth(value, isOffset?) — isOffset defaults to true (flatpickr). NOT
  // `monthChange`, which is the emitted event (so ROZ121-clear).
  function changeMonth(value: any, isOffset: any) {
    instance.current?.changeMonth(value, isOffset);
  }
  // changeYear(year) — jump to an absolute year. NOT `yearChange` (the emit).
  // changeYear(year) — jump to an absolute year. NOT `yearChange` (the emit).
  function changeYear(year: any) {
    instance.current?.changeYear(year);
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
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = date;
    if (!instance.current) return;
    if (v !== instance.current.input.value) instance.current.setDate(v, false);
  }, [date]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = props.mode;
    instance.current?.set('mode', v);
  }, [props.mode]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.minDate;
    instance.current?.set('minDate', v);
  }, [props.minDate]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.maxDate;
    instance.current?.set('maxDate', v);
  }, [props.maxDate]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = props.dateFormat;
    instance.current?.set('dateFormat', v);
  }, [props.dateFormat]);
  useEffect(() => {
    if (_watch5First.current) { _watch5First.current = false; return; }
    const v = props.disabled;
    if (instance.current) instance.current.input.disabled = v;
  }, [props.disabled]);
  useEffect(() => {
    if (_watch6First.current) { _watch6First.current = false; return; }
    const v = props.disable;
    instance.current?.set('disable', v);
  }, [props.disable]);
  useEffect(() => {
    if (_watch7First.current) { _watch7First.current = false; return; }
    const v = props.enable;
    instance.current?.set('enable', v);
  }, [props.enable]);
  useEffect(() => {
    if (_watch8First.current) { _watch8First.current = false; return; }
    const v = props.locale;
    instance.current?.set('locale', {
    ...(v ?? {}),
    ...(props.firstDayOfWeek !== 0 ? {
      firstDayOfWeek: props.firstDayOfWeek
    } : {})
  });
  }, [props.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch9First.current) { _watch9First.current = false; return; }
    const v = props.firstDayOfWeek;
    instance.current?.set('locale', {
    ...(props.locale ?? {}),
    ...(v !== 0 ? {
      firstDayOfWeek: v
    } : {})
  });
  }, [props.firstDayOfWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ clear, openPicker, closePicker, selectDate, jumpToDate, getSelectedDates, togglePicker, changeMonth, changeYear });
  _rozieExposeRef.current = { clear, openPicker, closePicker, selectDate, jumpToDate, getSelectedDates, togglePicker, changeMonth, changeYear };
  useImperativeHandle(ref, () => ({ clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), openPicker: (...args: Parameters<typeof openPicker>): ReturnType<typeof openPicker> => _rozieExposeRef.current.openPicker(...args), closePicker: (...args: Parameters<typeof closePicker>): ReturnType<typeof closePicker> => _rozieExposeRef.current.closePicker(...args), selectDate: (...args: Parameters<typeof selectDate>): ReturnType<typeof selectDate> => _rozieExposeRef.current.selectDate(...args), jumpToDate: (...args: Parameters<typeof jumpToDate>): ReturnType<typeof jumpToDate> => _rozieExposeRef.current.jumpToDate(...args), getSelectedDates: (...args: Parameters<typeof getSelectedDates>): ReturnType<typeof getSelectedDates> => _rozieExposeRef.current.getSelectedDates(...args), togglePicker: (...args: Parameters<typeof togglePicker>): ReturnType<typeof togglePicker> => _rozieExposeRef.current.togglePicker(...args), changeMonth: (...args: Parameters<typeof changeMonth>): ReturnType<typeof changeMonth> => _rozieExposeRef.current.changeMonth(...args), changeYear: (...args: Parameters<typeof changeYear>): ReturnType<typeof changeYear> => _rozieExposeRef.current.changeYear(...args) }), []);

  return (
    <>
    <input ref={inputEl} type="text" name={props.name} placeholder={props.placeholder} {...attrs} className={clsx("rozie-flatpickr", (attrs.className as string | undefined))} data-rozie-s-159070d4="" />
    </>
  );
});
export default Flatpickr;
