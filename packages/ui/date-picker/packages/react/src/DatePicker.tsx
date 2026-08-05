import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState, useKeynav } from '@rozie/runtime-react';
import './DatePicker.css';
import { addMonths, buildMonthGrid, buildMonthList, buildYearGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveRovingDayIndex, resolveRovingDrillIndex, resolveViewIso, ROVING_DAY_NONE, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface HeaderCtx { label: any; prev: any; next: any; disabled: any; }

interface FooterCtx { today: any; clear: any; todayIso: any; }

interface PresetsCtx { presets: any; apply: any; }

interface DatePickerProps {
  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
   */
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
  /**
   * Selection mode: `'single'` (the default — `value` is one ISO `YYYY-MM-DD` string, fully backward-compatible) or `'range'` (`value` becomes a `{ start, end }` object selected with two clicks plus a live hover preview, direction-agnostic). In `range` mode a completed selection additionally emits `rangeComplete`.
   */
  selectionMode?: string;
  /**
   * Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound.
   */
  min?: (string) | null;
  /**
   * Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound.
   */
  max?: (string) | null;
  /**
   * An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`.
   */
  disabledDates?: any[];
  /**
   * The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar).
   */
  weekStartsOn?: number;
  /**
   * Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`.
   */
  locale?: string;
  /**
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  presetRanges?: any[];
  /**
   * Render the month-year heading as a clickable drill **button** that navigates days → months → years (and a year label that drills months → years). **Capability-on:** this is the documented exception to the boolean-default-`false` rule — the drill navigation is the ergonomic win of this feature, so it defaults to `true`. Set `:month-year-nav="false"` to restore the static heading `<span>` (byte-identical to the pre-navigation output).
   */
  monthYearNav?: boolean;
  /**
   * How many month grids to render side by side, anchored at the view month and stepping forward (e.g. `2` for a two-up range calendar). `1` (the default) emits exactly the single-month markup with no extra wrapper element.
   */
  numberOfMonths?: number;
  /**
   * Render a Today / Clear footer row beneath the calendar grid. `Today` selects (single mode) or navigates to (range mode) the current date; `Clear` deselects. The `#footer` slot fully overrides the default row, receiving `{ today, clear, todayIso }`.
   */
  showFooter?: boolean;
  /**
   * An array of weekday indices to disable, `Number[]` where `0` = Sunday through `6` = Saturday (e.g. `[0, 6]` disables every weekend). Serializable, so it passes fine as a plain attribute. Threaded through the single gating funnel, so disabled weekdays are non-interactive, non-focusable, and marked `aria-disabled` — in agreement with day cells, drill enablement, and keyboard focus.
   */
  disabledDaysOfWeek?: any[];
  /**
   * A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`.
   */
  isDateDisabled?: ((...args: any[]) => any) | null;
  onChange?: (...args: any[]) => void;
  onRangeComplete?: (...args: any[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  renderFooter?: (ctx: FooterCtx) => ReactNode;
  renderPresets?: (ctx: PresetsCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const DatePicker = forwardRef<DatePickerHandle, DatePickerProps>(function DatePicker(_props: DatePickerProps, ref): JSX.Element {
  const __defaultDisabledDates = useState(() => (() => [])())[0];
  const __defaultPresetRanges = useState(() => (() => [])())[0];
  const __defaultDisabledDaysOfWeek = useState(() => (() => [])())[0];
  const props: Omit<DatePickerProps, 'selectionMode' | 'min' | 'max' | 'disabledDates' | 'weekStartsOn' | 'disabled' | 'locale' | 'presetRanges' | 'monthYearNav' | 'numberOfMonths' | 'showFooter' | 'disabledDaysOfWeek' | 'isDateDisabled'> & { selectionMode: string; min: (string) | null; max: (string) | null; disabledDates: any[]; weekStartsOn: number; disabled: boolean; locale: string; presetRanges: any[]; monthYearNav: boolean; numberOfMonths: number; showFooter: boolean; disabledDaysOfWeek: any[]; isDateDisabled: ((...args: any[]) => any) | null } = {
    ..._props,
    selectionMode: _props.selectionMode ?? 'single',
    min: _props.min ?? null,
    max: _props.max ?? null,
    disabledDates: _props.disabledDates ?? __defaultDisabledDates,
    weekStartsOn: _props.weekStartsOn ?? 0,
    disabled: _props.disabled ?? false,
    locale: _props.locale ?? 'en-US',
    presetRanges: _props.presetRanges ?? __defaultPresetRanges,
    monthYearNav: _props.monthYearNav ?? true,
    numberOfMonths: _props.numberOfMonths ?? 1,
    showFooter: _props.showFooter ?? false,
    disabledDaysOfWeek: _props.disabledDaysOfWeek ?? __defaultDisabledDaysOfWeek,
    isDateDisabled: _props.isDateDisabled ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, selectionMode, min, max, disabledDates, weekStartsOn, disabled, locale, presetRanges, monthYearNav, numberOfMonths, showFooter, disabledDaysOfWeek, isDateDisabled, defaultValue, onValueChange, onChange, onRangeComplete, ...rest } = _props as DatePickerProps & Record<string, unknown>;
    void value; void selectionMode; void min; void max; void disabledDates; void weekStartsOn; void disabled; void locale; void presetRanges; void monthYearNav; void numberOfMonths; void showFooter; void disabledDaysOfWeek; void isDateDisabled; void defaultValue; void onValueChange; void onChange; void onRangeComplete;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const [viewIso, setViewIso] = useState('');
  const [hoverIso, setHoverIso] = useState('');
  const [viewMode, setViewMode] = useState('days');
  const [activeDay, setActiveDay] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);
  const [activeYear, setActiveYear] = useState(0);
  const root = useRef<HTMLDivElement | null>(null);

  const { onChange: _rozieProp_onChange } = props;
  function todayIso() {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function selected(): string {
    return typeof value === 'string' ? value : '';
  }
  function readRange() {
    return normalizeRange(value);
  }
  function viewAnchor(): string {
    const s = selected();
    if (s !== '') return s;
    if (props.selectionMode === 'range') return readRange().start;
    return '';
  }
  const viewMonthGrid = useCallback((viewIsoOverride?: string) => resolveViewIso({
    viewIso: viewIsoOverride !== undefined ? viewIsoOverride : viewIso,
    value: viewAnchor(),
    today: todayIso()
  }), [todayIso, viewAnchor, viewIso]);
  function grid() {
    return buildMonthGrid({
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      selection: props.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: props.selectionMode === 'range' ? hoverIso : undefined
    });
  }
  function grids(viewIsoOverride?: string) {
    return Array.from({
      length: props.numberOfMonths
    }, (_: any, i: any) => buildMonthGrid({
      viewIso: addMonths(viewMonthGrid(viewIsoOverride), i),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      selection: props.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: props.selectionMode === 'range' ? hoverIso : undefined
    }));
  }
  function monthList() {
    return buildMonthList(viewMonthGrid(), {
      min: props.min,
      max: props.max,
      value: selected(),
      today: todayIso(),
      locale: props.locale
    });
  }
  function yearGrid() {
    return buildYearGrid(viewMonthGrid(), {
      min: props.min,
      max: props.max,
      value: selected(),
      today: todayIso()
    });
  }
  function yearRangeLabel() {
    return yearGrid().rangeLabel;
  }
  function daysGrids(viewIsoOverride?: string, assumeDaysView?: boolean) {
    return assumeDaysView || showsDaysView() ? grids(viewIsoOverride) : [];
  }
  function allDayCells(viewIsoOverride?: string, assumeDaysView?: boolean) {
    return daysGrids(viewIsoOverride, assumeDaysView).flatMap((g: any) => g.weeks.flatMap((row: any) => row));
  }
  function rovingDayInput(viewIsoOverride?: string) {
    return {
      viewIso: viewMonthGrid(viewIsoOverride),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      numberOfMonths: props.numberOfMonths,
      anchor: selected() !== '' ? selected() : props.selectionMode === 'range' ? readRange().start : ''
    };
  }
  const seedActiveDay = useCallback((viewIsoOverride?: string, assumeDaysView?: boolean) => {
    const next = resolveRovingDayIndex(allDayCells(viewIsoOverride, assumeDaysView), rovingDayInput(viewIsoOverride));
    if (next === activeDay) {
      setActiveDay(ROVING_DAY_NONE);
    }
    requestAnimationFrame(() => {
      setActiveDay(next);
    });
  }, [activeDay, allDayCells, rovingDayInput]);
  function monthHeading() {
    return monthLabel(viewMonthGrid(), props.locale);
  }
  function weekdays() {
    return weekdayLabels(props.weekStartsOn, props.locale);
  }
  function dayEnabled(iso: any) {
    return !isDayDisabled(iso, {
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled
    });
  }
  function commitValue(iso: any) {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    if (iso === selected()) return;
    setValue(iso);
    setViewIso(iso);
    props.onChange && props.onChange({
      value: iso
    });
  }
  function commitRange(iso: any) {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    const r = readRange();
    if (r.start === '' || r.end !== '') {
      // No in-progress selection, or a completed one → (re)start the anchor.
      setValue({
        start: iso,
        end: ''
      });
      setViewIso(iso);
      props.onChange && props.onChange({
        value: {
          start: iso,
          end: ''
        }
      });
    } else {
      // Anchor set, end empty → complete the range (ordered by normalizeRange).
      const next = normalizeRange({
        start: r.start,
        end: iso
      });
      setValue(next);
      setViewIso(iso);
      setHoverIso('');
      props.onChange && props.onChange({
        value: next
      });
      props.onRangeComplete && props.onRangeComplete({
        value: next
      });
    }
  }
  const onDayHover = useCallback((iso: any) => {
    if (props.selectionMode !== 'range') return;
    const r = readRange();
    if (r.start !== '' && r.end === '') setHoverIso(iso);
  }, [props.selectionMode, readRange]);
  function onDaySelect(iso: any) {
    if (props.selectionMode === 'range') commitRange(iso);else commitValue(iso);
  }
  function goToMonth(delta: any) {
    if (props.disabled) return;
    const unit = viewMode === 'years' ? 144 : viewMode === 'months' ? 12 : 1;
    const nextViewIso = addMonths(viewMonthGrid(), delta * unit);
    setViewIso(nextViewIso);
    // The rendered day set changed without going through the r-keynav page
    // mechanism (a direct header nav click) — reseed the tab stop (77-08).
    // Pass the freshly-computed viewIso directly (staleness fix, see
    // seedActiveDay's own doc comment) — $data.viewMode is UNCHANGED by this
    // function, so the live showsDaysView() read stays correct un-overridden.
    seedActiveDay(nextViewIso);
  }
  const goPrevMonth = useCallback(() => goToMonth(-1), [goToMonth]);
  const goNextMonth = useCallback(() => goToMonth(1), [goToMonth]);
  function showsDaysView(): boolean {
    return viewMode === 'days';
  }
  function showsMonthsView(): boolean {
    return viewMode === 'months';
  }
  function showsYearsView(): boolean {
    return viewMode === 'years';
  }
  const enterMonthsView = useCallback(() => {
    if (props.disabled) return;
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
    setViewMode('months');
  }, [monthList, props.disabled]);
  const enterYearsView = useCallback(() => {
    if (props.disabled) return;
    setActiveYear(resolveRovingDrillIndex(yearGrid().years));
    setViewMode('years');
  }, [props.disabled, yearGrid]);
  const selectMonth = useCallback((iso: any) => {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!monthEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('days');
    // Both the view anchor AND the days-view transition are fresh in THIS
    // call — pass both explicitly (staleness fix, see seedActiveDay's own doc
    // comment).
    seedActiveDay(iso, true);
  }, [monthEnabled, props.disabled, seedActiveDay]);
  const selectYear = useCallback((iso: any) => {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!yearEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('months');
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
  }, [monthList, props.disabled, yearEnabled]);
  function exitToDaysView() {
    setViewMode('days');
    // $data.viewIso is unchanged here (no fresher value to pass), but the
    // days-view transition IS fresh in THIS call — say so explicitly
    // (staleness fix, see seedActiveDay's own doc comment).
    seedActiveDay(undefined, true);
  }
  const onDayCommit = useCallback((i: any) => {
    const cell = allDayCells()[i];
    if (cell) onDaySelect(cell.iso);
  }, [allDayCells, onDaySelect]);
  const onDayPage = useCallback((detail: any) => {
    setViewIso(addMonths(viewMonthGrid(), detail.direction));
    const nextCells = allDayCells();
    if (detail.reason === 'boundary') {
      setActiveDay(detail.direction > 0 ? 0 : nextCells.length - 1);
    } else {
      const column = activeDay % 7;
      setActiveDay(Math.min(column, nextCells.length - 1));
    }
  }, [activeDay, allDayCells, viewMonthGrid]);
  function monthEnabled(iso: any) {
    const cell = monthList().months.find((m: any) => m.iso === iso);
    return !cell || !cell.disabled;
  }
  function yearEnabled(iso: any) {
    const cell = yearGrid().years.find((y: any) => y.iso === iso);
    return !cell || !cell.disabled;
  }
  const onDayCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      onDaySelect(iso);
    } else if (key === 'Escape') {
      // In range mode, cancel an in-progress (anchor-set) selection.
      if (props.selectionMode === 'range') {
        const r = readRange();
        if (r.start !== '' && r.end === '') {
          e.preventDefault();
          setValue({
            start: '',
            end: ''
          });
          setHoverIso('');
          _rozieProp_onChange && _rozieProp_onChange({
            value: {
              start: '',
              end: ''
            }
          });
        }
      }
    }
  }, [_rozieProp_onChange, onDaySelect, props.disabled, props.selectionMode, readRange, setValue]);
  const onMonthCommit = useCallback((i: any) => {
    const cell = monthList().months[i];
    if (cell) selectMonth(cell.iso);
  }, [monthList, selectMonth]);
  const onYearCommit = useCallback((i: any) => {
    const cell = yearGrid().years[i];
    if (cell) selectYear(cell.iso);
  }, [selectYear, yearGrid]);
  const onDrillPage = useCallback(() => {}, []);
  const onMonthCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectMonth(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }, [exitToDaysView, props.disabled, selectMonth]);
  const onYearCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectYear(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }, [exitToDaysView, props.disabled, selectYear]);
  function resolvedPresets() {
    return props.presetRanges.map((p: any) => ({
      label: p.label,
      range: rangeFromPreset(p)
    }));
  }
  function hasPresets(): boolean {
    return resolvedPresets().length > 0;
  }
  const { onRangeComplete: _rozieProp_onRangeComplete } = props;
    const applyPreset = useCallback((range: any) => {
    if (props.disabled) return;
    const next = normalizeRange(range);
    setValue(next);
    setHoverIso('');
    _rozieProp_onChange && _rozieProp_onChange({
      value: next
    });
    _rozieProp_onRangeComplete && _rozieProp_onRangeComplete({
      value: next
    });
  }, [_rozieProp_onChange, _rozieProp_onRangeComplete, props.disabled, setValue]);
  function isPresetActive(range: any) {
    const p = normalizeRange(range);
    if (p.start === '') return false;
    const r = readRange();
    return r.start === p.start && r.end === p.end;
  }
  function focus() {
    seedActiveDay();
  }
  function goToToday() {
    if (props.disabled) return;
    const nextViewIso = todayIso();
    setViewIso(nextViewIso);
    // Fresh viewIso passed directly (staleness fix, see seedActiveDay's own
    // doc comment); $data.viewMode is unchanged here.
    seedActiveDay(nextViewIso);
  }
  const selectToday = useCallback(() => {
    if (props.disabled) return;
    if (props.selectionMode === 'range') {
      goToToday();
    } else {
      commitValue(todayIso());
    }
  }, [commitValue, goToToday, props.disabled, props.selectionMode, todayIso]);
  function showsFooter(): boolean {
    return !!props.showFooter;
  }
  const clear = useCallback(() => {
    if (props.disabled) return;
    if (props.selectionMode === 'range') {
      const r = readRange();
      if (r.start === '' && r.end === '') return;
      setValue({
        start: '',
        end: ''
      });
      setHoverIso('');
      _rozieProp_onChange && _rozieProp_onChange({
        value: {
          start: '',
          end: ''
        }
      });
    } else {
      if (selected() === '') return;
      setValue('');
      _rozieProp_onChange && _rozieProp_onChange({
        value: ''
      });
    }
  }, [_rozieProp_onChange, props.disabled, props.selectionMode, readRange, selected, setValue]);

  const _seedActiveDayRef = useRef(seedActiveDay);
  _seedActiveDayRef.current = seedActiveDay;
  const _viewMonthGridRef = useRef(viewMonthGrid);
  _viewMonthGridRef.current = viewMonthGrid;
  useEffect(() => {
    const nextViewIso = _viewMonthGridRef.current();
    setViewIso(nextViewIso);
    _seedActiveDayRef.current(nextViewIso);
  }, []);

  const __rozieKeynavRootRef = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId = useId();
  useKeynav(__rozieKeynavRootRef, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (allDayCells()).map((day) => ({ disabled: day.disabled })),
    getActive: () => activeDay,
    setActive: setActiveDay,
    onCommit: (i) => { onDayCommit(i); },
    gridColumns: () => 7,
    onPage: (detail) => { onDayPage(detail); },
  });
  const __rozieKeynavRootRef1 = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId1 = useId();
  useKeynav(__rozieKeynavRootRef1, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (monthList().months).map((cell) => ({ label: cell.label, disabled: cell.disabled })),
    getActive: () => activeMonth,
    setActive: setActiveMonth,
    onCommit: (i) => { onMonthCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
  });
  const __rozieKeynavRootRef2 = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId2 = useId();
  useKeynav(__rozieKeynavRootRef2, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (yearGrid().years).map((cell) => ({ label: String(cell.year), disabled: cell.disabled })),
    getActive: () => activeYear,
    setActive: setActiveYear,
    onCommit: (i) => { onYearCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
  });

  const _rozieExposeRef = useRef({ focus, goToToday, clear });
  _rozieExposeRef.current = { focus, goToToday, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), goToToday: (...args: Parameters<typeof goToToday>): ReturnType<typeof goToToday> => _rozieExposeRef.current.goToToday(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label="Date picker" aria-disabled={!!props.disabled} {...attrs} className={clsx(clsx("rozie-datepicker", { "rozie-datepicker--disabled": props.disabled, "rozie-datepicker--multi": props.numberOfMonths > 1 }), (attrs.className as string | undefined))} data-rozie-s-6800c7a2="">
      
      {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!props.disabled }) : <div className={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Previous month" onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          {(props.monthYearNav) ? <button type="button" className={"rozie-datepicker-heading rozie-datepicker-heading-button"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Change month and year" aria-live="polite" onClick={enterMonthsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</button> : <span className={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>}<button type="button" className={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Next month" onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div className={"rozie-datepicker-grids"} ref={__rozieKeynavRootRef} data-rozie-s-6800c7a2="">
        {daysGrids().map((g, gi) => <div key={g.year + '-' + g.month} className={"rozie-datepicker-grid"} role="grid" onMouseLeave={($event) => { setHoverIso(''); }} data-rozie-s-6800c7a2="">
          <div className={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
            {weekdays().map((wd, wi) => <span key={wi} className={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>)}
          </div>

          {g.weeks.map((week, wk) => <div key={week[0].iso} className={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
            
            {week.map((day, dc) => <span key={day.iso} className={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2="">
              <button type="button" className={clsx("rozie-datepicker-day", { "is-selected": day.selected, "is-today": day.today, "is-outside": !day.inMonth, "is-in-range": day.inRange, "is-range-start": day.rangeStart, "is-range-end": day.rangeEnd, "is-in-preview": day.inPreview })} data-day={rozieAttr(day.iso)} disabled={!!props.disabled} aria-disabled={!!day.disabled} aria-label={rozieAttr(day.iso)} aria-current={rozieAttr(day.today ? 'date' : undefined)} onMouseEnter={($event) => { onDayHover(day.iso); }} onFocus={($event) => { onDayHover(day.iso); }} onKeyDown={($event) => { onDayCellKeydown(day.iso, $event); }} id={`${__rozieKeynavGroupId}-item-${gi * 42 + wk * 7 + dc}`} data-rozie-keynav-item={gi * 42 + wk * 7 + dc} data-rozie-keynav-active={activeDay === gi * 42 + wk * 7 + dc ? '' : undefined} tabIndex={activeDay === gi * 42 + wk * 7 + dc ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
            </span>)}
          </div>)}
        </div>)}
      </div>

      
      {!!(showsMonthsView()) && <div className={"rozie-datepicker-months"} data-rozie-s-6800c7a2="">
        <div className={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-drill-label"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Change year" onClick={enterYearsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthList().year)}</button>
        </div>
        <div className={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose month" ref={__rozieKeynavRootRef1} data-rozie-s-6800c7a2="">
          {monthList().months.map((cell, __rozieKeynavIndex) => <button key={cell.iso} type="button" className={clsx("rozie-datepicker-month", { "is-selected": cell.selected, "is-current": cell.current })} role="gridcell" data-month={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} onClick={($event) => { selectMonth(cell.iso); }} onKeyDown={($event) => { onMonthCellKeydown(cell.iso, $event); }} id={`${__rozieKeynavGroupId1}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={activeMonth === __rozieKeynavIndex ? '' : undefined} tabIndex={activeMonth === __rozieKeynavIndex ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell.label)}</button>)}
        </div>
      </div>}{!!(showsYearsView()) && <div className={"rozie-datepicker-years"} data-rozie-s-6800c7a2="">
        <div className={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <span className={"rozie-datepicker-drill-label"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(yearRangeLabel())}</span>
        </div>
        <div className={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose year" ref={__rozieKeynavRootRef2} data-rozie-s-6800c7a2="">
          {yearGrid().years.map((cell, __rozieKeynavIndex) => <button key={cell.iso} type="button" className={clsx("rozie-datepicker-year", { "is-selected": cell.selected, "is-current": cell.current })} role="gridcell" data-year={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} onClick={($event) => { selectYear(cell.iso); }} onKeyDown={($event) => { onYearCellKeydown(cell.iso, $event); }} id={`${__rozieKeynavGroupId2}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={activeYear === __rozieKeynavIndex ? '' : undefined} tabIndex={activeYear === __rozieKeynavIndex ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell.year)}</button>)}
        </div>
      </div>}{(props.renderFooter ?? props.slots?.['footer']) ? ((props.renderFooter ?? props.slots?.['footer']) as Function)({ today: selectToday, clear, todayIso: todayIso() }) : !!(showsFooter()) && <div className={"rozie-datepicker-footer"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-footer-btn rozie-datepicker-today"} disabled={!!props.disabled} aria-disabled={!!props.disabled} onClick={selectToday} data-rozie-s-6800c7a2="">Today</button>
          <button type="button" className={"rozie-datepicker-footer-btn rozie-datepicker-clear"} disabled={!!props.disabled} aria-disabled={!!props.disabled} onClick={clear} data-rozie-s-6800c7a2="">Clear</button>
        </div>}

      
      {(props.renderPresets ?? props.slots?.['presets']) ? ((props.renderPresets ?? props.slots?.['presets']) as Function)({ presets: resolvedPresets(), apply: applyPreset }) : !!(hasPresets()) && <div className={"rozie-datepicker-presets"} role="group" aria-label="Date range presets" data-rozie-s-6800c7a2="">
          {resolvedPresets().map((p) => <button key={p.label} type="button" className={clsx("rozie-datepicker-preset", { "is-active": isPresetActive(p.range) })} aria-pressed={!!isPresetActive(p.range)} disabled={!!props.disabled} onClick={($event) => { applyPreset(p.range); }} data-rozie-s-6800c7a2="">{rozieDisplay(p.label)}</button>)}
        </div>}
    </div>
    </>
  );
});
export default DatePicker;
