/**
 * filterCommands — the pure query-matching core of CommandPalette.
 *
 * Kept OUT of the `.rozie` <script> (and named `filterCommands`, NOT `filter`,
 * which would shadow `Array.prototype.filter` and read as a prop name) so it can
 * be unit-tested in isolation and vendored verbatim into every leaf via
 * codegen's `copyInternal` (it lands at `src/internal/filterCommands.ts` in each
 * of the six leaves, excluding `*.test.ts`).
 *
 * Matching is case-insensitive substring over the item `label` PLUS every entry
 * of its optional `keywords` array. An empty/whitespace query returns the items
 * unchanged (every command shown). `disabled` items are kept in the result (the
 * UI styles + skips them for selection); they are filtered only by query.
 */
export interface CommandItem {
    id: string;
    label: string;
    group?: string;
    keywords?: string[];
    disabled?: boolean;
}
/**
 * Does a single item match the (already-lowercased) query?
 * Exported for direct unit testing of the predicate.
 */
export declare function commandMatches(item: CommandItem, loweredQuery: string): boolean;
/**
 * Filter a command list by a raw (un-normalized) query. The result preserves
 * source order. An empty / whitespace-only query yields a shallow copy of the
 * input (all items). Non-array input yields an empty array.
 */
export declare function filterCommands<T extends CommandItem>(items: T[], rawQuery: string): T[];
