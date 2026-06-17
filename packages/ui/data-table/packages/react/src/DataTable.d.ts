import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface DataTableProps {
  data: unknown[];
  columns?: unknown[];
  selectionMode?: string;
  sorting?: unknown[];
  defaultSorting?: unknown[];
  onSortingChange?: (next: unknown[]) => void;
  globalFilter?: string;
  defaultGlobalFilter?: string;
  onGlobalFilterChange?: (next: string) => void;
  columnFilters?: unknown[];
  defaultColumnFilters?: unknown[];
  onColumnFiltersChange?: (next: unknown[]) => void;
  pagination?: Record<string, unknown>;
  defaultPagination?: Record<string, unknown>;
  onPaginationChange?: (next: Record<string, unknown>) => void;
  manual?: boolean;
  rowSelection?: Record<string, unknown>;
  defaultRowSelection?: Record<string, unknown>;
  onRowSelectionChange?: (next: Record<string, unknown>) => void;
  columnVisibility?: Record<string, unknown>;
  defaultColumnVisibility?: Record<string, unknown>;
  onColumnVisibilityChange?: (next: Record<string, unknown>) => void;
  columnSizing?: Record<string, unknown>;
  defaultColumnSizing?: Record<string, unknown>;
  onColumnSizingChange?: (next: Record<string, unknown>) => void;
  columnOrder?: unknown[];
  defaultColumnOrder?: unknown[];
  onColumnOrderChange?: (next: unknown[]) => void;
  columnPinning?: Record<string, unknown>;
  defaultColumnPinning?: Record<string, unknown>;
  onColumnPinningChange?: (next: Record<string, unknown>) => void;
  stickyHeader?: boolean;
  interactionMode?: string;
  onSortChange?: (...args: unknown[]) => void;
  onFilterChange?: (...args: unknown[]) => void;
  onPageChange?: (...args: unknown[]) => void;
  onSelectionChange?: (...args: unknown[]) => void;
  onVisibilityChange?: (...args: unknown[]) => void;
  onResizeChange?: (...args: unknown[]) => void;
  onReorderChange?: (...args: unknown[]) => void;
  onPinChange?: (...args: unknown[]) => void;
  children?: ReactNode;
  renderSelectAll?: (params: { checked: unknown; indeterminate: unknown; toggle: () => void }) => ReactNode;
  renderSelectCell?: (params: { row: unknown; checked: unknown; toggle: unknown }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface DataTableHandle {
  sortColumn: (...args: any[]) => any;
  clearSorting: (...args: any[]) => any;
  getColumnDefs: (...args: any[]) => any;
  toggleAllRows: (...args: any[]) => any;
  clearSelection: (...args: any[]) => any;
  getSelectedRows: (...args: any[]) => any;
  setPage: (...args: any[]) => any;
  setRowsPerPage: (...args: any[]) => any;
  toggleColumnVisibility: (...args: any[]) => any;
  applyColumnOrder: (...args: any[]) => any;
  resetColumnSizing: (...args: any[]) => any;
  pinColumn: (...args: any[]) => any;
}

declare const DataTable: React.ForwardRefExoticComponent<DataTableProps & React.RefAttributes<DataTableHandle>>;
export default DataTable;
