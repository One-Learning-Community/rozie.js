/**
 * paginationItems — the pure page-item model for the Pagination family.
 *
 * THE branchy core of this no-engine family, extracted to `src/internal/` so it
 * can be unit-tested in isolation (codegen vendors `src/internal/` into every
 * leaf via copyInternal, excluding `*.test.ts`) and imported once from
 * `Pagination.rozie`'s `<script>` as a PLAIN function — never a `$computed`,
 * since a `$computed` is a value on React but an accessor on Solid, so aliasing
 * the result in script logic diverges across targets. A plain function called
 * `()` everywhere is uniform on all six.
 *
 * Mirrors the MUI / WAI-ARIA "windowed pager" model: a fixed number of pages at
 * each boundary (`boundaryCount`), a window of `siblingCount` pages on each side
 * of the current page, and an `'ellipsis'` marker wherever a gap is collapsed.
 * The returned `pages` array is FRESH on every call (do not feed it to a
 * reference-equality `$watch` getter — watch a primitive instead).
 *
 * No framework imports, no DOM — pure data in, pure data out.
 */

export type PaginationItem = number | 'ellipsis';

export interface PaginationInput {
  /** 1-based current page. Clamped into [1, totalPages]. */
  page: number;
  /** Explicit total page count. Wins over `total`/`pageSize` when > 0. */
  totalPages?: number | null;
  /** Total item count — used with `pageSize` when `totalPages` is absent. */
  total?: number | null;
  /** Items per page — used with `total` when `totalPages` is absent. */
  pageSize?: number | null;
  /** Pages shown on each side of the current page. */
  siblingCount?: number;
  /** Pages always shown at each boundary (start + end). */
  boundaryCount?: number;
}

export interface PaginationModel {
  /** The resolved effective total page count (always >= 1). */
  totalPages: number;
  /** The clamped 1-based current page (always in [1, totalPages]). */
  page: number;
  /** The ordered render model: page numbers interleaved with `'ellipsis'`. */
  pages: PaginationItem[];
  /** `true` when a previous page exists (page > 1). */
  hasPrev: boolean;
  /** `true` when a next page exists (page < totalPages). */
  hasNext: boolean;
}

/** Inclusive integer range [start, end]; empty when start > end. */
function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i++) out.push(i);
  return out;
}

/**
 * Resolve the effective total page count from either an explicit `totalPages`
 * or `ceil(total / pageSize)`. Always at least 1 (an empty data set still has a
 * single page).
 */
export function resolveTotalPages(input: PaginationInput): number {
  const tp = input.totalPages;
  if (typeof tp === 'number' && tp > 0) return Math.max(1, Math.floor(tp));
  const total = typeof input.total === 'number' ? input.total : 0;
  const size = typeof input.pageSize === 'number' && input.pageSize > 0 ? input.pageSize : 0;
  if (total > 0 && size > 0) return Math.max(1, Math.ceil(total / size));
  return 1;
}

/**
 * Build the windowed page-item model. Pure: no clamping side effects, no DOM.
 *
 * Algorithm (MUI usePagination semantics):
 *   - `startPages` = first `boundaryCount` pages; `endPages` = last
 *     `boundaryCount` pages.
 *   - a sibling window of `siblingCount` pages on each side of `page`, kept
 *     clear of the boundary blocks.
 *   - an `'ellipsis'` collapses a gap of 2+ pages; a gap of exactly one page is
 *     rendered as that single bridging page (never a 1-page ellipsis).
 */
export function paginationItems(input: PaginationInput): PaginationModel {
  const totalPages = resolveTotalPages(input);

  const rawPage = typeof input.page === 'number' && Number.isFinite(input.page) ? Math.floor(input.page) : 1;
  const page = Math.min(Math.max(rawPage, 1), totalPages);

  const siblingCount = Math.max(0, Math.floor(input.siblingCount ?? 1));
  const boundaryCount = Math.max(0, Math.floor(input.boundaryCount ?? 1));

  // Start/end boundary blocks (clamped to the available pages).
  const startPages = range(1, Math.min(boundaryCount, totalPages));
  const endPages = range(Math.max(totalPages - boundaryCount + 1, boundaryCount + 1), totalPages);

  // The sibling window around the current page, kept clear of the boundary
  // blocks so a boundary page is never duplicated inside the window.
  const siblingsStart = Math.max(
    Math.min(page - siblingCount, totalPages - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const endPagesFirst: number | undefined = endPages[0];
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPagesFirst !== undefined ? endPagesFirst - 2 : totalPages - 1,
  );

  const pages: PaginationItem[] = [];

  pages.push(...startPages);

  // Gap (or single bridging page) between the start block and the window.
  if (siblingsStart > boundaryCount + 2) {
    pages.push('ellipsis');
  } else if (boundaryCount + 1 < totalPages - boundaryCount) {
    pages.push(boundaryCount + 1);
  }

  pages.push(...range(siblingsStart, siblingsEnd));

  // Gap (or single bridging page) between the window and the end block.
  if (siblingsEnd < totalPages - boundaryCount - 1) {
    pages.push('ellipsis');
  } else if (totalPages - boundaryCount > boundaryCount) {
    pages.push(totalPages - boundaryCount);
  }

  pages.push(...endPages);

  return {
    totalPages,
    page,
    pages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}
