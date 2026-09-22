import * as i0 from "@angular/core";
export declare class FilterText {
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label`.
     */
    columnId: import("@angular/core").InputSignal<string>;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column: import("@angular/core").InputSignal<unknown>;
    /**
     * The current column filter value the local draft seeds from (setup-once).
     */
    value: import("@angular/core").InputSignal<unknown>;
    /**
     * `(columnId, value) => void` — apply the column filter (Enter / blur applies, Escape clears). Null-guarded at call sites.
     */
    setFilter: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel: import("@angular/core").InputSignal<string>;
    draft: import("@angular/core").WritableSignal<string>;
    touched: import("@angular/core").WritableSignal<boolean>;
    private __rozieWatchInitial_0;
    constructor();
    draftValue: () => string;
    onInput: (e: any) => void;
    applyFilter: () => void;
    clearFilter: () => void;
    onKeydown: (e: any) => void;
    onBlur: () => void;
    a11yLabel: () => string;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<FilterText, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<FilterText, "rozie-filter-text", never, { "columnId": { "alias": "columnId"; "required": false; "isSignal": true; }; "column": { "alias": "column"; "required": false; "isSignal": true; }; "value": { "alias": "value"; "required": false; "isSignal": true; }; "setFilter": { "alias": "setFilter"; "required": false; "isSignal": true; }; "columnLabel": { "alias": "columnLabel"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default FilterText;
//# sourceMappingURL=FilterText.d.ts.map