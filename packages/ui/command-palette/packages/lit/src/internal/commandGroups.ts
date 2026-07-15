/**
 * commandGroups — the pure derive-groups + group-order helper feeding the
 * vendored <Combobox>'s NATIVE section groups (combobox-native-groups).
 *
 * Kept OUT of the `.rozie` <script> (the scoreCommands.ts / levelStack.ts
 * precedent) so it can be unit-tested in isolation and vendored verbatim
 * into every leaf via codegen's `copyInternal` (it lands at
 * `src/internal/commandGroups.ts` in each of the six leaves, excluding
 * `*.test.ts`).
 *
 * MIRRORS combobox `groupOptions()` semantics EXACTLY
 * (packages/ui/combobox/src/internal/groupOptions.ts is the reference —
 * same three-phase partition: leading ungrouped block, listed groups in
 * first-appearance order, stable-within), so command-palette's own
 * pre-ordering never diverges from what the vendored <Combobox> computes
 * internally when fed the SAME items + the SAME `:groups` list — the
 * combobox's re-partition of an already-group-ordered list is IDEMPOTENT,
 * which is what keeps `optId(opt._i)` aligned with `orderedItems()[idx]`
 * (CommandPalette.rozie's `highlightedItem()`).
 *
 * Semantics, exactly:
 *   - Read each item's group via
 *     `it && it.group != null && it.group !== '' ? String(it.group) : null`
 *     (mirrors combobox `groupOf`, treating empty-string as ungrouped).
 *   - Bucket items by group key preserving FIRST-APPEARANCE insertion order
 *     (a JS `Map` iterates insertion order). `null` is the ungrouped bucket.
 *     Track `anyItemHasGroup`.
 *   - Non-array `items` → `{ groups: [], ordered: [] }`.
 *   - No item has a group (`!anyItemHasGroup`) → `{ groups: [], ordered: items }`
 *     — RETURNS THE SAME `items` ARRAY REFERENCE (identity, no copy), so the
 *     flat path is byte-identical when CP feeds it back as `:options`.
 *   - Otherwise `groups` = the non-null bucket keys in first-appearance
 *     order, each as `{ id: key, label: key }` (label defaults to the group
 *     id string — a custom heading comes from the `#groupHeading` slot,
 *     never a per-group label prop here). `ordered` = the leading ungrouped
 *     bucket (if non-empty) concatenated with each group bucket in `groups`
 *     order; items keep their input relative order within every bucket
 *     (stable partition, never re-sort).
 *
 * PURE — no reactivity, no DOM, no imports.
 */

export interface OptionGroup {
  id: string;
  label: string;
}

export interface DeriveCommandGroupsResult<T> {
  groups: OptionGroup[];
  ordered: T[];
}

export function deriveCommandGroups<T extends { group?: unknown } | null | undefined>(
  items: T[],
): DeriveCommandGroupsResult<T> {
  if (!Array.isArray(items)) return { groups: [], ordered: [] };

  // Single pass: bucket every item by its normalized group key, preserving
  // FIRST-APPEARANCE insertion order (a JS Map iterates in insertion order).
  // `null` is the bucket key for ungrouped items.
  const buckets = new Map<string | null, T[]>();
  let anyItemHasGroup = false;
  for (const item of items) {
    const raw = item && (item as { group?: unknown }).group != null ? (item as { group?: unknown }).group : null;
    const key = raw == null || raw === '' ? null : String(raw);
    if (key !== null) anyItemHasGroup = true;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(item);
  }

  // Flat path — return the SAME array reference (identity), never a copy.
  if (!anyItemHasGroup) return { groups: [], ordered: items };

  const groups: OptionGroup[] = [];
  const ordered: T[] = [];

  // 1. Leading ungrouped block (no heading) — only when non-empty.
  const nullBucket = buckets.get(null);
  if (nullBucket && nullBucket.length > 0) {
    ordered.push(...nullBucket);
  }

  // 2. Groups in first-appearance order (the Map's natural iteration order,
  // minus the null bucket) — stable-within, never re-sorted.
  for (const [key, bucket] of buckets) {
    if (key === null) continue;
    groups.push({ id: key, label: key });
    ordered.push(...bucket);
  }

  return { groups, ordered };
}
