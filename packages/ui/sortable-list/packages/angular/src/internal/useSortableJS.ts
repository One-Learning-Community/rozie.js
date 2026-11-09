/**
 * useSortableJS — framework-agnostic SortableJS-vs-reconciler bridge.
 *
 * Why this exists
 * ---------------
 * Wrapping SortableJS for cross-framework consumption (Rozie's
 * `examples/SortableList.rozie`) has four recurring fragilities every wrapper
 * library independently re-discovers:
 *
 * 1. **Three-handler ambiguity.** SortableJS fires distinct `onUpdate`,
 *    `onAdd`, and `onRemove` events for the same logical drag in cross-list
 *    moves. Inline handlers in user code can ONLY disambiguate by reading
 *    `e.from === listEl` / `e.to === listEl`, which is the same disambiguation
 *    `onEnd` can perform in a SINGLE handler. Collapsing to one onEnd path
 *    removes the per-handler boilerplate.
 *
 * 2. **Fragile event shapes.** When SortableJS falls back to the mouse-event
 *    drag path (Playwright's mouse.move/down/up sequence; some touch devices;
 *    HTML5 DnD aborts), `e.item` may not be a valid Node by the time the
 *    handler runs (the source-side `onRemove` fires AFTER the destination
 *    has already detached the element). Inline
 *    `listEl.insertBefore(e.item, …)` throws inside SortableJS's
 *    `_dispatchEvent`. SortableJS catches and swallows the throw silently —
 *    the model writeback never runs, leaving the framework's view stale.
 *    THIS is the root cause of the duplicate-on-drop bug surfaced by the
 *    `sortable-nested-solid-deeper` VR spec.
 *
 * 3. **`e.oldIndex` is occasionally null.** Fallback-mode events lose the
 *    index. Identity-based item lookup (`items().indexOf(stashedItem)`) is
 *    strictly more reliable.
 *
 * 4. **Lit lit-html `repeat`-cache desync.** Every reconciler EXCEPT Lit
 *    handles the SortableJS DOM-restore + model writeback dance cleanly.
 *    Lit needs `$reconcileAfterDomMutation()` (a Rozie sigil that lowers to
 *    `__rozieReconcileAfterDomMutation(this)` on Lit + `void 0` elsewhere).
 *    The helper invokes the `afterCommit` callback after each `onCommit`;
 *    users wire `afterCommit: () => $reconcileAfterDomMutation()` to honour
 *    the Lit requirement without leaking lit-html internals into user code.
 *
 * Cross-target API contract
 * -------------------------
 * The helper is vanilla JS. It has NO framework imports. The same exported
 * symbol resolves identically across React, Vue, Svelte, Angular, Solid and
 * Lit consumer builds via the colocated relative `./internal/useSortableJS`
 * copy vendored into each leaf package by scripts/codegen.mjs.
 *
 * Caller contract:
 *   - `items: () => T[]` is called fresh on every event. Wire it to the
 *     current snapshot (`$props.items` etc.).
 *   - `onCommit(next)` is called once per successful drag commit with the
 *     new items array. The caller writes it to whatever reactive surface
 *     drives re-renders.
 *   - `afterCommit?()` is called immediately after each `onCommit`. Used on
 *     Lit to invoke `$reconcileAfterDomMutation()`.
 *
 * Returns `{ destroy, instance }`. The caller wires
 *   - teardown via `return handle.destroy` from `$onMount`
 *   - runtime option updates via `instance.option('disabled', v)` from
 *     `$watch(() => $props.disabled, ...)`.
 *
 * @public
 */

import SortableJS, { type Options as SortableOptions, type SortableEvent } from 'sortablejs';
import { afterFlush } from './keyboardRegistry';

/**
 * Put `node` back into the SortableJS list `from` where it was. SortableJS's
 * plain `oldIndex` counts every element child of `from` but `<template>`s
 * (a header or footer included), so the node goes back before the child now
 * at that index. Without it (a fragile event), `oldDraggableIndex` counts
 * only the list's `draggable` matches (`Sortable.get(from).options.draggable`,
 * else SortableJS's default: `li` in a `<ul>` / `<ol>`, else any child); past
 * the last draggable sibling the node goes right after it.
 */
