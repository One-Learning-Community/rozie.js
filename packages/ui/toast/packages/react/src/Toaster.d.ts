import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ToasterProps {
  /**
   * Which corner the toast stack renders in: `'top-left'`, `'top-right'`, `'top-center'`, `'bottom-left'`, `'bottom-right'`, or `'bottom-center'`. Drives the fixed-position layout and the stack direction.
   */
  position?: string;
  /**
   * Default auto-dismiss time in milliseconds, applied to any toast that does not pass its own `duration`. `0` (or a per-toast `duration` of `0`) makes the toast sticky — it stays until explicitly dismissed.
   */
  duration?: number;
  /**
   * Maximum number of visible toasts (`0` = unlimited). When the queue exceeds this, the oldest toasts drop off the stack.
   */
  max?: number;
  /**
   * Opt **out** of pausing the auto-dismiss timers while the pointer is over the stack. By default hovering pauses every timer and leaving restarts them; set this to keep toasts dismissing on schedule regardless of hover.
   */
  disablePauseOnHover?: boolean;
  /**
   * Accessible name for the live region (`role="region"`), applied as its `aria-label`. Defaults to `'Notifications'` when not set, so assistive tech can navigate to the toast stack as a landmark.
   */
  ariaLabel?: (string) | null;
  onDismissed?: (...args: unknown[]) => void;
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
