# MapLibre libraries comparison

How `@rozie-ui/maplibre` compares to the existing per-framework [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) wrappers. MapLibre GL is the open-source (BSD-3) WebGL map engine — the community fork of Mapbox GL JS v1 — and it is framework-agnostic: every wrapper exists only to glue reactive state to the imperative `Map`, render markers / popups / controls as framework components, and forward the event set. The result is an **uneven ecosystem**: deep React, solid Vue / Svelte / Angular, a **thin-and-stale Solid story, and effectively no Lit wrapper at all**. Rozie ships one source to all six.

> Research snapshot: 2026-06-07. Versions and the wrapper landscape move; treat them as of that date.

## The wrappers at a glance

| Wrapper | Package | Latest | Maintainer | Depth | Markers / popups | Solid / Lit reach |
| --- | --- | --- | --- | :---: | :---: | :---: |
| **React** | `react-map-gl` / `@vis.gl/react-maplibre` | 8.1.1 | vis.gl (OpenJS / Urban Computing Foundation) | **deep** | ✅ `<Marker>` / `<Popup>` | — |
| **Vue** | `@indoorequal/vue-maplibre-gl` | 8.4.2 | indoorequal | **deep** | ✅ `MglMarker` / `MglPopup` | — |
| **Svelte** | `svelte-maplibre-gl` (MIERUNE, Svelte 5 runes) | 2.0.1 | MIERUNE | **deep** | ✅ `<Marker>` / `<Popup>` | — |
| **Angular** | `@maplibre/ngx-maplibre-gl` (official org) | 21.0.2 | MapLibre org | **deep** | ✅ `mgl-marker` / `mgl-popup` | — |
| **Solid** | `solid-maplibre` | 0.5.0 (npm 2025-03) | community | **thin** | ⚠️ partial / sparse docs | low adoption, stale |
| **Lit** | `@trailstash/maplibre-component` | 1.0.1 (2024) | community | **minimal** | ❌ none | a single thin `<map-libre>` element |
| **Rozie** | `@rozie-ui/maplibre-*` | 0.1.0 | One Learning Community | **deep** | ✅ `marker` / `popup` reactive portal slots (all 6) | ✅ category-leading Solid + first-to-market Lit |

The four big-framework wrappers above are **excellent, mature libraries** — for a single-React, single-Vue, single-Svelte, or single-Angular app, each is the obvious pick, and Rozie does not claim to out-feature them on their home framework. The wedge is the **two underserved targets**: Solid's only dedicated wrapper (`solid-maplibre`) is stale (last npm publish 2025-03), low-adoption, and sparsely documented — the more mature `solid-map-gl` is Mapbox-first, not a clean MapLibre wrapper — and Lit / web-components has **no real option** (the only named package, `@trailstash/maplibre-component`, is a single thin `<map-libre>` element with no declarative markers / popups / sources / layers, last touched 2024). Rozie gives **Solid a category-leading wrapper and Lit a first-to-market one** — from the same source that produces the four idiomatic big-framework packages.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-glue-required / thin.

