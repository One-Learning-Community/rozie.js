import type { JSX } from 'solid-js';
import { For, Show, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { addDays, addMonths, buildMonthGrid, buildMonthList, buildYearGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

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
.rozie-datepicker-day[data-rozie-s-6800c7a2]:disabled {
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
.rozie-datepicker-month[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled),
.rozie-datepicker-year[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
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
.rozie-datepicker-month[data-rozie-s-6800c7a2]:disabled,
.rozie-datepicker-year[data-rozie-s-6800c7a2]:disabled {
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
  isDateDisabled?: ((...args: unknown[]) => unknown) | null;
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
  const _merged = mergeProps({ selectionMode: 'single', min: null, max: null, disabledDates: (() => [])(), weekStartsOn: 0, disabled: false, locale: 'en-US', presetRanges: (() => [])(), monthYearNav: true, numberOfMonths: 1, showFooter: false, disabledDaysOfWeek: (() => [])(), isDateDisabled: null }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'selectionMode', 'min', 'max', 'disabledDates', 'weekStartsOn', 'disabled', 'locale', 'presetRanges', 'monthYearNav', 'numberOfMonths', 'showFooter', 'disabledDaysOfWeek', 'isDateDisabled', 'ref']);
  onMount(() => { local.ref?.({ focus, goToToday, clear }); });

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');
  const [viewIso, setViewIso] = createSignal('');
  const [hoverIso, setHoverIso] = createSignal('');
  const [viewMode, setViewMode] = createSignal('days');
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
  // The current selected ISO, normalized to a string. In range mode the value is
  // an object → this returns '' (so the SINGLE-mode grid highlight no-ops there).
  // CAPTURE the polymorphic value into a local const BEFORE the typeof guard so
  // the narrowing flows uniformly on all six targets — on Solid `$props.value`
  // lowers to the accessor CALL `value()`, and TS does NOT narrow across two
  // separate `value()` calls (`typeof value() === 'string' ? value()` keeps the
  // union → TS2322 where it feeds the string grid params). A local const narrows
  // identically on Solid (accessor call), React (variable), Vue/Lit (property).
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
  // element free of an r-if+r-for combo, and at numberOfMonths === 1 it yields a
  // single grid with NO extra wrapper element (the byte-identical single-month path).
  function daysGrids() {
    return showsDaysView() ? grids() : [];
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

  // Drill DOWN into the month picker (from the days heading).
  function enterMonthsView() {
    if (local.disabled) return;
    setViewMode('months');
  }
  // Drill DOWN into the year picker (from the months-panel year label).
  function enterYearsView() {
    if (local.disabled) return;
    setViewMode('years');
  }
  // Pick a month → move the view anchor to it and drill back UP toward days.
  function selectMonth(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    setViewIso(iso);
    setViewMode('days');
  }
  // Pick a year → move the view anchor's year and drill back UP toward months.
  function selectYear(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    setViewIso(iso);
    setViewMode('months');
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

  // ---- drill focus choreography (months / years panels) ------------------
  // Mirror dayCells/focusDayIso, swapping [data-day] → [data-month]/[data-year].
  // $refs.root is read only here / in handlers (post-mount → ROZ123-safe) and the
  // querySelectorAll pierces Lit's shadow root exactly as the day walk does.
  function monthCells() {
    const root = rootRef;
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-month]')) as HTMLElement[];
  }
  function focusMonthIso(iso: any) {
    const cells = monthCells();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute('data-month') === iso) {
        cells[i].focus();
        return;
      }
    }
  }
  function yearCells() {
    const root = rootRef;
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-year]')) as HTMLElement[];
  }
  function focusYearIso(iso: any) {
    const cells = yearCells();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute('data-year') === iso) {
        cells[i].focus();
        return;
      }
    }
  }

  // Roving tabindex for the drill cells — nullable-typed `number | undefined` ON
  // PURPOSE (the dayTabIndex precedent): keeps React's `(expr) ?? undefined` wrap
  // reachable, avoiding TS2869. The selected cell (or the current month/year when
  // nothing is selected) is the single tab stop.
  function monthTabIndex(cell: any): number | undefined {
    return cell.selected || selected() === '' && cell.current ? 0 : -1;
  }
  function yearTabIndex(cell: any): number | undefined {
    return cell.selected || selected() === '' && cell.current ? 0 : -1;
  }

  // Move the roving focus by `days`, crossing into an adjacent month when the
  // target leaves the displayed grid. Skips nothing — disabled days are still
  // focusable (standard grid pattern) but not selectable.
  function moveFocus(fromIso: any, days: any) {
    if (local.disabled) return;
    const next = addDays(fromIso, days);
    // Widened to ANY rendered month (multi-month): if `next` is present in any of
    // the displayed grids, arrow focus can cross month columns without swinging
    // the view. Only when it leaves every rendered month do we move the anchor.
    const present = grids().some((g: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === next)));
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

  // ---- drill keyboard (months / years 12-cell grid) ----------------------
  // A 3-column × 4-row grid: arrows move within the 12 cells (clamped at the
  // edges), Home/End jump to the row bounds, Enter/Space pick, Escape returns to
  // days. Params LEFT UNTYPED so `e.key` neutralizes to `any` and typechecks ×6.
  const DRILL_COLS = 3;
  function onMonthKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    const cells = monthList().months;
    let idx = -1;
    for (let i = 0; i < cells.length; i++) if (cells[i].iso === iso) idx = i;
    if (idx < 0) return;
    let next = idx;
    if (key === 'ArrowLeft') next = Math.max(0, idx - 1);else if (key === 'ArrowRight') next = Math.min(11, idx + 1);else if (key === 'ArrowUp') next = Math.max(0, idx - DRILL_COLS);else if (key === 'ArrowDown') next = Math.min(11, idx + DRILL_COLS);else if (key === 'Home') next = idx - idx % DRILL_COLS;else if (key === 'End') next = idx - idx % DRILL_COLS + (DRILL_COLS - 1);else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectMonth(iso);
      return;
    } else if (key === 'Escape') {
      e.preventDefault();
      setViewMode('days');
      return;
    } else return;
    e.preventDefault();
    focusMonthIso(cells[next].iso);
  }
  function onYearKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    const cells = yearGrid().years;
    let idx = -1;
    for (let i = 0; i < cells.length; i++) if (cells[i].iso === iso) idx = i;
    if (idx < 0) return;
    let next = idx;
    if (key === 'ArrowLeft') next = Math.max(0, idx - 1);else if (key === 'ArrowRight') next = Math.min(11, idx + 1);else if (key === 'ArrowUp') next = Math.max(0, idx - DRILL_COLS);else if (key === 'ArrowDown') next = Math.min(11, idx + DRILL_COLS);else if (key === 'Home') next = idx - idx % DRILL_COLS;else if (key === 'End') next = idx - idx % DRILL_COLS + (DRILL_COLS - 1);else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectYear(iso);
      return;
    } else if (key === 'Escape') {
      e.preventDefault();
      setViewMode('days');
      return;
    } else return;
    e.preventDefault();
    focusYearIso(cells[next].iso);
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

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label="Date picker" aria-disabled={!!local.disabled} {...attrs} class={"rozie-datepicker" + " " + rozieClass({ 'rozie-datepicker--disabled': local.disabled, 'rozie-datepicker--multi': local.numberOfMonths > 1 }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6800c7a2="">
      
      {(_props.headerSlot ?? _props.slots?.['header'])?.({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!local.disabled }) ?? <div class={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Previous month" class={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!local.disabled} onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          {<Show when={local.monthYearNav} fallback={<span class={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>}><button type="button" aria-disabled={!!local.disabled} aria-label="Change month and year" aria-live="polite" class={"rozie-datepicker-heading rozie-datepicker-heading-button"} disabled={!!local.disabled} onClick={enterMonthsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</button></Show>}<button type="button" aria-disabled={!!local.disabled} aria-label="Next month" class={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!local.disabled} onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <For each={daysGrids()}>{(g, gi) => <div role="grid" class={"rozie-datepicker-grid"} onMouseLeave={($event) => { setHoverIso(''); }} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
          <For each={weekdays()}>{(wd, wi) => <span class={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>}</For>
        </div>

        <For each={g.weeks}>{(week, wk) => <div class={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
          <For each={week}>{(day) => <span class={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2="">
            <button type="button" data-day={rozieAttr(day.iso)} aria-disabled={!!day.disabled} aria-label={rozieAttr(day.iso)} aria-current={rozieAttr(day.today ? 'date' : null)} class={"rozie-datepicker-day" + " " + rozieClass({ 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview })} tabIndex={rozieAttr(dayTabIndex(day))} disabled={!!day.disabled} onClick={($event) => { onDaySelect(day.iso); }} onMouseEnter={($event) => { onDayHover(day.iso); }} onFocus={($event) => { onDayHover(day.iso); }} onKeyDown={($event) => { onDayKeydown(day.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
          </span>}</For>
        </div>}</For>
      </div>}</For>

      
      {<Show when={showsMonthsView()}><div class={"rozie-datepicker-months"} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Change year" class={"rozie-datepicker-drill-label"} disabled={!!local.disabled} onClick={enterYearsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthList().year)}</button>
        </div>
        <div class={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose month" data-rozie-s-6800c7a2="">
          <For each={monthList().months}>{(cell) => <button type="button" role="gridcell" data-month={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} class={"rozie-datepicker-month" + " " + rozieClass({ 'is-selected': cell.selected, 'is-current': cell.current })} tabIndex={rozieAttr(monthTabIndex(cell))} disabled={!!cell.disabled} onClick={($event) => { selectMonth(cell.iso); }} onKeyDown={($event) => { onMonthKeydown(cell.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(cell.label)}</button>}</For>
        </div>
      </div></Show>}{<Show when={showsYearsView()}><div class={"rozie-datepicker-years"} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <span class={"rozie-datepicker-drill-label"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(yearRangeLabel())}</span>
        </div>
        <div class={"rozie-datepicker-drill-grid"} role="grid" aria-label="Choose year" data-rozie-s-6800c7a2="">
          <For each={yearGrid().years}>{(cell) => <button type="button" role="gridcell" data-year={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} class={"rozie-datepicker-year" + " " + rozieClass({ 'is-selected': cell.selected, 'is-current': cell.current })} tabIndex={rozieAttr(yearTabIndex(cell))} disabled={!!cell.disabled} onClick={($event) => { selectYear(cell.iso); }} onKeyDown={($event) => { onYearKeydown(cell.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(cell.year)}</button>}</For>
        </div>
      </div></Show>}{<Show when={showsFooter()}>{(_props.footerSlot ?? _props.slots?.['footer'])?.({ today: selectToday, clear, todayIso: todayIso() }) ?? <div class={"rozie-datepicker-footer"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} class={"rozie-datepicker-footer-btn rozie-datepicker-today"} disabled={!!local.disabled} onClick={selectToday} data-rozie-s-6800c7a2="">Today</button>
          <button type="button" aria-disabled={!!local.disabled} class={"rozie-datepicker-footer-btn rozie-datepicker-clear"} disabled={!!local.disabled} onClick={clear} data-rozie-s-6800c7a2="">Clear</button>
        </div>}</Show>}{(_props.presetsSlot ?? _props.slots?.['presets'])?.({ presets: resolvedPresets(), apply: applyPreset }) ?? <Show when={hasPresets()}><div class={"rozie-datepicker-presets"} role="group" aria-label="Date range presets" data-rozie-s-6800c7a2="">
          <For each={resolvedPresets()}>{(p) => <button type="button" aria-pressed={!!isPresetActive(p.range)} class={"rozie-datepicker-preset" + " " + rozieClass({ 'is-active': isPresetActive(p.range) })} disabled={!!local.disabled} onClick={($event) => { applyPreset(p.range); }} data-rozie-s-6800c7a2="">{rozieDisplay(p.label)}</button>}</For>
        </div></Show>}
    </div>
    </>
  );
}
