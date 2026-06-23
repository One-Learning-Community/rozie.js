import type { ReactNode } from 'react';

export interface FilterSelectProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: unknown[]) => unknown) | null;
  uniqueValues?: unknown[];
}

declare function FilterSelect(props: FilterSelectProps): JSX.Element;
export default FilterSelect;
