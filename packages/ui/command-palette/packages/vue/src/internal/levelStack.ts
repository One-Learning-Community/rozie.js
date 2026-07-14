/**
 * levelStack — the pure, testable level-stack reducer behind CommandPalette's
 * nested-levels feature (LVL-STACK / LVL-QUERY / LVL-NAV).
 *
 * Kept OUT of the `.rozie` <script> (mirrors the scoreCommands.ts pattern —
 * pure functions, named to avoid shadowing a builtin or reading as a bare
 * prop, no `.rozie` sigils) so it can be unit-tested in isolation and
 * vendored verbatim into every leaf via codegen's `copyInternal` (lands at
 * `src/internal/levelStack.ts` in each of the six leaves, excluding
 * `*.test.ts`).
 *
 * ROOT (depth 0) IS IMPLICIT — it is `$props.items` + the top-level
 * `$model.query`, and is NOT stored as a frame here. This reducer only
 * tracks PUSHED frames: an empty stack means "at root". `stack[stack.length
 * - 1]` is the CURRENT (top) level; push appends, pop removes from the end.
 *
 * Query lifecycle (D-3): `pushFrame` snapshots the CURRENT query (the query
 * active just before the push) into the new frame's `parentQuery`; `popFrame`
 * hands that snapshot back as `restoreQuery` so the caller can restore both
 * the query MODEL and (via combobox's `seedQuery` verb) the visible input
 * text — full undo.
 */

/**
 * A consumer-supplied navigable command item. Intentionally loose (`unknown`
 * fields beyond the ones this module reads) — CommandItem's stricter shape
 * lives in scoreCommands.ts; this module only cares about the navigation
 * signal (`children` / `source`) and the display fallbacks (`title` /
 * `placeholder` / `label` / `id`).
 */
export interface NavigableItem {
  id?: string;
  label?: string;
  title?: string | null;
  placeholder?: string | null;
  children?: unknown[];
  // biome-ignore lint/suspicious/noExplicitAny: consumer-supplied query→items fn, shape varies per source
  source?: (query: string) => any;
  disabled?: boolean;
  [key: string]: unknown;
}

export type LevelStatus = 'ready' | 'loading' | 'error';

export interface LevelFrame<TItem = NavigableItem> {
  item: TItem;
  title: string | null;
  placeholder: string | null;
  // The query that was active immediately BEFORE this level was pushed —
  // restored on pop (D-3 "back = undo").
  parentQuery: string;
  resolvedItems: unknown[];
  status: LevelStatus;
  error: unknown;
}

export interface PopResult<TItem = NavigableItem> {
  stack: LevelFrame<TItem>[];
  restoreQuery: string | null;
}

export interface BreadcrumbEntry {
  id: string | null;
  title: string | null;
}

/**
 * True iff `item` carries a non-empty `children` array OR a `source`
 * function — the navigation signal (presence, no separate boolean flag).
 * False for a plain leaf, null/undefined, or a disabled item with neither.
 */
export function isNavigating(item: NavigableItem | null | undefined): boolean {
  if (!item) return false;
  if (Array.isArray(item.children) && item.children.length > 0) return true;
  if (typeof item.source === 'function') return true;
  return false;
}

/** The breadcrumb/header label fallback: item.title ?? item.label ?? null. */
export function levelTitle(item: NavigableItem | null | undefined): string | null {
  if (!item) return null;
  if (item.title != null) return item.title;
  if (item.label != null) return item.label;
  return null;
}

/** The child level's input placeholder fallback: item.placeholder ?? fallback. */
export function levelPlaceholder(
  item: NavigableItem | null | undefined,
  fallback: string | null,
): string | null {
  if (item && item.placeholder != null) return item.placeholder;
  return fallback == null ? null : fallback;
}

/**
 * Push a new frame for `item` onto `stack`, snapshotting `currentQuery` as
 * the frame's `parentQuery` (restored on pop). A `children` item seeds
 * `resolvedItems` from its static children + `status: 'ready'`; a `source`
 * item seeds `resolvedItems: []` + `status: 'loading'` (settled by
 * asyncSource.ts + the `.rozie` push handler in Task 5). Returns a NEW array
 * — never mutates `stack`.
 */
export function pushFrame<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
  item: TItem,
  currentQuery: string,
): LevelFrame<TItem>[] {
  const hasChildren = Array.isArray(item?.children) && item.children.length > 0;
  const frame: LevelFrame<TItem> = {
    item,
    title: levelTitle(item),
    placeholder: levelPlaceholder(item, null),
    parentQuery: currentQuery,
    resolvedItems: hasChildren ? (item.children as unknown[]).slice() : [],
    status: hasChildren ? 'ready' : 'loading',
    error: null,
  };
  return [...stack, frame];
}

/**
 * Pop the top frame off `stack`, returning the remaining stack + the popped
 * frame's `parentQuery` as `restoreQuery`. No-op on an empty stack —
 * `{ stack: [], restoreQuery: null }`.
 */
export function popFrame<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
): PopResult<TItem> {
  if (stack.length === 0) return { stack: [], restoreQuery: null };
  const top = stack[stack.length - 1];
  return { stack: stack.slice(0, -1), restoreQuery: top.parentQuery };
}

/** The top (current) frame, or null when at root (empty stack). */
export function currentFrame<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
): LevelFrame<TItem> | null {
  return stack.length === 0 ? null : stack[stack.length - 1];
}

/** The current nesting depth — 0 at root. */
export function depth<TItem extends NavigableItem = NavigableItem>(stack: LevelFrame<TItem>[]): number {
  return stack.length;
}

/**
 * Immutably replace the TOP frame's `resolvedItems` + `status: 'ready'`.
 * No-op on an empty stack (returns it unchanged). Lower frames are untouched
 * (same references).
 */
export function settleFrame<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
  items: unknown[],
): LevelFrame<TItem>[] {
  if (stack.length === 0) return stack;
  const next = stack.slice();
  const top = next[next.length - 1];
  next[next.length - 1] = { ...top, resolvedItems: Array.isArray(items) ? items : [], status: 'ready' };
  return next;
}

/**
 * Immutably replace the TOP frame's `status: 'error'` + `error`. No-op on an
 * empty stack (returns it unchanged). Lower frames are untouched (same
 * references).
 */
export function failFrame<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
  error: unknown,
): LevelFrame<TItem>[] {
  if (stack.length === 0) return stack;
  const next = stack.slice();
  const top = next[next.length - 1];
  next[next.length - 1] = { ...top, status: 'error', error };
  return next;
}

/**
 * The ordered breadcrumb from root through the current level: a root entry
 * (`id: null`, `title: rootTitle`) followed by one entry per pushed frame
 * (`id: item.id ?? null`, `title: levelTitle(frame.item)`). For the
 * `#breadcrumb` slot scope + the default header.
 */
export function breadcrumb<TItem extends NavigableItem = NavigableItem>(
  stack: LevelFrame<TItem>[],
  rootTitle: string | null,
): BreadcrumbEntry[] {
  const entries: BreadcrumbEntry[] = [{ id: null, title: rootTitle }];
  for (const frame of stack) {
    entries.push({ id: frame.item?.id ?? null, title: levelTitle(frame.item) });
  }
  return entries;
}
