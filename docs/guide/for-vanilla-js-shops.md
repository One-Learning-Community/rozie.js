# For vanilla-JS + plugin shops

Most production teams aren't on a pure framework stack. They have:

- A React admin panel from 2021
- A Vue marketing site from 2023
- A jQuery + plugins legacy app no one wants to touch
- And one new Astro project the new hire keeps pushing for

And every one of those apps glues the same vanilla-JS engines into its
framework: flatpickr for dates, SortableJS for drag-and-drop, Leaflet for
maps, TipTap for rich text, Chart.js for graphs, Uppy for uploads,
FullCalendar for scheduling.

Each app's glue is a different shape. Each upgrade of the engine breaks
the glue in a different way. Each new framework you adopt means writing
the glue *again*.

**Rozie wraps each engine once. The same wrapper drops into every one of
your apps.**

## The engine-wrapper pattern

The leverage criterion: the engine itself must be framework-agnostic
vanilla JS. Rozie wraps the wrapper, not the engine, so the engine stays
exactly where it is.

Examples that fit:

- **flatpickr** — date / range / time picker
- **SortableJS** — drag-and-drop reordering
- **Leaflet** / **Mapbox GL** / **MapLibre GL** — maps
- **TipTap** / **Lexical** / **CodeMirror 6** / **Monaco** — text editors
- **Chart.js** / **ApexCharts** / **D3** — charting
- **Uppy** — file upload
- **FullCalendar** — scheduling
- **Pikaday** — lightweight date picker
- **glide.js** / **swiper** — carousels

Examples that DON'T fit (the value IS the framework-native implementation,
not the engine):

- `react-day-picker` (no separable vanilla-JS engine)
- `vue-cal` (Vue-native logic, not a wrapper)
- Headless UI / Radix UI (the value is the React-specific accessibility
  semantics)

If the engine has a vanilla-JS public API you'd call from a plain
`<script>` tag, it fits the Rozie pattern.

## Side by side — SortableJS

### What you maintain today (one wrapper per framework)

You either install someone else's wrapper (`react-sortablejs`,
`vuedraggable`, `ngx-sortablejs`, `svelte-sortablejs`) — four different
APIs, four different bug surfaces, four different maintainers, four
different upgrade cycles — or you hand-roll glue inside each app.

Either way, you're maintaining the cross-framework workaround for
SortableJS's DOM-mutation-vs-framework-reconciler fight independently in
each codebase.

### What you maintain with Rozie (one wrapper, period)

```rozie
<rozie name="SortableList">

<props>
{
  items:     { type: Array,  default: () => [], model: true },
  itemKey:   { type: String, default: null },
  handle:    { type: String, default: null },
  animation: { type: Number, default: 150 },
}
</props>

<script>
import SortableJS from 'sortablejs'

let instance = null

$onMount(() => {
  instance = new SortableJS($el, {
    animation: $props.animation,
    handle:    $props.handle,
    onEnd:    (e) => $emit('end', e),
    onUpdate: (e) => {
      // Restore pre-drag DOM so the framework reconciler sees a clean
      // model change against unchanged DOM. Worked out once, works
      // everywhere.
      e.item.remove()
      $el.insertBefore(e.item, $el.children[e.oldIndex] ?? null)
      const next = [...$props.items]
      const [moved] = next.splice(e.oldIndex, 1)
      next.splice(e.newIndex, 0, moved)
      $props.items = next
      // Lit's lit-html `repeat` caches part identity by sentinel-comment
      // node. Engine DOM mutation desyncs it. No-op on every other target.
      $reconcileAfterDomMutation()
      $emit('change', e)
    },
  })
  return () => instance?.destroy()
})

$watch(() => $props.handle, (v) => instance?.option('handle', v))
</script>

<template>
<div class="rozie-sortable-list">
  <div r-for="item, index in $props.items" :key="item.id ?? index">
    <slot :item="item" :index="index" />
  </div>
</div>
</template>

</rozie>
```

That's the whole wrapper. Now use it from every app you maintain:

```tsx
// In your React admin panel
import { SortableList } from '@your-org/components';
<SortableList items={todos} onItemsChange={setTodos} itemKey="id">
  {({ item }) => <div className="row">{item.text}</div>}
</SortableList>
```

```vue
<!-- In your Vue marketing site -->
<SortableList v-model:items="todos" item-key="id">
  <template #default="{ item }">
    <div class="row">{{ item.text }}</div>
  </template>
</SortableList>
```

```svelte
<!-- In your SvelteKit dashboard -->
<SortableList bind:items={todos} itemKey="id">
  {#snippet children({ item })}
    <div class="row">{item.text}</div>
  {/snippet}
</SortableList>
```

```ts
// In your Angular admin
@Component({
  template: `
    <rz-sortable-list [(items)]="todos" itemKey="id">
      <ng-template #default let-ctx>
        <div class="row">{{ ctx.item.text }}</div>
      </ng-template>
    </rz-sortable-list>
  `,
})
```

