# Portal Slots — rendering consumer fragments into engine-created DOM

The `$portals.NAME(container, scope)` primitive: a vanilla-JS engine creates DOM, and the consumer's
framework renders a fragment into it. **Shipped** (Phase 33 lineage).

## Requirements

From the `killer-component-ports` idea.

- **REQ-5** — v1 portal slots are NOT reactive after mount; they re-render only when the wrapper's
  script re-invokes them. Deliberately sidesteps the per-framework reactivity-impedance problem that
  dominates official-wrapper LOC (`@fullcalendar/react` is 1000+ LOC mostly for this).
- **REQ-8** — the Svelte `PortalHost` ships as a SHARED runtime helper from `@rozie/runtime-svelte`,
  not per-component synthesis.
- **REQ-19** — the *reactive* Svelte portal is a SEPARATE helper `PortalHostReactive.svelte`, owning
  `scope` in `$state` and exposing an `update(s)` export.
- **REQ-20 (Solid)** — hold scope in `createSignal(scope, { equals: false })`. The engine may hand
  back a same-reference object mutated in place; default `===` would skip the recompute.
- **REQ-21 (Angular)** — update via `Object.assign(view.context, s)` + `view.detectChanges()` on the
  RETAINED `EmbeddedViewRef`. Never recreate the embedded view — that remounts.
- **REQ-22** — reactive slots return `{ update(scope), dispose() }`; non-reactive keep the verbatim
  `() => void` shape so the shipped slots stay byte-identical.
- **REQ-23 (contentDOM)** — the graft splits the 6 by ref-timing. React/Solid/Lit graft via their
  NATIVE `ref` (synchronous-within-render). **Vue/Svelte/Angular MUST use query-after-render**
  (`dom.querySelector('[data-rozie-hole]')` after the synchronous mount) — their function-ref/action/
  template-query timing is post-mount/async and misses the window before ProseMirror validates
  `contentDOM`.
- **REQ-24** — the full node view is the COMPOSITION of reactive chrome AROUND an editable hole;
  smoke-test the combination in real TipTap.
- **REQ-40** — bubble-menu hosts need the **reactive** primitive, not mount-once. A framework reactive
  mount survives `element.remove()` / `appendChild` detach-reattach and patches in place *while
  detached* (Vue: 211 updates / 207 while detached / 0 errors / input identity stable).
- **REQ-41** — give each BubbleMenu instance a distinct `pluginKey` so Floating-UI plugins don't collide.
- **REQ-9/10/11** — `:style` lowering: PostCSS-driven parsing (never `split(';')`); React/Solid
  mandate the object form, Vue/Svelte/Lit/Angular pass strings natively; emit `ROZ083` when
  `!important` would be silently dropped by React's object form.

## How to Build It

- Contract: `$portals.NAME(container, scope) => disposeFn` (mount-once) or `=> {update, dispose}` (reactive).
- Per-runtime helpers, NOT one shared method — the render primitive is irreducibly per-framework.
- Bookkeeping (live-handle `Set` + bulk dispose) factors into a per-runtime `createPortalRegistry`
  (spike 011: −3 LOC/component on Lit, bounded expected-only churn).
- Engine-mounted CSS reaches engine-created DOM via `@portal NAME { … }` →
  `[data-rozie-portal-NAME="<hash>"]` cascade (spike 004).

## What to Avoid

- Don't recreate Angular embedded views on update (remounts).
- Don't rely on `===` equality for Solid portal scope.
- Don't use a `ref:`/action graft for contentDOM on Vue/Svelte/Angular.
- Don't emit ambient `declare` blocks in Svelte 5 instance `<script>` (REQ-6) — import types instead.
- Don't give Angular `contentChild`/`viewChild` a locator generic when `{ read: X }` drives the
  return type (REQ-7, TS2322).

## Constraints

Proving in-place-update requires an **external identity marker**: stamp `el.dataset.identity` via
`page.evaluate`, then update, then assert content changed AND marker survived. A remount drops it.

## Origin

Spikes: 002, 003, 004, 007, 008, 011, 016 — sources in `sources/00{2,3,4,7,8}-*/`, `sources/011-*/`, `sources/016-*/`
