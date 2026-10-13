/**
 * groupOptions — the pure, stable re-partition core of Combobox's native
 * option-grouping feature.
 *
 * Kept OUT of the `.rozie` <script> (the scoreCommands.ts pattern) so it can
 * be unit-tested in isolation and vendored verbatim into every leaf via
 * codegen's `copyInternal` (it lands at `src/internal/groupOptions.ts` in
 * each of the six leaves, excluding `*.test.ts`).
 *
 * Semantics (the locked design's "stable re-partition" — see
 * docs/superpowers/specs/2026-07-14-combobox-native-groups-design.md):
 *
 *   - `grouped = false` when `groups` is empty AND no item carries a group
 *     (via `groupOf`). In that case `ordered` preserves input order exactly
 *     (identity ordering — the byte-runtime-identical flat path) and
 *     `blocks` is `[]` (unused by the caller).
 *   - `grouped = true` otherwise. Section order: a single LEADING
 *     `group: null` block for any ungrouped items (no heading, order
 *     preserved) FIRST, then the listed `groups` (in array order), then any
 *     group id present on an item but absent from `groups`, in
 *     FIRST-APPEARANCE order, after the listed ones. A listed group with
 *     zero matching items is OMITTED (no empty heading); likewise the
 *     leading null block is omitted when there are no ungrouped items.
 *   - Within every block, items keep their INPUT (filter/score) relative
 *     order — a stable partition (never re-sorts within a group).
 *   - `ordered` is exactly the concatenation of `blocks[].items` in block
 *     order (flat-index alignment: assigning a running index over `ordered`
 *     equals walking `blocks` top-to-bottom). A listed group's heading text
 *     is its `groups[i].label`; a fallback group's heading text is the
 *     group id itself.
 *   - Non-array `items` → `{ grouped:false, ordered:[], blocks:[] }`;
 *     non-array `groups` is treated as `[]`.
 *
 * PURE — no reactivity, no DOM, no imports. Single pass to bucket by group
 * id preserving order, then emit blocks in computed section order. Does NOT
 * read `.label`/`.value` off items — the caller supplies `groupOf` so the
 * helper stays option-shape-agnostic.
 */

export interface OptionGroup {
  id: string;
  label: string;
}

export interface GroupBlock<T> {
  group: OptionGroup | null;
  items: T[];
}

export interface GroupOptionsResult<T> {
  grouped: boolean;
  ordered: T[];
  blocks: GroupBlock<T>[];
}

export function groupOptions<T>(
  items: T[],
  groups: OptionGroup[],
  groupOf: (item: T) => string | null | undefined,
): GroupOptionsResult<T> {
  if (!Array.isArray(items)) return { grouped: false, ordered: [], blocks: [] };

  const groupList = Array.isArray(groups) ? groups : [];

  // Single pass: bucket every item by its normalized group key, preserving
  // FIRST-APPEARANCE insertion order (a JS Map iterates in insertion order,
  // which is exactly the fallback-group ordering rule below relies on).
  // `null` is the bucket key for ungrouped items.
  const buckets = new Map<string | null, T[]>();
  let anyItemHasGroup = false;
  for (const item of items) {
    const raw = groupOf(item);
    const key = raw == null || raw === '' ? null : String(raw);
    if (key !== null) anyItemHasGroup = true;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(item);
  }

  const grouped = groupList.length > 0 || anyItemHasGroup;
  if (!grouped) return { grouped: false, ordered: items.slice(), blocks: [] };

  const blocks: GroupBlock<T>[] = [];
  const consumed = new Set<string>();

  // 1. Leading ungrouped block (no heading) — only when non-empty.
  const nullBucket = buckets.get(null);
  if (nullBucket && nullBucket.length > 0) {
    blocks.push({ group: null, items: nullBucket });
  }

  // 2. Listed groups, in `groups` array order — omit empty ones.
  for (const g of groupList) {
    const bucket = buckets.get(g.id);
    if (bucket && bucket.length > 0) {
      blocks.push({ group: { id: g.id, label: g.label }, items: bucket });
      consumed.add(g.id);
    }
  }

  // 3. Fallback groups (present on items but absent from `groups`), in
  // first-appearance order — the Map's natural iteration order, minus null
  // and anything already emitted as a listed group.
  for (const [key, bucket] of buckets) {
    if (key === null || consumed.has(key)) continue;
    blocks.push({ group: { id: key, label: key }, items: bucket });
  }

  const ordered = ([] as T[]).concat(...blocks.map((b) => b.items));
  return { grouped: true, ordered, blocks };
}