```html
<!-- In your Astro / plain HTML page (Lit target) -->
<rz-sortable-list .items=${todos} item-key="id">
  ${todos.map(item => html`<div class="row">${item.text}</div>`)}
</rz-sortable-list>
```

**Five consumer-side authoring shapes. One source of truth.**

## The compiler invariants that make this work

A handful of engine-wrapper-specific compiler features have shipped
specifically because vanilla-JS engines are common Rozie use cases. You
can rely on them:

- **`$el` lowers to the right per-target host element** so engine
  constructors that take a DOM node always get the right one.
- **`$onMount` returning a cleanup function** is the right shape on every
  target. No `useEffect` ceremony, no `DestroyRef` boilerplate.
- **`$watch(() => $props.x, (v) => …)`** lowers to each target's idiomatic
  reactive primitive. The callback fires when the watched expression
  changes and the new value is bound correctly on all six targets.
- **`$reconcileAfterDomMutation()`** is the escape hatch when the engine
  mutates DOM under the framework's feet — no-op on five targets,
  active on Lit where lit-html's `repeat` cache needs the nudge.
- **`$classSelector('grip')`** survives React's CSS-Modules class hashing.
  Engines that take a `handle: '.grip'` option Just Work everywhere.
- **Round-trip guards on two-way bound engine state.** When the engine
  fires its change event you write `$props.x = newValue`; the wrapper's
  own `$watch` then sees the change and would push it back. Common
  pattern: guard with `if (newValue !== getCurrentEngineValue())
  updateEngine(newValue)` inside the `$watch`. Documented in
  [the SortableList example](/examples/sortable-list).
- **TypeScript `as` / `satisfies` annotations** in `<data>` block
  initializers — `selected: null as Item | null` keeps the field
  discriminated instead of degrading to `null` / `any`.

## What's in the reference slate

Seven engine wrappers ship as reference examples, each a different stress
test of the compiler's engine-wrapper substrate:

| Wrapper | Stresses |
| --- | --- |
| [**SortableList**](/examples/sortable-list) | Two-way array prop, DOM mutation, keyed reconciler, `$reconcileAfterDomMutation()` escape hatch |
| [**Flatpickr**](/examples/flatpickr) | Scalar two-way binding `r-model:date` |
| **LeafletMap** | TWO scalar two-way binds + array prop |
| [**LineChart (Chart.js)**](/examples/line-chart) | Deeply-nested object reactivity + interval-driven `$data` mutation |
| **TipTap** | Rich-text engine, internal toolbar tracking active marks, contenteditable DOM ownership |
| **Uppy** | Multi-event emit chain, streaming progress, engine-state snapshotting |
| **FullCalendar** | Date-typed array elements, object spread inside engine calls, structured-payload multi-emit, portal-slot fills |

Each wrapper compiles to byte-identical output across all six targets on
every commit — the engine-wrapper substrate is the most heavily-pinned
surface in the test suite.

## Cross-framework leverage — the math

If you maintain a single engine glued into N apps across M frameworks,
your maintenance cost today is roughly N × M — each app glues each engine
its own way.

With Rozie, the engine glue is M × 1 — one wrapper per engine — and you
still pay N × 0 to use it from each app (one import per app, same shape
as importing any native component).

For a team running a React app + a Vue app + an Angular admin + a static
HTML site (Lit), and four engines (Sortable + Flatpickr + Leaflet +
Chart.js): you go from sixteen distinct glue surfaces to four wrappers.

The first wrapper takes maybe a day. The second takes an hour, because
you already know the pattern. The reference examples in this repo are the
template.

## How to start

### Step 1: Pick the engine that hurts the most

The one you've fought across the most apps. The one that breaks on every
framework upgrade. The one whose existing wrapper library you don't
trust.

### Step 2: Read the closest reference

[SortableList](/examples/sortable-list) is the canonical demo —
two-way bound array, DOM mutation, scoped slot for per-row rendering.
[Flatpickr](/examples/flatpickr) is the simpler scalar-two-way pattern.

### Step 3: Wrap your engine

Copy one of the reference files. Replace SortableJS with your engine.
Wire `$onMount` / `$onUnmount` for instantiation and teardown. Use
`$watch` to push prop changes into the engine. Use `$emit` for engine
events. Use `r-model:` props for state the engine wants to own.

### Step 4: Drop it into one app, then another

The [Adopt incrementally guide](/guide/adopt-incrementally) covers the
per-stack install. Start with whichever framework is least intimidating;
the others come for free once it works in the first one.

## Next steps

- [SortableList example](/examples/sortable-list) — the canonical engine
  wrapper, full source + per-target output.
- [Flatpickr example](/examples/flatpickr) — simpler scalar two-way.
- [LineChart (Chart.js) example](/examples/line-chart) — deeply-nested
  reactivity + interval-driven updates.
- [Creature comforts](/guide/creature-comforts) — the full matrix of
  cross-framework normalizations.
- [Adopt incrementally](/guide/adopt-incrementally) — drop a wrapper
  into your existing apps.
