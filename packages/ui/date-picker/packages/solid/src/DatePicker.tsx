import type { JSX } from 'solid-js';
import { For, Show, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, createControllableSignal, createKeynav, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { addMonths, buildMonthGrid, buildMonthList, buildYearGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveRovingDayIndex, resolveRovingDrillIndex, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

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
.rozie-datepicker-grids[data-rozie-s-6800c7a2] {
  display: contents;
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
.rozie-datepicker-day[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]) {
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
.rozie-datepicker-day.is-in-range[data-rozie-s-6800c7a2] {
  background: var(--rozie-datepicker-range-bg, rgba(0, 102, 204, 0.14));
  border-radius: 0;
}
.rozie-datepicker-day.is-in-preview[data-rozie-s-6800c7a2] {
  background: var(--rozie-datepicker-preview-bg, rgba(0, 102, 204, 0.08));
  border-radius: 0;
}
.rozie-datepicker-day.is-range-start[data-rozie-s-6800c7a2],
.rozie-datepicker-day.is-range-end[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
  border-color: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-day.is-range-start[data-rozie-s-6800c7a2] {
  border-top-left-radius: var(--rozie-datepicker-day-radius, 6px);
  border-bottom-left-radius: var(--rozie-datepicker-day-radius, 6px);
}
.rozie-datepicker-day.is-range-end[data-rozie-s-6800c7a2] {
  border-top-right-radius: var(--rozie-datepicker-day-radius, 6px);
  border-bottom-right-radius: var(--rozie-datepicker-day-radius, 6px);
}
.rozie-datepicker-day[aria-disabled='true'][data-rozie-s-6800c7a2] {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker--disabled[data-rozie-s-6800c7a2] {
  opacity: var(--rozie-datepicker-disabled-opacity, 0.55);
  pointer-events: none;
}
.rozie-datepicker-presets[data-rozie-s-6800c7a2] {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rozie-datepicker-presets-gap, 0.25rem);
  margin-top: var(--rozie-datepicker-presets-gap-top, 0.5rem);
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2] {
  font: inherit;
  font-size: var(--rozie-datepicker-preset-size, 0.78rem);
  color: var(--rozie-datepicker-preset-fg, inherit);
  background: var(--rozie-datepicker-preset-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-preset-radius, 999px);
  padding: var(--rozie-datepicker-preset-padding, 0.2rem 0.6rem);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-preset.is-active[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker-drill-header[data-rozie-s-6800c7a2] {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--rozie-datepicker-drill-header-gap, 0.5rem);
}
.rozie-datepicker-drill-label[data-rozie-s-6800c7a2] {
  font: inherit;
  font-weight: var(--rozie-datepicker-heading-weight, 600);
  font-size: var(--rozie-datepicker-heading-size, 0.95rem);
  color: inherit;
  background: var(--rozie-datepicker-drill-label-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid transparent;
  border-radius: var(--rozie-datepicker-nav-radius, 6px);
  padding: var(--rozie-datepicker-drill-label-padding, 0.15rem 0.5rem);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.rozie-datepicker-drill-label[data-rozie-s-6800c7a2]:hover {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-drill-label[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-heading-button[data-rozie-s-6800c7a2] {
  font: inherit;
  color: inherit;
  background: var(--rozie-datepicker-drill-label-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid transparent;
  border-radius: var(--rozie-datepicker-nav-radius, 6px);
  padding: var(--rozie-datepicker-drill-label-padding, 0.15rem 0.5rem);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.rozie-datepicker-heading-button[data-rozie-s-6800c7a2]:hover {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-months[data-rozie-s-6800c7a2] .rozie-datepicker-drill-grid[data-rozie-s-6800c7a2],
.rozie-datepicker-years[data-rozie-s-6800c7a2] .rozie-datepicker-drill-grid[data-rozie-s-6800c7a2] {
  display: grid;
  grid-template-columns: repeat(var(--rozie-datepicker-drill-cols, 3), 1fr);
  gap: var(--rozie-datepicker-drill-gap, 0.25rem);
}
.rozie-datepicker-month[data-rozie-s-6800c7a2],
.rozie-datepicker-year[data-rozie-s-6800c7a2] {
  box-sizing: border-box;
  height: var(--rozie-datepicker-drill-cell-height, 2.5rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: var(--rozie-datepicker-drill-cell-size, 0.85rem);
  color: inherit;
  background: var(--rozie-datepicker-day-bg, transparent);
  border: var(--rozie-datepicker-day-border-width, 1px) solid transparent;
  border-radius: var(--rozie-datepicker-day-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-month[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]),
.rozie-datepicker-year[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-month.is-current[data-rozie-s-6800c7a2]:not(.is-selected[data-rozie-s-6800c7a2]),
.rozie-datepicker-year.is-current[data-rozie-s-6800c7a2]:not(.is-selected[data-rozie-s-6800c7a2]) {
  border-color: var(--rozie-datepicker-today-border, var(--rozie-datepicker-accent, #0066cc));
}
.rozie-datepicker-month.is-selected[data-rozie-s-6800c7a2],
.rozie-datepicker-year.is-selected[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-month[data-rozie-s-6800c7a2]:focus-visible,
.rozie-datepicker-year[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-month[aria-disabled='true'][data-rozie-s-6800c7a2],
.rozie-datepicker-year[aria-disabled='true'][data-rozie-s-6800c7a2] {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker-footer[data-rozie-s-6800c7a2] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-datepicker-footer-gap, 0.25rem);
  margin-top: var(--rozie-datepicker-footer-gap-top, 0.5rem);
}
.rozie-datepicker-footer-btn[data-rozie-s-6800c7a2] {
  font: inherit;
  font-size: var(--rozie-datepicker-footer-size, 0.78rem);
  color: var(--rozie-datepicker-footer-fg, inherit);
  background: var(--rozie-datepicker-footer-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-footer-radius, 6px);
  padding: var(--rozie-datepicker-footer-padding, 0.2rem 0.6rem);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-footer-btn[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-footer-btn[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-footer-btn[data-rozie-s-6800c7a2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker--multi[data-rozie-s-6800c7a2] .rozie-datepicker-grid[data-rozie-s-6800c7a2] {
  display: inline-grid;
  vertical-align: top;
}
.rozie-datepicker--multi[data-rozie-s-6800c7a2] .rozie-datepicker-grid[data-rozie-s-6800c7a2] + .rozie-datepicker-grid[data-rozie-s-6800c7a2] {
  margin-left: var(--rozie-datepicker-month-gap, 1rem);
}`);

interface HeaderSlotCtx { label: any; prev: any; next: any; disabled: any; }

interface FooterSlotCtx { today: any; clear: any; todayIso: any; }

interface PresetsSlotCtx { presets: any; apply: any; }

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
  onChange?: (...args: unknown[]) => void;
  onRangeComplete?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  footerSlot?: (ctx: FooterSlotCtx) => JSX.Element;
  presetsSlot?: (ctx: PresetsSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: DatePickerHandle) => void;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function DatePicker(_props: DatePickerProps): JSX.Element {
  const _merged = mergeProps({ selectionMode: 'single', min: null, max: null, disabledDates: (() => [])() as any[], weekStartsOn: 0, disabled: false, locale: 'en-US', presetRanges: (() => [])() as any[], monthYearNav: true, numberOfMonths: 1, showFooter: false, disabledDaysOfWeek: (() => [])() as any[], isDateDisabled: null }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'selectionMode', 'min', 'max', 'disabledDates', 'weekStartsOn', 'disabled', 'locale', 'presetRanges', 'monthYearNav', 'numberOfMonths', 'showFooter', 'disabledDaysOfWeek', 'isDateDisabled', 'ref', 'onChange', 'onRangeComplete']);
  onMount(() => { local.ref?.({ focus, goToToday, clear }); });

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');
  const [viewIso, setViewIso] = createSignal('');
  const [hoverIso, setHoverIso] = createSignal('');
  const [viewMode, setViewMode] = createSignal('days');
  const [activeDay, setActiveDay] = createSignal(0);
  const [activeMonth, setActiveMonth] = createSignal(0);
  const [activeYear, setActiveYear] = createSignal(0);
  onMount(() => {
    setViewIso(viewMonthGrid());
    seedActiveDay();
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
  // The current selected ISO, normalized to a string. In range mode the value is
  // an object → this returns '' (so the SINGLE-mode grid highlight no-ops there).
  // `$props.value` lowers to an accessor CALL on both Solid (`value()`) and
  // Angular (`this.value()`); both emitters now hoist a local before the
  // `typeof` guard (hoistPolymorphicModelGuards, Solid emitter-hardening backlog
  // item #11 / Angular quick task 260711-v2l), so this inline guard narrows
  // cleanly on all six targets.
  function selected(): string {
    const v = value();
    return typeof v === 'string' ? v : '';
  }

  // The RANGE normalization funnel (mirrors selected()): coerce the polymorphic
  // `value` into a canonical ordered { start, end }. ALL range logic reads through
  // this — never $props.value directly — so the polymorph is funneled in one place.
  function readRange() {
    return normalizeRange(value());
  }

  // The resolved month anchor: the local view state, falling back to the selected
  // value, then today. In range mode `selected()` is '' (the value is an object),
  // so fall back to the range's `start` endpoint — a DatePicker opened with a
  // pre-selected range must show that range's month, mirroring how single mode
  // pins the view to its selected ISO (else range mode always opens on today).
  function viewAnchor(): string {
    const s = selected();
    if (s !== '') return s;
    if (local.selectionMode === 'range') return readRange().start;
    return '';
  }
  function viewMonthGrid() {
    return resolveViewIso({
      viewIso: viewIso(),
      value: viewAnchor(),
      today: todayIso()
    });
  }

  // The whole render model in a single call: { year, month, weeks }. A PLAIN
  // function (not $computed) so it reads uniformly on all six targets and can be
  // aliased in handlers without the Solid accessor divergence. Returns a FRESH
  // object each call — never feed it to a reference-equality $watch getter. In
  // range mode it additionally passes `selection` (the ordered range) + the live
  // `previewEnd` (the hovered day); in single mode those are omitted (undefined →
  // all range flags false → byte-stable single path).
  function grid() {
    return buildMonthGrid({
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      disabledDaysOfWeek: local.disabledDaysOfWeek,
      isDateDisabled: local.isDateDisabled,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled,
      selection: local.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: local.selectionMode === 'range' ? hoverIso() : undefined
    });
  }

  // The multi-month render model: N grids stepping forward from the view month,
  // so `numberOfMonths` renders side by side. A PLAIN function (uniform x6),
  // mirroring grid() exactly but with the view anchor advanced by `i` months.
  // numberOfMonths === 1 yields a one-element array whose single grid === grid().
  function grids() {
    return Array.from({
      length: local.numberOfMonths
    }, (_: any, i: any) => buildMonthGrid({
      viewIso: addMonths(viewMonthGrid(), i),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      disabledDaysOfWeek: local.disabledDaysOfWeek,
      isDateDisabled: local.isDateDisabled,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled,
      selection: local.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: local.selectionMode === 'range' ? hoverIso() : undefined
    }));
  }

  // ---- drill models (months / years panels) ------------------------------
  // The 12-cell month picker for the 'months' drill view + the 12-cell year
  // picker (decade-aligned) for the 'years' view. PLAIN functions (uniform x6),
  // each a fresh object per call. The gates that matter to a whole month/year span
  // are min/max (buildMonthList/buildYearGrid own the entire-span test); the
  // per-day weekday/predicate gates apply only in the days grid.
  function monthList() {
    return buildMonthList(viewMonthGrid(), {
      min: local.min,
      max: local.max,
      value: selected(),
      today: todayIso(),
      locale: local.locale
    });
  }
  function yearGrid() {
    return buildYearGrid(viewMonthGrid(), {
      min: local.min,
      max: local.max,
      value: selected(),
      today: todayIso()
    });
  }
  // The decade window label (e.g. "2020–2031") shown in the years-panel header.
  function yearRangeLabel() {
    return yearGrid().rangeLabel;
  }

  // The day-grid iterable for the template: the N month grids in the 'days' view,
  // or an empty array in the months/years drill views. Gating the r-for through an
  // EMPTY array (rather than an r-if on the same element) keeps the day-grid
  // element free of an r-if+r-for combo. The panels render inside the ONE
  // layout-neutral `.rozie-datepicker-grids` wrapper (77-08 — the r-keynav day
  // grid's root; `display: contents` in the style block below keeps it out of
  // the render tree, so this stays present regardless of numberOfMonths without
  // perturbing the single-month layout).
  function daysGrids() {
    return showsDaysView() ? grids() : [];
  }

  // The flat, render-order concatenation of every rendered panel's day cells
  // (panels in order, weeks in order, days in order) — the r-keynav day grid's
  // `:source` (77-08). Every panel is always exactly 42 cells (6 weeks x 7
  // days), so a cell's flat index is `panelIndex * 42 + weekIndex * 7 +
  // columnIndex` — the day button's own explicit r-keynav-item index expression
  // computes this exactly. Empty while a drill panel is showing, mirroring
  // daysGrids()'s own gate.
  function allDayCells() {
    return daysGrids().flatMap((g: any) => g.weeks.flatMap((row: any) => row));
  }

  // The day grid's roving/active-index resolution input — the SAME shape the
  // pre-retrofit rovingDayIso() built, now feeding resolveRovingDayIndex
  // (buildMonthGrid.ts) instead of resolveRovingIso directly, so the tab stop,
  // entry focus and the focus() expose handle can never disagree (the
  // 260802-hla invariant). `anchor` mirrors the existing viewAnchor() funnel —
  // the selected value in single mode, else the in-progress range anchor — so
  // a range picker gets a tab stop too.
  function rovingDayInput() {
    return {
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      disabledDaysOfWeek: local.disabledDaysOfWeek,
      isDateDisabled: local.isDateDisabled,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled,
      numberOfMonths: local.numberOfMonths,
      anchor: selected() !== '' ? selected() : local.selectionMode === 'range' ? readRange().start : ''
    };
  }

  // Seed $data.activeDay from the SAME anchor-in-view → today-in-view →
  // first-enabled-in-month-day fallback the pre-retrofit tab stop used
  // (resolveRovingDayIndex, buildMonthGrid.ts) — called on mount, after a
  // direct month/today nav, and whenever a drill panel returns to the days
  // view (selectMonth/exitToDaysView). The r-keynav grid controller lands DOM
  // focus itself whenever this value changes — see the day grid's template
  // root. NOT called from onDayPage below, which computes its own precise
  // landing index per SPEC §4.1 instead of this fallback chain.
  function seedActiveDay() {
    setActiveDay(resolveRovingDayIndex(allDayCells(), rovingDayInput()));
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
      disabledDaysOfWeek: local.disabledDaysOfWeek,
      isDateDisabled: local.isDateDisabled,
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

  // ---- range write funnel (direction-agnostic two-click state machine) ----
  // The anchor IS the partial model's `start` (end ''); there is no separate
  // anchor field. First click (no in-progress range, OR a completed one →
  // restart): write { start: iso, end: '' } + emit change. Second click
  // (anchor set, end empty → completing): write the ORDERED { start, end } +
  // clear the preview + emit change AND rangeComplete. Endpoints are compared by
  // VALUE (never object ===, Pitfall-4).
  function commitRange(iso: any) {
    if (local.disabled) return;
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
      _props.onChange?.({
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
      _props.onChange?.({
        value: next
      });
      _props.onRangeComplete?.({
        value: next
      });
    }
  }

  // Hover preview: only meaningful in range mode while a range is in progress
  // (anchor set, end empty). Records the hovered ISO so the grid lights the
  // direction-agnostic preview band. Otherwise a no-op.
  function onDayHover(iso: any) {
    if (local.selectionMode !== 'range') return;
    const r = readRange();
    if (r.start !== '' && r.end === '') setHoverIso(iso);
  }

  // Day-select dispatch: route a click / Enter / Space through the mode-appropriate
  // funnel (range → commitRange, single → commitValue).
  function onDaySelect(iso: any) {
    if (local.selectionMode === 'range') commitRange(iso);else commitValue(iso);
  }

  // ---- month navigation (view-mode-aware ‹ › step) -----------------------
  // The prev/next step advances the view anchor by ONE UNIT of the current drill
  // view: a month in 'days', a year (12 months) in 'months', 12 years (144
  // months) in 'years'. In the default 'days' view the delta is `delta` months —
  // byte-identical to the pre-navigation behavior, so `:month-year-nav="false"`
  // (which can never leave 'days') is unchanged.
  function goToMonth(delta: any) {
    if (local.disabled) return;
    const unit = viewMode() === 'years' ? 144 : viewMode() === 'months' ? 12 : 1;
    setViewIso(addMonths(viewMonthGrid(), delta * unit));
    // The rendered day set changed without going through the r-keynav page
    // mechanism (a direct header nav click) — reseed the tab stop (77-08).
    seedActiveDay();
  }
  function goPrevMonth() {
    return goToMonth(-1);
  }
  function goNextMonth() {
    return goToMonth(1);
  }

  // ---- view-mode drill state machine (mutates $data.viewMode/$data.viewIso
  // ONLY — never $model.value; drilling is a pure VIEW concern) -------------
  // Named boolean guards (never a bare `.length` / bare string compare in an
  // r-if — route through a `(): boolean` so the JSX targets emit a true boolean
  // and no falsy value leaks a text node).
  function showsDaysView(): boolean {
    return viewMode() === 'days';
  }
  function showsMonthsView(): boolean {
    return viewMode() === 'months';
  }
  function showsYearsView(): boolean {
    return viewMode() === 'years';
  }

  // Drill DOWN into the month picker (from the days heading). Seeds
  // $data.activeMonth via resolveRovingDrillIndex (the SAME selection chain
  // resolveRovingDrillIso proves), so the r-keynav grid primitive lands DOM
  // focus on the resolved cell in the same tick the panel first renders — the
  // focus-after-render seam (SPEC §10). No scheduleFocus call: that's now the
  // primitive's job.
  function enterMonthsView() {
    if (local.disabled) return;
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
    setViewMode('months');
  }
  // Drill DOWN into the year picker (from the months-panel year label). Mirrors
  // enterMonthsView.
  function enterYearsView() {
    if (local.disabled) return;
    setActiveYear(resolveRovingDrillIndex(yearGrid().years));
    setViewMode('years');
  }
  // Pick a month → move the view anchor to it, drill back UP toward days, and
  // seed $data.activeDay onto the resolved day tab stop — the r-keynav grid
  // controller lands DOM focus itself once the value changes (77-08; no
  // scheduler needed any more).
  function selectMonth(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!monthEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('days');
    seedActiveDay();
  }
  // Pick a year → move the view anchor's year, drill back UP toward months, and
  // re-seed $data.activeMonth (mirrors enterMonthsView — the primitive lands
  // focus, no scheduleFocus needed).
  function selectYear(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!yearEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('months');
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
  }

  // Shared Escape-to-days exit for both drill keydown handlers: returns to the
  // days view AND seeds $data.activeDay, so Escape returns focus into the grid
  // (the r-keynav controller lands it) instead of dropping it to <body>.
  function exitToDaysView() {
    setViewMode('days');
    seedActiveDay();
  }

  // ---- day grid r-keynav wiring (77-08 retrofit) --------------------------
  // @keynav-commit fires with the day grid's own active index already resolved
  // by the primitive — read via the handler's OWN `i` parameter (mirrors
  // onMonthCommit/onYearCommit, 77-07 Task 3's real-DOM finding: re-reading
  // $data.activeDay here would see a stale pre-click value on React's async
  // setState). commitValue/commitRange already gate on dayEnabled(iso), so
  // committing a disabled cell stays a safe no-op even though the primitive
  // itself never commits one to begin with (grid mode's inert-by-default
  // contract, SPEC §5).
  function onDayCommit(i: any) {
    const cell = allDayCells()[i];
    if (cell) onDaySelect(cell.iso);
  }

  // @keynav-page — the retrofit's behavioural heart (SPEC §4.1, §10). The
  // primitive NEVER moves $data.activeDay itself on a page/boundary event; it
  // only reports the attempted move so the author (who owns which month is
  // rendered) can advance the dataset and set the landing index, both in the
  // SAME tick — the focus-after-render seam plan 77-06 proved on all six
  // targets before this retrofit depended on it.
  //
  // 'boundary' (an arrow ran off either end of the WHOLE flat day source, in
  // EITHER axis — a row-end AND a column-end boundary land identically, SPEC
  // §4): swing the view by exactly one month in the event's direction and land
  // at the OPPOSITE edge of the freshly rendered set — forward lands at the
  // first cell (index 0), backward at the last.
  //
  // 'pageup'/'pagedown': swing the view by one month and keep the SAME COLUMN
  // (SPEC §4.1's sameWeekdayIndex illustration, mirroring KeynavGridDemo's own
  // onPage) — every panel is exactly 42 cells (6 rows x 7 columns), so
  // `activeDay % 7` recovers the weekday column regardless of which panel/row
  // the active cell was in.
  //
  // Reuses addMonths — the family's existing month arithmetic (T-77-08-03: one
  // month per event, no unbounded loop) — no new date math.
  //
  // `allDayCells()` is called AFTER the $data.viewIso write, but ONLY its
  // `.length` is read below — SAFE despite React's async setState (unlike
  // onMonthCommit/onYearCommit's `i`-parameter fix, 77-07 Task 3): every panel
  // is unconditionally 42 cells, so the flat array's length is `numberOfMonths
  // * 42` regardless of WHICH month $data.viewIso currently names — nothing
  // here depends on the just-written value actually having landed yet.
  function onDayPage(detail: any) {
    setViewIso(addMonths(viewMonthGrid(), detail.direction));
    const nextCells = allDayCells();
    if (detail.reason === 'boundary') {
      setActiveDay(detail.direction > 0 ? 0 : nextCells.length - 1);
    } else {
      const column = activeDay() % 7;
      setActiveDay(Math.min(column, nextCells.length - 1));
    }
  }

  // The native `disabled` attribute is gone from the month/year drill buttons
  // (D-3 — focusable-but-inert, matching the day cells), so selectMonth/
  // selectYear must gate on the cell's own `disabled` flag themselves — today the
  // native attribute was the only guard.
  function monthEnabled(iso: any) {
    const cell = monthList().months.find((m: any) => m.iso === iso);
    return !cell || !cell.disabled;
  }
  function yearEnabled(iso: any) {
    const cell = yearGrid().years.find((y: any) => y.iso === iso);
    return !cell || !cell.disabled;
  }

  // ---- keyboard (77-08: author-owned Space/Escape only, F5) --------------
  // Every other key (arrows, Home/End, PageUp/PageDown, Ctrl+Home/End, Enter)
  // falls through untouched to the primitive's own root-level grid delegation
  // (the day grid's r-keynav wrapper, template below) — the hand-rolled day
  // keydown switch and its moveFocus helper are DELETED (77-08's whole point).
  function onDayCellKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      onDaySelect(iso);
    } else if (key === 'Escape') {
      // In range mode, cancel an in-progress (anchor-set) selection.
      if (local.selectionMode === 'range') {
        const r = readRange();
        if (r.start !== '' && r.end === '') {
          e.preventDefault();
          setValue({
            start: '',
            end: ''
          });
          setHoverIso('');
          _props.onChange?.({
            value: {
              start: '',
              end: ''
            }
          });
        }
      }
    }
  }

  // ---- drill grid (months / years 12-cell r-keynav roots, 77-07) ---------
  // Both drills are 3-column grids — the VERIFIED shared column count (a hand-
  // rolled constant AND the CSS custom property default were both already 3;
  // see the drill-grid CSS comment below for the CSS-custom-property caveat).
  // The primitive's key map (arrows, Home/End, Ctrl+Home/End, Enter) replaces
  // the two deleted hand-rolled per-cell keydown switches entirely; only Space
  // and Escape stay author-owned (P71 §4 boundary — the primitive
  // does not cover either).

  // @keynav-commit fires with the panel's own active index already resolved by
  // the primitive — read via the handler's OWN `i` parameter (the SAME index
  // the primitive just wrote through `r-keynav:tabindex`'s setter), NOT via
  // $data.activeMonth/$data.activeYear: on a POINTER commit (click on a
  // non-active cell) the primitive calls setActive(i) THEN commit(i) in the
  // same synchronous pass, and on React specifically `setState` is
  // async — a handler that re-reads $data.activeMonth here would see the
  // PRE-click value, committing the WRONG cell (found via 77-07 Task 3's
  // real-DOM run). `i` is always correct regardless of target/timing.
  // selectMonth/selectYear already gate on the cell's own `disabled` flag (the
  // pointer-path guard), so committing a disabled cell is a safe no-op even
  // though the primitive itself never commits one to begin with (grid mode's
  // inert-by-default contract, SPEC §5).
  function onMonthCommit(i: any) {
    const cell = monthList().months[i];
    if (cell) selectMonth(cell.iso);
  }
  function onYearCommit(i: any) {
    const cell = yearGrid().years[i];
    if (cell) selectYear(cell.iso);
  }

  // The drills have no pageable dataset (12 fixed cells, never paged) — SPEC
  // §4.1's "if the author ignores the event, boundary/page keys are safe
  // no-ops" clamp-equivalent default. Written explicitly (not omitted) so a
  // reader sees this is deliberate, not a missing handler.
  function onDrillPage() {}

  // Author-owned Space/Escape only — every other key falls through untouched
  // to the primitive's own root-level grid delegation (the markup below).
  function onMonthCellKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectMonth(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }
  function onYearCellKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectYear(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }

  // ---- presets (range mode) ----------------------------------------------
  // Resolve every consumer preset's `range` (literal or () => RangeValue thunk)
  // into an ordered { label, range } for the rail + the #presets slot. A PLAIN
  // function (uniform x6), called fresh each render.
  function resolvedPresets() {
    return local.presetRanges.map((p: any) => ({
      label: p.label,
      range: rangeFromPreset(p)
    }));
  }

  // Whether a preset rail should render. A BOOLEAN-returning helper, NOT a bare
  // `resolvedPresets().length` r-if: on the JSX targets `r-if` lowers to
  // `cond && <div>`, and a numeric `0` length leaks a literal "0" text node into
  // the DOM (React/Solid render falsy numbers). Even `length > 0` inline is
  // stripped back to `length` by the production minifier in the boolean-`&&`
  // context — routing through a named boolean helper keeps the guard a true
  // boolean through minification (the React falsy-number-in-r-if discipline).
  function hasPresets(): boolean {
    return resolvedPresets().length > 0;
  }

  // Apply a preset = a complete range: write the (ordered) value + clear any
  // in-progress preview + emit change AND rangeComplete.
  function applyPreset(range: any) {
    if (local.disabled) return;
    const next = normalizeRange(range);
    setValue(next);
    setHoverIso('');
    _props.onChange?.({
      value: next
    });
    _props.onRangeComplete?.({
      value: next
    });
  }

  // Whether a preset matches the current value (ordered endpoint equality), used
  // for aria-pressed / is-active. An empty range never reads active.
  function isPresetActive(range: any) {
    const p = normalizeRange(range);
    if (p.start === '') return false;
    const r = readRange();
    return r.start === p.start && r.end === p.end;
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // Seed the view month from value / today on mount, then seed the day grid's
  // active-index model (77-08) — the SAME resolveRovingDayIndex chain the tab
  // stop uses, so mount, keyboard Tab and this handle can never disagree.

  // focus() — resolve + set $data.activeDay through the SAME roving-tabindex
  // chain the tab stop uses (seedActiveDay/resolveRovingDayIndex), so this
  // handle can never disagree with keyboard Tab — multi-month aware. It does
  // NOT query the DOM itself; the r-keynav grid controller lands DOM focus once
  // the value changes (77-08). DELIBERATELY overrides HTMLElement.focus on Lit
  // (ROZ137 warn, accepted).
  function focus() {
    seedActiveDay();
  }

  // goToToday() — swing the view to the current month (no selection change).
  function goToToday() {
    if (local.disabled) return;
    setViewIso(todayIso());
    seedActiveDay();
  }

  // ---- footer moves (Today / Clear row) ----------------------------------
  // selectToday() — the footer "Today" action. In single mode commit today
  // through the value funnel (write + emit change, gated exactly like a day
  // click); in range mode just swing the view to the current month (goToToday),
  // never mutating the value. Clear reuses the existing clear() funnel unchanged.
  function selectToday() {
    if (local.disabled) return;
    if (local.selectionMode === 'range') {
      goToToday();
    } else {
      commitValue(todayIso());
    }
  }

  // Named boolean guard for the footer r-if (never a bare truthiness in the r-if
  // so the JSX targets emit a real boolean and leak no falsy value).
  function showsFooter(): boolean {
    return !!local.showFooter;
  }

  // clear() — deselect, writing the mode-appropriate empty ('' single /
  // { start:'', end:'' } range) + emit change.
  function clear() {
    if (local.disabled) return;
    if (local.selectionMode === 'range') {
      const r = readRange();
      if (r.start === '' && r.end === '') return;
      setValue({
        start: '',
        end: ''
      });
      setHoverIso('');
      _props.onChange?.({
        value: {
          start: '',
          end: ''
        }
      });
    } else {
      if (selected() === '') return;
      setValue('');
      _props.onChange?.({
        value: ''
      });
    }
  }

  let __rozieKeynavRootRef: HTMLElement | null = null;

  const __rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;

  createKeynav(() => __rozieKeynavRootRef, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (allDayCells()).map((day) => ({ disabled: day.disabled })),
    getActive: () => activeDay(),
    setActive: setActiveDay,
    onCommit: (i) => { onDayCommit(i); },
    gridColumns: () => 7,
    onPage: (detail) => { onDayPage(detail); },
  });

  const [__rozieKeynavRootRef1, __setRozieKeynavRootRef1] = createSignal<HTMLElement | null>(null);

  const __rozieKeynavGroupId1 = `keynav-${Math.random().toString(36).slice(2)}`;

  createKeynav(__rozieKeynavRootRef1, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (monthList().months).map((cell) => ({ label: cell.label, disabled: cell.disabled })),
    getActive: () => activeMonth(),
    setActive: setActiveMonth,
    onCommit: (i) => { onMonthCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
  });

  const [__rozieKeynavRootRef2, __setRozieKeynavRootRef2] = createSignal<HTMLElement | null>(null);

  const __rozieKeynavGroupId2 = `keynav-${Math.random().toString(36).slice(2)}`;

  createKeynav(__rozieKeynavRootRef2, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (yearGrid().years).map((cell) => ({ label: String(cell.year), disabled: cell.disabled })),
    getActive: () => activeYear(),
    setActive: setActiveYear,
    onCommit: (i) => { onYearCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
  });

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label="Date picker" aria-disabled={!!local.disabled} {...attrs} class={"rozie-datepicker" + " " + rozieClass({ 'rozie-datepicker--disabled': local.disabled, 'rozie-datepicker--multi': local.numberOfMonths > 1 }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6800c7a2="">
      
      {(_props.headerSlot ?? _props.slots?.['header'])?.({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!local.disabled }) ?? <div class={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Previous month" class={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!local.disabled} onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          {<Show when={local.monthYearNav} fallback={<span class={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>}><button type="button" aria-disabled={!!local.disabled} aria-label="Change month and year" aria-live="polite" class={"rozie-datepicker-heading rozie-datepicker-heading-button"} disabled={!!local.disabled} onClick={enterMonthsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</button></Show>}<button type="button" aria-disabled={!!local.disabled} aria-label="Next month" class={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!local.disabled} onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div class={"rozie-datepicker-grids"} ref={(el) => { __rozieKeynavRootRef = el as HTMLElement; }} data-rozie-s-6800c7a2="">
        <For each={daysGrids()}>{(g, gi) => <div role="grid" class={"rozie-datepicker-grid"} onMouseLeave={($event: MouseEvent & { currentTarget: HTMLDivElement; target: Element }) => { setHoverIso(''); }} data-rozie-s-6800c7a2="">
          <div class={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
            <For each={weekdays()}>{(wd, wi) => <span class={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>}</For>
          </div>

          <For each={g.weeks}>{(week, wk) => <div class={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
            
            <Key each={week as readonly any[]} by={(day) => day.iso}>{(day, dc) => <span class={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!(day().selected || day().rangeStart || day().rangeEnd)} data-rozie-s-6800c7a2="">
              <button type="button" data-day={rozieAttr(day().iso)} aria-disabled={!!day().disabled} aria-label={rozieAttr(day().iso)} aria-current={rozieAttr(day().today ? 'date' : null)} class={"rozie-datepicker-day" + " " + rozieClass({ 'is-selected': day().selected, 'is-today': day().today, 'is-outside': !day().inMonth, 'is-in-range': day().inRange, 'is-range-start': day().rangeStart, 'is-range-end': day().rangeEnd, 'is-in-preview': day().inPreview })} disabled={!!local.disabled} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onDaySelect(day().iso); }} onMouseEnter={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onDayHover(day().iso); }} onFocus={($event: FocusEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onDayHover(day().iso); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onDayCellKeydown(day().iso, $event); }} id={`${__rozieKeynavGroupId}-item-${gi() * 42 + wk() * 7 + dc()}`} data-rozie-keynav-item={gi() * 42 + wk() * 7 + dc()} data-rozie-keynav-active={activeDay() === gi() * 42 + wk() * 7 + dc() ? '' : undefined} tabIndex={activeDay() === gi() * 42 + wk() * 7 + dc() ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(day().day)}</button>
            </span>}</Key>
          </div>}</For>
        </div>}</For>
      </div>

      
      {<Show when={showsMonthsView()}><div class={"rozie-datepicker-months"} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Change year" class={"rozie-datepicker-drill-label"} disabled={!!local.disabled} onClick={enterYearsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthList().year)}</button>
        </div>
        <div class={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose month" ref={(el) => { __setRozieKeynavRootRef1(el as HTMLElement | null); }} data-rozie-s-6800c7a2="">
          <Key each={monthList().months as readonly any[]} by={(cell) => cell.iso}>{(cell, __rozieKeynavIndex) => <button type="button" role="gridcell" data-month={rozieAttr(cell().iso)} aria-disabled={!!cell().disabled} aria-selected={!!cell().selected} class={"rozie-datepicker-month" + " " + rozieClass({ 'is-selected': cell().selected, 'is-current': cell().current })} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { selectMonth(cell().iso); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onMonthCellKeydown(cell().iso, $event); }} id={`${__rozieKeynavGroupId1}-item-${__rozieKeynavIndex()}`} data-rozie-keynav-item={__rozieKeynavIndex()} data-rozie-keynav-active={activeMonth() === __rozieKeynavIndex() ? '' : undefined} tabIndex={activeMonth() === __rozieKeynavIndex() ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell().label)}</button>}</Key>
        </div>
      </div></Show>}{<Show when={showsYearsView()}><div class={"rozie-datepicker-years"} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <span class={"rozie-datepicker-drill-label"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(yearRangeLabel())}</span>
        </div>
        <div class={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose year" ref={(el) => { __setRozieKeynavRootRef2(el as HTMLElement | null); }} data-rozie-s-6800c7a2="">
          <Key each={yearGrid().years as readonly any[]} by={(cell) => cell.iso}>{(cell, __rozieKeynavIndex) => <button type="button" role="gridcell" data-year={rozieAttr(cell().iso)} aria-disabled={!!cell().disabled} aria-selected={!!cell().selected} class={"rozie-datepicker-year" + " " + rozieClass({ 'is-selected': cell().selected, 'is-current': cell().current })} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { selectYear(cell().iso); }} onKeyDown={($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: Element }) => { onYearCellKeydown(cell().iso, $event); }} id={`${__rozieKeynavGroupId2}-item-${__rozieKeynavIndex()}`} data-rozie-keynav-item={__rozieKeynavIndex()} data-rozie-keynav-active={activeYear() === __rozieKeynavIndex() ? '' : undefined} tabIndex={activeYear() === __rozieKeynavIndex() ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell().year)}</button>}</Key>
        </div>
      </div></Show>}{(_props.footerSlot ?? _props.slots?.['footer'])?.({ today: selectToday, clear, todayIso: todayIso() }) ?? <Show when={showsFooter()}><div class={"rozie-datepicker-footer"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} class={"rozie-datepicker-footer-btn rozie-datepicker-today"} disabled={!!local.disabled} onClick={selectToday} data-rozie-s-6800c7a2="">Today</button>
          <button type="button" aria-disabled={!!local.disabled} class={"rozie-datepicker-footer-btn rozie-datepicker-clear"} disabled={!!local.disabled} onClick={clear} data-rozie-s-6800c7a2="">Clear</button>
        </div></Show>}

      
      {(_props.presetsSlot ?? _props.slots?.['presets'])?.({ presets: resolvedPresets(), apply: applyPreset }) ?? <Show when={hasPresets()}><div class={"rozie-datepicker-presets"} role="group" aria-label="Date range presets" data-rozie-s-6800c7a2="">
          <Key each={resolvedPresets() as readonly any[]} by={(p) => p.label}>{(p) => <button type="button" aria-pressed={!!isPresetActive(p().range)} class={"rozie-datepicker-preset" + " " + rozieClass({ 'is-active': isPresetActive(p().range) })} disabled={!!local.disabled} onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { applyPreset(p().range); }} data-rozie-s-6800c7a2="">{rozieDisplay(p().label)}</button>}</Key>
        </div></Show>}
    </div>
    </>
  );
}
