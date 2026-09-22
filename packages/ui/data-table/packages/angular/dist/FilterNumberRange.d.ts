import * as i0 from "@angular/core";
export declare class FilterNumberRange {
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
     */
    columnId: import("@angular/core").InputSignal<string>;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column: import("@angular/core").InputSignal<unknown>;
    /**
     * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
     */
    value: import("@angular/core").InputSignal<unknown>;
    /**
     * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
     */
    setFilter: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
     */
    minMax: import("@angular/core").InputSignal<unknown>;
    /**
     * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel: import("@angular/core").InputSignal<string>;
    minDraft: import("@angular/core").WritableSignal<string>;
    maxDraft: import("@angular/core").WritableSignal<string>;
    touched: import("@angular/core").WritableSignal<boolean>;
    private __rozieWatchInitial_0;
    constructor();
    minDraftValue: () => string;
    maxDraftValue: () => string;
    onMinInput: (e: any) => void;
    onMaxInput: (e: any) => void;
    onKeydown: (e: any) => void;
    onBlur: () => void;
    minPlaceholder: () => string;
    maxPlaceholder: () => string;
    applyRange: (minDraft: any, maxDraft: any) => void;
    a11yLabel: () => string;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<FilterNumberRange, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<FilterNumberRange, "rozie-filter-number-range", never, { "columnId": { "alias": "columnId"; "required": false; "isSignal": true; }; "column": { "alias": "column"; "required": false; "isSignal": true; }; "value": { "alias": "value"; "required": false; "isSignal": true; }; "setFilter": { "alias": "setFilter"; "required": false; "isSignal": true; }; "minMax": { "alias": "minMax"; "required": false; "isSignal": true; }; "columnLabel": { "alias": "columnLabel"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default FilterNumberRange;
//# sourceMappingURL=FilterNumberRange.d.ts.map