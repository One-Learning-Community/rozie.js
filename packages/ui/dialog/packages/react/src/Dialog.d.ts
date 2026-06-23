import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (next: boolean) => void;
  disableBackdropClose?: boolean;
  disableEscapeClose?: boolean;
  disableScrollLock?: boolean;
  ariaLabel?: (string) | null;
  ariaLabelledby?: (string) | null;
  onClose?: (...args: unknown[]) => void;
  children?: ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface DialogHandle {
  show: (...args: any[]) => any;
  hide: (...args: any[]) => any;
}

declare const Dialog: React.ForwardRefExoticComponent<DialogProps & React.RefAttributes<DialogHandle>>;
export default Dialog;
