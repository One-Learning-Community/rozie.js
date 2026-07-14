/**
 * asyncSource — the pure, testable async-source race-drop controller behind
 * CommandPalette's nested-levels feature (LVL-ASYNC, absorbs feature #4).
 *
 * Kept OUT of the `.rozie` <script> (mirrors scoreCommands.ts / levelStack.ts —
 * pure functions, no `.rozie` sigils, unit-testable) so it can be vendored
 * verbatim into every leaf via codegen's `copyInternal`.
 *
 * The counter itself lives in the `.rozie` `$data` (a plain int, NEVER
 * `$computed`) and is threaded through `nextRequestToken`/`isLatestRequest`;
 * the debounce TIMER is a `setTimeout` in the `.rozie` (Task 5) — this module
 * owns only the boundary DECISIONS: sync-vs-async classification and the
 * latest-token guard (T-cpl-01 mitigation).
 */

import type { NavigableItem, LevelStatus } from './levelStack';

export type ResolvedChildSource =
  | { kind: 'sync'; items: unknown[] }
  | { kind: 'async'; promise: Promise<unknown> }
  | { kind: 'none' };

/** True iff `typeof item.source === 'function'` — the only levels that debounce keystroke refetch. */
export function isAsyncLevel(item: NavigableItem | null | undefined): boolean {
  return !!item && typeof item.source === 'function';
}

/** Alias of `isAsyncLevel` at the debounce-decision call site (async-only debounce). */
export function shouldDebounceCall(item: NavigableItem | null | undefined): boolean {
  return isAsyncLevel(item);
}

function isThenable(v: unknown): v is Promise<unknown> {
  return !!v && (typeof v === 'object' || typeof v === 'function') && typeof (v as { then?: unknown }).then === 'function';
}

/**
 * Invoke `item`'s child source (once) and classify the result: a non-empty
 * `children` array or a sync `source(query)` array return is `{ kind: 'sync',
 * items }`; a `source(query)` returning a thenable/Promise is `{ kind:
 * 'async', promise }`; a non-navigating item is `{ kind: 'none' }`. `children`
 * takes precedence over `source` when an item somehow carries both (matches
 * `pushFrame`'s own precedence). A non-array sync `source` return normalizes
 * to `[]`.
 */
export function resolveChildSource(item: NavigableItem | null | undefined, query: string): ResolvedChildSource {
  if (!item) return { kind: 'none' };
  if (Array.isArray(item.children) && item.children.length > 0) {
    return { kind: 'sync', items: item.children };
  }
  if (typeof item.source === 'function') {
    const result = item.source(query);
    if (isThenable(result)) return { kind: 'async', promise: result };
    return { kind: 'sync', items: Array.isArray(result) ? result : [] };
  }
  return { kind: 'none' };
}

/** Bump a monotonic request-token counter. */
export function nextRequestToken(current: number): number {
  return current + 1;
}

/** True iff `token` is still the latest issued token (an equality guard) — false ⇒ drop the stale resolution. */
export function isLatestRequest(token: number, current: number): boolean {
  return token === current;
}

/** Default `searchDebounce` prop value (ms), applied to ASYNC source calls only. */
export const DEFAULT_SEARCH_DEBOUNCE = 150;

// Re-exported for call sites that want to align a resolved/settled status
// string with levelStack's LevelStatus without importing both modules.
export type { LevelStatus };
