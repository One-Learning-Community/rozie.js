import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DatePickerProps {
  /**
   * The selected date as an ISO `YYYY-MM-DD` string (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). An empty string `""` means no date is selected; selecting a day writes the new ISO string back and emits `change`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
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
  onChange?: (...args: unknown[]) => void;
  renderHeader?: (params: { label: unknown; prev: () => void; next: () => void; disabled: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const DatePicker: React.ForwardRefExoticComponent<DatePickerProps & React.RefAttributes<DatePickerHandle>>;
export default DatePicker;
