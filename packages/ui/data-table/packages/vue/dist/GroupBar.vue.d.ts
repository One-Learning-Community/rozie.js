type __VLS_Props = {
    /**
     * The ordered active grouping key array (read-only source of truth from the `#groupBar` slot scope). This drop-in never keeps its own copy — it always reads this and writes through `applyGrouping` / `clearGrouping`.
     */
    grouping?: any[];
    /**
     * The columns offered as grouping targets — `[{ id, label }]` — rendered as draggable chips.
     */
    groupableColumns?: any[];
    /**
     * `(cols: string[]) => void` — the only add/reorder writer for the grouping order. Null-guarded at call sites.
     */
    applyGrouping?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — the only clear writer; resets grouping to empty. Null-guarded at call sites.
     */
    clearGrouping?: ((...args: any[]) => any) | null;
};
declare const __VLS_export: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{}>, {
    grouping: any[];
    groupableColumns: any[];
    applyGrouping: ((...args: any[]) => any) | null;
    clearGrouping: ((...args: any[]) => any) | null;
}, {}, {}, {}, string, import("vue").ComponentProvideOptions, true, {}, any>;
declare const _default: typeof __VLS_export;
export default _default;
