type __VLS_Props = {
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label` fallback.
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
     * The current cell value the editor seeds its local draft from (setup-once).
     */
    value?: Record<string, any> | null;
    /**
     * `(value) => void` — commit the edited cell value (from the `#editor` slot scope). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit and close the editor (from the `#editor` slot scope). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
    /**
     * Focus this editor's primary input when true — the host sets it for the one editor that should hold focus; reactive.
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
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
