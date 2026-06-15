import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface FlatpickrProps {
  date?: string;
  defaultDate?: string;
  onDateChange?: (next: string) => void;
  mode?: string;
  dateFormat?: string;
  altInput?: boolean;
  altFormat?: string;
  enableTime?: boolean;
  enableSeconds?: boolean;
  time24hr?: boolean;
  noCalendar?: boolean;
  minDate?: (string) | null;
  maxDate?: (string) | null;
  placeholder?: string;
  disabled?: boolean;
  commitOn?: string;
  options?: Record<string, unknown>;
  name?: string;
  inline?: boolean;
  staticPosition?: boolean;
  position?: string;
  appendTo?: (Record<string, unknown>) | null;
  showMonths?: number;
  weekNumbers?: boolean;
  monthSelectorType?: string;
  prevArrow?: (string) | null;
  nextArrow?: (string) | null;
  allowInput?: boolean;
  disable?: unknown[];
  enable?: unknown[];
  locale?: (Record<string, unknown>) | null;
  firstDayOfWeek?: number;
  parseDate?: ((...args: unknown[]) => unknown) | null;
  formatDate?: ((...args: unknown[]) => unknown) | null;
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
