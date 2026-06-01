import type { ReactNode } from 'react';

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
  onChange?: (...args: unknown[]) => void;
  onReady?: (...args: unknown[]) => void;
  onOpen?: (...args: unknown[]) => void;
  onClose?: (...args: unknown[]) => void;
  onMonthChange?: (...args: unknown[]) => void;
  onYearChange?: (...args: unknown[]) => void;
  onValueUpdate?: (...args: unknown[]) => void;
  onDayCreate?: (...args: unknown[]) => void;
}

declare function Flatpickr(props: FlatpickrProps): JSX.Element;
export default Flatpickr;
