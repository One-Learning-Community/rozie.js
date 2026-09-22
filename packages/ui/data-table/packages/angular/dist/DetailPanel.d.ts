import * as i0 from "@angular/core";
export declare class DetailPanel {
    /**
     * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
     */
    row: import("@angular/core").InputSignal<unknown>;
    entries: () => {
        key: any;
        value: string;
    }[];
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<DetailPanel, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<DetailPanel, "rozie-detail-panel", never, { "row": { "alias": "row"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default DetailPanel;
//# sourceMappingURL=DetailPanel.d.ts.map