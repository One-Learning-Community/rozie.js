import type { ReactNode } from 'react';

export interface FilterTextProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the local draft seeds from (setup-once).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
   */
  setFilter?: ((...args: any[]) => any) | null;
}

declare function FilterText(props: FilterTextProps): JSX.Element;
export default FilterText;
