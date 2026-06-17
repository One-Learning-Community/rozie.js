import type { ReactNode } from 'react';

export interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  renderCell?: (params: { row: () => void; value: () => void; column: () => void }) => ReactNode;
  renderHeaderTemplate?: (params: { column: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

declare function Column(props: ColumnProps): JSX.Element;
export default Column;
