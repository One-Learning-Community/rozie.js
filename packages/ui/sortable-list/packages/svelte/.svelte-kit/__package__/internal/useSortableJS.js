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
import SortableJS from 'sortablejs';
/** Symbol stashed on `e.item` between `onStart` and `onEnd` to ferry the
 * dragged item DATA (not just the DOM node) across cross-list moves and
 * survive `e.oldIndex` going null in fallback-mode events. The double
 * underscore prefix signals "Rozie-internal, do not collide with user
 * data". */
const ROZIE_ITEM_STASH_KEY = '__rozieItem';
/** Read the stashed item, falling back to a `null`/`undefined` when the
 * element doesn't have the property. Centralised so the cast lives in
 * exactly one place. */
function readStash(item) {
    if (item === null || typeof item !== 'object')
        return undefined;
    return item[ROZIE_ITEM_STASH_KEY];
}
/** Try-catch wrapper for DOM operations that may throw on fragile event
 * paths. Returning `false` lets the caller proceed to the model writeback
 * — the framework's re-render off the new model brings the DOM back into
 * sync (may flicker briefly, but vastly better than today's silent drop). */
function safeDom(op) {
    try {
        op();
        return true;
    }
    catch {
        // The DOM-restore is best-effort. Proceed to model writeback regardless.
        return false;
    }
}
/**
 * Wire a SortableJS instance to a reactive items array. See module doc
 * for the full rationale + cross-target contract.
 */
