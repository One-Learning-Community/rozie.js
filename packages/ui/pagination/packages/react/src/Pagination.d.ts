import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface PaginationProps {
  /**
   * The 1-based current page (two-way model). Clamped into `[1, totalPages]`. Bind it with `r-model:modelValue` / `v-model:modelValue` / `modelValue` + `onModelValueChange`; it is also the Angular ControlValueAccessor control value.
   */
  modelValue?: number;
  defaultModelValue?: number;
  onModelValueChange?: (next: number) => void;
  /**
   * Explicit total page count. When provided (> 0) it takes precedence over `total` + `pageSize`. Use it when the backend already reports the page count.
   */
  totalPages?: (number) | null;
  /**
   * Total item count. Combined with `pageSize` to derive the page count (`ceil(total / pageSize)`) when `totalPages` is not given.
   */
  total?: (number) | null;
  /**
   * Items per page. Combined with `total` to derive the page count when `totalPages` is not given.
   */
  pageSize?: (number) | null;
  /**
   * Number of page buttons shown on each side of the current page (the sibling window). Larger values show more context around the current page.
   */
  siblingCount?: number;
  /**
   * Number of page buttons always shown at each boundary (the first and last `boundaryCount` pages), regardless of the current page.
   */
  boundaryCount?: number;
  /**
   * Disable the entire control — every page button and the prev/next controls become non-interactive and are marked `aria-disabled`.
   */
  disabled?: boolean;
  /**
   * Accessible name for the surrounding `<nav>` landmark (its `aria-label`). Defaults to `"Pagination"`.
   */
  ariaLabel?: string;
  onChange?: (...args: unknown[]) => void;
  renderPrevControl?: (params: { disabled: unknown; goto: () => void; page: unknown }) => ReactNode;
  renderEllipsis?: (params: { index: () => void }) => ReactNode;
  renderItem?: (params: { page: () => void; selected: unknown; goto: unknown }) => ReactNode;
  renderNextControl?: (params: { disabled: unknown; goto: () => void; page: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface PaginationHandle {
  goto: (...args: any[]) => any;
  next: (...args: any[]) => any;
  prev: (...args: any[]) => any;
  first: (...args: any[]) => any;
  last: (...args: any[]) => any;
}

declare const Pagination: React.ForwardRefExoticComponent<PaginationProps & React.RefAttributes<PaginationHandle>>;
export default Pagination;
