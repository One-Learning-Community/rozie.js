/**
 * Unit tests for the pure page-item algorithm. These pin the ellipsis / sibling
 * / boundary edge cases with concrete expected arrays — the branchy logic that
 * the surface gate (which only checks the IR shape) cannot cover.
 *
 * Excluded from the vendored leaf copies (codegen's copyInternal filters
 * `*.test.ts`) — runs only under `pnpm --filter @rozie-ui/pagination test`.
 */
import { describe, it, expect } from 'vitest';
import { paginationItems, resolveTotalPages } from './paginationItems';

const items = (input: Parameters<typeof paginationItems>[0]) => paginationItems(input).pages;

describe('resolveTotalPages', () => {
  it('prefers explicit totalPages', () => {
    expect(resolveTotalPages({ page: 1, totalPages: 7 })).toBe(7);
  });
  it('derives ceil(total / pageSize) when totalPages absent', () => {
    expect(resolveTotalPages({ page: 1, total: 95, pageSize: 10 })).toBe(10);
    expect(resolveTotalPages({ page: 1, total: 100, pageSize: 10 })).toBe(10);
    expect(resolveTotalPages({ page: 1, total: 1, pageSize: 10 })).toBe(1);
  });
  it('falls back to 1 page for empty/invalid data', () => {
    expect(resolveTotalPages({ page: 1 })).toBe(1);
    expect(resolveTotalPages({ page: 1, total: 0, pageSize: 10 })).toBe(1);
    expect(resolveTotalPages({ page: 1, totalPages: 0 })).toBe(1);
  });
});

describe('paginationItems — no ellipsis needed (short ranges)', () => {
  it('renders every page when the count fits the window', () => {
    expect(items({ page: 1, totalPages: 1 })).toEqual([1]);
    expect(items({ page: 1, totalPages: 5 })).toEqual([1, 2, 3, 4, 5]);
    expect(items({ page: 4, totalPages: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('paginationItems — current near the start', () => {
  it('constant-width window with one ellipsis on the right (MUI parity, sibling=1, boundary=1)', () => {
    // The window keeps a constant width near a boundary (MUI usePagination
    // semantics) — pages 1..3 all show the same five leading pages.
    expect(items({ page: 1, totalPages: 20 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(items({ page: 2, totalPages: 20 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(items({ page: 3, totalPages: 20 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
    expect(items({ page: 4, totalPages: 20 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
  });
});

describe('paginationItems — current in the middle', () => {
  it('an ellipsis on each side', () => {
    expect(items({ page: 10, totalPages: 20 })).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });
});

describe('paginationItems — current near the end', () => {
  it('constant-width window with one ellipsis on the left (MUI parity)', () => {
    expect(items({ page: 20, totalPages: 20 })).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
    expect(items({ page: 18, totalPages: 20 })).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
    expect(items({ page: 17, totalPages: 20 })).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20]);
  });
});

describe('paginationItems — single bridging page (gap of exactly one)', () => {
  it('renders the bridging page instead of a one-page ellipsis', () => {
    // page 4 of 9: gap between {1} and {3,4,5} is just page 2 → render 2, not '…'
    expect(items({ page: 4, totalPages: 9 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 9]);
    // page 6 of 9: gap between {5,6,7} and {9} is just page 8 → render 8
    expect(items({ page: 6, totalPages: 9 })).toEqual([1, 'ellipsis', 5, 6, 7, 8, 9]);
  });
});

describe('paginationItems — larger siblingCount', () => {
  it('widens the window symmetrically', () => {
    expect(items({ page: 10, totalPages: 20, siblingCount: 2 })).toEqual([
      1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 20,
    ]);
  });
  it('a window large enough to swallow all gaps renders every page', () => {
    expect(items({ page: 5, totalPages: 9, siblingCount: 5 })).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('paginationItems — larger boundaryCount', () => {
  it('shows more pages at each end', () => {
    expect(items({ page: 10, totalPages: 20, boundaryCount: 2 })).toEqual([
      1, 2, 'ellipsis', 9, 10, 11, 'ellipsis', 19, 20,
    ]);
  });
});

describe('paginationItems — clamping + flags', () => {
  it('clamps page above totalPages down and sets flags', () => {
    const m = paginationItems({ page: 999, totalPages: 5 });
    expect(m.page).toBe(5);
    expect(m.hasPrev).toBe(true);
    expect(m.hasNext).toBe(false);
  });
  it('clamps page below 1 up and sets flags', () => {
    const m = paginationItems({ page: 0, totalPages: 5 });
    expect(m.page).toBe(1);
    expect(m.hasPrev).toBe(false);
    expect(m.hasNext).toBe(true);
  });
  it('totalPages <= 1 → no prev, no next', () => {
    const m = paginationItems({ page: 1, totalPages: 1 });
    expect(m.hasPrev).toBe(false);
    expect(m.hasNext).toBe(false);
    expect(m.pages).toEqual([1]);
  });
  it('returns a fresh array each call (no shared reference)', () => {
    const a = paginationItems({ page: 1, totalPages: 5 }).pages;
    const b = paginationItems({ page: 1, totalPages: 5 }).pages;
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('paginationItems — total + pageSize path', () => {
  it('derives totalPages and windows correctly', () => {
    expect(items({ page: 1, total: 195, pageSize: 10 })).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20]);
  });
});