export function useSortableJS(listEl, opts) {
    // Defensive merge: strip user-supplied handler keys from the verbatim
    // `options` blob — we own those paths. We deliberately do NOT splat
    // `opts.options` straight into the constructor argument unmodified, since
    // a user-supplied `onUpdate` would silently bypass our reconciler dance.
    const baseOptions = { ...(opts.options ?? {}) };
    /** Item-scoped child lookup. `listEl.children` now also includes the
     * non-draggable `#header` / `#footer` slot holes (direct children of the
     * list container), so the DOM-restore sites must index ONLY the item rows —
     * `:scope > .rozie-sortable-item` — to keep the restore index item-relative
     * and correct (no off-by-one from header/footer). */
    const itemChildAt = (i) => listEl.querySelectorAll(':scope > .rozie-sortable-item')[i] ?? null;
    // Build the explicit handler set — these always win over anything the
    // caller passed in via `options`.
    delete baseOptions.onStart;
    delete baseOptions.onEnd;
    delete baseOptions.onUpdate;
    delete baseOptions.onAdd;
    delete baseOptions.onRemove;
    // `onClone` is owned by the helper: we use it to bridge the
    // `__rozieItem` stash from the original DOM node to the cloned node
    // so the destination's `onAdd` can recover the dragged item DATA on
    // a clone-mode drag. See `handleClone` below.
    delete baseOptions.onClone;
    /** Stash dragged item DATA on `e.item` so cross-list moves can recover
     * it on the destination side. */
    const handleStart = (e) => {
        const current = opts.items();
        // The source index in this list (onStart fires from the source). Prefer the
        // DRAGGABLE-relative index: with non-draggable element children present
        // (Lit shadow-DOM `#header`/`#footer` `<slot>`s), plain `e.oldIndex` counts
        // all children and is offset — stashing `current[oldIndex]` would capture
        // the WRONG item (the row after the one actually grabbed), and the
        // identity-based commit lookup would then faithfully move that wrong item.
        // `oldDraggableIndex` counts only the `.rozie-sortable-item` rows.
        const fromIdx = typeof e.oldDraggableIndex === 'number'
            ? e.oldDraggableIndex
            : typeof e.oldIndex === 'number'
                ? e.oldIndex
                : -1;
        if (fromIdx >= 0 && fromIdx < current.length) {
            const item = e.item;
            if (item !== null && typeof item === 'object') {
                item[ROZIE_ITEM_STASH_KEY] = current[fromIdx];
            }
        }
        opts.onStart?.(e);
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
    const handleCommit = (e) => {
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
            const kind = sameList ? 'reorder' : fromUs ? 'remove' : 'add';
            // Identity-based item lookup beats fragile `e.oldIndex`. The stash was
            // set on `onStart` and travels with `e.item` across lists (SortableJS
            // physically moves the same node between lists).
            const stashedItem = readStash(e.item);
            // Prefer the DRAGGABLE-relative indices. SortableJS computes plain
            // `oldIndex`/`newIndex` via `index(dragEl)` — counting ALL element
            // siblings — while `oldDraggableIndex`/`newDraggableIndex` use
            // `index(dragEl, options.draggable)`, counting only the
            // `.rozie-sortable-item` rows. When the list container also holds
            // non-draggable element children, the plain indices are offset. This bites
            // ONLY on Lit: the `#header` / `#footer` named slots render as real
            // `<slot>` ELEMENTS inside the shadow-DOM list container (the 5 light-DOM
            // targets render nothing for an empty named slot), so the leading
            // `<slot name="header">` shifts every plain `newIndex` by +1 and the
            // writeback dropped items one slot too far. The draggable indices stay
            // item-relative everywhere; when no non-draggable children exist the two
            // coincide, so the 5 light-DOM targets are unchanged.
            const oldIndexHint = typeof e.oldDraggableIndex === 'number'
                ? e.oldDraggableIndex
                : typeof e.oldIndex === 'number'
                    ? e.oldIndex
                    : -1;
            const newIndexHint = typeof e.newDraggableIndex === 'number'
                ? e.newDraggableIndex
                : typeof e.newIndex === 'number'
                    ? e.newIndex
                    : -1;
            let next;
            let oldIndex;
            let newIndex;
            let moved;
            if (sameList) {
                // SAME-LIST REORDER
                // Locate the moved item by identity first; fall back to the index hint.
                const movedFromIdx = stashedItem !== undefined && current.indexOf(stashedItem) !== -1
                    ? current.indexOf(stashedItem)
                    : oldIndexHint;
                if (movedFromIdx < 0 || movedFromIdx >= current.length) {
                    // Lost the source item entirely. Bail out cleanly.
                    return;
                }
                moved = current[movedFromIdx];
                // Restore the moved DOM node back to its original position so the
                // framework reconciler sees a clean model-vs-DOM shift. If the
                // restore throws (fragile event), proceed to the model writeback —
                // the re-render off the new model will reconcile.
                safeDom(() => {
                    // Item-scoped: header/footer are non-item direct children of listEl,
                    // so index against the .rozie-sortable-item rows only.
                    const ref = itemChildAt(movedFromIdx);
                    listEl.insertBefore(e.item, ref);
                });
                next = [...current];
                next.splice(movedFromIdx, 1);
                const targetIdx = newIndexHint >= 0 && newIndexHint <= next.length
                    ? newIndexHint
                    : next.length;
                next.splice(targetIdx, 0, moved);
                oldIndex = movedFromIdx;
                newIndex = targetIdx;
            }
            else if (fromUs) {
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
                    return;
                }
                // SOURCE SIDE of cross-list move — splice out of our items.
                // Locate the moved item by identity (stash) first; fall back to oldIndex hint.
                const movedFromIdx = stashedItem !== undefined && current.indexOf(stashedItem) !== -1
                    ? current.indexOf(stashedItem)
                    : oldIndexHint;
                if (movedFromIdx < 0 || movedFromIdx >= current.length) {
                    // Lost the source item entirely. Bail.
                    return;
                }
                moved = current[movedFromIdx];
                // Put the dragged DOM node back so our framework's re-render off
                // the new (shorter) model removes it cleanly. If restore throws
                // (fragile event — common path here when destination's onAdd
                // already detached e.item), proceed to writeback anyway.
                safeDom(() => {
                    // Item-scoped: header/footer are non-item direct children of listEl,
                    // so index against the .rozie-sortable-item rows only.
                    const ref = itemChildAt(movedFromIdx);
                    listEl.insertBefore(e.item, ref);
                });
                next = [...current];
                next.splice(movedFromIdx, 1);
                oldIndex = movedFromIdx;
                newIndex = -1; // not applicable on the source side
            }
            else {
                // DESTINATION SIDE of cross-list move — splice INTO our items.
                // Prefer the stash (the source list's item data); fall back to
                // attempting to read it from the moved DOM if the stash was lost
                // (extreme fallback — should not happen in practice).
                moved = stashedItem;
                if (moved === undefined) {
                    // Without a moved item we have nothing to insert. Remove the
                    // SortableJS-inserted node so the framework re-render is clean.
                    safeDom(() => {
                        const node = e.item;
                        node?.remove?.();
                    });
                    return;
                }
                // Remove the SortableJS-inserted node — the framework re-render
                // from the new (longer) model recreates the row properly.
                safeDom(() => {
                    const node = e.item;
                    node?.remove?.();
                });
                next = [...current];
                const targetIdx = newIndexHint >= 0 && newIndexHint <= next.length
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
                opts.onChange?.({ kind, oldIndex, newIndex, item: moved });
            });
        }
        finally {
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
            const fromUs = e.from === listEl;
            if (fromUs) {
                const item = e.item;
                if (item !== null && typeof item === 'object') {
                    delete item[ROZIE_ITEM_STASH_KEY];
                }
                opts.onEnd?.(e);
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
    const handleClone = (e) => {
        const original = e.item;
        const clone = e.clone;
        if (original !== null &&
            typeof original === 'object' &&
            clone !== null &&
            typeof clone === 'object' &&
            ROZIE_ITEM_STASH_KEY in original) {
            clone[ROZIE_ITEM_STASH_KEY] = original[ROZIE_ITEM_STASH_KEY];
        }
    };
    const instance = new SortableJS(listEl, {
        // Scope dragging to item rows only so the `#header` / `#footer` slot holes
        // (non-draggable direct children of listEl) are skipped — keeps SortableJS's
        // own e.oldIndex/e.newIndex hints item-relative. Placed BEFORE the spread so
        // a consumer-supplied `options.draggable` still overrides it (pass-through).
        draggable: '.rozie-sortable-item',
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
