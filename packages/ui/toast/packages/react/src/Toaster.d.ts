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
  /**
   * Opt **out** of pointer swipe-to-dismiss. By default, dragging a toast past 45% of its own width/height (direction auto-derived from `position`) or a fast flick dismisses it with reason `'swipe'`; a short drag springs back. A drag starting on the close button (or any button/link) never swipes.
   */
  disableSwipe?: boolean;
  /**
   * Opt **in** to a sonner-style collapsed stack: a single-cell grid overlay with depth-driven transforms (toasts at depth 3+ fade to invisible), newest on top. Hovering the region or moving keyboard focus into it expands to the normal flex-column stack; leaving re-collapses. `false` (default) renders the plain flex column at all times.
   */
  stacked?: boolean;
  onDismissed?: (...args: unknown[]) => void;
  renderToast?: (params: { toast: unknown; dismiss: (...args: any[]) => any }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ToasterHandle {
  show(input?: { message?: string; type?: 'info' | 'success' | 'error' | 'warning' | 'loading'; duration?: number; id?: string | number; action?: { label?: string; onClick: (ctx: { id: string; data: unknown; }) => void; }; data?: unknown; }): string;
  dismiss(id: string): void;
  clear(): void;
  patch(id: string, changes?: { message?: string; type?: 'info' | 'success' | 'error' | 'warning' | 'loading'; duration?: number; action?: { label?: string; onClick: (ctx: { id: string; data: unknown; }) => void; }; data?: unknown; }): boolean;
  promise(p: Promise<unknown>, opts?: { loading?: string; success?: string | ((value: unknown) => string); error?: string | ((err: unknown) => string); }): string;
}

declare const Toaster: React.ForwardRefExoticComponent<ToasterProps & React.RefAttributes<ToasterHandle>>;
export default Toaster;
