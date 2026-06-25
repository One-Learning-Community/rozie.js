import type { ReactNode } from 'react';

export interface FilterSelectProps {
  /**
   * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
   */
  columnId?: string;
  /**
   * The table-core column object (opaque passthrough from the `#filter` slot scope).
   */
  column?: (unknown) | null;
  /**
   * The current column filter value the select seeds from (String-coerced).
   */
  value?: (unknown) | null;
  /**
   * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
   */
  setFilter?: ((...args: unknown[]) => unknown) | null;
  /**
   * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
   */
  uniqueValues?: unknown[];
}

declare function FilterSelect(props: FilterSelectProps): JSX.Element;
export default FilterSelect;
