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
export function commandMatches(item: CommandItem, loweredQuery: string): boolean {
  if (!loweredQuery) return true;
  if (!item) return false;
  const label = String(item.label == null ? '' : item.label).toLowerCase();
  if (label.indexOf(loweredQuery) !== -1) return true;
  const kws = Array.isArray(item.keywords) ? item.keywords : [];
  for (let i = 0; i < kws.length; i++) {
    if (String(kws[i] == null ? '' : kws[i]).toLowerCase().indexOf(loweredQuery) !== -1) return true;
  }
  return false;
}

/**
 * Filter a command list by a raw (un-normalized) query. The result preserves
 * source order. An empty / whitespace-only query yields a shallow copy of the
 * input (all items). Non-array input yields an empty array.
 */
export function filterCommands<T extends CommandItem>(items: T[], rawQuery: string): T[] {
  const list = Array.isArray(items) ? items : [];
  const q = String(rawQuery == null ? '' : rawQuery).trim().toLowerCase();
  if (!q) return list.slice();
  const out: T[] = [];
  for (let i = 0; i < list.length; i++) {
    if (commandMatches(list[i], q)) out.push(list[i]);
  }
  return out;
}
