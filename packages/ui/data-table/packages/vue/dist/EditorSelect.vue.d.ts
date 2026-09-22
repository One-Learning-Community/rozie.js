type __VLS_Props = {
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the select `aria-label`.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#editor` slot scope).
     */
    column?: Record<string, any> | null;
    /**
     * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
     */
    row?: Record<string, any> | null;
    /**
     * The current cell value the local draft seeds from (setup-once); String-coerced for the `<select>` binding.
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the cell with the selected value (Enter / blur). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
    /**
     * The select options — `[{ value, label }]`. Mirrors `<Column editorOptions>`.
     */
    options?: any[];
    /**
     * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
     */
    autofocus?: boolean;
    /**
     * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    value: Record<string, any> | null;
    row: Record<string, any> | null;
    cancel: ((...args: any[]) => any) | null;
    columnId: string;
    column: Record<string, any> | null;
    commit: ((...args: any[]) => any) | null;
    autofocus: boolean;
    columnLabel: string;
    options: any[];
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
