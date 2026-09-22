import { ElementRef } from '@angular/core';
import * as i0 from "@angular/core";
export declare class EditorDate {
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
     */
    columnId: import("@angular/core").InputSignal<string>;
    /**
     * The table-core column object (opaque passthrough from the `#editor` slot scope).
     */
    column: import("@angular/core").InputSignal<unknown>;
    /**
     * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
     */
    row: import("@angular/core").InputSignal<unknown>;
    /**
     * The current cell value the local draft seeds from (setup-once); String-coerced to an ISO `YYYY-MM-DD` string for the native date input.
     */
    value: import("@angular/core").InputSignal<unknown>;
    /**
     * `(value) => void` — commit the cell with the ISO `YYYY-MM-DD` string (Enter / blur). Null-guarded at call sites.
     */
    commit: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel: import("@angular/core").InputSignal<(...args: any[]) => any>;
    /**
     * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
     */
    autofocus: import("@angular/core").InputSignal<boolean>;
    /**
     * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel: import("@angular/core").InputSignal<string>;
    draft: import("@angular/core").WritableSignal<string>;
    touched: import("@angular/core").WritableSignal<boolean>;
    inputEl: import("@angular/core").Signal<ElementRef<HTMLInputElement>>;
    private __rozieWatchInitial_0;
    constructor();
    ngAfterViewInit(): void;
    draftValue: () => string;
    onInput: (e: any) => void;
    doCommit: () => void;
    doCancel: () => void;
    onChange: (e: any) => void;
    onKeydown: (e: any) => void;
    onBlur: () => void;
    a11yLabel: () => string;
    rozieDisplay(v: unknown): string;
    rozieAttr(v: unknown): string | null;
    static ɵfac: i0.ɵɵFactoryDeclaration<EditorDate, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<EditorDate, "rozie-editor-date", never, { "columnId": { "alias": "columnId"; "required": false; "isSignal": true; }; "column": { "alias": "column"; "required": false; "isSignal": true; }; "row": { "alias": "row"; "required": false; "isSignal": true; }; "value": { "alias": "value"; "required": false; "isSignal": true; }; "commit": { "alias": "commit"; "required": false; "isSignal": true; }; "cancel": { "alias": "cancel"; "required": false; "isSignal": true; }; "autofocus": { "alias": "autofocus"; "required": false; "isSignal": true; }; "columnLabel": { "alias": "columnLabel"; "required": false; "isSignal": true; }; }, {}, never, never, true, never>;
}
export default EditorDate;
//# sourceMappingURL=EditorDate.d.ts.map