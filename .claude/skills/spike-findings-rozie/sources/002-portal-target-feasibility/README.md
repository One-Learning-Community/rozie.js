---
spike: 002
name: portal-target-feasibility
type: standard
validates: "Given a hypothetical portal-slot Rozie wrapper, when we hand-write the lowered output for each of 6 targets (React/Vue/Svelte/Angular/Solid/Lit), then each emitted form (a) uses only standard imperative-render APIs, (b) satisfies the $portals.event(container, scope) => disposeFn contract, (c) handles dispose cleanly on wrapper teardown, (d) passes tsc --noEmit / vue-tsc / svelte-check"
verdict: VALIDATED
related: ["001-sortablejs-port"]
tags: [portal-slots, cross-target, ir-design, callback-rendering, fullcalendar, ag-grid, swiper, killer-component-port]
---

# Spike 002: Portal-Slot Target Feasibility

First de-risking pass for the portal-slot primitive. Validates that the new
authoring shape — `<slot name="event" portal :params="['arg']" />` exposed
via the script symbol `$portals.event(container, scope) => disposeFn` — can
be lowered cleanly to all 6 targets using only standard imperative-render
APIs.

The need surfaced while writing examples/FullCalendar.rozie: FullCalendar's
`eventContent` and `dayCellContent` are CALLBACKS that return DOM
synchronously. Rozie scoped slots compile to each target's native slot
idiom (Vue `<slot>`, React `children`, etc.) which can only render
inside the framework's own tree — they can't be invoked imperatively
from inside a foreign engine's callback. The official FullCalendar
wrappers each solve this with a per-framework portal mechanism
(`createPortal`, `<Teleport>`, `mount()`, `ViewContainerRef`); we want
one Rozie primitive that compiles to all of them.

