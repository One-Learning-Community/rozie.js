import type { ReactNode } from 'react';

export interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
}

declare function Column(props: ColumnProps): JSX.Element;
export default Column;
