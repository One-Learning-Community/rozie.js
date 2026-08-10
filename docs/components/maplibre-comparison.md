---
surface_hash: 5b198fe4fe61
---

# MapLibre libraries comparison

How `@rozie-ui/maplibre` compares to the existing per-framework [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) wrappers. MapLibre GL is the open-source (BSD-3) WebGL map engine — the community fork of Mapbox GL JS v1 — and it is framework-agnostic: every wrapper exists only to glue reactive state to the imperative `Map`, render markers / popups / controls as framework components, and forward the event set. The result is an uneven ecosystem: deep React, solid Vue / Svelte / Angular, a thin-and-stale Solid story, and effectively no Lit wrapper at all. Rozie delivers the same idiomatic map component, with the same props, events, two-way camera, and handle, on all six frameworks as pre-compiled per-framework packages.

> Research snapshot: 2026-08-10. Versions and the wrapper landscape move; treat them as of that date.

## The wrappers at a glance

| Wrapper | Package | Latest | Maintainer | Depth | Markers / popups | Solid / Lit reach |
| --- | --- | --- | --- | :---: | :---: | :---: |
| **React** | `react-map-gl` / `@vis.gl/react-maplibre` | 8.1.2 | vis.gl (OpenJS / Urban Computing Foundation) | **deep** | ✅ `<Marker>` / `<Popup>` | — |
| **Vue** | `@indoorequal/vue-maplibre-gl` | 9.0.1 | indoorequal | **deep** | ✅ `MglMarker` / `MglPopup` | — |
| **Svelte** | `svelte-maplibre-gl` (MIERUNE, Svelte 5 runes) | 2.2.0 | MIERUNE | **deep** | ✅ `<Marker>` / `<Popup>` | — |
| **Angular** | `@maplibre/ngx-maplibre-gl` (official org) | 22.1.0 | MapLibre org | **deep** | ✅ `mgl-marker` / `mgl-popup` | — |
| **Solid** | `solid-maplibre` | 0.5.0 (npm 2025-03) | community | **thin** | ⚠️ partial / sparse docs | low adoption, stale |
| **Lit** | `@trailstash/maplibre-component` | 1.0.1 (2024) | community | **minimal** | ❌ none | a single thin `<map-libre>` element |
| **Rozie** | `@rozie-ui/maplibre-*` | pre-1.0 | One Learning Community | **deep** | ✅ `marker` / `popup` reactive portal slots (all 6) | ✅ full surface on both Solid and Lit |

On its home framework each of the four big wrappers is a solid pick. The case for Rozie is the two underserved targets: Solid's only dedicated wrapper (`solid-maplibre`) is stale (last npm publish 2025-03), low-adoption, and sparsely documented, while the more mature `solid-map-gl` is Mapbox-first rather than a clean MapLibre wrapper; Lit / web components have no real option (the only named package, `@trailstash/maplibre-component`, is a single thin `<map-libre>` element with no declarative markers / popups / sources / layers, last touched 2024). Rozie ships Solid and Lit the same full-surface wrapper the four big frameworks get.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported / not present · **⚠️** = partial / consumer-glue-required / thin.

| Capability | `react-map-gl` | `vue-maplibre-gl` | `ngx-maplibre-gl` | `svelte-maplibre-gl` | `solid-maplibre` | Lit (none) | **`@rozie-ui/maplibre`** |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Mount map | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ |
| **Two-way camera** (center / zoom / bearing / pitch) | ✅ controlled `viewState` | ✅ `v-model` (4) | ✅ inputs + outputs | ✅ `bind:` (4) | ⚠️ | hand-roll | ✅ 4 `r-model` props (echo-guarded) |
| Full event set | ✅ | ✅ | ✅ | ✅ | ⚠️ | hand-roll | ✅ 20 structured events |
| **Markers** (framework component) | ✅ `<Marker>` | ✅ `MglMarker` | ✅ `mgl-marker` | ✅ `<Marker>` | ⚠️ | ❌ | ✅ `marker` reactive portal slot (all 6) |
| **Popups** (framework component) | ✅ `<Popup>` | ✅ `MglPopup` | ✅ `mgl-popup` | ✅ `<Popup>` | ⚠️ | ❌ | ✅ `popup` reactive portal slot (all 6) |
| Custom control (framework component) | ✅ `useControl` | ✅ `MglCustomControl` | ✅ control directives | ✅ | ⚠️ | ❌ | ✅ `control` mount-once portal slot (all 6) |
| Standard controls | ✅ | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ `:controls` prop (all 6) |
| Sources / layers | ✅ `<Source>` / `<Layer>` | ✅ `MglGeoJSONSource` / `Mgl…Layer` | ✅ source / layer directives | ✅ `<Source>` / `<Layer>` | ⚠️ | ❌ | ✅ `<Source>` / `<Layer>` children **and** `:sources` / `:layers` config props (see below) |
| Interactive-layer hover (`features`) | ✅ `interactiveLayerIds` | ✅ | ✅ | ✅ | ⚠️ | ❌ | ✅ `:interactiveLayerIds` + `@mouseenter`/`@mouseleave` |
| Imperative handle (`getMap` etc.) | ✅ `useMap` / ref | ✅ `useMap` | ✅ `MapService` / ref | ✅ | ⚠️ | hand-roll | ✅ uniform `$expose` handle |
| TypeScript | ✅ | ✅ | ✅ | ✅ | ⚠️ | — | ✅ |
| Same API on all 6 frameworks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Where Rozie wins today

