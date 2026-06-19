import type { ReactNode } from 'react';

export interface ColumnProps {
  id?: string;
  field?: string;
  header?: string;
  sortable?: boolean;
  filterable?: boolean;
  pinned?: string;
  width?: string | number;
  expandable?: boolean;
  groupable?: boolean;
  aggregationFn?: (string | (...args: unknown[]) => unknown) | null;
  editable?: boolean;
  editor?: string;
  editorOptions?: unknown[];
  validate?: ((...args: unknown[]) => unknown) | null;
}

declare function Column(props: ColumnProps): JSX.Element;
export default Column;
