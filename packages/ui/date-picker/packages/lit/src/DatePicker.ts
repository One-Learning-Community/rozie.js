import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { KeynavController, createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { addMonths, buildMonthGrid, buildMonthList, buildYearGrid, dayLabel, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, rangeSpansDisabled, resolveLabel, resolveRovingDayIndex, resolveRovingDrillIndex, resolveViewIso, ROVING_DAY_NONE, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface RozieHeaderSlotCtx {
  label: any;
  prev: any;
  next: any;
  disabled: any;
  openMonths: any;
  openYears: any;
  closeDrill: any;
  viewMode: any;
}

interface RozieFooterSlotCtx {
  today: any;
  clear: any;
  todayIso: any;
}

interface RoziePresetsSlotCtx {
  presets: any;
  apply: any;
}

@customElement('rozie-date-picker')
export default class DatePicker extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-datepicker[data-rozie-s-6800c7a2] {
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
.rozie-datepicker-day.is-selected[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]),
.rozie-datepicker-day.is-range-start[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]),
.rozie-datepicker-day.is-range-end[data-rozie-s-6800c7a2]:hover:not([aria-disabled='true'][data-rozie-s-6800c7a2]) {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-hover-bg, color-mix(in srgb, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)) 85%, #000));
  border-color: var(--rozie-datepicker-selected-hover-bg, color-mix(in srgb, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)) 85%, #000));
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
}
`;

  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <rozie-date-picker .value=${date} @value-change=${…} .min=${'2026-01-01'} @change=${onPick}></rozie-date-picker>
   */
  @property({ type: String, attribute: 'value' }) _value_attr: string | any = '';
  private _valueControllable = createLitControllableProperty<string | any>({ host: this, eventName: 'value-change', defaultValue: '', initialControlledValue: undefined });
  /**
   * Selection mode: `'single'` (the default — `value` is one ISO `YYYY-MM-DD` string, fully backward-compatible) or `'range'` (`value` becomes a `{ start, end }` object selected with two clicks plus a live hover preview, direction-agnostic). In `range` mode a completed selection additionally emits `rangeComplete`.
   */
  @property({ type: String, reflect: true }) selectionMode: string = 'single';
  /**
   * Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound.
   */
  @property({ type: String, reflect: true }) min: string | null = null;
  /**
   * Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound.
   */
  @property({ type: String, reflect: true }) max: string | null = null;
  /**
   * An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`.
   */
  @property({ type: Array }) disabledDates: any[] = [];
  /**
   * The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar).
   */
  @property({ type: Number, reflect: true }) weekStartsOn: number = 0;
  /**
   * Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`.
   */
  @property({ type: String, reflect: true }) locale: string = 'en-US';
  /**
   * Optional overrides for the 10 static English "chrome" strings, keyed by `root`, `previousMonth`, `nextMonth`, `changeMonthYear`, `changeYear`, `chooseMonth`, `chooseYear`, `presets`, `today`, `clear` (defaults: `"Date picker"`, `"Previous month"`, `"Next month"`, `"Change month and year"`, `"Change year"`, `"Choose month"`, `"Choose year"`, `"Date range presets"`, `"Today"`, `"Clear"`). **Honest split:** `Intl` is a date/number formatter, not a message catalog — it can localize a DATE but cannot translate the phrase "Previous month". The day-cell accessible name, each multi-month panel's own grid caption, the weekday header long names, and the month-year heading text are already Intl-derived from the `locale` prop and are NOT `labels` keys; the 10 chrome phrases above are English-static and only `labels` can translate them. An empty object (the default) yields the English defaults with zero config. **Lit caveat:** pass via a *property* binding (`.labels=${…}`), never a string attribute — the same rule already in force for `disabledDates`/`presetRanges`.
   * @example
   * <rozie-date-picker .labels=${{ previousMonth: 'Mois précédent' }} locale="fr-FR"></rozie-date-picker>
   */
  @property({ type: Object }) labels: any = {};
  /**
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  @property({ type: Array }) presetRanges: any[] = [];
  /**
   * Render the month-year heading as a clickable drill **button** that navigates days → months → years (and a year label that drills months → years). **Capability-on:** this is the documented exception to the boolean-default-`false` rule — the drill navigation is the ergonomic win of this feature, so it defaults to `true`. Set `:month-year-nav="false"` to restore the static heading `<span>` (byte-identical to the pre-navigation output).
   */
  @property({ type: Boolean, reflect: true }) monthYearNav: boolean = true;
  /**
   * How many month grids to render side by side, anchored at the view month and stepping forward (e.g. `2` for a two-up range calendar). `1` (the default) emits exactly the single-month markup with no extra wrapper element.
   */
  @property({ type: Number, reflect: true }) numberOfMonths: number = 1;
  /**
   * Render a Today / Clear footer row beneath the calendar grid. `Today` selects (single mode) or navigates to (range mode) the current date; `Clear` deselects. The `#footer` slot fully overrides the default row, receiving `{ today, clear, todayIso }`.
   */
  @property({ type: Boolean, reflect: true }) showFooter: boolean = false;
  /**
   * An array of weekday indices to disable, `Number[]` where `0` = Sunday through `6` = Saturday (e.g. `[0, 6]` disables every weekend). Serializable, so it passes fine as a plain attribute. Threaded through the single gating funnel, so disabled weekdays are non-interactive, non-focusable, and marked `aria-disabled` — in agreement with day cells, drill enablement, and keyboard focus.
   */
  @property({ type: Array }) disabledDaysOfWeek: any[] = [];
  /**
   * A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`.
   */
  @property({ type: Function }) isDateDisabled: ((...args: any[]) => any) | null = null;
  private _viewIso = signal('');
  private _hoverIso = signal('');
  private _viewMode = signal('days');
  private _activeDay = signal(0);
  private _activeDayReal = signal(0);
  private _activeMonth = signal(0);
  private _activeYear = signal(0);
  @query('[data-rozie-ref="root"]') private _refRoot!: HTMLElement;

  private _rozieKeynavGroupId = `keynav-${Math.random().toString(36).slice(2)}`;
  private _rozieKeynavController = new KeynavController(this, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (this.allDayCells()).map((day) => ({ disabled: day.disabled })),
    getActive: () => this._activeDay.value,
    setActive: (i: number) => { this._activeDay.value = i; },
    onCommit: (i) => { this.onDayCommit(i); },
    gridColumns: () => 7,
    onPage: (detail) => { this.onDayPage(detail); },
    rootMarker: '0',
  });
  private _rozieKeynavGroupId1 = `keynav-${Math.random().toString(36).slice(2)}`;
  private _rozieKeynavController1 = new KeynavController(this, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (this.monthList().months).map((cell) => ({ label: cell.label, disabled: cell.disabled })),
    getActive: () => this._activeMonth.value,
    setActive: (i: number) => { this._activeMonth.value = i; },
    onCommit: (i) => { this.onMonthCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { this.onDrillPage(); },
    rootMarker: '1',
  });
  private _rozieKeynavGroupId2 = `keynav-${Math.random().toString(36).slice(2)}`;
  private _rozieKeynavController2 = new KeynavController(this, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (this.yearGrid().years).map((cell) => ({ label: String(cell.year), disabled: cell.disabled })),
    getActive: () => this._activeYear.value,
    setActive: (i: number) => { this._activeYear.value = i; },
    onCommit: (i) => { this.onYearCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { this.onDrillPage(); },
    rootMarker: '2',
  });

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @property({ attribute: false }) header?: (scope: { label: any; prev: any; next: any; disabled: any; openMonths: any; openYears: any; closeDrill: any; viewMode: any }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];
  @property({ attribute: false }) footer?: (scope: { today: any; clear: any; todayIso: any }) => unknown;
  @state() private _hasSlotPresets = false;
  @queryAssignedElements({ slot: 'presets', flatten: true }) private _slotPresetsElements!: Element[];
  @property({ attribute: false }) presets?: (scope: { presets: any; apply: any }) => unknown;
  // Phase 79 Plan 08 (R4) contract for 79-09: the record intake for
  // record-routed slot fills. 79-09's consumer-side emitSlotFiller
  // accumulates an object literal onto the SAME `.rozieSlots=${{ ... }}`
  // open-tag binding; the KEY is the fill's authored (possibly
  // non-identifier) name and the VALUE is a scope-taking render
  // function. `rozieSlots?.[name]` must be checked BEFORE the legacy
  // named function-prop / <slot> fallback (AC-9). Attribute
  // deserialization is disabled — this is a function-valued record,
  // never reflected to/from an HTML attribute.
  @property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="header"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeader = this._slotHeaderElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="footer"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotFooter = this._slotFooterElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="presets"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotPresets = this._slotPresetsElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'header');
    this._hasSlotFooter = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    this._hasSlotPresets = Array.from(this.children).some((el) => el.getAttribute('slot') === 'presets');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    const nextViewIso = this.viewMonthGrid();
    this._viewIso.value = nextViewIso;
    this.seedActiveDay(nextViewIso);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'value') this._valueControllable.notifyAttributeChange(value as unknown as string | any);
  }

  render() {
    return html`
<div class="${Object.entries({ "rozie-datepicker": true, 'rozie-datepicker--disabled': this.disabled, 'rozie-datepicker--multi': this.numberOfMonths > 1 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="group" aria-label=${rozieAttr(this.labelFor('root'))} aria-disabled=${!!this.disabled} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="root" data-rozie-s-6800c7a2>
  
  ${this.header !== undefined ? this.header({label: this.monthHeading(), prev: this.goPrevMonth, next: this.goNextMonth, disabled: !!this.disabled, openMonths: this.enterMonthsView, openYears: this.enterYearsView, closeDrill: this.exitToDaysView, viewMode: this._viewMode.value}) : html`<slot name="header" data-rozie-params=${(() => { try { return JSON.stringify({label: this.monthHeading(), disabled: !!this.disabled, viewMode: this._viewMode.value}); } catch { return '{}'; } })()} @rozie-header-prev=${($event: CustomEvent) => ((this.goPrevMonth) as (...args: any[]) => any)($event.detail)} @rozie-header-next=${($event: CustomEvent) => ((this.goNextMonth) as (...args: any[]) => any)($event.detail)} @rozie-header-open-months=${($event: CustomEvent) => ((this.enterMonthsView) as (...args: any[]) => any)($event.detail)} @rozie-header-open-years=${($event: CustomEvent) => ((this.enterYearsView) as (...args: any[]) => any)($event.detail)} @rozie-header-close-drill=${($event: CustomEvent) => ((this.exitToDaysView) as (...args: any[]) => any)($event.detail)}>
    <div class="rozie-datepicker-header" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-nav rozie-datepicker-prev" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label=${rozieAttr(this.labelFor('previousMonth'))} @click=${this.goPrevMonth} data-rozie-s-6800c7a2>‹</button>
      ${this.monthYearNav ? html`<button class="rozie-datepicker-heading rozie-datepicker-heading-button" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label=${rozieAttr(this.labelFor('changeMonthYear'))} aria-live="polite" @click=${this.enterMonthsView} data-rozie-s-6800c7a2>${rozieDisplay(this.monthHeading())}</button>` : html`<span class="rozie-datepicker-heading" aria-live="polite" data-rozie-s-6800c7a2>${rozieDisplay(this.monthHeading())}</span>`}<button class="rozie-datepicker-nav rozie-datepicker-next" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label=${rozieAttr(this.labelFor('nextMonth'))} @click=${this.goNextMonth} data-rozie-s-6800c7a2>›</button>
    </div>
  </slot>`}

  
  <div class="rozie-datepicker-grids" data-rozie-keynav-root="0" data-rozie-s-6800c7a2>
    ${repeat<any>(this.daysGrids(), (g, gi) => g.year + '-' + g.month, (g, gi) => html`<div class="rozie-datepicker-grid" role="grid" aria-label=${rozieAttr(this.panelHeading(gi))} @mouseleave=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this._hoverIso.value = ''; }} data-rozie-s-6800c7a2>
      <div class="rozie-datepicker-weekdays" role="row" data-rozie-s-6800c7a2>
        ${repeat<any>(this.weekdays(), (wd, wi) => wi, (wd, wi) => html`<span class="rozie-datepicker-weekday" role="columnheader" aria-label=${rozieAttr(this.weekdaysLong()[wi])} data-rozie-s-6800c7a2>${rozieDisplay(wd)}</span>`)}
      </div>

      ${repeat<any>(g.weeks, (week, wk) => week[0].iso, (week, wk) => html`<div class="rozie-datepicker-week" role="row" data-rozie-s-6800c7a2>
        
        ${repeat<any>(week, (day, dc) => day.iso, (day, dc) => html`<span class="rozie-datepicker-cell" role="gridcell" aria-selected=${!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2>
          <button class="${Object.entries({ "rozie-datepicker-day": true, 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" data-day=${rozieAttr(day.iso)} ?disabled=${!!this.disabled} aria-disabled=${!!day.disabled} aria-label=${rozieAttr(this.dayAria(day.iso))} aria-current=${rozieAttr(day.today ? 'date' : null)} @mouseenter=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayHover(day.iso); }} @focus=${($event: FocusEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayHover(day.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayCellKeydown(day.iso, $event); }} id=${`${this._rozieKeynavGroupId}-item-${gi * 42 + wk * 7 + dc}`} data-rozie-keynav-item=${gi * 42 + wk * 7 + dc} ?data-rozie-keynav-active=${this._activeDay.value === gi * 42 + wk * 7 + dc} tabindex=${this._activeDay.value === gi * 42 + wk * 7 + dc ? 0 : -1} data-rozie-s-6800c7a2>${rozieDisplay(day.day)}</button>
        </span>`)}
      </div>`)}
    </div>`)}
  </div>

  
  ${this.showsMonthsView() ? html`<div class="rozie-datepicker-months" data-rozie-s-6800c7a2>
    <div class="rozie-datepicker-drill-header" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-drill-label" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label=${rozieAttr(this.labelFor('changeYear'))} @click=${this.enterYearsView} data-rozie-s-6800c7a2>${rozieDisplay(this.monthList().year)}</button>
    </div>
    <div class="rozie-datepicker-drill-grid" role="grid" aria-label=${rozieAttr(this.labelFor('chooseMonth'))} data-rozie-keynav-root="1" data-rozie-s-6800c7a2>
      ${repeat<any>(this.monthList().months, (cell, _idx) => cell.iso, (cell, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-month": true, 'is-selected': cell.selected, 'is-current': cell.current }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" role="gridcell" data-month=${rozieAttr(cell.iso)} aria-disabled=${!!cell.disabled} aria-selected=${!!cell.selected} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.selectMonth(cell.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onMonthCellKeydown(cell.iso, $event); }} id=${`${this._rozieKeynavGroupId1}-item-${_idx}`} data-rozie-keynav-item=${_idx} ?data-rozie-keynav-active=${this._activeMonth.value === _idx} tabindex=${this._activeMonth.value === _idx ? 0 : -1} data-rozie-s-6800c7a2>${rozieDisplay(cell.label)}</button>`)}
    </div>
  </div>` : nothing}${this.showsYearsView() ? html`<div class="rozie-datepicker-years" data-rozie-s-6800c7a2>
    <div class="rozie-datepicker-drill-header" data-rozie-s-6800c7a2>
      <span class="rozie-datepicker-drill-label" aria-live="polite" data-rozie-s-6800c7a2>${rozieDisplay(this.yearRangeLabel())}</span>
    </div>
    <div class="rozie-datepicker-drill-grid" role="grid" aria-label=${rozieAttr(this.labelFor('chooseYear'))} data-rozie-keynav-root="2" data-rozie-s-6800c7a2>
      ${repeat<any>(this.yearGrid().years, (cell, _idx) => cell.iso, (cell, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-year": true, 'is-selected': cell.selected, 'is-current': cell.current }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" role="gridcell" data-year=${rozieAttr(cell.iso)} aria-disabled=${!!cell.disabled} aria-selected=${!!cell.selected} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.selectYear(cell.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onYearCellKeydown(cell.iso, $event); }} id=${`${this._rozieKeynavGroupId2}-item-${_idx}`} data-rozie-keynav-item=${_idx} ?data-rozie-keynav-active=${this._activeYear.value === _idx} tabindex=${this._activeYear.value === _idx ? 0 : -1} data-rozie-s-6800c7a2>${rozieDisplay(cell.year)}</button>`)}
    </div>
  </div>` : nothing}${this.footer !== undefined ? this.footer({today: this.selectToday, clear: this.clear, todayIso: this.todayIso()}) : html`<slot name="footer" data-rozie-params=${(() => { try { return JSON.stringify({todayIso: this.todayIso()}); } catch { return '{}'; } })()} @rozie-footer-today=${($event: CustomEvent) => ((this.selectToday) as (...args: any[]) => any)($event.detail)} @rozie-footer-clear=${($event: CustomEvent) => ((this.clear) as (...args: any[]) => any)($event.detail)}>
    ${this.showsFooter() ? html`<div class="rozie-datepicker-footer" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-footer-btn rozie-datepicker-today" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} @click=${this.selectToday} data-rozie-s-6800c7a2>${rozieDisplay(this.labelFor('today'))}</button>
      <button class="rozie-datepicker-footer-btn rozie-datepicker-clear" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} @click=${this.clear} data-rozie-s-6800c7a2>${rozieDisplay(this.labelFor('clear'))}</button>
    </div>` : nothing}</slot>`}

  
  ${this.presets !== undefined ? this.presets({presets: this.resolvedPresets(), apply: this.applyPreset}) : html`<slot name="presets" data-rozie-params=${(() => { try { return JSON.stringify({presets: this.resolvedPresets()}); } catch { return '{}'; } })()} @rozie-presets-apply=${($event: CustomEvent) => ((this.applyPreset) as (...args: any[]) => any)($event.detail)}>
    ${this.hasPresets() ? html`<div class="rozie-datepicker-presets" role="group" aria-label=${rozieAttr(this.labelFor('presets'))} data-rozie-s-6800c7a2>
      ${repeat<any>(this.resolvedPresets(), (p, _idx) => p.label, (p, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-preset": true, 'is-active': this.isPresetActive(p.range) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" aria-pressed=${!!this.isPresetActive(p.range)} ?disabled=${!!this.disabled} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.applyPreset(p.range); }} data-rozie-s-6800c7a2>${rozieDisplay(p.label)}</button>`)}
    </div>` : nothing}</slot>`}