- **First-class packages for all six frameworks**, including the two the ecosystem underserves: Solid (thin / stale `solid-maplibre`, or the Mapbox-first `solid-map-gl`) and Lit (no real wrapper). A Solid dev today fights a sparsely-documented, low-adoption package; a Lit dev hand-rolls everything around a bare `<map-libre>` element.
- **Framework-native markers & popups on all six.** The `marker` / `popup` reactive multi-instance portal slots render a real framework fragment (any component, any reactivity) as a map marker / popup, reconciled keep / update / dispose off the `markers` / `popups` data arrays. This is exactly the capability `solid-maplibre` is thin on and Lit lacks entirely; on Solid and Lit it works the same as on the big four.
- **Two-way camera out of the box on all six.** Four `r-model` props (`center` / `zoom` / `bearing` / `pitch`) with a built-in echo-guard (the `eventData` marker that survives batched camera ops). `center` is `[lng, lat]`, MapLibre's convention.
- **A uniform event surface** with structured pointer payloads (`{ lngLat, point, features, originalEvent }`), identical on every target, instead of each wrapper's own event idiom.
- **A uniform imperative handle** (`getMap`, `flyTo`, `fitBounds`, `project` / `unproject`, `queryRenderedFeatures`, and more) grabbed with each framework's native ref, versus however each wrapper happens to expose the `Map` (a hook, a service, a ref, a directive input). And `getMap()` is always one hop from the raw engine, so the full MapLibre API is reachable on any target when the curated surface doesn't cover something. The full handle table is in the [showcase](/components/maplibre).

## Declarative `<Source>` / `<Layer>` children {#declarative-children}

Sources and layers can be authored as declarative `<Source>` / `<Layer>` children on all six targets, alongside the `:sources` / `:layers` config-array props — the authoring shape the big-framework wrappers (`react-map-gl`, `vue-maplibre-gl`, `svelte-maplibre-gl`, `ngx-maplibre-gl`) are known for. Nested `<Source><Layer/></Source>` auto-binds the layer to its parent source, flat `<Layer source="id" />` works for background and cross-source layers, and both shapes feed the same id-keyed, style-load-gated registry as the config arrays. The [showcase documents the full recipe](/components/maplibre-sources-layers#declarative-source-layer-children).

## What Rozie defers {#what-rozie-defers}

- **Big-framework depth on the home framework.** `react-map-gl` (vis.gl, OpenJS-foundation-backed), `vue-maplibre-gl`, `svelte-maplibre-gl` (MIERUNE), and the official `ngx-maplibre-gl` are mature, multi-year libraries with deep component catalogs (terrain, globe / projection, geocoding integrations, draw plugins, and the full declarative children model). On their own framework, they expose more surface than Rozie's curated prop set. Rozie's value is the same idiomatic component on all six frameworks, with the underserved Solid and Lit getting a first-class wrapper they otherwise lack. For anything outside the curated surface, `getMap()` hands you the raw engine on every target.

- **`@rozie-ui/maplibre` is pre-1.0.** The surface is stable and gate-verified, but it is younger than the multi-year incumbents. The full prop, event, handle, and slot tables live in the [showcase + API reference](/components/maplibre).

## Try it

The [`@rozie-ui/maplibre` showcase + API reference](/components/maplibre) documents the `@rozie-ui/maplibre-*` packages — one pre-compiled, per-framework install (`npm i @rozie-ui/maplibre-react maplibre-gl`, etc.), plus the `import 'maplibre-gl/dist/maplibre-gl.css'` the engine DOM needs. The showcase walks the four two-way camera bindings, the 20-event surface, the imperative handle, both the `<Source>` / `<Layer>` declarative children and the `:sources` / `:layers` config-array passthroughs, and the per-target recipe for the `marker` / `popup` / `control` portal slots.

## Cross-references

- [MapLibre — showcase & API](/components/maplibre) — the full `@rozie-ui/maplibre` surface, quick starts, and recipes.
- [`MapLibre.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/src/MapLibre.rozie)
- [The portal-slot primitive](/examples/portal-list) — the mechanism the `marker` / `popup` reactive slots build on.
