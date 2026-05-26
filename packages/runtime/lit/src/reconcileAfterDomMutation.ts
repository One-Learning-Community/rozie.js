/**
 * reconcileAfterDomMutation — Lit runtime helper for the
 * `$reconcileAfterDomMutation()` sigil (engine-wrapper escape hatch).
 *
 * Use case
 * --------
 * Cross-framework engine wrappers (SortableList → SortableJS, FullCalendar →
 * FullCalendar, TipTap, Uppy, …) often integrate with libraries that mutate
 * the DOM directly. Every framework reconciler then sees a model-vs-DOM
 * mismatch on the next render and either fights the mutation (flash,
 * snap-back) or silently desyncs. The cross-framework workaround the engine
 * wrappers all implement is: BEFORE writing the new model state, restore
 * the pre-mutation DOM, so the reconciler sees a clean array shift and
 * performs idiomatic key-based moves.
 *
 * That workaround works on Vue/React/Svelte/Solid/Angular because their
 * keyed reconcilers diff against the live DOM at patch time. It does NOT
 * work on Lit. lit-html's `repeat` directive uses an internal `oldParts`
 * cache keyed by SENTINEL-COMMENT node identity — not by reading
 * `parent.children` at patch time. SortableJS's physical DOM mutation moves
 * the rendered `<div>` relative to the sentinel-comment markers, leaving
 * sentinel-bracket content out of sync. Subsequent `insertPart` walks then
 * move sentinel pairs around misplaced content, garbling the output.
 *
 * The sigil `$reconcileAfterDomMutation()` is a per-target lowering:
 *   - Vue / React / Svelte / Solid / Angular → no-op (`void 0`)
 *   - Lit → `__rozieReconcileAfterDomMutation(this)` (this helper)
 *
 * What this helper does
 * ---------------------
 * Bumps `host._rozieReconcileSeq` and calls `host.requestUpdate()`.
 *
 * The seq counter is consumed by `keyed(this._rozieReconcileSeq ?? 0, …)`
 * wrappers that the Lit emitter places around the children of every
 * `r-external`-marked element. When the seq changes, lit-html's `keyed`
 * directive disposes the previously rendered child DOM (including any
 * orphan nodes left by the engine's mid-drag mutation and the stale
 * sentinel-comment layout) and renders the children FRESH with a clean
 * sentinel structure. Crucially, the `r-external` element ITSELF — outside
 * the `keyed` wrapper — is preserved by lit-html's template-instance reuse,
 * so any third-party listeners attached to it (SortableJS pointerdown
 * handlers, FullCalendar resize observers, …) survive the rebuild.
 *
 * Replaces the prior `render(nothing, host.renderRoot)` strategy. That
 * approach destroyed the entire shadow-DOM subtree on every reconcile,
 * detaching the engine root element along with the orphans. The seq+keyed
 * strategy preserves engine attachments end-to-end, enabling consecutive
 * drag/edit/etc. operations on the same engine instance.
 *
 * Caller contract — the host must be a `LitElement`-shaped object with:
 *   - `requestUpdate(): void` (LitElement's public update-schedule API)
 *   - `_rozieReconcileSeq?: number` (declared on the class by the emitter
 *     whenever the template uses `r-external`; this helper safely
 *     initializes it to 0 if missing)
 *
 * Cost — bumping a number + one extra render. `keyed`'s disposal walks the
 * existing children, so it's O(children) inside the marked element. Cheap
 * compared to the prior whole-shadow-DOM teardown.
 *
 * @public
 */

/**
 * Shape of a Lit host element that this helper can operate on. Keeping the
 * duck-typed shape avoids a hard dependency on `LitElement` itself and lets
 * the helper accept any LitElement-shaped instance (including test mocks).
 *
 * `_rozieReconcileSeq` is `number | undefined` so the emitter can omit the
 * class field on components that don't use `r-external` (forward-
 * compatibility: legacy emit before this change has no such field; the
 * `?? 0` coercion below handles both cases without a TS widening cast).
 */
export interface ReconcilableHost {
  requestUpdate(): void;
  _rozieReconcileSeq?: number;
}

/**
 * Bump the host's reconcile-seq counter and schedule an update. The seq is
 * read by `keyed(this._rozieReconcileSeq ?? 0, …)` wrappers around the
 * children of `r-external`-marked elements; the bump triggers `keyed` to
 * dispose stale children DOM and rebuild with a fresh sentinel structure,
 * while the marked element itself (and any third-party listeners attached
 * to it) is preserved across the reconcile.
 *
 * Internal name is `__rozieReconcileAfterDomMutation` (double-underscore
 * prefix) so users cannot accidentally collide with it via `<data>` or
 * `r-for` aliases — it is an emit-only identifier.
 */
export function __rozieReconcileAfterDomMutation(host: ReconcilableHost): void {
  host._rozieReconcileSeq = (host._rozieReconcileSeq ?? 0) + 1;
  host.requestUpdate();
}
