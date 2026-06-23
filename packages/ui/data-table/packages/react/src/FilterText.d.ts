import type { ReactNode } from 'react';

export interface FilterTextProps {
  columnId?: string;
  column?: (unknown) | null;
  value?: (unknown) | null;
  setFilter?: ((...args: unknown[]) => unknown) | null;
}

declare function FilterText(props: FilterTextProps): JSX.Element;
export default FilterText;
