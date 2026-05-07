import type { ReactNode } from 'react';

export interface DropdownProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  renderTrigger?: (params: { open: boolean; toggle: () => void }) => ReactNode;
  children?: ReactNode | ((params: { close: () => void }) => ReactNode);
}

declare function Dropdown(props: DropdownProps): JSX.Element;
export default Dropdown;
