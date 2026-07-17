/**
 * rozieResolvePortalledRef — command-palette-portal-through-portal cluster
 * (BUG A).
 *
 * A component with at least one `r-portal` element can relocate an ANCESTOR
 * subtree out of `this.renderRoot` via `RoziePortalController`'s
 * `appendChild` (see that module's doc comment for the full mechanism). Any
 * plain author `ref="x"` living INSIDE that relocated subtree (a native
 * element ref OR a `<components>`-composed child ref) is emitted as an
 * UNCACHED, `this.renderRoot`-scoped `@query('[data-rozie-ref="x"]')` — once
 * the node is physically moved out of `renderRoot`, that query returns
 * `null`/`undefined` FOREVER, even though the node is still live and
 * connected (just parked in the portal's container).
 *
 * Confirmed live: `@rozie-ui/command-palette`'s `$refs.panel`/`$refs.frame`/
 * `$refs.combobox` all silently no-op once `appendTo` portals the panel —
 * `goBack()`'s `seedQuery()` never restores the input text, the popup never
 * reopens (`focus()` no-ops), and the action-menu focus arbitration breaks.
 *
 * A naive "cache the first successful query result" fix does NOT work:
 * `RoziePortalController.hostUpdated()` (which performs the relocation) runs
 * SYNCHRONOUSLY, as part of Lit's `performUpdate()`, strictly BEFORE the
 * component's own `firstUpdated()`/`updated()` — so on the very first render
 * with the portal already active, the node is relocated before ANY consumer
 * code gets a chance to read the ref even once. There is no "successful
 * first read" to cache.
 *
 * This helper instead re-derives the answer on EVERY call, with no caching
 * at all: try the fresh, uncached query FIRST (so a close→reopen — Lit
 * dropping and recreating the `r-if` subtree — always observes the NEW node,
 * never a stale one); if that comes up empty, search WITHIN the LIVE
 * relocated subtree of every `RoziePortalController` field on the host
 * instance (`RoziePortalController.element` — always in sync with the
 * CURRENT `hostUpdated()` state, including the "recreate" case, so this
 * helper needs no staleness guard of its own).
 *
 * Host-field discovery is duck-typed via `Object.values(host)` rather than
 * requiring the emitter to know each portal controller's exact generated
 * field name ahead of time (portal field names are only known once
 * `emitTemplate`'s template walk runs, which happens AFTER `emitScript`'s ref
 * fields are emitted — see `emitLit.ts`'s `hasElementPortal` doc comment for
 * the same ordering constraint). Emitted Lit classes use TS `private` (a
 * compile-time-only modifier — NOT native `#private` fields), so portal
 * controller instances are genuine enumerable own properties reachable this
 * way. A component typically has 0-2 portal controllers, so this scan is
 * cheap; it is only reached at all once a portal's fresh query has already
 * failed (i.e. exactly when the fallback is needed).
 *
 * Controller identification uses `RoziePortalController`'s `__rozieBrand`
 * STRING property, NOT `instanceof` — confirmed live that a real-world
 * per-component-chunk bundled build (the VR host's Vite code splitting) can
 * give different chunks their OWN separately-bundled copy of
 * `@rozie/runtime-lit` (a dual-package hazard), so an `instanceof` check
 * against a DIFFERENT chunk's class reference silently fails even for a
 * genuine controller instance. A string-valued property survives that —
 * bundlers rename declaration identifiers/class names, not property names.
 *
 * @public — runtime API consumed by emitted Lit `.ts` files.
 */
function isRoziePortalController(
  value: unknown,
): value is { element: Element | null } {
  return (
    !!value &&
    typeof value === 'object' &&
    (value as { __rozieBrand?: unknown }).__rozieBrand === 'RoziePortalController'
  );
}

export function rozieResolvePortalledRef<T extends Element>(
  host: object,
  selector: string,
  fresh: T | null | undefined,
): T | null {
  if (fresh) return fresh;
  for (const value of Object.values(host as Record<string, unknown>)) {
    if (!isRoziePortalController(value)) continue;
    const container = value.element;
    if (!container) continue;
    if (container.matches(selector)) return container as T;
    const found = container.querySelector(selector);
    if (found) return found as T;
  }
  return null;
}