V1 design constraint: **portal slots are NOT reactive after mount.** They
re-render only when the wrapper's script re-invokes them. This sidesteps
the per-framework reactivity-impedance question that dominates the
official-wrapper LOC and matches how engine callbacks actually work
(they re-invoke the render callback when data changes, which IS when
you'd re-render).

## What This Validates

**Given** a hypothetical Rozie wrapper exposing a portal slot named `event`
(`<slot name="event" portal :params="['arg']" />` in template, invoked from
script as `$portals.event(container, scope) => disposeFn`),

**when** we hand-write the lowered output for each of 6 targets matching
the contract,

**then** each emitted form:
  - (a) uses only standard imperative-render APIs from that target's
    canonical runtime package (no exotic deps)
  - (b) satisfies the `$portals.event(container, scope) => disposeFn`
    contract
  - (c) handles dispose cleanly on wrapper teardown — both per-cell
    disposes AND a bulk dispose at component unmount
  - (d) passes the target's TypeScript syntax check
    (`tsc --noEmit` / `vue-tsc` / `svelte-check`)

## Research

Per-target imperative-render APIs (all standard, no exotic dependencies):

| Target | Package | API | Returns |
|---|---|---|---|
| React 18+ | `react-dom/client` | `createRoot(container).render(...)` | `Root` with `.unmount()` |
| Vue 3 | `vue` | `render(vnode, container)` | void — unmount via `render(null, container)` |
| Svelte 5 | `svelte` | `mount(Component, { target, props })` | mount instance — unmount via `unmount(inst)` |
| Angular 19 | `@angular/core` | `vcr.createEmbeddedView(tplRef, scope)` | `EmbeddedViewRef` with `.destroy()` and `.rootNodes` |
| Solid | `solid-js/web` | `render(fn, container)` | dispose function (called to teardown) |
| Lit 3 | `lit` | `render(template, container)` | void — re-render with `nothing` to clear |

All six are production-stable, documented in each framework's official docs,
and free of exotic peer deps.

## How to Run

```bash
# Stage hand-written outputs into an isolated check env (one-time)
CHECK=/tmp/rozie-spike-002-check && rm -rf $CHECK && mkdir -p $CHECK
cp .planning/spikes/002-portal-target-feasibility/*.{ts,tsx,vue,svelte,d.ts} $CHECK/
cd $CHECK
npm install --silent typescript@5.7 react@18 react-dom@18 @types/react@18 \
  @types/react-dom@18 vue@3.5 vue-tsc@2 svelte@5 svelte-check@4 \
  solid-js@1.9 lit@3 @angular/core@19 rxjs zone.js
touch engine.js  # svelte-check needs the import target to exist

# Verify per target — each must report 0 errors.
npx tsc -p tsconfig.react.json      # React
npx tsc -p tsconfig.solid.json      # Solid
npx tsc -p tsconfig.lit.json        # Lit
npx tsc -p tsconfig.angular.json    # Angular
npx vue-tsc -p tsconfig.vue.json    # Vue
npx svelte-check --no-tsconfig      # Svelte
```

## What to Expect

Each per-target tsc check reports 0 errors. Eyeball each `Demo.*` file
to confirm:
  - The `$portals.event(container, scope) => disposeFn` contract is
    explicitly present (variable named `portals` with a single `event`
    method matching the contract)
  - A dispose-tracking collection (Set/Map) is maintained so wrapper
    teardown can dispose all active portal mounts in bulk
  - The cellRenderer callback handed to `FakeEngine` invokes
    `portals.event(node, { arg })` and forwards the dispose handle

## Investigation Trail

**Iteration 1 — Survey the 6 target APIs.** Reviewed each framework's
imperative-render documentation. Confirmed Svelte 5's `mount`/`unmount`
landed in stable (replacing Svelte 4's component constructor pattern),
React 18's `createRoot` replaces the legacy `ReactDOM.render`, Vue 3's
`render(vnode, container)` has been stable since the 3.0 release.

**Iteration 2 — Hand-write each target output.** Started with React
(known-best), then Vue, then the easier "render returns dispose"
targets (Solid, Lit). Saved Svelte and Angular for last as the
trickier ones. Key drafting decisions:

  - **All 6** maintain a `Set` of in-flight portal mounts so that
    wrapper teardown can bulk-dispose. Without this, the engine
    holding onto stale containers would leak.
  - **All 6** check `if (!slot) return () => {}` so the wrapper can
    expose portal slots that are optional from the consumer's
    perspective without throwing on undefined.
  - **All 6** dispose portal mounts BEFORE destroying the engine in
    the teardown order, to avoid unmounting framework trees whose
    containers are already detached.

**Iteration 3 — tsc verification surfaced 2 real issues:**

  1. **Angular `contentChild` generic placement** — `contentChild<TemplateRef<{arg: unknown}>>('event', { read: TemplateRef })` failed
     with TS2322 because the locator-typed generic conflicts with the
     `read` option's inferred return type. Fix: drop the generic on
     `contentChild`, let the `read: TemplateRef` option drive inference.
     ⇒ Implication for the compiler: when emitting the per-portal-slot
     contentChild query, do NOT add an explicit generic — rely on
     Angular's overload resolution.

  2. **Svelte 5 ambient declarations** — `declare class FakeEngine { ... }`
     inside `<script lang="ts">` failed with "Modifiers cannot appear
     here. If this is a declare statement, move it into
     `<script context="module">`". Fix: extracted the engine type to
     a shared `engine.d.ts` and imported it.
     ⇒ Implication for the compiler: emitted Svelte 5 components should
     never contain ambient `declare` blocks in instance scripts. If the
     wrapper's `<script>` references foreign types, those types must be
     imported from a .d.ts or .ts file, not declared inline. Existing
     emit path probably already does this — verify in Spike 003.

**Iteration 4 — Per-target complications inventory.** Annotated each
file with a "Per-target note" header capturing the one or two things
the compiler needs to know to emit that target. Key findings:

  - **Lit can't use `<slot>` for portal slots** — Lit's shadow-DOM `<slot>`
    is part of the normal render tree; you can't invoke it from a
    callback. Lit therefore receives portal slots as function-typed
    `@property`, mirroring the existing render-prop lowering for
    non-portal scoped slots. The Lit emit path already handles function
    props — small extension needed.

  - **Svelte 5 needs a synthesized PortalHost wrapper** — Svelte 5
    Snippets can't be `mount()`-ed directly; only Components can. The
    emitter therefore synthesizes a ~10 LOC inline component per
    portal-slot-using Rozie source whose body just `{@render snippet(scope)}`.
    This is the heaviest per-target adapter — but bounded and only emitted
    when the source uses portal slots.

  - **Angular needs a `<ng-container #portalAnchor>` + per-slot contentChild
    query** — straightforward template + decorator surgery. DI does NOT
    bleed into the wrapper because Angular 19's `viewChild`/`contentChild`
    signals handle it.

  - **React/Vue/Solid** — no per-target complications. The lowering is
    "wrap the imperative-render API in a closure that matches the
    contract." 5-10 lines each.

## Results

**Verdict: VALIDATED.**

All 6 targets accept the portal-slot contract via standard imperative-
render APIs. Tsc/vue-tsc/svelte-check report 0 errors across all 6
hand-written outputs after the two iteration-3 fixes.

Per-target complexity budget (LOC added to a generated wrapper that
uses one portal slot, approximate):

| Target | LOC added |
|---|---|
| Solid | ~12 |
| Lit | ~14 |
| React | ~18 |
| Vue | ~18 |
| Angular | ~22 (incl. ng-container + contentChild) |
| Svelte 5 | ~25 (incl. synthesized PortalHost sidecar) |

Total compiler work for Spike 003: 6 per-target emit functions
(~25-50 LOC each), 1 new IR node kind (`PortalSlotDecl`), 1 parser
change (recognize `portal` attribute on `<slot>` elements), 1 script
lowering pass (`$portals.NAME` symbol resolution). Estimated 600-900
LOC of compiler-side changes + fixtures.

**Surprises:**

  - Angular was less ceremony-heavy than expected. The `inject(...)`
    constructor pattern was avoided entirely by using the signal-based
    `viewChild`/`contentChild` APIs.

  - Svelte 5's Snippet-vs-Component asymmetry forced the PortalHost
    synthesis. This was the only target where the spike grew NEW
    emit-time code (a synthesized sidecar file) rather than just
    rewriting the existing script/template structure.

  - All 6 targets independently arrived at the same dispose-tracking
    pattern (`Set<dispose-handle>` maintained across mounts). Suggests
    this should be hoisted into a shared runtime helper rather than
    re-emitted per wrapper.

**Open questions for Spike 003:**

  1. Where does the synthesized Svelte 5 PortalHost live? Inline in
     the same emitted bundle (preferred — single file) or sidecar
     (cleaner separation, but ships an extra import)?

  2. Should we hoist the dispose-tracking `Set` pattern into a shared
     `@rozie/runtime-portal` package? Probably yes — it's identical
     across all 6 targets and would shrink emitted output ~5 LOC per
     wrapper.

  3. How does the parser distinguish `<slot name="X" portal />` from
     a regular scoped slot? Just an attribute check, but: is the
     `:params="['arg']"` array the right way to declare the scope
     shape, or should it be inferred from script usage?

## Cross-refs

  - Spike 001 (sortablejs-port) — established the engine-wrapper port
    pattern this spike's portal mechanism unblocks the next layer of.
  - Existing scoped-slot lowering in `packages/targets/*/src/emit/emitSlot*.ts`
    — Spike 003 will mostly add a sibling code path that diverts portal
    slots into the imperative-render shape.
