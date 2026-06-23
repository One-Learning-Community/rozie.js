import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ToasterProps {
  position?: string;
  duration?: number;
  max?: number;
  disablePauseOnHover?: boolean;
  ariaLabel?: (string) | null;
  renderToast?: (params: { toast: () => void; dismiss: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ToasterHandle {
  show: (...args: any[]) => any;
  dismiss: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

declare const Toaster: React.ForwardRefExoticComponent<ToasterProps & React.RefAttributes<ToasterHandle>>;
export default Toaster;
