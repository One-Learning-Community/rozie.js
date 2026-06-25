import type { JSX } from 'solid-js';
import { For, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieDisplay } from '@rozie/runtime-solid';
import { addDays, addMonths, buildMonthGrid, isDayDisabled, isIsoDate, monthLabel, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

__rozieInjectStyle('DatePicker-6800c7a2', `.rozie-datepicker[data-rozie-s-6800c7a2] {
  display: inline-block;
  font: var(--rozie-datepicker-font, inherit);
  color: var(--rozie-datepicker-fg, #1a1a1a);
  background: var(--rozie-datepicker-bg, #fff);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-radius, 10px);
  padding: var(--rozie-datepicker-padding, 0.75rem);
}
.rozie-datepicker-header[data-rozie-s-6800c7a2] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-datepicker-gap, 0.25rem);
  margin-bottom: var(--rozie-datepicker-header-gap, 0.5rem);
}
.rozie-datepicker-heading[data-rozie-s-6800c7a2] {
  font-weight: var(--rozie-datepicker-heading-weight, 600);
  font-size: var(--rozie-datepicker-heading-size, 0.95rem);
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2] {
  box-sizing: border-box;
  width: var(--rozie-datepicker-nav-size, 2rem);
  height: var(--rozie-datepicker-nav-size, 2rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  color: inherit;
  background: var(--rozie-datepicker-nav-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-nav-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2]:hover {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2]:focus-visible,
.rozie-datepicker-day[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-grid[data-rozie-s-6800c7a2] {
  display: grid;
  gap: var(--rozie-datepicker-cell-gap, 0.125rem);
}
.rozie-datepicker-weekdays[data-rozie-s-6800c7a2],
.rozie-datepicker-week[data-rozie-s-6800c7a2] {
  display: grid;
  grid-template-columns: repeat(7, var(--rozie-datepicker-cell-size, 2.25rem));
  gap: var(--rozie-datepicker-cell-gap, 0.125rem);
}
.rozie-datepicker-weekday[data-rozie-s-6800c7a2] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--rozie-datepicker-weekday-height, 1.75rem);
  font-size: var(--rozie-datepicker-weekday-size, 0.72rem);
  font-weight: var(--rozie-datepicker-weekday-weight, 600);
  color: var(--rozie-datepicker-weekday-fg, rgba(0, 0, 0, 0.5));
  text-transform: uppercase;
  user-select: none;
}
.rozie-datepicker-cell[data-rozie-s-6800c7a2] {
  display: inline-flex;
}
.rozie-datepicker-day[data-rozie-s-6800c7a2] {
  box-sizing: border-box;
  width: var(--rozie-datepicker-cell-size, 2.25rem);
  height: var(--rozie-datepicker-cell-size, 2.25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: var(--rozie-datepicker-day-size, 0.85rem);
  color: inherit;
  background: var(--rozie-datepicker-day-bg, transparent);
  border: var(--rozie-datepicker-day-border-width, 1px) solid transparent;
  border-radius: var(--rozie-datepicker-day-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-day[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-day.is-outside[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-outside-fg, rgba(0, 0, 0, 0.35));
}
.rozie-datepicker-day.is-today[data-rozie-s-6800c7a2]:not(.is-selected[data-rozie-s-6800c7a2]) {
  border-color: var(--rozie-datepicker-today-border, var(--rozie-datepicker-accent, #0066cc));
}
.rozie-datepicker-day.is-selected[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-day[data-rozie-s-6800c7a2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker--disabled[data-rozie-s-6800c7a2] {
  opacity: var(--rozie-datepicker-disabled-opacity, 0.55);
  pointer-events: none;
}`);

interface HeaderSlotCtx { label: any; prev: any; next: any; disabled: any; }

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
  onChange?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: DatePickerHandle) => void;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function DatePicker(_props: DatePickerProps): JSX.Element {
  const _merged = mergeProps({ min: null, max: null, disabledDates: (() => [])(), weekStartsOn: 0, disabled: false, locale: 'en-US' }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'min', 'max', 'disabledDates', 'weekStartsOn', 'disabled', 'locale', 'ref']);
  onMount(() => { local.ref?.({ focus, goToToday, clear }); });

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');
  const [viewIso, setViewIso] = createSignal('');
  onMount(() => {
    setViewIso(viewMonthGrid());
  });
  let rootRef: HTMLElement | null = null;

  // ---- today (deterministic per-render read) -----------------------------
  // Today's ISO, computed from the local clock. A plain function so each call is
  // fresh (a date picker open across midnight should follow the wall clock).
  function todayIso() {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // ---- derived view (ONE plain function, uniform x6) ---------------------
  // The current selected ISO, normalized to a string.
  function selected() {
    return typeof value() === 'string' ? value() : '';
  }

  // The resolved month anchor: the local view state, falling back to value/today.
  function viewMonthGrid() {
    return resolveViewIso({
      viewIso: viewIso(),
      value: selected(),
      today: todayIso()
    });
  }

  // The whole render model in a single call: { year, month, weeks }. A PLAIN
  // function (not $computed) so it reads uniformly on all six targets and can be
  // aliased in handlers without the Solid accessor divergence. Returns a FRESH
  // object each call — never feed it to a reference-equality $watch getter.
  function grid() {
    return buildMonthGrid({
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled
    });
  }

  // Roving-tabindex value for a day cell: the selected day (or today, when nothing
  // is selected) is the single tab stop (0), the rest are -1. The return type is
  // annotated `number | undefined` ON PURPOSE — the React emitter wraps every
  // numeric `:attr` binding in `(expr) ?? undefined`, and a PROVABLY non-null
  // value (a bare `0`/`-1` ternary) trips TS2869 "right operand of ?? is
  // unreachable". Routing tabindex through this nullable-typed helper keeps the
  // `?? undefined` reachable (the pagination `tabIndexFor` precedent).
  function dayTabIndex(day: any): number | undefined {
    return day.selected || selected() === '' && day.today ? 0 : -1;
  }

  // The localized month-year heading. NAMED `monthHeading`, NOT `label` — a bare
  // `label` helper becomes a class field on the Lit custom element and a `title`
  // would collide with the inherited HTMLElement.title; `monthHeading` is clear.
  function monthHeading() {
    return monthLabel(viewMonthGrid(), local.locale);
  }
  // The seven weekday header labels, rotated by weekStartsOn.
  function weekdays() {
    return weekdayLabels(local.weekStartsOn, local.locale);
  }

  // Whether a given ISO can be selected (the template gates clicks on it too).
  function dayEnabled(iso: any) {
    return !isDayDisabled(iso, {
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled
    });
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Select an ISO date: write the model + emit change. NOT named `setValue`
  // (collides with React's generated `value` model setter → ROZ524). A no-op
  // (re-selecting the same date) still re-emits intentionally? No — guard it.
  function commitValue(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    if (iso === selected()) return;
    setValue(iso);
    setViewIso(iso);
    _props.onChange?.({
      value: iso
    });
  }

  // ---- month navigation --------------------------------------------------
  function goToMonth(delta: any) {
    if (local.disabled) return;
    setViewIso(addMonths(viewMonthGrid(), delta));
  }
  function goPrevMonth() {
    return goToMonth(-1);
  }
  function goNextMonth() {
    return goToMonth(1);
  }

  // ---- focus choreography (container ref, post-mount only) ---------------
  // Read $refs.root only here / in handlers / in $expose verbs (all post-mount →
  // ROZ123-safe). querySelectorAll reaches the day cells inside Lit's shadow root
  // too. Focus a day by its ISO; the [data-day] attribute carries the iso.
  function dayCells() {
    const root = rootRef;
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-day]')) as HTMLElement[];
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

  // Move the roving focus by `days`, crossing into an adjacent month when the
  // target leaves the displayed grid. Skips nothing — disabled days are still
  // focusable (standard grid pattern) but not selectable.
  function moveFocus(fromIso: any, days: any) {
    if (local.disabled) return;
    const next = addDays(fromIso, days);
    const g = grid();
    // If `next` is not in the rendered weeks, swing the view to its month first.
    const present = g.weeks.some((row: any) => row.some((d: any) => d.iso === next));
    if (!present) setViewIso(next);
    focusDayIso(next);
  }

  // ---- keyboard ----------------------------------------------------------
  // Arrow keys move a day, Home/End to the week bounds, PageUp/PageDown change the
  // month, Enter/Space select. The focused day's iso rides on [data-day].
  function onDayKeydown(iso: any, e: any) {
    if (local.disabled) return;
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
  }

  // Column index (0..6) of `iso` within its rendered week, honoring weekStartsOn.
  function weekdayOffset(iso: any) {
    const g = grid();
    for (const row of g.weeks as any) {
      for (let c = 0; c < row.length; c++) {
        if (row[c].iso === iso) return c;
      }
    }
    return 0;
  }

  // The day-delta to the same column one month away (PageUp/PageDown). Computed as
  // the difference between `iso` and `addMonths(iso, dir)` so the focus lands on
  // the clamped same-day-of-month.
  function daysInMonthSpan(iso: any, dir: any) {
    const a = isoToMs(iso);
    const b = isoToMs(addMonths(iso, dir));
    return Math.round((b - a) / 86400000);
  }
  function isoToMs(iso: any) {
    const t = isIsoDate(iso) ? Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : 0;
    return t;
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // Seed the view month from value / today on mount.

  // focus() — focus the selected day, or today, or the first day of the view.
  // DELIBERATELY overrides HTMLElement.focus on Lit (ROZ137 warn, accepted).
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

  // goToToday() — swing the view to the current month (no selection change).
  function goToToday() {
    if (local.disabled) return;
    setViewIso(todayIso());
  }

  // clear() — deselect (write '' back, emit change).
  function clear() {
    if (local.disabled) return;
    if (selected() === '') return;
    setValue('');
    _props.onChange?.({
      value: ''
    });
  }

  return (
    <>
    <div classList={{ 'rozie-datepicker--disabled': local.disabled }} ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label="Date picker" aria-disabled={!!local.disabled} {...attrs} class={"rozie-datepicker" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6800c7a2="">
      
      {(_props.headerSlot ?? _props.slots?.['header'])?.({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!local.disabled }) ?? <div class={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Previous month" class={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!local.disabled} onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          <span class={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>
          <button type="button" aria-disabled={!!local.disabled} aria-label="Next month" class={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!local.disabled} onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div class={"rozie-datepicker-grid"} role="grid" data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
          <For each={weekdays()}>{(wd, wi) => <span class={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>}</For>
        </div>

        <For each={grid().weeks}>{(week, wk) => <div class={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
          <For each={week}>{(day) => <span class={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!day.selected} data-rozie-s-6800c7a2="">
            <button type="button" data-day={rozieAttr(day.iso)} aria-disabled={!!day.disabled} aria-label={rozieAttr(day.iso)} aria-current={rozieAttr(day.today ? 'date' : null)} class={"rozie-datepicker-day"} classList={{ 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth }} tabIndex={rozieAttr(dayTabIndex(day))} disabled={!!day.disabled} onClick={($event) => { commitValue(day.iso); }} onKeyDown={($event) => { onDayKeydown(day.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
          </span>}</For>
        </div>}</For>
      </div>
    </div>
    </>
  );
}
