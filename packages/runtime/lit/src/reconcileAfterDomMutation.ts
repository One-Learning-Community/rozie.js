/**
 * reconcileAfterDomMutation — Lit runtime helper for the pre-Phase-16
 * cleanup Item 3 `$reconcileAfterDomMutation()` sigil.
 *
 * Use case
 * --------
 * Cross-framework engine wrappers (SortableList → SortableJS, FullCalendar →
 * FullCalendar, TipTap, Uppy, …) often integrate with libraries that mutate
 * the DOM directly. Every framework reconciler then sees a model-vs-DOM mismatch
 * on the next render and either fights the mutation (flash, snap-back) or
 * silently desyncs. The cross-framework workaround the engine wrappers all
 * implement is: BEFORE writing the new model state, restore the pre-mutation
 * DOM, so the reconciler sees a clean array shift and performs idiomatic
 * key-based moves.
 *
 * That workaround works on Vue/React/Svelte/Solid/Angular because their keyed
 * reconcilers diff against the live DOM at patch time. It does NOT work on
 * Lit. lit-html's `repeat` directive uses an internal `oldParts` cache keyed
 * by SENTINEL-COMMENT node identity — not by reading `parent.children` at
 * patch time. SortableJS's physical DOM mutation moves the rendered `<div>`
 * relative to the sentinel-comment markers, leaving sentinel-bracket content
 * out of sync. Subsequent `insertPart` walks then move sentinel pairs around
 * misplaced content, garbling the output.
 *
 * The sigil `$reconcileAfterDomMutation()` is a per-target lowering:
 *   - Vue / React / Svelte / Solid / Angular → no-op (`void 0`)
 *   - Lit → `__rozieReconcileAfterDomMutation(this)` (this helper)
 *
 * What this helper does
 * ---------------------
 * 1. `render(nothing, host.renderRoot)` — clears lit-html's rendered content
 *    AND discards the cached `oldParts` array, so the next render rebuilds
 *    every part from scratch instead of diffing against a stale cache.
 * 2. `host.requestUpdate()` — schedules a fresh render via Lit's standard
 *    update lifecycle. The reactive update is likely already scheduled by
 *    the surrounding user code (`$props.items = next` triggered a property
 *    write), so this call is usually redundant but cheap and defensive.
 *
 * Caller contract — the host must be a `LitElement`-shaped object with:
 *   - `renderRoot: ParentNode` (LitElement's per-component render container)
 *   - `requestUpdate(): void` (LitElement's public update-schedule API)
 *
 * Cost — `render(nothing, …)` tears down and re-creates the entire subtree.
 * It is more expensive than a normal `requestUpdate()`. Authors should call
 * `$reconcileAfterDomMutation()` ONLY after a third-party DOM mutation that
 * has invalidated lit-html's part cache (the SortableList `onUpdate` pattern
 * is the canonical use case). Calling it on every state change defeats lit-
 * html's efficient diffing.
 *
 * @public
 */
// Use the `lit` umbrella package the way the sibling runtime helpers
// (rozieSpread, rozieListeners) do — keeps the runtime-lit peerDependency
// set as `lit` (not bare `lit-html`). `nothing` re-exports from lit-html via
// the umbrella; `render` lives in `lit/html.js` (Lit 3 re-export shape).
import { nothing } from 'lit';
import { render } from 'lit/html.js';

/**
 * Shape of a Lit host element that this helper can operate on. `renderRoot`
 * matches LitElement's `RenderRootNode = HTMLElement | DocumentFragment`
 * (lit-html's `render()` accepts the same union, so threading the narrower
 * type avoids a TS widening cast). Keeping the duck-typed shape avoids a
 * hard dependency on `LitElement` itself and lets the helper accept any
 * LitElement-shaped instance (including test mocks).
 */
export interface ReconcilableHost {
  readonly renderRoot: HTMLElement | DocumentFragment;
  requestUpdate(): void;
}

/**
 * Tear down lit-html's part tree under `host.renderRoot` and schedule a
 * fresh update. Internal name is `__rozieReconcileAfterDomMutation` (double-
 * underscore prefix) so users cannot accidentally collide with it via
 * `<data>` or `r-for` aliases — it is an emit-only identifier.
 */
export function __rozieReconcileAfterDomMutation(host: ReconcilableHost): void {
  render(nothing, host.renderRoot);
  host.requestUpdate();
}
