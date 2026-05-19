<script setup>
import { ref } from 'vue';
import PortalListDemo from '../../examples/demos/PortalListDemo.rozie';
</script>

# PortalList

The portal-slot primitive in action. `PortalList.rozie` ships a tiny inline vanilla-JS "engine" (`MiniListEngine`) that owns per-row `<li>` containers but delegates per-row CONTENT rendering to a portal slot. `PortalListDemo.rozie` fills the `#item` slot with `<template #item="{ item }">…</template>` and the per-target compiler routes the consumer's fragment through each framework's standard imperative-render API (React `createRoot`, Vue `render(h(...), container)`, Svelte `mount()`, Angular `vcr.createEmbeddedView`, Solid `render`, Lit `render`).

**This is the cross-framework "foreign-engine cell rendering" pattern.** Portal slots are what unlock wrappers like FullCalendar (`eventContent`), AG-Grid (`cellRenderer`), Swiper (slide content), and TipTap (custom node views) — every engine whose plugin contract is "give us a callback that returns DOM, we'll mount it where we want." Rozie's `<slot name="X" portal />` + `$portals.X(container, scope) => disposeFn` shape is the cross-target equivalent of each official wrapper's per-framework portal mechanism (FullCalendar/React uses `createPortal`, FullCalendar/Vue uses `<Teleport>`, FullCalendar/Svelte uses `mount`, FullCalendar/Angular uses `ViewContainerRef`).

## Live demo

The PortalList below is the actual `examples/PortalList.rozie` + `examples/demos/PortalListDemo.rozie` files from the monorepo, compiled via `@rozie/unplugin/vite` at build time. The colored swatches, monospaced ids, and bold labels all come from the consumer's `<template #item>` filler — but the surrounding `<ul>` and per-row `<li>` are owned by the wrapper's inline `MiniListEngine`. **Open the dev tools and inspect the DOM:** each row is a `<li class="mini-list__row">` wrapping a `<div class="mini-list__cell">`, and the `<div>` was filled by mounting the consumer's framework-native fragment imperatively.

<div class="rozie-demo">
  <ClientOnly>
    <PortalListDemo />
  </ClientOnly>
</div>

## Why portal slots exist

Rozie's ordinary scoped slots compile to each target's native slot mechanism — Vue's `<slot>`, React's `children` prop, Svelte's `{@render}`, Angular's `<ng-template>`, etc. Native slots can only render INSIDE the framework's own template tree. They can NOT be invoked imperatively from inside a foreign engine's callback like `cellRenderer(item) => DOM`.

Portal slots solve the gap by exposing the same `<slot name="X" />` authoring surface to the consumer but routing the producer-side invocation through each target's `imperative render → returned dispose handle` API. Authors write one wrapper; consumers fill it with `<template #X>` the same way they fill any other named slot.

::: tip V1 reactivity constraint
Portal slots are NOT reactive after mount in v1. They re-render only when the wrapper's script re-invokes them — which is how real engine callbacks behave anyway (FullCalendar re-calls `eventContent` when the event data changes; AG-Grid re-calls `cellRenderer` when the row updates). A reactive variant that subscribes to scope changes is a post-v1 evolution.
:::

::: tip Styling engine-owned DOM
The `MiniListEngine` styles its row containers and `<ul>` via inline `el.style.foo = …` assignments rather than referencing classes from the wrapper's `<style>` block. The reason: every target scopes the wrapper's CSS — React/Solid via CSS Modules hashed class names, Vue/Svelte/Angular via attribute-selector rewrites bound to declared template elements. Engine-created elements are NOT in the static template, so the scoped class names / attribute selectors never reach them. Inline styles bypass scoping uniformly across all 6 targets, which is the portable contract for engines that own their own DOM. The consumer's `<template #item>` content still flows through normal scoped CSS — that's the slot author's surface.
:::

::: tip Lit consumer-side bridge — CLOSED 2026-05-19 (Phase 07.5)
Phase 07.5 closed the Lit consumer-side portal-slot bridge. `emitSlotFiller` (Lit) now branches on producer-side `SlotDecl.isPortal === true` (and on scoped slots whose consumer destructures scope params) and emits the fill as `<rozie-foo .item=${(scope) => html\`…\`}>` function-prop form on the parent component's open tag — exactly the shape the producer's portal closure expects. The producer-side companion change in `emitSlot` (commit `6fce2de`, CR-01 fix) wraps the slot output in `${this.<X> !== undefined ? this.<X>({…scope…}) : html\`<slot…>fallback</slot>\`}` so the consumer's function actually fires at render time. `LIT_PORTAL_GAP` was removed from `tests/visual-regression/specs/portal-list.spec.ts`; the Lit cell now renders the consumer's fragments inside the engine-owned containers like the other 5 targets. Dynamic-slot-name dispatch was carved into a follow-up Phase 07.6 — see `07.5-CARVE.md` for the architectural rationale.
:::

## Authoring surface
The PortalList wrapper boils down to three pieces. The `<template>` block declares the portal slot:

```rozie
<template>
<div class="rozie-portal-list">
  <slot name="item" portal :params="['item']" />
</div>
</template>
```

The `<script>` block invokes the slot from inside the engine's per-cell callback:

```rozie
$onMount(() => {
  instance = new MiniListEngine($el, {
    items: $props.items,
    cellRenderer: (item) => {
      const node = document.createElement('div')
      const dispose = $portals.item(node, { item })
      return { node, dispose }
    },
  })
  return () => instance?.destroy()
})
```

And the consumer-side fill looks identical to any other scoped slot fill:

```rozie
<PortalList :items="$data.items">
  <template #item="{ item }">
    <span :style="'background: ' + item.color"></span>
    <code>#{{ item.id }}</code>
    <strong>{{ item.label }}</strong>
  </template>
</PortalList>
```

## What the compiler does per target

Each target gets a `portals` closure synthesized inside the mount-phase lifecycle hook plus a dispose-tracking `Set` hoisted at component scope:

| Target  | Mount API                                  | Closure lives in       | Bulk dispose runs in      |
| ------- | ------------------------------------------ | ---------------------- | ------------------------- |
| React   | `createRoot(c).render(slot(scope))`        | `useEffect` body       | `useEffect` cleanup       |
| Vue     | `render(h('div', null, slot(scope)), c)`   | `<script setup>` top   | `onBeforeUnmount`         |
| Svelte 5| `mount(PortalHost, { target: c, props })`  | `<script lang="ts">` top | `$effect` cleanup       |
| Angular | `vcr.createEmbeddedView(tplRef, scope)`    | `ngAfterViewInit` body | `DestroyRef.onDestroy`    |
| Solid   | `render(() => slot(scope), c)`             | Component body top     | `onCleanup`               |
| Lit     | `render(slot(scope), c)`                   | `firstUpdated` body    | `disconnectedCallback`    |

All six targets dispose every active portal mount BEFORE destroying the engine in cleanup order — otherwise we'd be unmounting framework trees from already-detached containers. The Svelte 5 case ships a small `PortalHost` Snippet→Component shim from `@rozie/runtime-svelte` because Svelte 5's `mount()` requires a Component, not a Snippet.

## Source — PortalList.rozie

```rozie-src PortalList
```

## Source — PortalListDemo.rozie

```rozie-src PortalListDemo
```

## Vue output

```rozie-out PortalList vue
```

## React output

```rozie-out PortalList react
```

## Svelte output

```rozie-out PortalList svelte
```

## Angular output

```rozie-out PortalList angular
```

## Solid output

```rozie-out PortalList solid
```

## Lit output

```rozie-out PortalList lit
```
