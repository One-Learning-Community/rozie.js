import type { ReactNode } from 'react';

export interface SelectProps<T> {
  items: unknown[];
  selected?: T;
  defaultSelected?: T;
  onSelectedChange?: (next: T) => void;
}

declare function Select<T>(props: SelectProps<T>): JSX.Element;
export default Select;
