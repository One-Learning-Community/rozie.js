interface Props {
    /**
     * The column id (mirrors the `#editor` slot scope). Used as the input `aria-label`.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#editor` slot scope).
     */
    column?: (unknown) | null;
    /**
     * The consumer's row data object (opaque passthrough from the `#editor` slot scope).
     */
    row?: (unknown) | null;
    /**
     * The current cell value the local draft string seeds from (setup-once).
     */
    value?: (unknown) | null;
    /**
     * `(value) => void` — commit the cell. The draft is coerced with `Number()` at commit time; an empty/whitespace or non-numeric draft commits `null` (never `NaN`). Null-guarded at call sites.
     */
    commit?: ((...args: any[]) => any) | null;
    /**
     * `() => void` — revert the edit (Escape). Null-guarded at call sites.
     */
    cancel?: ((...args: any[]) => any) | null;
    /**
     * Focus this editor's primary control when true — the host sets it for the one editor that should hold focus; reactive.
     */
    autofocus?: boolean;
    /**
     * The column's human header, forwarded by the slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
}
declare const EditorNumber: import("svelte").Component<Props, {}, "">;
type EditorNumber = ReturnType<typeof EditorNumber>;
export default EditorNumber;