function putBack(node: HTMLElement, from: HTMLElement, oldIndex: number | null | undefined, oldDraggableIndex: number | null | undefined): void {
  if (typeof oldIndex === 'number' && oldIndex >= 0) {
    const kids = Array.from(from.children).filter((c) => c !== node && c.tagName !== 'TEMPLATE');
    from.insertBefore(node, kids[oldIndex] ?? null);
    return;
  }
  const inst = (SortableJS as unknown as { get?: (el: HTMLElement) => { options?: { draggable?: unknown } } | undefined }).get?.(from);
  const d = inst?.options?.draggable;
  let sel = typeof d === 'string' && d.trim() !== '' ? d.trim() : /^[uo]l$/i.test(from.nodeName) ? 'li' : '*';
  if (sel[0] === '>') sel = sel.slice(1).trim() || '*';
  const matches = (el: Element): boolean => {
    if (el.tagName === 'TEMPLATE') return false;
    try {
      return el.matches(sel);
    } catch {
      return true;
    }
  };
  const rows = Array.from(from.children).filter((c) => c !== node && matches(c));
  const at = typeof oldDraggableIndex === 'number' && oldDraggableIndex >= 0 ? oldDraggableIndex : rows.length;
  if (at < rows.length) from.insertBefore(node, rows[at]!);
  else if (rows.length > 0) from.insertBefore(node, rows[rows.length - 1]!.nextSibling);
  else from.appendChild(node);
}

/**
 * Every list element a SortableList's helper has run SortableJS on (kept
 * after it unmounts), shared by separately bundled copies through a
 * `globalThis` `Symbol.for` key. A drag between one of these and any other
 * SortableJS list is refused in both directions.
 */
const LISTS_KEY = Symbol.for('rozie.sortable-list.lists.v1');
function sortableLists(): WeakSet<Element> {
  const g = globalThis as unknown as Record<symbol, WeakSet<Element> | undefined>;
  return (g[LISTS_KEY] ??= new WeakSet<Element>());
}

/** Symbol stashed on `e.item` between `onStart` and `onEnd` to ferry the
 * dragged item DATA (not just the DOM node) across cross-list moves and
 * survive `e.oldIndex` going null in fallback-mode events. The double
 * underscore prefix signals "Rozie-internal, do not collide with user
 * data". */
const ROZIE_ITEM_STASH_KEY = '__rozieItem';

/** Disambiguated event kind, exposed via `onChange`. */
export type SortableEventKind = 'reorder' | 'add' | 'remove';

/** Argument shape for the disambiguated onChange callback. */
export interface SortableChange<T> {
  kind: SortableEventKind;
  /** Item-row index in `from`. `-1` for `add`, or when it could not be
   * determined (fragile-event path). */
  oldIndex: number;
  /** Item-row index in `to`. `-1` for `remove`, or when it could not be
   * determined. */
  newIndex: number;
  /** The moved item. May be `undefined` only when both the stash AND the
   * source list's snapshot lost track of it (extreme fallback path). */
  item: T | undefined;
  /** The dragged row element (`e.item`). */
  el: HTMLElement;
  /** Source list element (`e.from`). */
  from: HTMLElement;
  /** Destination list element (`e.to`). */
  to: HTMLElement;
  /** The raw SortableJS event. */
  event: SortableEvent;
}

/** Argument shape for the `onStart` / `onEnd` callbacks. Indices are
 * item-row indices (SortableJS's draggable-relative ones), never counting
 * a non-row child of the list. */
export interface SortableDrag<T> {
  /** The dragged item's data value (from the stash). */
  item: T | undefined;
  /** The dragged row element (`e.item`). */
  el: HTMLElement;
  /** Source list element (`e.from`). */
  from: HTMLElement;
  /** Destination list element (`e.to`; the source when dropped outside). */
  to: HTMLElement;
  /** Item-row index in `from`. */
  oldIndex: number;
  /** Item-row index in `to` (equal to `oldIndex` for `onStart` and for a
   * drop back in place). */
  newIndex: number;
  /** The raw SortableJS event. */
  event: SortableEvent;
}

