import type { ReactNode } from 'react';

export interface FilterNumberRangeProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: unknown[]) => unknown) | null;
  minMax?: (unknown) | null;
}

declare function FilterNumberRange(props: FilterNumberRangeProps): JSX.Element;
export default FilterNumberRange;
