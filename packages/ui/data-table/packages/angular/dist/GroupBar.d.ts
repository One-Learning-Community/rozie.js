import * as i0 from "@angular/core";
export declare class GroupBar {
    /**
     * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
     */
    grouping: import("@angular/core").InputSignal<any[]>;
    /**
     * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
     */
    groupableColumns: import("@angular/core").InputSignal<any[]>;
    /**
     * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
     */
    applyGrouping: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
     */
    clearGrouping: import("@angular/core").InputSignal<(...args: any[]) => any>;
    draggingId: import("@angular/core").WritableSignal<string>;
    isOver: import("@angular/core").WritableSignal<boolean>;
    dragKind: import("@angular/core").WritableSignal<string>;
    dropKey: import("@angular/core").WritableSignal<string>;
    onChipDragStart: (e: any, id: any) => void;
    onTokenDragStart: (e: any, gk: any) => void;
    onDragOver: (e: any) => void;
    onTokenDragOver: (e: any, gk: any) => void;
    onDragLeave: (e: any) => void;
    resetDrag: () => void;
    onDragEnd: () => void;
    onDrop: (e: any) => void;
    removeKey: (key: any) => void;
    clearAll: () => void;
    labelFor: (key: any) => any;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<GroupBar, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<GroupBar, "rozie-group-bar", never, { "grouping": { "alias": "grouping"; "required": false; "isSignal": true; }; "groupableColumns": { "alias": "groupableColumns"; "required": false; "isSignal": true; }; "applyGrouping": { "alias": "applyGrouping"; "required": false; "isSignal": true; }; "clearGrouping": { "alias": "clearGrouping"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default GroupBar;
//# sourceMappingURL=GroupBar.d.ts.map