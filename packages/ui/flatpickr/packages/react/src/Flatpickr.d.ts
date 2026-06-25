import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface FlatpickrProps {
  /**
   * The two-way value (`r-model:date`) — the **formatted string** flatpickr produces, not a `Date`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Consumers that need the parsed `Date[]` read them off the `change` event payload instead.
   * @example
   * <Flatpickr r-model:date="picked" @change="onChange" />
   */
  date?: string;
  defaultDate?: string;
  onDateChange?: (next: string) => void;
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
  options?: Record<string, unknown>;
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
  appendTo?: (Record<string, unknown>) | null;
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
  disable?: unknown[];
  /**
   * Allow-list (the inverse of `disable`): when non-empty, ONLY these dates/ranges/predicates are selectable and everything else is disabled. Same element shapes as `disable`. Runtime-updatable via `set()`.
   */
  enable?: unknown[];
  /**
   * A flatpickr locale object (e.g. `import fr from 'flatpickr/dist/l10n/fr.js'`). The consumer lazy-imports it themselves — the wrapper adds no locale dependency. Runtime-updatable via `set('locale', …)`.
   */
  locale?: (Record<string, unknown>) | null;
  /**
   * First weekday of the calendar (`0` = Sunday … `1` = Monday). Folded into the `locale` option and overrides the locale's own first weekday when set. Runtime-updatable.
   */
  firstDayOfWeek?: number;
  /**
   * Custom parser `(dateStr: string, format: string) => Date` for input formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  parseDate?: ((...args: unknown[]) => unknown) | null;
  /**
   * Custom formatter `(date: Date, format: string, locale) => string` for output formats flatpickr's token grammar cannot express. **Construction-time only** — re-key the component to change it live.
   */
  formatDate?: ((...args: unknown[]) => unknown) | null;
  /**
   * An array of flatpickr plugin instances (imported from `flatpickr/dist/plugins/…`); the headline use is `rangePlugin` for two-input ranges. **Construction-time only** — re-key the component to swap plugins live.
   */
  plugins?: unknown[];
  onChange?: (...args: unknown[]) => void;
  onReady?: (...args: unknown[]) => void;
  onOpen?: (...args: unknown[]) => void;
  onClose?: (...args: unknown[]) => void;
  onMonthChange?: (...args: unknown[]) => void;
  onYearChange?: (...args: unknown[]) => void;
  onValueUpdate?: (...args: unknown[]) => void;
  onDayCreate?: (...args: unknown[]) => void;
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

declare const Flatpickr: React.ForwardRefExoticComponent<FlatpickrProps & React.RefAttributes<FlatpickrHandle>>;
export default Flatpickr;