export interface UseSortableJSOptions<T> {
  /** Current items getter. Called fresh on every event for reactivity-safety. */
  items: () => readonly T[];
  /** Fires once per successful drag commit with the new items array. */
  onCommit: (next: T[]) => void;
  /** Optional: forwarded verbatim to SortableJS constructor.
   * Any handler keys (`onStart`, `onEnd`, `onUpdate`, `onAdd`, `onRemove`)
   * are silently ignored — the helper owns the event-handling path. Use
   * `onStart` / `onEnd` / `onChange` on this options object instead. */
  options?: SortableOptions;
  /** Optional: fires on drag start, from the source list. */
  onStart?: (info: SortableDrag<T>) => void;
  /** Optional: fires once per drag, from the source list's helper, in a
   * task AFTER every list involved has run its `onCommit` / `afterCommit` /
   * `onChange` and the flushes those scheduled (see the `finally` in
   * `handleCommit`). The caller decides which list
   * reports it (the one `info.to` belongs to). */
  onEnd?: (info: SortableDrag<T>) => void;
  /** Optional: takes over the end of the drag from `onEnd`. Called with the
   * same info from a microtask queued after every list's commit; the caller
   * puts off and emits the `end` itself. SortableList passes one that goes
   * through its keyboard registry's `deferEnd`, so a pending `end` (pointer
   * or keyboard) fires before the next `start`, never from an unmounted
   * list, and from the origin when the destination has gone. */
  scheduleEnd?: (info: SortableDrag<T>) => void;
  /** Optional: fires once per commit with the disambiguated event kind. */
  onChange?: (info: SortableChange<T>) => void;
  /** Optional: called immediately after `onCommit`. Used on Lit to invoke
   * `$reconcileAfterDomMutation()`. No-op on the other 5 targets. */
  afterCommit?: () => void;
}

export interface UseSortableJSResult {
  /** Teardown — call from `$onMount` return. */
  destroy: () => void;
  /** Live SortableJS instance — exposed for runtime
   * `instance.option('disabled', v)` updates from `$watch`. */
  instance: SortableJS;
}

/** Read the stashed item, falling back to a `null`/`undefined` when the
 * element doesn't have the property. Centralised so the cast lives in
 * exactly one place. */
function readStash<T>(item: unknown): T | undefined {
  if (item === null || typeof item !== 'object') return undefined;
  return (item as Record<string, unknown>)[ROZIE_ITEM_STASH_KEY] as T | undefined;
}

/** SortableJS's plain index (every element child of the list but
 * `<template>`s and its clone, which are all item rows: `#header` / `#footer`
 * render outside the list element), falling back to the draggable-relative
 * one, else `-1`. The draggable index is not an item-row index when a custom
 * `options.draggable` leaves rows out (it skips them). */
function plainIndex(plain: number | null | undefined, draggable: number | null | undefined): number {
  if (typeof plain === 'number') return plain;
  if (typeof draggable === 'number') return draggable;
  return -1;
}

/** The item-row index of `node` in `list`: its position among the list's
 * `.rozie-sortable-item` children (SortableJS's hidden clone and `<template>`s
 * left out), whatever `draggable` matches. `hint` when `node` isn't a child of
 * `list`. */
function rowIndex(list: HTMLElement | null | undefined, node: unknown, hint: number): number {
  if (list == null || node == null || (node as Node).parentNode !== list) return hint;
  const clone = (SortableJS as unknown as { clone?: unknown }).clone;
  let i = 0;
  for (const c of Array.from(list.children)) {
    if (c === node) return i;
    if (c !== clone && c.tagName !== 'TEMPLATE' && c.classList.contains('rozie-sortable-item')) i++;
  }
  return hint;
}

/** Try-catch wrapper for DOM operations that may throw on fragile event
 * paths. Returning `false` lets the caller proceed to the model writeback
 * — the framework's re-render off the new model brings the DOM back into
 * sync (may flicker briefly, but vastly better than today's silent drop). */
function safeDom(op: () => void): boolean {
  try {
    op();
    return true;
  } catch {
    // The DOM-restore is best-effort. Proceed to model writeback regardless.
    return false;
  }
}

/**
 * Wire a SortableJS instance to a reactive items array. See module doc
 * for the full rationale + cross-target contract.
 */
/** The `draggable` the helper constructs SortableJS with: item rows only. */
export const ROW_DRAGGABLE = '.rozie-sortable-item';

/** SortableJS handler keys the helper owns: never taken from `options`. */
export const HELPER_OWNED_OPTION_KEYS: readonly string[] = ['onStart', 'onEnd', 'onUpdate', 'onAdd', 'onRemove', 'onClone'];

/**
 * How two option values differ: `'none'` (identical, or plain objects /
 * arrays with the same content), `'functions'` (the same content but for
 * function leaves of different identity), or `'content'`. A consumer passing
 * an inline `options={{ group: { … } }}` hands over a fresh object every
 * render, and in React a fresh inline `pull` / `put` / `filter` function too.
 * Non-plain objects compare by identity. Symbol keys are ignored (SortableJS
 * reads none). A cyclic object compares by identity where it repeats, so a
 * self-referencing config cannot overflow the stack.
 */
