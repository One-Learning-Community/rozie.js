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
/** Disambiguated event kind, exposed via `onChange`. */
export type SortableEventKind = 'reorder' | 'add' | 'remove';
/** Argument shape for the disambiguated onChange callback. */
export interface SortableChange<T> {
    kind: SortableEventKind;
    /** Source index. `-1` if it could not be determined (fragile-event path). */
    oldIndex: number;
    /** Destination index. `-1` if it could not be determined. */
    newIndex: number;
    /** The moved item. May be `undefined` only when both the stash AND the
     * source list's snapshot lost track of it (extreme fallback path). */
    item: T | undefined;
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
    /** Optional: fires on drag start. The dragged item DATA has already been
     * stashed on `e.item.__rozieItem` by the time this fires. */
    onStart?: (e: SortableEvent) => void;
    /** Optional: fires on drag end after `onCommit` + `afterCommit`. */
    onEnd?: (e: SortableEvent) => void;
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
/**
 * Wire a SortableJS instance to a reactive items array. See module doc
 * for the full rationale + cross-target contract.
 */
export declare function useSortableJS<T>(listEl: HTMLElement, opts: UseSortableJSOptions<T>): UseSortableJSResult;
