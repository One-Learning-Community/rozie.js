import * as i0 from "@angular/core";
export declare class FilterSelect {
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the select `aria-label`.
     */
    columnId: import("@angular/core").InputSignal<string>;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column: import("@angular/core").InputSignal<unknown>;
    /**
     * The current column filter value the select seeds from (String-coerced).
     */
    value: import("@angular/core").InputSignal<unknown>;
    /**
     * `(columnId, value) => void` — apply the column filter on change; the leading empty "All" option clears it. Null-guarded at call sites.
     */
    setFilter: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * The faceted distinct keys for this column (cross-filtered, keys only — no occurrence counts) used to build the `<option>` list.
     */
    uniqueValues: import("@angular/core").InputSignal<any[]>;
    /**
     * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel: import("@angular/core").InputSignal<string>;
    selectValue: () => string;
    onChange: (e: any) => void;
    a11yLabel: () => string;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<FilterSelect, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<FilterSelect, "rozie-filter-select", never, { "columnId": { "alias": "columnId"; "required": false; "isSignal": true; }; "column": { "alias": "column"; "required": false; "isSignal": true; }; "value": { "alias": "value"; "required": false; "isSignal": true; }; "setFilter": { "alias": "setFilter"; "required": false; "isSignal": true; }; "uniqueValues": { "alias": "uniqueValues"; "required": false; "isSignal": true; }; "columnLabel": { "alias": "columnLabel"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default FilterSelect;
//# sourceMappingURL=FilterSelect.d.ts.map