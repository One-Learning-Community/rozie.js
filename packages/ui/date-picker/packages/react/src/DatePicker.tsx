import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState } from '@rozie/runtime-react';
import './DatePicker.css';
import { addDays, addMonths, buildMonthGrid, isDayDisabled, isIsoDate, monthLabel, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface HeaderCtx { label: any; prev: any; next: any; disabled: any; }

interface DatePickerProps {
  /**
   * The selected date as an ISO `YYYY-MM-DD` string (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). An empty string `""` means no date is selected; selecting a day writes the new ISO string back and emits `change`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
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
  onChange?: (...args: any[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const DatePicker = forwardRef<DatePickerHandle, DatePickerProps>(function DatePicker(_props: DatePickerProps, ref): JSX.Element {
  const __defaultDisabledDates = useState(() => (() => [])())[0];
  const props: Omit<DatePickerProps, 'min' | 'max' | 'disabledDates' | 'weekStartsOn' | 'disabled' | 'locale'> & { min: (string) | null; max: (string) | null; disabledDates: any[]; weekStartsOn: number; disabled: boolean; locale: string } = {
    ..._props,
    min: _props.min ?? null,
    max: _props.max ?? null,
    disabledDates: _props.disabledDates ?? __defaultDisabledDates,
    weekStartsOn: _props.weekStartsOn ?? 0,
    disabled: _props.disabled ?? false,
    locale: _props.locale ?? 'en-US',
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, min, max, disabledDates, weekStartsOn, disabled, locale, defaultValue, onValueChange, ...rest } = _props as DatePickerProps & Record<string, unknown>;
    void value; void min; void max; void disabledDates; void weekStartsOn; void disabled; void locale; void defaultValue; void onValueChange;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const [viewIso, setViewIso] = useState('');
  const root = useRef<HTMLDivElement | null>(null);

  function todayIso() {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function selected() {
    return typeof value === 'string' ? value : '';
  }
  const viewMonthGrid = useCallback(() => resolveViewIso({
    viewIso: viewIso,
    value: selected(),
    today: todayIso()
  }), [selected, todayIso, viewIso]);
  function grid() {
    return buildMonthGrid({
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled
    });
  }
  function dayTabIndex(day: any): number | undefined {
    return day.selected || selected() === '' && day.today ? 0 : -1;
  }
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
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled
    });
  }
  const { onChange: _rozieProp_onChange } = props;
    const commitValue = useCallback((iso: any) => {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    if (iso === selected()) return;
    setValue(iso);
    setViewIso(iso);
    _rozieProp_onChange && _rozieProp_onChange({
      value: iso
    });
  }, [_rozieProp_onChange, dayEnabled, props.disabled, selected, setValue]);
  function goToMonth(delta: any) {
    if (props.disabled) return;
    setViewIso(addMonths(viewMonthGrid(), delta));
  }
  const goPrevMonth = useCallback(() => goToMonth(-1), [goToMonth]);
  const goNextMonth = useCallback(() => goToMonth(1), [goToMonth]);
  function dayCells() {
    const root$local = root.current;
    if (!root$local) return [];
    return Array.from(root$local.querySelectorAll('[data-day]')) as HTMLElement[];
  }
  function focusDayIso(iso: any) {
    const cells = dayCells();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute('data-day') === iso) {
        cells[i].focus();
        return;
      }
    }
  }
  function moveFocus(fromIso: any, days: any) {
    if (props.disabled) return;
    const next = addDays(fromIso, days);
    const g = grid();
    // If `next` is not in the rendered weeks, swing the view to its month first.
    const present = g.weeks.some((row: any) => row.some((d: any) => d.iso === next));
    if (!present) setViewIso(next);
    focusDayIso(next);
  }
  const onDayKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus(iso, -1);
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      moveFocus(iso, 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(iso, -7);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(iso, 7);
    } else if (key === 'Home') {
      e.preventDefault();
      moveFocus(iso, -weekdayOffset(iso));
    } else if (key === 'End') {
      e.preventDefault();
      moveFocus(iso, 6 - weekdayOffset(iso));
    } else if (key === 'PageUp') {
      e.preventDefault();
      moveFocus(iso, 0 - daysInMonthSpan(iso, -1));
    } else if (key === 'PageDown') {
      e.preventDefault();
      moveFocus(iso, daysInMonthSpan(iso, 1));
    } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      commitValue(iso);
    }
  }, [commitValue, daysInMonthSpan, moveFocus, props.disabled, weekdayOffset]);
  function weekdayOffset(iso: any) {
    const g = grid();
    for (const row of g.weeks as any) {
      for (let c = 0; c < row.length; c++) {
        if (row[c].iso === iso) return c;
      }
    }
    return 0;
  }
  function daysInMonthSpan(iso: any, dir: any) {
    const a = isoToMs(iso);
    const b = isoToMs(addMonths(iso, dir));
    return Math.round((b - a) / 86400000);
  }
  function isoToMs(iso: any) {
    const t = isIsoDate(iso) ? Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : 0;
    return t;
  }
  function focus() {
    const sel = selected();
    const t = todayIso();
    const g = grid();
    const present = (iso: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === iso));
    if (sel && present(sel)) {
      focusDayIso(sel);
    } else if (present(t)) {
      focusDayIso(t);
    } else {
      const first = g.weeks[0] && g.weeks[0][0] ? g.weeks[0][0].iso : '';
      if (first) focusDayIso(first);
    }
  }
  function goToToday() {
    if (props.disabled) return;
    setViewIso(todayIso());
  }
  function clear() {
    if (props.disabled) return;
    if (selected() === '') return;
    setValue('');
    props.onChange && props.onChange({
      value: ''
    });
  }

  useEffect(() => {
    setViewIso(viewMonthGrid());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ focus, goToToday, clear });
  _rozieExposeRef.current = { focus, goToToday, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), goToToday: (...args: Parameters<typeof goToToday>): ReturnType<typeof goToToday> => _rozieExposeRef.current.goToToday(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label="Date picker" aria-disabled={!!props.disabled} {...attrs} className={clsx(clsx("rozie-datepicker", { "rozie-datepicker--disabled": props.disabled }), (attrs.className as string | undefined))} data-rozie-s-6800c7a2="">
      
      {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!props.disabled }) : <div className={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Previous month" onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          <span className={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>
          <button type="button" className={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label="Next month" onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div className={"rozie-datepicker-grid"} role="grid" data-rozie-s-6800c7a2="">
        <div className={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
          {weekdays().map((wd, wi) => <span key={wi} className={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>)}
        </div>

        {grid().weeks.map((week, wk) => <div key={wk} className={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
          {week.map((day) => <span key={day.iso} className={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!day.selected} data-rozie-s-6800c7a2="">
            <button type="button" className={clsx("rozie-datepicker-day", { "is-selected": day.selected, "is-today": day.today, "is-outside": !day.inMonth })} data-day={rozieAttr(day.iso)} tabIndex={(dayTabIndex(day)) ?? undefined} disabled={!!day.disabled} aria-disabled={!!day.disabled} aria-label={rozieAttr(day.iso)} aria-current={rozieAttr(day.today ? 'date' : undefined)} onClick={($event) => { commitValue(day.iso); }} onKeyDown={($event) => { onDayKeydown(day.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
          </span>)}
        </div>)}
      </div>
    </div>
    </>
  );
});
export default DatePicker;
