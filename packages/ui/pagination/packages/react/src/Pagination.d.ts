import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

/** The `change` event payload: the page that was just navigated to. */
export interface PaginationChangePayload {
  /** The new, clamped, 1-based current page. */
  page: number;
}

export interface PaginationProps extends Omit<import('react').ComponentPropsWithoutRef<'nav'>, 'modelValue' | 'defaultModelValue' | 'onModelValueChange' | 'totalPages' | 'total' | 'pageSize' | 'siblingCount' | 'boundaryCount' | 'disabled' | 'ariaLabel' | 'onChange' | 'renderPrevControl' | 'renderEllipsis' | 'renderItem' | 'renderNextControl' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
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
  onChange?: (payload: PaginationChangePayload) => void;
  renderPrevControl?: (params: { disabled: boolean; goto: () => void; page: number }) => ReactNode;
  renderEllipsis?: (params: { index: number }) => ReactNode;
  renderItem?: (params: { page: number; selected: boolean; goto: () => void }) => ReactNode;
  renderNextControl?: (params: { disabled: boolean; goto: () => void; page: number }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface PaginationHandle {
  goto: (page: number) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;
}

declare const Pagination: React.ForwardRefExoticComponent<PaginationProps & React.RefAttributes<PaginationHandle>>;
export default Pagination;
