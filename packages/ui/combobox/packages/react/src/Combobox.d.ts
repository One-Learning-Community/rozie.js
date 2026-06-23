import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ComboboxProps {
  value?: (unknown) | null;
  defaultValue?: (unknown) | null;
  onValueChange?: (next: (unknown) | null) => void;
  options?: unknown[];
  placeholder?: string;
  disabled?: boolean;
  disableFilter?: boolean;
  ariaLabel?: (string) | null;
  idBase?: string;
  onChange?: (...args: unknown[]) => void;
  onSearch?: (...args: unknown[]) => void;
  renderOption?: (params: { option: () => void; active: unknown; selected: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ComboboxHandle {
  focus: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const Combobox: React.ForwardRefExoticComponent<ComboboxProps & React.RefAttributes<ComboboxHandle>>;
export default Combobox;