export function optionChange(a: unknown, b: unknown, seen: WeakSet<object> = new WeakSet()): 'none' | 'functions' | 'content' {
  if (a === b) return 'none';
  if (typeof a === 'function' && typeof b === 'function') return 'functions';
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return 'content';
  if (Array.isArray(a) !== Array.isArray(b)) return 'content';
  const plain = (o: object) => Array.isArray(o) || Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null;
  if (!plain(a) || !plain(b)) return 'content';
  if (seen.has(a)) return 'content';
  seen.add(a);
  try {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return 'content';
    let out: 'none' | 'functions' = 'none';
    for (const k of ka) {
      if (!Object.prototype.hasOwnProperty.call(b, k)) return 'content';
      const c = optionChange((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], seen);
      if (c === 'content') return 'content';
      if (c === 'functions') out = 'functions';
    }
    return out;
  } finally {
    seen.delete(a);
  }
}

/** What `reapplyOptions` should do about a key whose value differs only in function identity. */
export interface ReapplyHooks {
  /**
   * True when `key` has a runtime value (`option(key, v)`) that should win:
   * a function-only difference (a fresh inline function, same content) is
   * then not applied, so the runtime value stays until the options' content
   * changes. `prev` is the key's previous effective value.
   */
  keep?(key: string, prev: unknown): boolean;
  /** Called after a function-only difference was applied (fresh closures reach SortableJS). */
  refreshed?(key: string): void;
}

/**
 * Reapply an `options` object that changed after construction to the live
 * SortableJS instance, so a pointer drag obeys the new value (SortableJS only
 * reads its constructor options once). Each key whose effective value
 * changed by content (see `optionChange`) is set with
 * `instance.option(key, value)`; the effective value is the one in `options`,
 * else `base[key]` (what the key means without `options`: the named props and
 * the helper's own defaults), so a key dropped from `options` goes back to it.
 * A dropped key with no base value keeps the value SortableJS has now.
 * Helper-owned handler keys are skipped. Returns the keys whose content
 * changed, in order.
 *
 * A key whose value differs only by function identity (a fresh inline
 * `filter`, or `group` with a fresh `pull` / `put` function) is set too, so
 * SortableJS runs the consumer's newest closure, but it is not a change: it is
 * not returned, goes to `hooks.refreshed`, and is skipped when `hooks.keep`
 * says a runtime value should win.
 */
export function reapplyOptions(
  instance: { option(name: string, value: unknown): unknown },
  prev: Record<string, unknown> | null | undefined,
  next: Record<string, unknown> | null | undefined,
  base: Record<string, unknown>,
  hooks: ReapplyHooks = {},
): string[] {
  const p = prev ?? {};
  const n = next ?? {};
  const valueIn = (o: Record<string, unknown>, k: string) => (o[k] !== undefined ? o[k] : base[k]);
  const applied: string[] = [];
  for (const key of new Set([...Object.keys(p), ...Object.keys(n)])) {
    if (HELPER_OWNED_OPTION_KEYS.includes(key)) continue;
    const v = valueIn(n, key);
    if (v === undefined) continue;
    const before = valueIn(p, key);
    const change = optionChange(v, before);
    if (change === 'none') continue;
    if (change === 'functions') {
      if (hooks.keep?.(key, before)) continue;
      instance.option(key, v);
      hooks.refreshed?.(key);
      continue;
    }
    instance.option(key, v);
    applied.push(key);
  }
  return applied;
}

/**
 * The order the imperative `sort(order)` gives `items`: the items whose key
 * (`String(keyOf(item, index))`, the row's `data-id`) is listed in `order`
 * come first, in that order; every other item follows in its current order.
 * Unknown and repeated keys are ignored, so every item appears exactly once.
 */
export function orderByKeys<T>(items: readonly T[], order: readonly unknown[], keyOf: (item: T, index: number) => unknown): T[] {
  const rank = new Map<string, number>();
  for (const k of order) {
    const key = String(k);
    if (!rank.has(key)) rank.set(key, rank.size);
  }
  // One bucket per listed key (items may share a key), filled in item order.
  const listed: T[][] = [];
  const rest: T[] = [];
  items.forEach((item, i) => {
    const at = rank.get(String(keyOf(item, i)));
    if (at === undefined) rest.push(item);
    else (listed[at] ??= []).push(item);
  });
  const out: T[] = [];
  for (const bucket of listed) if (bucket) for (const item of bucket) out.push(item);
  for (const item of rest) out.push(item);
  return out;
}

