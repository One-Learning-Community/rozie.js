import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ListboxProps {
  options?: unknown[];
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  multiple?: boolean;
  combobox?: boolean;
  filterable?: boolean;
  disabled?: boolean;
  placeholder?: string;
  closeOnSelect?: boolean;
  optionLabel?: ((...args: unknown[]) => unknown) | null;
  optionValue?: ((...args: unknown[]) => unknown) | null;
  optionDisabled?: ((...args: unknown[]) => unknown) | null;
  id?: string;
  ariaLabel?: (string) | null;
  onOpenChange?: (...args: unknown[]) => void;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  renderSelected?: (params: { selected: () => void; value: unknown }) => ReactNode;
  renderOption?: (params: { option: () => void; index: () => void; active: unknown; selected: unknown; disabled: unknown }) => ReactNode;
  renderEmpty?: (params: { query: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ListboxHandle {
  open: (...args: any[]) => any;
  close: (...args: any[]) => any;
  toggle: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  focusControl: (...args: any[]) => any;
}

declare const Listbox: React.ForwardRefExoticComponent<ListboxProps & React.RefAttributes<ListboxHandle>>;
export default Listbox;