</div>
`;
  }

  todayIso = () => {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
};

  // ---- derived view (ONE plain function, uniform x6) ---------------------
  // The current selected ISO, normalized to a string. In range mode the value is
  // an object → this returns '' (so the SINGLE-mode grid highlight no-ops there).
  // `$props.value` lowers to an accessor CALL on both Solid (`value()`) and
  // Angular (`this.value()`); both emitters now hoist a local before the
  // `typeof` guard (hoistPolymorphicModelGuards, Solid emitter-hardening backlog
  // item #11 / Angular quick task 260711-v2l), so this inline guard narrows
  // cleanly on all six targets.
  selected = (): string => typeof this.value === 'string' ? this.value : '';

  // The RANGE normalization funnel (mirrors selected()): coerce the polymorphic
  // `value` into a canonical ordered { start, end }. ALL range logic reads through
  // this — never $props.value directly — so the polymorph is funneled in one place.
  readRange = () => normalizeRange(this.value);

  // The resolved month anchor: the local view state, falling back to the selected
  // value, then today. In range mode `selected()` is '' (the value is an object),
  // so fall back to the range's `start` endpoint — a DatePicker opened with a
  // pre-selected range must show that range's month, mirroring how single mode
  // pins the view to its selected ISO (else range mode always opens on today).
  viewAnchor = (): string => {
  const s = this.selected();
  if (s !== '') return s;
  if (this.selectionMode === 'range') return this.readRange().start;
  return '';
};

  // `viewIsoOverride` (77-08): callers that just wrote $data.viewIso in the
  // SAME synchronous call (goToMonth/goToToday/selectMonth) can pass the
  // FRESH value directly instead of relying on this function's own
  // $data.viewIso read. This matters because a callback that reads $data.viewIso
  // is a JS CLOSURE captured at a point in time — on React specifically, no
  // amount of setTimeout/rAF deferral makes an ALREADY-CAPTURED closure
  // observe a state write made by the SAME synchronous call that created it
  // (React's setState is async; the closure was bound before that write even
  // scheduled a new render). Passing the value the caller already computed
  // sidesteps the staleness entirely (mirrors 77-07's onMonthCommit/
  // onYearCommit `i`-parameter fix for the identical class of bug). Omitted
  // (undefined) falls back to the live $data.viewIso read — correct for every
  // call site with no fresher value in hand ($onMount, the focus() expose
  // handle, template reads).
  viewMonthGrid = (viewIsoOverride?: string) => resolveViewIso({
  viewIso: viewIsoOverride !== undefined ? viewIsoOverride : this._viewIso.value,
  value: this.viewAnchor(),
  today: this.todayIso()
});

  // The whole render model in a single call: { year, month, weeks }. A PLAIN
  // function (not $computed) so it reads uniformly on all six targets and can be
  // aliased in handlers without the Solid accessor divergence. Returns a FRESH
  // object each call — never feed it to a reference-equality $watch getter. In
  // range mode it additionally passes `selection` (the ordered range) + the live
  // `previewEnd` (the hovered day); in single mode those are omitted (undefined →
  // all range flags false → byte-stable single path).
  grid = () => buildMonthGrid({
  viewIso: this.viewMonthGrid(),
  value: this.selected(),
  today: this.todayIso(),
  min: this.min,
  max: this.max,
  disabledDates: this.disabledDates,
  disabledDaysOfWeek: this.disabledDaysOfWeek,
  isDateDisabled: this.isDateDisabled,
  weekStartsOn: this.weekStartsOn,
  disabled: this.disabled,
  selection: this.selectionMode === 'range' ? this.readRange() : undefined,
  previewEnd: this.selectionMode === 'range' ? this._hoverIso.value : undefined
});

  // The multi-month render model: N grids stepping forward from the view month,
  // so `numberOfMonths` renders side by side. A PLAIN function (uniform x6),
  // mirroring grid() exactly but with the view anchor advanced by `i` months.
  // numberOfMonths === 1 yields a one-element array whose single grid === grid().
  // `viewIsoOverride` threads through to viewMonthGrid() — see its own doc
  // comment (77-08 staleness fix).
  grids = (viewIsoOverride?: string) => Array.from({
  length: this.numberOfMonths
}, (_: any, i: any) => buildMonthGrid({
  viewIso: addMonths(this.viewMonthGrid(viewIsoOverride), i),
  value: this.selected(),
  today: this.todayIso(),
  min: this.min,
  max: this.max,
  disabledDates: this.disabledDates,
  disabledDaysOfWeek: this.disabledDaysOfWeek,
  isDateDisabled: this.isDateDisabled,
  weekStartsOn: this.weekStartsOn,
  disabled: this.disabled,
  selection: this.selectionMode === 'range' ? this.readRange() : undefined,
  previewEnd: this.selectionMode === 'range' ? this._hoverIso.value : undefined
}));

  // ---- drill models (months / years panels) ------------------------------
  // The 12-cell month picker for the 'months' drill view + the 12-cell year
  // picker (decade-aligned) for the 'years' view. PLAIN functions (uniform x6),
  // each a fresh object per call. The gates that matter to a whole month/year span
  // are min/max (buildMonthList/buildYearGrid own the entire-span test); the
  // per-day weekday/predicate gates apply only in the days grid.
  monthList = () => buildMonthList(this.viewMonthGrid(), {
  min: this.min,
  max: this.max,
  value: this.selected(),
  today: this.todayIso(),
  locale: this.locale
});

  yearGrid = () => buildYearGrid(this.viewMonthGrid(), {
  min: this.min,
  max: this.max,
  value: this.selected(),
  today: this.todayIso()
});

  // The decade window label (e.g. "2020–2031") shown in the years-panel header.
  yearRangeLabel = () => this.yearGrid().rangeLabel;

  // The day-grid iterable for the template: the N month grids in the 'days' view,
  // or an empty array in the months/years drill views. Gating the r-for through an
  // EMPTY array (rather than an r-if on the same element) keeps the day-grid
  // element free of an r-if+r-for combo. The panels render inside the ONE
  // layout-neutral `.rozie-datepicker-grids` wrapper (77-08 — the r-keynav day
  // grid's root; `display: contents` in the style block below keeps it out of
  // the render tree, so this stays present regardless of numberOfMonths without
  // perturbing the single-month layout).
  //
  // `viewIsoOverride` threads to viewMonthGrid() (77-08 staleness fix, see its
  // doc comment). `assumeDaysView`, when true, bypasses the showsDaysView()
  // gate — for a caller (selectMonth/exitToDaysView) that just wrote
  // $data.viewMode = 'days' in the SAME synchronous call: reading
  // $data.viewMode back here would observe the PRE-write value for the exact
  // same closure-staleness reason, so the caller that KNOWS it is
  // transitioning into the days view says so explicitly instead.
  daysGrids = (viewIsoOverride?: string, assumeDaysView?: boolean) => assumeDaysView || this.showsDaysView() ? this.grids(viewIsoOverride) : [];

  // The flat, render-order concatenation of every rendered panel's day cells
  // (panels in order, weeks in order, days in order) — the r-keynav day grid's
  // `:source` (77-08). Every panel is always exactly 42 cells (6 weeks x 7
  // days), so a cell's flat index is `panelIndex * 42 + weekIndex * 7 +
  // columnIndex` — the day button's own explicit r-keynav-item index expression
  // computes this exactly. Empty while a drill panel is showing, mirroring
  // daysGrids()'s own gate. Both params thread straight through to daysGrids().
  allDayCells = (viewIsoOverride?: string, assumeDaysView?: boolean) => this.daysGrids(viewIsoOverride, assumeDaysView).flatMap((g: any) => g.weeks.flatMap((row: any) => row));

  // The day grid's roving/active-index resolution input — the SAME shape the
  // pre-retrofit rovingDayIso() built, now feeding resolveRovingDayIndex
  // (buildMonthGrid.ts) instead of resolveRovingIso directly, so the tab stop,
  // entry focus and the focus() expose handle can never disagree (the
  // 260802-hla invariant). `anchor` mirrors the existing viewAnchor() funnel —
  // the selected value in single mode, else the in-progress range anchor — so
  // a range picker gets a tab stop too. `viewIsoOverride` threads to
  // viewMonthGrid() (77-08 staleness fix).
  rovingDayInput = (viewIsoOverride?: string) => ({
  viewIso: this.viewMonthGrid(viewIsoOverride),
  value: this.selected(),
  today: this.todayIso(),
  min: this.min,
  max: this.max,
  disabledDates: this.disabledDates,
  disabledDaysOfWeek: this.disabledDaysOfWeek,
  isDateDisabled: this.isDateDisabled,
  weekStartsOn: this.weekStartsOn,
  disabled: this.disabled,
  numberOfMonths: this.numberOfMonths,
  anchor: this.selected() !== '' ? this.selected() : this.selectionMode === 'range' ? this.readRange().start : ''
});

  // Seed $data.activeDay from the SAME anchor-in-view → today-in-view →
  // first-enabled-in-month-day fallback the pre-retrofit tab stop used
  // (resolveRovingDayIndex, buildMonthGrid.ts) — called on mount, after a
  // direct month/today nav, and whenever a drill panel returns to the days
  // view (selectMonth/exitToDaysView). The r-keynav grid controller lands DOM
  // focus itself whenever this value CHANGES — see the day grid's template
  // root. NOT called from onDayPage below, which computes its own precise
  // landing index per SPEC §4.1 instead of this fallback chain.
  //
  // `viewIsoOverride`/`assumeDaysView` thread straight through to
  // allDayCells()/rovingDayInput() — every caller that just wrote
  // $data.viewIso and/or $data.viewMode passes the fresh value(s) it already
  // computed instead of letting this function re-derive them from $data. This
  // is NOT a timing/ordering issue — no amount of setTimeout/rAF deferral
  // fixes it: on React, reading a state variable inside a callback observes
  // whatever that CLOSURE captured at creation time, and a synchronous
  // $data.X = newValue write inside the SAME calling function does not
  // retroactively update a closure that already exists (React's setState is
  // async — the closure calling this was bound BEFORE that write even
  // scheduled a new render). Passing the value the caller already has
  // sidesteps the staleness entirely (mirrors 77-07's onMonthCommit/
  // onYearCommit `i`-parameter fix for the identical class of bug; found via
  // 77-08's real-DOM Docker VR run — "step forward a month" resolved the
  // fallback against the OLD month, and a drill exit resolved against an
  // empty day source because $data.viewMode hadn't "visibly" flipped back to
  // 'days' from this function's point of view). Omitted at a call site with
  // no fresher value in hand (focus() expose handle) falls back to the live
  // $data reads, correctly.
  //
  // The day grid's own root never remounts (unlike the drills' r-if roots,
  // 77-07) — it's the SAME wrapper the whole time, so the controller's own
  // {root,active} diff (its "only re-apply on a genuine change" guard) sees
  // NO change at all when the freshly-resolved index happens to repeat the
  // value $data.activeDay already held, and silently skips re-applying DOM
  // focus. That drops focus continuity on exactly the 260802-hla regression
  // case this retrofit must keep green: drilling into months/years and back
  // out WITHOUT the selection changing (so the day tab stop resolves to the
  // SAME index both times) — meanwhile the day buttons themselves were
  // removed and recreated while the drill panel was showing, so REAL DOM
  // focus has already been lost by the time this runs. Force a genuine
  // change the reactive system actually observes: settle through the
  // ROVING_DAY_NONE sentinel first, then the real value one animation frame
  // later.
  //
  // EVERY write to $data.activeDay below is deferred one animation frame,
  // even in the plain (not-same-value) case — found empirically via 77-08's
  // real-DOM Docker VR run: a synchronous write from a real click handler
  // (not a mount effect, and with a CORRECTLY fresh-computed `next` value —
  // this is NOT the closure-staleness class of bug the viewIsoOverride
  // parameters above fix) still silently failed to reach the template on one
  // target. A single rAF deferral committed correctly every time on every
  // target, with no observable flicker (never a retry loop, and still never
  // queries the DOM or calls .focus() itself — the primitive's own effect
  // keeps owning that once it sees activeDay actually move).
  // [77-09 fix] Resolves the CURRENT day-grid position, safe to call even
  // while a settle is mid-flight (`$data.activeDay === ROVING_DAY_NONE`).
  // `$data.activeDay` is authoritative WHENEVER it holds a real value — this
  // covers every ordinary primitive-driven move (arrows, Home/End, Ctrl+Home/
  // End, pointer clicks, the focusin sync) transparently, since none of those
  // ever write the sentinel; they write straight through the
  // `r-keynav:tabindex.grid(7)="$data.activeDay"` two-way binding. Only when
  // `activeDay` is CURRENTLY the sentinel (a settle this same module started
  // is still in flight) does this fall back to `activeDayReal`, the shadow
  // both seedActiveDay and onDayPage keep pointed at their own last-computed
  // target — see `activeDayReal`'s own <data> doc comment for why a plain
  // `$data.activeDay` read is unsafe in that window.
  currentActiveDay = () => this._activeDay.value === ROVING_DAY_NONE ? this._activeDayReal.value : this._activeDay.value;

  seedActiveDay = (viewIsoOverride?: string, assumeDaysView?: boolean) => {
  const next = resolveRovingDayIndex(this.allDayCells(viewIsoOverride, assumeDaysView), this.rovingDayInput(viewIsoOverride));
  if (next === this.currentActiveDay()) {
    this._activeDay.value = ROVING_DAY_NONE;
  }
  // `activeDayReal` is updated SYNCHRONOUSLY (no rAF defer) — pure
  // bookkeeping, never read for DOM focus/UI, so it must always reflect the
  // latest INTENDED target the instant it's known, not one frame later.
  this._activeDayReal.value = next;
  requestAnimationFrame(() => {
    this._activeDay.value = next;
  });
};

  // The localized month-year heading. NAMED `monthHeading`, NOT `label` — a bare
  // `label` helper becomes a class field on the Lit custom element and a `title`
  // would collide with the inherited HTMLElement.title; `monthHeading` is clear.
  monthHeading = () => monthLabel(this.viewMonthGrid(), this.locale);

  // The seven weekday header labels, rotated by weekStartsOn. Visible text —
  // stays the SHORT Intl label (weekdaysLong() below feeds aria-label only).
  weekdays = () => weekdayLabels(this.weekStartsOn, this.locale);

  // ---- labels / a11y (quick task 260807-6p8, D-01, D-05) -----------------
  // labelFor(key) is the ONE resolution site for every chrome aria/visible
  // string — no default is ever duplicated at a call site (resolveLabel funnels
  // $props.labels through the shared LABEL_DEFAULTS table).
  labelFor = (key: any) => resolveLabel(this.labels, key);

  // The day cell's full, localized, human-readable aria-label (e.g. "Sunday,
  // June 15, 2025") — Intl-derived from $props.locale, NOT a `labels` key.
  dayAria = (iso: any) => dayLabel(iso, this.locale);

  // The seven FULL weekday names (Intl 'long'), used only for the column-header
  // aria-label — the visible text stays weekdays()'s short form.
  weekdaysLong = () => weekdayLabels(this.weekStartsOn, this.locale, 'long');

  // Each rendered month panel's OWN localized "Month YYYY" caption (per-panel
  // aria-label on its role="grid") — panel `i` is the view month advanced `i`
  // months, matching how grids() builds the panels.
  panelHeading = (i: any) => monthLabel(addMonths(this.viewMonthGrid(), i), this.locale);

  // The ten-field gating input shared by isDayDisabled AND rangeSpansDisabled,
  // so day-cell enablement and range-span validation can never disagree about
  // the same gates. ONE definition (was inlined per-call before this task).
  gateInput = () => ({
  viewIso: this.viewMonthGrid(),
  value: this.selected(),
  today: this.todayIso(),
  min: this.min,
  max: this.max,
  disabledDates: this.disabledDates,
  disabledDaysOfWeek: this.disabledDaysOfWeek,
  isDateDisabled: this.isDateDisabled,
  weekStartsOn: this.weekStartsOn,
  disabled: this.disabled
});

  // Whether a given ISO can be selected (the template gates clicks on it too).
  dayEnabled = (iso: any) => !isDayDisabled(iso, this.gateInput());

  // Whether the (order-tolerant) span between two ISOs crosses a disabled day
  // in its interior (D-02) — consumed by BOTH onDayHover (preview suppression)
  // and commitRange (re-anchor instead of complete) below, one predicate.
  rangeSpanBlocked = (a: any, b: any) => rangeSpansDisabled(a, b, this.gateInput());

  // ---- write funnel (single $emit site) ----------------------------------
  // Select an ISO date: write the model + emit change. NOT named `setValue`
  // (collides with React's generated `value` model setter → ROZ524). A no-op
  // (re-selecting the same date) still re-emits intentionally? No — guard it.
  commitValue = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  if (!this.dayEnabled(iso)) return;
  if (iso === this.selected()) return;
  this._valueControllable.write(iso);
  this._viewIso.value = iso;
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: iso
    },
    bubbles: true,
    composed: true
  }));
};

  // ---- range write funnel (direction-agnostic two-click state machine) ----
  // The anchor IS the partial model's `start` (end ''); there is no separate
  // anchor field. First click (no in-progress range, OR a completed one →
  // restart): write { start: iso, end: '' } + emit change. Second click
  // (anchor set, end empty → completing): write the ORDERED { start, end } +
  // clear the preview + emit change AND rangeComplete. Endpoints are compared by
  // VALUE (never object ===, Pitfall-4).
  // [D-02] The restart branch now ALSO fires when the in-progress span crosses
  // a disabled day (rangeSpanBlocked(r.start, iso)) — a blocked second click
  // RE-ANCHORS at the clicked day instead of completing, reusing this SAME
  // restart branch verbatim (one write path; no second $model.value write site
  // is introduced). Deliberately does NOT clear $data.hoverIso here — the
  // frozen VR phases depend on the restart branch's existing behavior.
  commitRange = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  if (!this.dayEnabled(iso)) return;
  const r = this.readRange();
  if (r.start === '' || r.end !== '' || this.rangeSpanBlocked(r.start, iso)) {
    // No in-progress selection, a completed one, or a blocked span → (re)start the anchor.
    this._valueControllable.write({
      start: iso,
      end: ''
    });
    this._viewIso.value = iso;
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: {
          start: iso,
          end: ''
        }
      },
      bubbles: true,
      composed: true
    }));
  } else {
    // Anchor set, end empty, span not blocked → complete the range (ordered by normalizeRange).
    const next = normalizeRange({
      start: r.start,
      end: iso
    });
    this._valueControllable.write(next);
    this._viewIso.value = iso;
    this._hoverIso.value = '';
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: next
      },
      bubbles: true,
      composed: true
    }));
    this.dispatchEvent(new CustomEvent("range-complete", {
      detail: {
        value: next
      },
      bubbles: true,
      composed: true
    }));
  }
};

  // Hover preview: only meaningful in range mode while a range is in progress
  // (anchor set, end empty). Records the hovered ISO so the grid lights the
  // direction-agnostic preview band. Otherwise a no-op — the early return below
  // is byte-preserved from the pre-260807-6p8 behavior. [D-02] Inside the
  // previewing state, when the hovered day is itself disabled OR the anchor→
  // hovered span crosses a disabled day (rangeSpanBlocked), the band is
  // SUPPRESSED entirely by clearing $data.hoverIso (not merely returning) —
  // clamping would put the visible band somewhere the cursor is not.
  onDayHover = (iso: any) => {
  if (this.selectionMode !== 'range') return;
  const r = this.readRange();
  if (r.start === '' || r.end !== '') return;
  if (!this.dayEnabled(iso) || this.rangeSpanBlocked(r.start, iso)) {
    this._hoverIso.value = '';
    return;
  }
  this._hoverIso.value = iso;
};

  // Day-select dispatch: route a click / Enter / Space through the mode-appropriate
  // funnel (range → commitRange, single → commitValue).
  onDaySelect = (iso: any) => {
  if (this.selectionMode === 'range') this.commitRange(iso);else this.commitValue(iso);
};

  // ---- month navigation (view-mode-aware ‹ › step) -----------------------
  // The prev/next step advances the view anchor by ONE UNIT of the current drill
  // view: a month in 'days', a year (12 months) in 'months', 12 years (144
  // months) in 'years'. In the default 'days' view the delta is `delta` months —
  // byte-identical to the pre-navigation behavior, so `:month-year-nav="false"`
  // (which can never leave 'days') is unchanged.
  goToMonth = (delta: any) => {
  if (this.disabled) return;
  const unit = this._viewMode.value === 'years' ? 144 : this._viewMode.value === 'months' ? 12 : 1;
  const nextViewIso = addMonths(this.viewMonthGrid(), delta * unit);
  this._viewIso.value = nextViewIso;
  // The rendered day set changed without going through the r-keynav page
  // mechanism (a direct header nav click) — reseed the tab stop (77-08).
  // Pass the freshly-computed viewIso directly (staleness fix, see
  // seedActiveDay's own doc comment) — $data.viewMode is UNCHANGED by this
  // function, so the live showsDaysView() read stays correct un-overridden.
  this.seedActiveDay(nextViewIso);
};

  goPrevMonth = () => this.goToMonth(-1);

  goNextMonth = () => this.goToMonth(1);

  // ---- view-mode drill state machine (mutates $data.viewMode/$data.viewIso
  // ONLY — never $model.value; drilling is a pure VIEW concern) -------------
  // Named boolean guards (never a bare `.length` / bare string compare in an
  // r-if — route through a `(): boolean` so the JSX targets emit a true boolean
  // and no falsy value leaks a text node).
  showsDaysView = (): boolean => this._viewMode.value === 'days';

  showsMonthsView = (): boolean => this._viewMode.value === 'months';

  showsYearsView = (): boolean => this._viewMode.value === 'years';

  // Drill DOWN into the month picker (from the days heading). Seeds
  // $data.activeMonth via resolveRovingDrillIndex (the SAME selection chain
  // resolveRovingDrillIso proves), so the r-keynav grid primitive lands DOM
  // focus on the resolved cell in the same tick the panel first renders — the
  // focus-after-render seam (SPEC §10). No scheduleFocus call: that's now the
  // primitive's job.
  enterMonthsView = () => {
  if (this.disabled) return;
  this._activeMonth.value = resolveRovingDrillIndex(this.monthList().months);
  this._viewMode.value = 'months';
};

  // Drill DOWN into the year picker (from the months-panel year label). Mirrors
  // enterMonthsView.
  enterYearsView = () => {
  if (this.disabled) return;
  this._activeYear.value = resolveRovingDrillIndex(this.yearGrid().years);
  this._viewMode.value = 'years';
};

  // Pick a month → move the view anchor to it, drill back UP toward days, and
  // seed $data.activeDay onto the resolved day tab stop — the r-keynav grid
  // controller lands DOM focus itself once the value changes (77-08; no
  // scheduler needed any more).
  selectMonth = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  if (!this.monthEnabled(iso)) return;
  this._viewIso.value = iso;
  this._viewMode.value = 'days';
  // Both the view anchor AND the days-view transition are fresh in THIS
  // call — pass both explicitly (staleness fix, see seedActiveDay's own doc
  // comment).
  this.seedActiveDay(iso, true);
};

  // Pick a year → move the view anchor's year, drill back UP toward months, and
  // re-seed $data.activeMonth (mirrors enterMonthsView — the primitive lands
  // focus, no scheduleFocus needed).
  selectYear = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  if (!this.yearEnabled(iso)) return;
  this._viewIso.value = iso;
  this._viewMode.value = 'months';
  this._activeMonth.value = resolveRovingDrillIndex(this.monthList().months);
};

  // Shared Escape-to-days exit for both drill keydown handlers: returns to the
  // days view AND seeds $data.activeDay, so Escape returns focus into the grid
  // (the r-keynav controller lands it) instead of dropping it to <body>. [D-03]
  // Now also reachable via the additive `header` slot `:closeDrill` param —
  // unlike its two existing callers (which already guard on $props.disabled
  // before calling), a consumer-invoked slot callback has no such guard, so a
  // whole-control disabled check is added here (a no-op for both existing call
  // sites, which never call this while disabled).
  exitToDaysView = () => {
  if (this.disabled) return;
  this._viewMode.value = 'days';
  // $data.viewIso is unchanged here (no fresher value to pass), but the
  // days-view transition IS fresh in THIS call — say so explicitly
  // (staleness fix, see seedActiveDay's own doc comment).
  this.seedActiveDay(undefined, true);
};

  // ---- day grid r-keynav wiring (77-08 retrofit) --------------------------
  // @keynav-commit fires with the day grid's own active index already resolved
  // by the primitive — read via the handler's OWN `i` parameter (mirrors
  // onMonthCommit/onYearCommit, 77-07 Task 3's real-DOM finding: re-reading
  // $data.activeDay here would see a stale pre-click value on React's async
  // setState). commitValue/commitRange already gate on dayEnabled(iso), so
  // committing a disabled cell stays a safe no-op even though the primitive
  // itself never commits one to begin with (grid mode's inert-by-default
  // contract, SPEC §5).
  onDayCommit = (i: any) => {
  const cell = this.allDayCells()[i];
  if (cell) this.onDaySelect(cell.iso);
};

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
  // 'pageup'/'pagedown': swing the view by one month and land on the SAME FLAT
  // INDEX (SPEC §4.1's sameWeekdayIndex illustration, mirroring KeynavGridDemo's
  // own onPage) — every panel is unconditionally 42 cells (6 rows x 7 columns)
  // and numberOfMonths never changes mid-page, so preserving the flat index
  // preserves BOTH the row and the weekday column. [77-09 fix, bug report
  // 2026-08-05] The prior implementation only preserved the COLUMN
  // (`activeDay % 7`), which silently discarded the row and always re-landed
  // on row 0 — visibly "jumping to the top row" on every PageUp/PageDown press
  // whenever the active cell wasn't already there.
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
  //
  // [77-09 fix] EVERY write below settles through the ROVING_DAY_NONE sentinel
  // first, then the real landing index one animation frame later — the SAME
  // safety net seedActiveDay uses (see its own doc comment) and for the SAME
  // reason: a page/boundary event always tears down and recreates the day-cell
  // DOM nodes (fresh content-based :key per week/panel for the new month) even
  // when the computed landing INDEX happens to repeat the value activeDay
  // already held (which the fixed 'pageup'/'pagedown' math above now does by
  // design whenever the grid shape is unchanged). When that happens, the
  // per-target controller's own "only re-apply focus on a genuine active-value
  // change" guard sees no change at all and never re-queries the (brand new)
  // DOM for the landing cell — silently dropping focus. This was the exact
  // mechanism behind the reported "second PageUp press loses focus entirely"
  // symptom: the first press (previously) computed a DIFFERENT column-only
  // value than the starting index, so it visibly (if wrongly) refocused; the
  // second press then computed the SAME value as the first, hit the
  // no-genuine-change guard, and focus vanished. Settling through the sentinel
  // forces a genuine reactive change on every press, regardless of whether the
  // computed index happens to repeat.
  //
  // [77-09 fix, real-DOM regression] The landing-index math below reads
  // `currentActiveDay()` (the sentinel-safe resolver), NOT `$data.activeDay`
  // directly. `activeDay` transiently sits at ROVING_DAY_NONE between the
  // synchronous settle-write below and the rAF-deferred real-value write one
  // frame later — a real hazard under RAPID REPEATED presses (PageDown held
  // down; OS key-repeat comfortably outpaces a single animation frame): a
  // second onDayPage call landing inside that transient window would read the
  // SENTINEL as "the current position," permanently corrupting every
  // subsequent landing index to -1 and dropping focus forever (confirmed via
  // real-DOM testing — a fast repeated-PageDown sequence never recovered
  // within a 10s poll). `currentActiveDay()` falls back to `activeDayReal`
  // (kept synchronously current below) ONLY during that window, and is
  // `$data.activeDay` itself the rest of the time — which is what keeps an
  // ORDINARY move (Control+Home, arrows, Home/End — none of which ever write
  // the sentinel) correctly visible here too, rather than a stale shadow from
  // whenever the day grid was last paged.
  onDayPage = (detail: any) => {
  this._viewIso.value = addMonths(this.viewMonthGrid(), detail.direction);
  const nextCells = this.allDayCells();
  const current = this.currentActiveDay();
  const next = detail.reason === 'boundary' ? detail.direction > 0 ? 0 : nextCells.length - 1 : Math.min(current, nextCells.length - 1);
  if (next === current) {
    this._activeDay.value = ROVING_DAY_NONE;
  }
  this._activeDayReal.value = next;
  requestAnimationFrame(() => {
    this._activeDay.value = next;
  });
};

  // The native `disabled` attribute is gone from the month/year drill buttons
  // (D-3 — focusable-but-inert, matching the day cells), so selectMonth/
  // selectYear must gate on the cell's own `disabled` flag themselves — today the
  // native attribute was the only guard.
  monthEnabled = (iso: any) => {
  const cell = this.monthList().months.find((m: any) => m.iso === iso);
  return !cell || !cell.disabled;
};

  yearEnabled = (iso: any) => {
  const cell = this.yearGrid().years.find((y: any) => y.iso === iso);
  return !cell || !cell.disabled;
};

  // ---- keyboard (77-08: author-owned Space/Escape only, F5) --------------
  // Every other key (arrows, Home/End, PageUp/PageDown, Ctrl+Home/End, Enter)
  // falls through untouched to the primitive's own root-level grid delegation
  // (the day grid's r-keynav wrapper, template below) — the hand-rolled day
  // keydown switch and its moveFocus helper are DELETED (77-08's whole point).
  onDayCellKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  if (key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    this.onDaySelect(iso);
  } else if (key === 'Escape') {
    // In range mode, cancel an in-progress (anchor-set) selection.
    if (this.selectionMode === 'range') {
      const r = this.readRange();
      if (r.start !== '' && r.end === '') {
        e.preventDefault();
        this._valueControllable.write({
          start: '',
          end: ''
        });
        this._hoverIso.value = '';
        this.dispatchEvent(new CustomEvent("change", {
          detail: {
            value: {
              start: '',
              end: ''
            }
          },
          bubbles: true,
          composed: true
        }));
      }
    }
  }
};

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
  onMonthCommit = (i: any) => {
  const cell = this.monthList().months[i];
  if (cell) this.selectMonth(cell.iso);
};

  onYearCommit = (i: any) => {
  const cell = this.yearGrid().years[i];
  if (cell) this.selectYear(cell.iso);
};

  // The drills have no pageable dataset (12 fixed cells, never paged) — SPEC
  // §4.1's "if the author ignores the event, boundary/page keys are safe
  // no-ops" clamp-equivalent default. Written explicitly (not omitted) so a
  // reader sees this is deliberate, not a missing handler.
  onDrillPage = () => {};

  // Author-owned Space/Escape only — every other key falls through untouched
  // to the primitive's own root-level grid delegation (the markup below).
  onMonthCellKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  if (key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    this.selectMonth(iso);
  } else if (key === 'Escape') {
    e.preventDefault();
    this.exitToDaysView();
  }
};

  onYearCellKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  if (key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    this.selectYear(iso);
  } else if (key === 'Escape') {
    e.preventDefault();
    this.exitToDaysView();
  }
};

  // ---- presets (range mode) ----------------------------------------------
  // Resolve every consumer preset's `range` (literal or () => RangeValue thunk)
  // into an ordered { label, range } for the rail + the #presets slot. A PLAIN
  // function (uniform x6), called fresh each render.
  resolvedPresets = () => this.presetRanges.map((p: any) => ({
  label: p.label,
  range: rangeFromPreset(p)
}));

  // Whether a preset rail should render. A BOOLEAN-returning helper, NOT a bare
  // `resolvedPresets().length` r-if: on the JSX targets `r-if` lowers to
  // `cond && <div>`, and a numeric `0` length leaks a literal "0" text node into
  // the DOM (React/Solid render falsy numbers). Even `length > 0` inline is
  // stripped back to `length` by the production minifier in the boolean-`&&`
  // context — routing through a named boolean helper keeps the guard a true
  // boolean through minification (the React falsy-number-in-r-if discipline).
  hasPresets = (): boolean => this.resolvedPresets().length > 0;

  // Apply a preset = a complete range: write the (ordered) value + clear any
  // in-progress preview + emit change AND rangeComplete. [D-02 discretion,
  // DELIBERATELY NOT range-span-validated] Unlike commitRange, this does NOT
  // consult rangeSpanBlocked: a preset's `range` is a consumer-supplied
  // literal/thunk whose date math the consumer already owns (see the
  // `presetRanges` prop docs), and silently refusing to honor a preset the
  // consumer explicitly configured would be worse than applying it as
  // supplied. Filed as a new explicit re-defer (quick task 260807-6p8 SUMMARY).
  applyPreset = (range: any) => {
  if (this.disabled) return;
  const next = normalizeRange(range);
  this._valueControllable.write(next);
  this._hoverIso.value = '';
  this.dispatchEvent(new CustomEvent("change", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
  this.dispatchEvent(new CustomEvent("range-complete", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
};

  // Whether a preset matches the current value (ordered endpoint equality), used
  // for aria-pressed / is-active. An empty range never reads active.
  isPresetActive = (range: any) => {
  const p = normalizeRange(range);
  if (p.start === '') return false;
  const r = this.readRange();
  return r.start === p.start && r.end === p.end;
};

  // ---- lifecycle + imperative handle -------------------------------------
  // Seed the view month from value / today on mount, then seed the day grid's
  // active-index model (77-08) — the SAME resolveRovingDayIndex chain the tab
  // stop uses, so mount, keyboard Tab and this handle can never disagree. The
  // fresh viewIso is passed directly (staleness fix, see seedActiveDay's own
  // doc comment); seedActiveDay() defers its own write internally, so this
  // call is a plain, synchronous fire-and-forget like every other
  // seedActiveDay() call site.
  // focus() — resolve + set $data.activeDay through the SAME roving-tabindex
  // chain the tab stop uses (seedActiveDay/resolveRovingDayIndex), so this
  // handle can never disagree with keyboard Tab — multi-month aware. It does
  // NOT query the DOM itself; the r-keynav grid controller lands DOM focus once
  // the value changes (77-08). DELIBERATELY overrides HTMLElement.focus on Lit
  // (ROZ137 warn, accepted).
  focus = () => {
  this.seedActiveDay();
};

  // goToToday() — swing the view to the current month (no selection change).
  goToToday = () => {
  if (this.disabled) return;
  const nextViewIso = this.todayIso();
  this._viewIso.value = nextViewIso;
  // Fresh viewIso passed directly (staleness fix, see seedActiveDay's own
  // doc comment); $data.viewMode is unchanged here.
  this.seedActiveDay(nextViewIso);
};

  // ---- footer moves (Today / Clear row) ----------------------------------
  // selectToday() — the footer "Today" action. In single mode commit today
  // through the value funnel (write + emit change, gated exactly like a day
  // click); in range mode just swing the view to the current month (goToToday),
  // never mutating the value. Clear reuses the existing clear() funnel unchanged.
  selectToday = () => {
  if (this.disabled) return;
  if (this.selectionMode === 'range') {
    this.goToToday();
  } else {
    this.commitValue(this.todayIso());
  }
};

  // Named boolean guard for the footer r-if (never a bare truthiness in the r-if
  // so the JSX targets emit a real boolean and leak no falsy value).
  showsFooter = (): boolean => !!this.showFooter;

  // clear() — deselect, writing the mode-appropriate empty ('' single /
  // { start:'', end:'' } range) + emit change.
  clear = () => {
  if (this.disabled) return;
  if (this.selectionMode === 'range') {
    const r = this.readRange();
    if (r.start === '' && r.end === '') return;
    this._valueControllable.write({
      start: '',
      end: ''
    });
    this._hoverIso.value = '';
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: {
          start: '',
          end: ''
        }
      },
      bubbles: true,
      composed: true
    }));
  } else {
    if (this.selected() === '') return;
    this._valueControllable.write('');
    this.dispatchEvent(new CustomEvent("change", {
      detail: {
        value: ''
      },
      bubbles: true,
      composed: true
    }));
  }
};

  get value(): string | any { return this._valueControllable.read(); }
  set value(v: string | any) { this._valueControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'value', 'selection-mode', 'selectionmode', 'min', 'max', 'disabled-dates', 'disableddates', 'week-starts-on', 'weekstartson', 'disabled', 'locale', 'labels', 'preset-ranges', 'presetranges', 'month-year-nav', 'monthyearnav', 'number-of-months', 'numberofmonths', 'show-footer', 'showfooter', 'disabled-days-of-week', 'disableddaysofweek', 'is-date-disabled', 'isdatedisabled']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