export function useSortableJS<T>(
  listEl: HTMLElement,
  opts: UseSortableJSOptions<T>,
): UseSortableJSResult {
  // Defensive merge: strip user-supplied handler keys from the verbatim
  // `options` blob — we own those paths. We deliberately do NOT splat
  // `opts.options` straight into the constructor argument unmodified, since
  // a user-supplied `onUpdate` would silently bypass our reconciler dance.
  const baseOptions: SortableOptions = { ...(opts.options ?? {}) };
  sortableLists().add(listEl);

  /** Item-scoped child lookup. The DOM-restore sites index ONLY the item rows
   * (`:scope > .rozie-sortable-item`), so the restore index stays
   * item-relative whatever else is a child of the list element. (`#header` /
   * `#footer` render outside it, around the `role="list"` element.) */
  const itemChildAt = (i: number): Element | null =>
    Array.from(listEl.children).filter((c) => c.classList.contains('rozie-sortable-item'))[i] ?? null;
  // Build the explicit handler set — these always win over anything the
  // caller passed in via `options`.
  // `onClone` is owned by the helper too: we use it to bridge the
  // `__rozieItem` stash from the original DOM node to the cloned node
  // so the destination's `onAdd` can recover the dragged item DATA on
  // a clone-mode drag. See `handleClone` below.
  for (const key of HELPER_OWNED_OPTION_KEYS) delete (baseOptions as Record<string, unknown>)[key];

  /** Stash dragged item DATA on `e.item` so cross-list moves can recover
   * it on the destination side. */
  const handleStart = (e: SortableEvent): void => {
    const current = opts.items();
    // The source index in this list (onStart fires from the source): the
    // dragged row's item-row index, read off the DOM. Not SortableJS's
    // `oldDraggableIndex`: a consumer `options.draggable` that leaves rows out
    // makes it skip them, and stashing `current[oldDraggableIndex]` would
    // capture the WRONG item, which the identity-based commit lookup would
    // then faithfully move.
    const fromIdx = rowIndex(listEl, e.item, plainIndex(e.oldIndex, e.oldDraggableIndex));
    let data: T | undefined;
    if (fromIdx >= 0 && fromIdx < current.length) {
      data = current[fromIdx] as T;
      const item = e.item as unknown as Record<string, unknown> | null;
      if (item !== null && typeof item === 'object') {
        item[ROZIE_ITEM_STASH_KEY] = data;
      }
    }
    opts.onStart?.({
      item: data,
      el: e.item,
      from: e.from,
      to: e.from,
      oldIndex: fromIdx,
      newIndex: fromIdx,
      event: e,
    });
  };

  /** The single point of truth for committed drags. Disambiguates via
   * `e.from` and `e.to`.
   *
   * SortableJS's event lifecycle is asymmetric across lists: `onEnd` fires
   * ONLY on the source list (the one that owned `e.item` at drag start).
   * The destination list of a cross-list move receives an `onAdd` event,
   * NOT an `onEnd`. We register this handler against BOTH:
   *   - source-list `onEnd` — handles same-list reorder + cross-list source
   *   - destination-list `onAdd` — handles cross-list destination
   *
   * The single function services both event names because the
   * `from === listEl` / `to === listEl` disambiguation is sufficient to
   * determine our role; SortableJS's event name doesn't carry additional
   * information we need. Registering both is the load-bearing fix — the
   * inline-handlers design DID register onAdd; collapsing to onEnd-only
   * would lose the destination-side commit entirely. */
  const handleCommit = (e: SortableEvent): void => {
    // What the `end` callback reports (source side only). Filled in below as
    // the commit is worked out; the hints cover the early-return paths.
    const stashAtEntry = readStash<T>(e.item);
    let endOld = plainIndex(e.oldIndex, e.oldDraggableIndex);
    let endNew = rowIndex(e.to, e.item, plainIndex(e.newIndex, e.newDraggableIndex));
    let endItem: T | undefined = stashAtEntry;
    let endTo: HTMLElement = e.to;
    try {
      const fromUs = e.from === listEl;
      const toUs = e.to === listEl;
      const sameList = fromUs && toUs;

      if (!fromUs && !toUs) {
        // Not our event. Defensive — guards against the rare case where
        // SortableJS would re-dispatch.
        return;
      }

      const current = opts.items();

      // Disambiguate kind for the onChange callback + computing the next array.
      const kind: SortableEventKind = sameList ? 'reorder' : fromUs ? 'remove' : 'add';

      // Identity-based item lookup beats fragile `e.oldIndex`. The stash was
      // set on `onStart` and travels with `e.item` across lists (SortableJS
      // physically moves the same node between lists).
      const stashedItem = readStash<T>(e.item);

      // Item-row indices: the new one read off the DOM where the row is
      // (`rowIndex`), else SortableJS's plain index, which counts every
      // element child of the list (all item rows). SortableJS's
      // `*DraggableIndex` skip rows a custom `options.draggable` leaves out,
      // so they are only the last resort.
      const oldIndexHint = endOld;
      const newIndexHint = endNew;

      let next: T[];
      let oldIndex: number;
      let newIndex: number;
      let moved: T | undefined;

      if (sameList) {
        // SAME-LIST REORDER
        // Locate the moved item by identity first; fall back to the index hint.
        const movedFromIdx =
          stashedItem !== undefined && current.indexOf(stashedItem) !== -1
            ? current.indexOf(stashedItem)
            : oldIndexHint;
        if (movedFromIdx < 0 || movedFromIdx >= current.length) {
          // Lost the source item entirely. Bail out cleanly.
          return;
        }
        moved = current[movedFromIdx] as T;
        const targetIdx =
          newIndexHint >= 0 && newIndexHint < current.length
            ? newIndexHint
            : current.length - 1;
        endOld = movedFromIdx;
        endItem = moved;
        endNew = targetIdx;
        if (targetIdx === movedFromIdx) {
          // Dropped back where it started (or outside any list, which
          // SortableJS reverts): nothing moved, so nothing is written and no
          // `reorder` fires. `end` still does (from the `finally`).
          return;
        }
        // Restore the moved DOM node back to its original position so the
        // framework reconciler sees a clean model-vs-DOM shift. If the
        // restore throws (fragile event), proceed to the model writeback —
        // the re-render off the new model will reconcile.
        safeDom(() => {
          // Item-scoped: listEl may hold non-row children (see itemChildAt),
          // so index against the .rozie-sortable-item rows only.
          const ref = itemChildAt(movedFromIdx);
          listEl.insertBefore(e.item, ref);
        });
        next = [...current];
        next.splice(movedFromIdx, 1);
        next.splice(targetIdx, 0, moved);
        oldIndex = movedFromIdx;
        newIndex = targetIdx;
      } else if (fromUs && !sortableLists().has(e.to)) {
        // Dropped into a SortableJS list that is not a SortableList. Refused,
        // as a row from one is refused here (items never disappear): the row
        // goes back where it was, nothing is written or emitted, and the
        // `end` reports a drop in place (`to` is this list, `newIndex` is
        // `oldIndex`). In clone mode the original went to the other list and
        // SortableJS left its clone here: they swap back.
        const at =
          stashedItem !== undefined && current.indexOf(stashedItem) !== -1
            ? current.indexOf(stashedItem)
            : oldIndexHint;
        endOld = at;
        endNew = at;
        endTo = listEl;
        if (at >= 0 && at < current.length) endItem = current[at] as T;
        safeDom(() => {
          const node = e.item as HTMLElement;
          const clone = (e as SortableEvent & { clone?: HTMLElement | null }).clone;
          if (clone != null && clone !== node && clone.parentNode === listEl) {
            listEl.replaceChild(node, clone);
            return;
          }
          listEl.insertBefore(node, at >= 0 ? itemChildAt(at) : null);
        });
        return;
      } else if (fromUs) {
        // CLONE MODE — short-circuit. When SortableJS is in clone mode
        // (`group.pull === 'clone'`), `e.pullMode === 'clone'` on cross-
        // list events; the original DOM node STAYS in place and a fresh
        // clone is what travels to the destination. The source list's
        // items array is unchanged — no splice, no DOM-restore, and no
        // `onChange({ kind: 'remove' })` (nothing was removed). The
        // `__rozieItem` stash on the original is still cleaned up in
        // the `finally` block below (`fromUs === true`), and the user's
        // `onEnd` callback still fires from the finally — the drag did
        // end on the source side.
        if (e.pullMode === 'clone') {
          if (stashAtEntry !== undefined && current.indexOf(stashAtEntry) !== -1) {
            endOld = current.indexOf(stashAtEntry);
          }
          return;
        }
        // SOURCE SIDE of cross-list move — splice out of our items.
        // Locate the moved item by identity (stash) first; fall back to oldIndex hint.
        const movedFromIdx =
          stashedItem !== undefined && current.indexOf(stashedItem) !== -1
            ? current.indexOf(stashedItem)
            : oldIndexHint;
        if (movedFromIdx < 0 || movedFromIdx >= current.length) {
          // Lost the source item entirely. Bail.
          return;
        }
        moved = current[movedFromIdx] as T;
        endOld = movedFromIdx;
        endItem = moved;
        // Put the dragged DOM node back so our framework's re-render off
        // the new (shorter) model removes it cleanly. If restore throws
        // (fragile event — common path here when destination's onAdd
        // already detached e.item), proceed to writeback anyway.
        safeDom(() => {
          // Item-scoped: listEl may hold non-row children (see itemChildAt),
          // so index against the .rozie-sortable-item rows only.
          const ref = itemChildAt(movedFromIdx);
          listEl.insertBefore(e.item, ref);
        });
        next = [...current];
        next.splice(movedFromIdx, 1);
        oldIndex = movedFromIdx;
        newIndex = -1; // not applicable on the source side
      } else {
        // DESTINATION SIDE of cross-list move — splice INTO our items.
        // Prefer the stash (the source list's item data); fall back to
        // attempting to read it from the moved DOM if the stash was lost
        // (extreme fallback — should not happen in practice).
        moved = stashedItem;
        if (moved === undefined) {
          // No item data travelled with the row: it came from a SortableJS
          // list that isn't a SortableList (only a SortableList stashes its
          // item on the dragged element). Such drops aren't supported, so the
          // row goes back where it came from — in `e.from`, at `e.oldIndex` —
          // and nothing is written or emitted. (A clone-mode source kept its
          // original: the clone is just removed.)
          safeDom(() => {
            const node = e.item as unknown as HTMLElement;
            const from = e.from as HTMLElement | null;
            if (e.pullMode === 'clone' || from == null || from === listEl) {
              node.remove();
              return;
            }
            putBack(node, from, e.oldIndex, e.oldDraggableIndex);
          });
          return;
        }
        // Remove the SortableJS-inserted node — the framework re-render
        // from the new (longer) model recreates the row properly.
        safeDom(() => {
          const node = e.item as { remove?: () => void } | null;
          node?.remove?.();
        });
        next = [...current];
        const targetIdx =
          newIndexHint >= 0 && newIndexHint <= next.length
            ? newIndexHint
            : next.length;
        next.splice(targetIdx, 0, moved);
        oldIndex = -1; // not applicable on the destination side
        newIndex = targetIdx;
      }

      // SortableJS-internal-state hazard: calling `opts.onCommit(next)`
      // SYNCHRONOUSLY here triggers framework re-renders (Solid/React/Vue/
      // etc.) that may unmount sibling SortableList instances mid-drop.
      // When the framework destroys a sibling SortableJS, that instance's
      // `destroy()` calls `_onDrop()` which calls `_nulling()`, setting
      // `Sortable.active = null` on the SortableJS module. The source
      // list's pending `end` event is then guarded by `if (Sortable.active)`
      // and skipped — losing the source-side commit on cross-list moves.
      //
      // Defer to a microtask so SortableJS's `_onDrop` can complete
      // uninterrupted (both `add` and `end` events fire in their natural
      // order) before any framework re-render runs. The DOM-restore step
      // above has already happened synchronously, so the DOM and the
      // model are kept in sync.
      queueMicrotask(() => {
        opts.onCommit(next);
        opts.afterCommit?.();
        opts.onChange?.({
          kind,
          oldIndex,
          newIndex,
          item: moved,
          el: e.item,
          from: e.from,
          to: e.to,
          event: e,
        });
      });
    } finally {
      // The user's `onEnd` callback only fires from a true `onEnd` event
      // (source-side). The destination's `onAdd` invocation routes
      // through the same handler but should NOT fire `onEnd` again — the
      // source list already will.
      //
      // Cleanup of the `__rozieItem` stash happens in the source's `onEnd`
      // (`fromUs === true`) because that's the last guaranteed event in
      // the SortableJS lifecycle for any drag. Cross-list `onAdd` runs
      // BEFORE source `onEnd`, so the stash must remain readable on
      // `e.item` until the source side completes.
      //
      // `onEnd` runs in a TASK (`afterFlush`: `setTimeout(0)`, then a posted
      // message), scheduled from a microtask
      // that runs after this list's commit microtask (queued above, in the
      // `try`). On a cross-list drag the destination's commit was queued even
      // earlier, from its `onAdd`. So by the time `onEnd` runs every list
      // involved has written its items and reported `reorder` / `add` /
      // `remove`, and any flush those writes scheduled — in a microtask (Vue,
      // Svelte, React during a discrete event), a timer, or a posted message
      // (React's scheduler otherwise) — has run: a consumer `end` handler
      // reads the new state on every target.
      const fromUs = e.from === listEl;
      if (fromUs) {
        const item = e.item as unknown as Record<string, unknown> | null;
        if (item !== null && typeof item === 'object') {
          delete item[ROZIE_ITEM_STASH_KEY];
        }
        const info: SortableDrag<T> = {
          item: endItem,
          el: e.item,
          from: e.from,
          to: endTo,
          oldIndex: endOld,
          newIndex: endNew,
          event: e,
        };
        if (opts.scheduleEnd) {
          const scheduleEnd = opts.scheduleEnd;
          queueMicrotask(() => scheduleEnd(info));
        } else if (opts.onEnd) {
          const onEnd = opts.onEnd;
          queueMicrotask(() => afterFlush(() => onEnd(info)));
        }
      }
    }
  };

  /** Bridge the `__rozieItem` stash from the original DOM node to its
   * clone when SortableJS is in clone mode (`group.pull === 'clone'`).
   *
   * Clone-mode lifecycle:
   *   1. `onStart` fires on the source — we stash the dragged item DATA
   *      on `e.item.__rozieItem`.
   *   2. SortableJS clones the node — `clone` is the new DOM element
   *      that physically travels to the destination.
   *   3. `onClone` fires with `{ item, clone }` — THIS HOOK — we copy
   *      the stash from `item` to `clone` so step 4 can find it.
   *   4. `onAdd` fires on the destination with `e.item === clone`
   *      (NOT the original). Destination-side `handleCommit` reads
   *      `__rozieItem` off the clone via `readStash` → recovers the
   *      dragged item DATA, splices it into its array.
   *   5. `onEnd` fires on the source with `e.item === original`.
   *      `handleCommit` (clone-mode short-circuit) returns early so
   *      no spurious `remove` change is fired; the `finally` cleans
   *      up the stash on the original.
   *
   * The `clone` DOM property is not in SortableJS's strict d.ts for
   * `SortableEvent` (it's documented in their JS source but not the
   * exported types), so we widen the parameter type locally. */
  const handleClone = (e: SortableEvent & { clone: HTMLElement }): void => {
    const original = e.item as unknown as Record<string, unknown> | null;
    const clone = e.clone as unknown as Record<string, unknown> | null;
    if (
      original !== null &&
      typeof original === 'object' &&
      clone !== null &&
      typeof clone === 'object' &&
      ROZIE_ITEM_STASH_KEY in original
    ) {
      clone[ROZIE_ITEM_STASH_KEY] = original[ROZIE_ITEM_STASH_KEY];
    }
  };

  const instance = new SortableJS(listEl, {
    // Scope dragging to item rows only, so any non-row child of listEl is
    // skipped — keeps SortableJS's own e.oldIndex/e.newIndex hints
    // item-relative. Placed BEFORE the spread so
    // a consumer-supplied `options.draggable` still overrides it (pass-through).
    draggable: ROW_DRAGGABLE,
    ...baseOptions,
    onStart: handleStart,
    // SortableJS event lifecycle is asymmetric: `onEnd` fires only on the
    // source list; cross-list destination receives `onAdd`. Wiring the
    // same handler to both keeps the helper's "single handler with from/to
    // disambiguation" contract consistent across same-list reorder
    // (source onEnd), cross-list source (source onEnd), and cross-list
    // destination (destination onAdd).
    onEnd: handleCommit,
    onAdd: handleCommit,
    // Clone-mode stash bridge (see `handleClone` doc above). No-op on
    // non-cloneable drags — SortableJS doesn't fire `onClone` outside
    // clone mode.
    onClone: handleClone,
  });

  return {
    destroy: () => {
      instance.destroy();
    },
    instance,
  };
}
