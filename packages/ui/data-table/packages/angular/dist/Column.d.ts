import * as i0 from "@angular/core";
export declare class Column {
    /**
     * The column id. Optional — defaults to `field` when omitted. Used as the key in the id-keyed registry union and in the `#cell` / `#colHeader` slot dispatch.
     */
    id: import("@angular/core").InputSignal<string>;
    /**
     * The row field this column reads (table-core `accessorKey`). The plain accessor value renders when the `#cell` slot falls through.
     * @example
     * <rozie-column field="email" header="Email" />
     */
    field: import("@angular/core").InputSignal<string>;
    /**
     * The header label, rendered when the parent `#colHeader` slot falls through to the plain label.
     */
    header: import("@angular/core").InputSignal<string>;
    /**
     * Whether this column participates in click-to-sort. Default `false`. Bind `:sortable="true"` (a bare attr only coerces on Vue+Lit).
     */
    sortable: import("@angular/core").InputSignal<boolean>;
    /**
     * Whether this column participates in per-column filtering (the `#filter` slot / faceted filter chrome). Default `false`.
     */
    filterable: import("@angular/core").InputSignal<boolean>;
    /**
     * Initial pin side: `''` (unpinned) | `'left'` | `'right'`. Applied once as the table's starting `columnPinning` state, so `getIsPinned()` reports it and the column joins the matching sticky rail — which also reorders it, since visible cells are ordered `[left-pinned, center, right-pinned]`. Ignored if the consumer has already pinned something; an interactive unpin is never re-applied.
     */
    pinned: import("@angular/core").InputSignal<string>;
    /**
     * Optional fixed/initial column width, applied as the column's starting size — a px number (`120`) or a px string (`'120px'`). Column sizing is numeric px, so other CSS lengths (`'12rem'`, `'20%'`, `'auto'`) have no px value to apply and are ignored; the column keeps the default width. An interactive resize overrides this.
     */
    width: import("@angular/core").InputSignal<string | number>;
    /**
     * Reserved per-column metadata flagging participation in the expand affordance. The expander chevron is its own auto-injected leading column on `<DataTable expandable>`, so this is forward-compat metadata, not the toggle host. Default `false`.
     */
    expandable: import("@angular/core").InputSignal<boolean>;
    /**
     * Whether this column is offered to the headless `#groupBar` as a grouping target. Defaults `true` (opt-OUT via `:groupable="false"`); this only filters the groupable-columns list. Whether grouping is engaged is driven by the parent's `grouping` model, never this flag.
     */
    groupable: import("@angular/core").InputSignal<boolean>;
    /**
     * The table-core aggregation for this column inside a group-header cell. Either a built-in name string — `'sum'` | `'min'` | `'max'` | `'extent'` | `'mean'` | `'median'` | `'unique'` | `'uniqueCount'` | `'count'` — or a custom function `(columnId, leafRows, childRows) => any` (defensively wrapped by the parent so a throw cannot crash grouping). Null → no aggregation (the group-header cell renders as a placeholder).
     */
    aggregationFn: import("@angular/core").InputSignal<string | ((...args: any[]) => any)>;
    /**
     * Whether this column's cells are editable (opt-in). Default `false` → the column is read-only and the display↔editor branch never mounts an editor. Bind `:editable="true"` (a bare attr only coerces on Vue+Lit).
     */
    editable: import("@angular/core").InputSignal<boolean>;
    /**
     * Editor type for this column: `'text'` | `'number'` | `'select'` | `'checkbox'` (built-in inputs), or `'custom'` to hand rendering to the `#editor` scoped slot (or a per-column `editor-<columnId>` fill). Default `'text'`. **`'custom'` is the gate:** a column left on a built-in type ignores any `#editor` fill and renders the built-in input. Requires `editable: true` — and, for any pointer or keyboard edit entry, `interactionMode="grid"` on the table.
     */
    editor: import("@angular/core").InputSignal<string>;
    /**
     * Options for `editor: 'select'` — `[{ value, label }]`. Empty for other editor types.
     */
    editorOptions: import("@angular/core").InputSignal<any[]>;
    /**
     * Synchronous per-column validator `(value, row) => true | string`. A string return is the error message (the editor stays open and the aria-live region announces it). Null → no validation. The parent wraps it defensively against a thrown/non-bool/non-string return.
     */
    validate: import("@angular/core").InputSignal<(...args: any[]) => any>;
    registry: unknown;
    private __rozieDestroyRef;
    private __rozieWatchInitial_0;
    constructor();
    ngAfterViewInit(): void;
    reg: any;
    registered: boolean;
    colId: () => string;
    buildSpec: () => {
        id: string;
        field: string;
        header: string;
        sortable: boolean;
        filterable: boolean;
        pinned: string;
        width: string | number;
        expandable: boolean;
        groupable: boolean;
        aggregationFn: string | ((...args: any[]) => any);
        editable: boolean;
        editor: string;
        editorOptions: any[];
        validate: (...args: any[]) => any;
    };
    static ɵfac: i0.ɵɵFactoryDeclaration<Column, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<Column, "rozie-column", never, { "id": { "alias": "id"; "required": false; "isSignal": true; }; "field": { "alias": "field"; "required": false; "isSignal": true; }; "header": { "alias": "header"; "required": false; "isSignal": true; }; "sortable": { "alias": "sortable"; "required": false; "isSignal": true; }; "filterable": { "alias": "filterable"; "required": false; "isSignal": true; }; "pinned": { "alias": "pinned"; "required": false; "isSignal": true; }; "width": { "alias": "width"; "required": false; "isSignal": true; }; "expandable": { "alias": "expandable"; "required": false; "isSignal": true; }; "groupable": { "alias": "groupable"; "required": false; "isSignal": true; }; "aggregationFn": { "alias": "aggregationFn"; "required": false; "isSignal": true; }; "editable": { "alias": "editable"; "required": false; "isSignal": true; }; "editor": { "alias": "editor"; "required": false; "isSignal": true; }; "editorOptions": { "alias": "editorOptions"; "required": false; "isSignal": true; }; "validate": { "alias": "validate"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default Column;
//# sourceMappingURL=Column.d.ts.map