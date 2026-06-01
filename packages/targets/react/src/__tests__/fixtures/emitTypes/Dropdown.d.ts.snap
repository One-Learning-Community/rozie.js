import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DropdownProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  renderTrigger?: (params: { open: boolean; toggle: () => void }) => ReactNode;
  children?: ReactNode | ((params: { close: () => void }) => ReactNode);
  slots?: Record<string, () => ReactNode>;
}

export interface DropdownHandle {
  toggle: (...args: any[]) => any;
  close: (...args: any[]) => any;
}

declare const Dropdown: React.ForwardRefExoticComponent<DropdownProps & React.RefAttributes<DropdownHandle>>;
export default Dropdown;
