import type { ReactNode } from 'react';

export interface ColumnProps {
  /**
   * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
   */
  id?: string;
  /**
   * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
   * @example
   * <Column field="email" header="Email" />
   */
  field?: string;
  /**
   * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
   */
  header?: string;
  /**
   * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
   */
  sortable?: boolean;
  /**
   * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
   */
  filterable?: boolean;
  /**
   * Pin side: `''` (unpinned) | `'left'` | `'right'`. Reserved metadata carried into the parent's column pinning state.
   */
  pinned?: string;
  /**
   * Optional fixed/initial column width — a CSS length string or a px number.
   */
  width?: string | number;
  /**
   * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
   */
  expandable?: boolean;
  /**
   * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
   */
  groupable?: boolean;
  /**
   * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
   */
  aggregationFn?: (string | ((...args: unknown[]) => unknown)) | null;
  /**
   * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
   */
  editable?: boolean;
  /**
   * Built-in editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'`. Ignored when a custom `#editor` scoped slot handles the column. Default `'text'`.
   */
  editor?: string;
  /**
   * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
   */
  editorOptions?: unknown[];
  /**
   * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
   */
  validate?: ((...args: unknown[]) => unknown) | null;
}

declare function Column(props: ColumnProps): JSX.Element;
export default Column;
