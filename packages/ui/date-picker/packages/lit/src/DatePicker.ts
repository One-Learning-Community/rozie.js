import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, signal } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
import { repeat } from 'lit/directives/repeat.js';
import { addDays, addMonths, buildMonthGrid, buildMonthList, buildYearGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface RozieHeaderSlotCtx {
  label: unknown;
  prev: unknown;
  next: unknown;
  disabled: unknown;
}

interface RozieFooterSlotCtx {
  today: unknown;
  clear: unknown;
  todayIso: unknown;
}

interface RoziePresetsSlotCtx {
  presets: unknown;
  apply: unknown;
}

@customElement('rozie-date-picker')
export default class DatePicker extends SignalWatcher(LitElement) {
  static styles = css`
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
}
`;

  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
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
  @property({ type: Function }) isDateDisabled: ((...args: unknown[]) => unknown) | null = null;
  private _viewIso = signal('');
  private _hoverIso = signal('');
  private _viewMode = signal('days');
  @query('[data-rozie-ref="root"]') private _refRoot!: HTMLElement;

  @state() private _hasSlotHeader = false;
  @queryAssignedElements({ slot: 'header', flatten: true }) private _slotHeaderElements!: Element[];
  @property({ attribute: false }) header?: (scope: { label: unknown; prev: unknown; next: unknown; disabled: unknown }) => unknown;
  @state() private _hasSlotFooter = false;
  @queryAssignedElements({ slot: 'footer', flatten: true }) private _slotFooterElements!: Element[];
  @property({ attribute: false }) footer?: (scope: { today: unknown; clear: unknown; todayIso: unknown }) => unknown;
  @state() private _hasSlotPresets = false;
  @queryAssignedElements({ slot: 'presets', flatten: true }) private _slotPresetsElements!: Element[];
  @property({ attribute: false }) presets?: (scope: { presets: unknown; apply: unknown }) => unknown;

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

    this._viewIso.value = this.viewMonthGrid();
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
<div class="${Object.entries({ "rozie-datepicker": true, 'rozie-datepicker--disabled': this.disabled, 'rozie-datepicker--multi': this.numberOfMonths > 1 }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="group" aria-label="Date picker" aria-disabled=${!!this.disabled} ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-ref="root" data-rozie-s-6800c7a2>
  
  ${this.header !== undefined ? this.header({label: this.monthHeading(), prev: this.goPrevMonth, next: this.goNextMonth, disabled: !!this.disabled}) : html`<slot name="header" data-rozie-params=${(() => { try { return JSON.stringify({label: this.monthHeading(), disabled: !!this.disabled}); } catch { return '{}'; } })()} @rozie-header-prev=${($event: CustomEvent) => ((this.goPrevMonth) as (...args: any[]) => any)($event.detail)} @rozie-header-next=${($event: CustomEvent) => ((this.goNextMonth) as (...args: any[]) => any)($event.detail)}>
    <div class="rozie-datepicker-header" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-nav rozie-datepicker-prev" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label="Previous month" @click=${this.goPrevMonth} data-rozie-s-6800c7a2>‹</button>
      ${this.monthYearNav ? html`<button class="rozie-datepicker-heading rozie-datepicker-heading-button" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label="Change month and year" aria-live="polite" @click=${this.enterMonthsView} data-rozie-s-6800c7a2>${rozieDisplay(this.monthHeading())}</button>` : html`<span class="rozie-datepicker-heading" aria-live="polite" data-rozie-s-6800c7a2>${rozieDisplay(this.monthHeading())}</span>`}<button class="rozie-datepicker-nav rozie-datepicker-next" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label="Next month" @click=${this.goNextMonth} data-rozie-s-6800c7a2>›</button>
    </div>
  </slot>`}

  
  ${repeat<any>(this.daysGrids(), (g, gi) => gi, (g, gi) => html`<div class="rozie-datepicker-grid" key=${rozieAttr(gi)} role="grid" @mouseleave=${($event: MouseEvent & { currentTarget: HTMLDivElement; target: HTMLDivElement }) => { this._hoverIso.value = ''; }} data-rozie-s-6800c7a2>
    <div class="rozie-datepicker-weekdays" role="row" data-rozie-s-6800c7a2>
      ${repeat<any>(this.weekdays(), (wd, wi) => wi, (wd, wi) => html`<span class="rozie-datepicker-weekday" key=${rozieAttr(wi)} role="columnheader" aria-label=${rozieAttr(wd)} data-rozie-s-6800c7a2>${rozieDisplay(wd)}</span>`)}
    </div>

    ${repeat<any>(g.weeks, (week, wk) => wk, (week, wk) => html`<div class="rozie-datepicker-week" key=${rozieAttr(wk)} role="row" data-rozie-s-6800c7a2>
      ${repeat<any>(week, (day, _idx) => day.iso, (day, _idx) => html`<span class="rozie-datepicker-cell" key=${rozieAttr(day.iso)} role="gridcell" aria-selected=${!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2>
        <button class="${Object.entries({ "rozie-datepicker-day": true, 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview }).filter(([, v]) => v).map(([k]) => k).join(' ')}" type="button" data-day=${rozieAttr(day.iso)} tabindex=${rozieAttr(this.dayTabIndex(day))} ?disabled=${!!day.disabled} aria-disabled=${!!day.disabled} aria-label=${rozieAttr(day.iso)} aria-current=${rozieAttr(day.today ? 'date' : null)} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDaySelect(day.iso); }} @mouseenter=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayHover(day.iso); }} @focus=${($event: FocusEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayHover(day.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onDayKeydown(day.iso, $event); }} data-rozie-s-6800c7a2>${rozieDisplay(day.day)}</button>
      </span>`)}
    </div>`)}
  </div>`)}

  
  ${this.showsMonthsView() ? html`<div class="rozie-datepicker-months" data-rozie-s-6800c7a2>
    <div class="rozie-datepicker-drill-header" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-drill-label" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} aria-label="Change year" @click=${this.enterYearsView} data-rozie-s-6800c7a2>${rozieDisplay(this.monthList().year)}</button>
    </div>
    <div class="rozie-datepicker-drill-grid" role="grid" aria-label="Choose month" data-rozie-s-6800c7a2>
      ${repeat<any>(this.monthList().months, (cell, _idx) => cell.iso, (cell, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-month": true, 'is-selected': cell.selected, 'is-current': cell.current }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(cell.iso)} type="button" role="gridcell" data-month=${rozieAttr(cell.iso)} tabindex=${rozieAttr(this.monthTabIndex(cell))} ?disabled=${!!cell.disabled} aria-disabled=${!!cell.disabled} aria-selected=${!!cell.selected} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.selectMonth(cell.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onMonthKeydown(cell.iso, $event); }} data-rozie-s-6800c7a2>${rozieDisplay(cell.label)}</button>`)}
    </div>
  </div>` : nothing}${this.showsYearsView() ? html`<div class="rozie-datepicker-years" data-rozie-s-6800c7a2>
    <div class="rozie-datepicker-drill-header" data-rozie-s-6800c7a2>
      <span class="rozie-datepicker-drill-label" aria-live="polite" data-rozie-s-6800c7a2>${rozieDisplay(this.yearRangeLabel())}</span>
    </div>
    <div class="rozie-datepicker-drill-grid" role="grid" aria-label="Choose year" data-rozie-s-6800c7a2>
      ${repeat<any>(this.yearGrid().years, (cell, _idx) => cell.iso, (cell, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-year": true, 'is-selected': cell.selected, 'is-current': cell.current }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(cell.iso)} type="button" role="gridcell" data-year=${rozieAttr(cell.iso)} tabindex=${rozieAttr(this.yearTabIndex(cell))} ?disabled=${!!cell.disabled} aria-disabled=${!!cell.disabled} aria-selected=${!!cell.selected} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.selectYear(cell.iso); }} @keydown=${($event: KeyboardEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.onYearKeydown(cell.iso, $event); }} data-rozie-s-6800c7a2>${rozieDisplay(cell.year)}</button>`)}
    </div>
  </div>` : nothing}${this.footer !== undefined ? this.footer({today: this.selectToday, clear: this.clear, todayIso: this.todayIso()}) : html`<slot name="footer" data-rozie-params=${(() => { try { return JSON.stringify({todayIso: this.todayIso()}); } catch { return '{}'; } })()} @rozie-footer-today=${($event: CustomEvent) => ((this.selectToday) as (...args: any[]) => any)($event.detail)} @rozie-footer-clear=${($event: CustomEvent) => ((this.clear) as (...args: any[]) => any)($event.detail)}>
    ${this.showsFooter() ? html`<div class="rozie-datepicker-footer" data-rozie-s-6800c7a2>
      <button class="rozie-datepicker-footer-btn rozie-datepicker-today" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} @click=${this.selectToday} data-rozie-s-6800c7a2>Today</button>
      <button class="rozie-datepicker-footer-btn rozie-datepicker-clear" type="button" ?disabled=${!!this.disabled} aria-disabled=${!!this.disabled} @click=${this.clear} data-rozie-s-6800c7a2>Clear</button>
    </div>` : nothing}</slot>`}

  
  ${this.presets !== undefined ? this.presets({presets: this.resolvedPresets(), apply: this.applyPreset}) : html`<slot name="presets" data-rozie-params=${(() => { try { return JSON.stringify({presets: this.resolvedPresets()}); } catch { return '{}'; } })()} @rozie-presets-apply=${($event: CustomEvent) => ((this.applyPreset) as (...args: any[]) => any)($event.detail)}>
    ${this.hasPresets() ? html`<div class="rozie-datepicker-presets" role="group" aria-label="Date range presets" data-rozie-s-6800c7a2>
      ${repeat<any>(this.resolvedPresets(), (p, _idx) => p.label, (p, _idx) => html`<button class="${Object.entries({ "rozie-datepicker-preset": true, 'is-active': this.isPresetActive(p.range) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" key=${rozieAttr(p.label)} type="button" aria-pressed=${!!this.isPresetActive(p.range)} ?disabled=${!!this.disabled} @click=${($event: MouseEvent & { currentTarget: HTMLButtonElement; target: HTMLButtonElement }) => { this.applyPreset(p.range); }} data-rozie-s-6800c7a2>${rozieDisplay(p.label)}</button>`)}
    </div>` : nothing}</slot>`}
</div>
`;
  }

  todayIso = () => {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth(), d.getDate());
};

  selected = (): string => {
  const v = this.value;
  return typeof v === 'string' ? v : '';
};

  readRange = () => normalizeRange(this.value);

  viewAnchor = (): string => {
  const s = this.selected();
  if (s !== '') return s;
  if (this.selectionMode === 'range') return this.readRange().start;
  return '';
};

  viewMonthGrid = () => resolveViewIso({
  viewIso: this._viewIso.value,
  value: this.viewAnchor(),
  today: this.todayIso()
});

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

  grids = () => Array.from({
  length: this.numberOfMonths
}, (_: any, i: any) => buildMonthGrid({
  viewIso: addMonths(this.viewMonthGrid(), i),
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

  yearRangeLabel = () => this.yearGrid().rangeLabel;

  daysGrids = () => this.showsDaysView() ? this.grids() : [];

  dayTabIndex = (day: any): number | undefined => day.selected || this.selected() === '' && day.today ? 0 : -1;

  monthHeading = () => monthLabel(this.viewMonthGrid(), this.locale);

  weekdays = () => weekdayLabels(this.weekStartsOn, this.locale);

  dayEnabled = (iso: any) => !isDayDisabled(iso, {
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

  commitRange = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  if (!this.dayEnabled(iso)) return;
  const r = this.readRange();
  if (r.start === '' || r.end !== '') {
    // No in-progress selection, or a completed one → (re)start the anchor.
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
    // Anchor set, end empty → complete the range (ordered by normalizeRange).
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
    this.dispatchEvent(new CustomEvent("rangeComplete", {
      detail: {
        value: next
      },
      bubbles: true,
      composed: true
    }));
  }
};

  onDayHover = (iso: any) => {
  if (this.selectionMode !== 'range') return;
  const r = this.readRange();
  if (r.start !== '' && r.end === '') this._hoverIso.value = iso;
};

  onDaySelect = (iso: any) => {
  if (this.selectionMode === 'range') this.commitRange(iso);else this.commitValue(iso);
};

  goToMonth = (delta: any) => {
  if (this.disabled) return;
  const unit = this._viewMode.value === 'years' ? 144 : this._viewMode.value === 'months' ? 12 : 1;
  this._viewIso.value = addMonths(this.viewMonthGrid(), delta * unit);
};

  goPrevMonth = () => this.goToMonth(-1);

  goNextMonth = () => this.goToMonth(1);

  showsDaysView = (): boolean => this._viewMode.value === 'days';

  showsMonthsView = (): boolean => this._viewMode.value === 'months';

  showsYearsView = (): boolean => this._viewMode.value === 'years';

  enterMonthsView = () => {
  if (this.disabled) return;
  this._viewMode.value = 'months';
};

  enterYearsView = () => {
  if (this.disabled) return;
  this._viewMode.value = 'years';
};

  selectMonth = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  this._viewIso.value = iso;
  this._viewMode.value = 'days';
};

  selectYear = (iso: any) => {
  if (this.disabled) return;
  if (!isIsoDate(iso)) return;
  this._viewIso.value = iso;
  this._viewMode.value = 'months';
};

  dayCells = () => {
  const root = this._refRoot;
  if (!root) return [];
  return Array.from(root.querySelectorAll('[data-day]')) as HTMLElement[];
};

  focusDayIso = (iso: any) => {
  const cells = this.dayCells();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].getAttribute('data-day') === iso) {
      cells[i].focus();
      return;
    }
  }
};

  monthCells = () => {
  const root = this._refRoot;
  if (!root) return [];
  return Array.from(root.querySelectorAll('[data-month]')) as HTMLElement[];
};

  focusMonthIso = (iso: any) => {
  const cells = this.monthCells();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].getAttribute('data-month') === iso) {
      cells[i].focus();
      return;
    }
  }
};

  yearCells = () => {
  const root = this._refRoot;
  if (!root) return [];
  return Array.from(root.querySelectorAll('[data-year]')) as HTMLElement[];
};

  focusYearIso = (iso: any) => {
  const cells = this.yearCells();
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].getAttribute('data-year') === iso) {
      cells[i].focus();
      return;
    }
  }
};

  monthTabIndex = (cell: any): number | undefined => cell.selected || this.selected() === '' && cell.current ? 0 : -1;

  yearTabIndex = (cell: any): number | undefined => cell.selected || this.selected() === '' && cell.current ? 0 : -1;

  moveFocus = (fromIso: any, days: any) => {
  if (this.disabled) return;
  const next = addDays(fromIso, days);
  // Widened to ANY rendered month (multi-month): if `next` is present in any of
  // the displayed grids, arrow focus can cross month columns without swinging
  // the view. Only when it leaves every rendered month do we move the anchor.
  const present = this.grids().some((g: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === next)));
  if (!present) this._viewIso.value = next;
  this.focusDayIso(next);
};

  onDayKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  if (key === 'ArrowLeft') {
    e.preventDefault();
    this.moveFocus(iso, -1);
  } else if (key === 'ArrowRight') {
    e.preventDefault();
    this.moveFocus(iso, 1);
  } else if (key === 'ArrowUp') {
    e.preventDefault();
    this.moveFocus(iso, -7);
  } else if (key === 'ArrowDown') {
    e.preventDefault();
    this.moveFocus(iso, 7);
  } else if (key === 'Home') {
    e.preventDefault();
    this.moveFocus(iso, -this.weekdayOffset(iso));
  } else if (key === 'End') {
    e.preventDefault();
    this.moveFocus(iso, 6 - this.weekdayOffset(iso));
  } else if (key === 'PageUp') {
    e.preventDefault();
    this.moveFocus(iso, 0 - this.daysInMonthSpan(iso, -1));
  } else if (key === 'PageDown') {
    e.preventDefault();
    this.moveFocus(iso, this.daysInMonthSpan(iso, 1));
  } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
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

  DRILL_COLS = 3;

  onMonthKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  const cells = this.monthList().months;
  let idx = -1;
  for (let i = 0; i < cells.length; i++) if (cells[i].iso === iso) idx = i;
  if (idx < 0) return;
  let next = idx;
  if (key === 'ArrowLeft') next = Math.max(0, idx - 1);else if (key === 'ArrowRight') next = Math.min(11, idx + 1);else if (key === 'ArrowUp') next = Math.max(0, idx - this.DRILL_COLS);else if (key === 'ArrowDown') next = Math.min(11, idx + this.DRILL_COLS);else if (key === 'Home') next = idx - idx % this.DRILL_COLS;else if (key === 'End') next = idx - idx % this.DRILL_COLS + (this.DRILL_COLS - 1);else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    this.selectMonth(iso);
    return;
  } else if (key === 'Escape') {
    e.preventDefault();
    this._viewMode.value = 'days';
    return;
  } else return;
  e.preventDefault();
  this.focusMonthIso(cells[next].iso);
};

  onYearKeydown = (iso: any, e: any) => {
  if (this.disabled) return;
  const key = e ? e.key : '';
  const cells = this.yearGrid().years;
  let idx = -1;
  for (let i = 0; i < cells.length; i++) if (cells[i].iso === iso) idx = i;
  if (idx < 0) return;
  let next = idx;
  if (key === 'ArrowLeft') next = Math.max(0, idx - 1);else if (key === 'ArrowRight') next = Math.min(11, idx + 1);else if (key === 'ArrowUp') next = Math.max(0, idx - this.DRILL_COLS);else if (key === 'ArrowDown') next = Math.min(11, idx + this.DRILL_COLS);else if (key === 'Home') next = idx - idx % this.DRILL_COLS;else if (key === 'End') next = idx - idx % this.DRILL_COLS + (this.DRILL_COLS - 1);else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
    e.preventDefault();
    this.selectYear(iso);
    return;
  } else if (key === 'Escape') {
    e.preventDefault();
    this._viewMode.value = 'days';
    return;
  } else return;
  e.preventDefault();
  this.focusYearIso(cells[next].iso);
};

  weekdayOffset = (iso: any) => {
  const g = this.grid();
  for (const row of g.weeks as any) {
    for (let c = 0; c < row.length; c++) {
      if (row[c].iso === iso) return c;
    }
  }
  return 0;
};

  daysInMonthSpan = (iso: any, dir: any) => {
  const a = this.isoToMs(iso);
  const b = this.isoToMs(addMonths(iso, dir));
  return Math.round((b - a) / 86400000);
};

  isoToMs = (iso: any) => {
  const t = isIsoDate(iso) ? Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : 0;
  return t;
};

  resolvedPresets = () => this.presetRanges.map((p: any) => ({
  label: p.label,
  range: rangeFromPreset(p)
}));

  hasPresets = (): boolean => this.resolvedPresets().length > 0;

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
  this.dispatchEvent(new CustomEvent("rangeComplete", {
    detail: {
      value: next
    },
    bubbles: true,
    composed: true
  }));
};

  isPresetActive = (range: any) => {
  const p = normalizeRange(range);
  if (p.start === '') return false;
  const r = this.readRange();
  return r.start === p.start && r.end === p.end;
};

  focus = () => {
  const sel = this.selected();
  const t = this.todayIso();
  const g = this.grid();
  const present = (iso: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === iso));
  if (sel && present(sel)) {
    this.focusDayIso(sel);
  } else if (present(t)) {
    this.focusDayIso(t);
  } else {
    const first = g.weeks[0] && g.weeks[0][0] ? g.weeks[0][0].iso : '';
    if (first) this.focusDayIso(first);
  }
};

  goToToday = () => {
  if (this.disabled) return;
  this._viewIso.value = this.todayIso();
};

  selectToday = () => {
  if (this.disabled) return;
  if (this.selectionMode === 'range') {
    this.goToToday();
  } else {
    this.commitValue(this.todayIso());
  }
};

  showsFooter = (): boolean => !!this.showFooter;

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
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['value', 'selection-mode', 'selectionmode', 'min', 'max', 'disabled-dates', 'disableddates', 'week-starts-on', 'weekstartson', 'disabled', 'locale', 'preset-ranges', 'presetranges', 'month-year-nav', 'monthyearnav', 'number-of-months', 'numberofmonths', 'show-footer', 'showfooter', 'disabled-days-of-week', 'disableddaysofweek', 'is-date-disabled', 'isdatedisabled']);
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
