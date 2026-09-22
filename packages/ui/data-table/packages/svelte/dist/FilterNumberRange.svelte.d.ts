interface Props {
    /**
     * The column id (mirrors the `#filter` slot scope) — used as the filter key and the input `aria-label` base.
     */
    columnId?: string;
    /**
     * The table-core column object (opaque passthrough from the `#filter` slot scope).
     */
    column?: (unknown) | null;
    /**
     * The current column filter value (`[min, max]` tuple or null) the two inputs seed from (setup-once).
     */
    value?: (unknown) | null;
    /**
     * `(columnId, value) => void` — apply the column filter as a `[min, max]` tuple (each side coerced to a Number or `undefined`, so a one-sided range works); both empty clears the filter. Null-guarded at call sites.
     */
    setFilter?: ((...args: any[]) => any) | null;
    /**
     * The faceted `[min, max]` bounds for this column (`[number, number]` or null) — drives the input placeholders only.
     */
    minMax?: (unknown) | null;
    /**
     * The column's human header, forwarded by the `#filter` slot scope — used as the control's accessible name in place of the internal column id.
     */
    columnLabel?: string;
}
declare const FilterNumberRange: import("svelte").Component<Props, {}, "">;
type FilterNumberRange = ReturnType<typeof FilterNumberRange>;
export default FilterNumberRange;