| Capability | `react-map-gl` | `vue-maplibre-gl` | `ngx-maplibre-gl` | `svelte-maplibre-gl` | `solid-maplibre` | Lit (none) | **`@rozie-ui/maplibre`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount map | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ |
| **Two-way camera** (center / zoom / bearing / pitch) | ✅ controlled `viewState` | ✅ `v-model` (4) | ✅ inputs + outputs | ✅ `bind:` (4) | ⚠️ | hand-roll | ✅ 4 `r-model` props (echo-guarded) |
| Full event set | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ 22 structured events |
| **Markers** (framework component) | ✅ `<Marker>` | ✅ `MglMarker` | ✅ `mgl-marker` | ✅ `<Marker>` | ⚠️ | ❌ | ✅ `marker` reactive portal slot (all 6) |
| **Popups** (framework component) | ✅ `<Popup>` | ✅ `MglPopup` | ✅ `mgl-popup` | ✅ `<Popup>` | ⚠️ | ❌ | ✅ `popup` reactive portal slot (all 6) |
| Custom control (framework component) | ✅ `useControl` | ✅ `MglCustomControl` | ✅ control directives | ✅ | ⚠️ | ❌ | ✅ `control` mount-once portal slot (all 6) |
| Standard controls | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ `:controls` prop (all 6) |
| Sources / layers | ✅ `<Source>` / `<Layer>` | ✅ `MglGeoJSONSource` / `Mgl…Layer` | ✅ source / layer directives | ✅ `<Source>` / `<Layer>` | ⚠️ | ❌ | ⚠️ **`:sources` / `:layers` config props** (see below) |
| Interactive-layer hover (`features`) | ✅ `interactiveLayerIds` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ `:interactiveLayerIds` + `@mouseenter`/`@mouseleave` |
| Imperative handle (`getMap` etc.) | ✅ `useMap` / ref | ✅ `useMap` | ✅ `MapService` / ref | ✅ | ⚠️ | hand-roll | ✅ uniform 8-verb `$expose` |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| One source → all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **One definition, six idiomatic packages** — including the two frameworks the ecosystem underserves: **Solid (thin / stale `solid-maplibre`, or the Mapbox-first `solid-map-gl`)** and **Lit (no real wrapper)**. A Solid dev today fights a sparsely-documented, low-adoption package; a Lit dev hand-rolls everything around a bare `<map-libre>` element.
- **Framework-native markers & popups on all six** — the `marker` / `popup` **reactive multi-instance portal slots** render a real framework fragment (any component, any reactivity) as a map marker / popup, reconciled keep / update / dispose off the `markers` / `popups` data arrays. This is exactly the capability `solid-maplibre` is thin on and Lit lacks entirely: **Solid and Lit consumers get real, reactive marker / popup content they otherwise can't have**, from the same source.
- **Two-way camera out of the box on all six** — four `r-model` props (`center` / `zoom` / `bearing` / `pitch`) with a built-in echo-guard (the `eventData` marker that survives batched camera ops). `center` is `[lng, lat]`, MapLibre's convention.
- **A uniform 22-event surface** with structured pointer payloads (`{ lngLat, point, features, originalEvent }`) — identical on every target, instead of each wrapper's own event idiom.
- **A uniform 8-verb imperative handle** (`getMap` / `flyTo` / `easeTo` / `jumpTo` / `fitBounds` / `getCenter` / `getZoom` / `resize`) grabbed with each framework's native ref — versus "however this wrapper happens to expose the `Map`" (a hook, a service, a ref, a directive input).
- **`getMap()` is always one hop from the raw engine**, so the full MapLibre API is reachable on any target when the curated surface doesn't cover something.

## What Rozie defers {#what-rozie-defers}

This page concedes where the standalone wrappers are genuinely ahead — that's what keeps the comparison credible, and it doubles as Rozie's own roadmap.

- **Declarative `<Source>` / `<Layer>` *children*.** `react-map-gl`, `vue-maplibre-gl`, `svelte-maplibre-gl`, and `ngx-maplibre-gl` all let you compose data sources and styled layers as **child components / directives** inside the map — `<Source><Layer /></Source>` and friends. Rozie v1 takes a different authoring shape: the **`:sources` / `:layers` config props** (MapLibre's own source / layer specs, reconciled into the live style after load). It is the **same `addSource` / `addLayer` runtime** and reaches the same result, but the authoring model is a config array, not nested children. True declarative source / layer children need a **cross-component context primitive** (a parent map providing context to descendant `<Source>` / `<Layer>` elements) that Rozie deliberately defers — it's a meaningful compiler primitive, not a quick wrapper feature. Until then, `:sources` / `:layers` cover the same ground in config form.

- **Big-framework depth on the home framework.** `react-map-gl` (vis.gl, OpenJS-foundation-backed), `vue-maplibre-gl`, `svelte-maplibre-gl` (MIERUNE), and the official `ngx-maplibre-gl` are mature, multi-year libraries with deep component catalogs (terrain, globe / projection, geocoding integrations, draw plugins, and the full declarative children model). On their own framework, they expose more surface than Rozie's curated prop set. Rozie's value is **not** "more than react-map-gl on React" — it's the **same idiomatic component on all six frameworks from one source**, with the underserved **Solid and Lit** getting a first-class wrapper they otherwise lack. For anything outside the curated surface, `getMap()` hands you the raw engine on every target.

- **`@rozie-ui/maplibre` is `0.1.0`.** The surface (25 props / 22 events / 8-verb handle / `marker` + `popup` reactive slots + `control` mount-once slot) is stable and gate-verified, but it is younger than the multi-year incumbents.

## Try it

The [`@rozie-ui/maplibre` showcase + API reference](/guide/maplibre) documents the `@rozie-ui/maplibre-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/maplibre-react maplibre-gl`, etc.), plus the `import 'maplibre-gl/dist/maplibre-gl.css'` the engine DOM needs. The showcase walks the four two-way camera bindings, the 22-event surface, the imperative handle, the `:sources` / `:layers` passthroughs, and the per-target recipe for the `marker` / `popup` / `control` portal slots.

## Cross-references

- [MapLibre — showcase & API](/guide/maplibre) — the full `@rozie-ui/maplibre` surface, quick starts, and recipes.
- [`MapLibre.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/src/MapLibre.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `marker` / `popup` reactive slots build on.
