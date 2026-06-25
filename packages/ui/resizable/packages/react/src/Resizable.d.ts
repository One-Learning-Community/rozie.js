import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ResizableProps {
  /**
   * The first (`start`) panel's size as a percent of the container along the split axis (its width when `direction="horizontal"`, its height when `"vertical"`). Two-way via `r-model:size`. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so the splitter position **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Every commit (drag, keyboard, or a programmatic `applySize`) is clamped to `[min, max]` and written back.
   * @example
   * <Resizable r-model:size="split" :min="20" :max="80" direction="horizontal" />
   */
  size?: number;
  defaultSize?: number;
  onSizeChange?: (next: number) => void;
  /**
   * The split axis. `'horizontal'` (default) lays the two panels out side-by-side with a vertical drag handle between them (`size` is the first panel's **width**); `'vertical'` stacks them with a horizontal handle (`size` is the first panel's **height**). Also sets the handle's `aria-orientation`.
   */
  direction?: string;
  /**
   * The minimum `size` percent — the first panel can never be dragged or nudged below this. Clamps every commit.
   */
  min?: number;
  /**
   * The maximum `size` percent — the first panel can never be dragged or nudged beyond this (so the second panel keeps at least `100 - max` percent). Clamps every commit.
   */
  max?: number;
  /**
   * Disable resizing — the handle becomes non-interactive (pointer drag and keyboard are ignored) and the panels lock at the current `size`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  onResize?: (...args: unknown[]) => void;
  renderStart?: () => ReactNode;
  renderHandle?: () => ReactNode;
  renderEnd?: () => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ResizableHandle {
  applySize: (...args: any[]) => any;
  reset: (...args: any[]) => any;
}

declare const Resizable: React.ForwardRefExoticComponent<ResizableProps & React.RefAttributes<ResizableHandle>>;
export default Resizable;
