interface Props {
    /**
     * The raw row object (the `#detail` slot scope `row` = `row.original`). This drop-in walks its own enumerable keys and String-coerces each value into a key/value definition list; a null row renders an empty list.
     */
    row?: (unknown) | null;
}
declare const DetailPanel: import("svelte").Component<Props, {}, "">;
type DetailPanel = ReturnType<typeof DetailPanel>;
export default DetailPanel;
