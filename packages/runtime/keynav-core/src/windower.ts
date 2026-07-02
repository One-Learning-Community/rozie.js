/**
 * `KeynavWindower` — the optional full-dataset addressing contract
 * `r-keynav` consumes when the item list is virtualized (SPEC §10).
 *
 * DESIGN-ONLY in Phase 71 Plan 03: no windower implementation is built here.
 * `@rozie-ui/headless-core`'s existing `windowing.rzts` virtualizer already
 * satisfies this shape (`virtualizer.scrollToIndex(active)`), so a future
 * consumer can wire it directly with zero changes to this contract.
 *
 * @public — runtime API consumed by all six per-target keynav controllers.
 */
import type { KeynavItemMeta } from './types.js';

export interface KeynavWindower {
  /** Total item count across the full (possibly unrendered) data set. */
  count(): number;
  /** Metadata for item `i`, regardless of whether it is currently rendered. */
  itemMeta(i: number): KeynavItemMeta;
  /** Scrolls the virtualizer so item `i` becomes visible/renderable. */
  scrollToIndex(i: number, opts?: { align?: 'center' | 'nearest' }): void;
}

/**
 * The no-windower default: derives `count`/`itemMeta` straight from the
 * `:source` array. `scrollToIndex` is `undefined` — the per-target
 * controller falls back to `scrollIntoView` on the rendered node when no
 * real windower is present (SPEC §10: "No windower → the controller derives
 * count/meta from the `:source` array and falls back to `scrollIntoView`").
 */
export interface SourceArrayFallback {
  count(): number;
  itemMeta(i: number): KeynavItemMeta;
  scrollToIndex: undefined;
}

export function sourceArrayFallback(
  getSource: () => unknown[],
  itemMetaOf: (item: unknown, index: number) => KeynavItemMeta,
): SourceArrayFallback {
  return {
    count: () => getSource().length,
    itemMeta: (i: number) => itemMetaOf(getSource()[i], i),
    scrollToIndex: undefined,
  };
}
