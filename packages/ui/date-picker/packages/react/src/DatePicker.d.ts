import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DatePickerProps {
  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
   */
  value?: string | Record<string, unknown>;
  defaultValue?: string | Record<string, unknown>;
  onValueChange?: (next: string | Record<string, unknown>) => void;
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
  disabledDates?: unknown[];
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
  presetRanges?: unknown[];
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
  disabledDaysOfWeek?: unknown[];
  /**
   * A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`.
   */
  isDateDisabled?: ((...args: any[]) => any) | null;
  onChange?: (...args: unknown[]) => void;
  onRangeComplete?: (...args: unknown[]) => void;
  renderHeader?: (params: { label: unknown; prev: () => void; next: () => void; disabled: unknown }) => ReactNode;
  renderFooter?: (params: { today: () => void; clear: () => void; todayIso: unknown }) => ReactNode;
  renderPresets?: (params: { presets: unknown; apply: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const DatePicker: React.ForwardRefExoticComponent<DatePickerProps & React.RefAttributes<DatePickerHandle>>;
export default DatePicker;
