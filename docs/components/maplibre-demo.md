---
title: MapLibre — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';
import 'maplibre-gl/dist/maplibre-gl.css';

// A network-free MapLibre style — a solid background + a colored GeoJSON polygon
// (fill + line). No tile server, no token, no network: it renders identically
// here, offline, and in CI. (Verbatim from MapLibreScreenshotDemo.rozie, the
// deterministic screenshot cell.) The live `center`/`zoom` two-way binding below
// rides on top of it.
const OFFLINE_STYLE = {
  version: 8,
  sources: {
    demo: {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature', properties: {},
          geometry: { type: 'Polygon', coordinates: [[[-80, 40], [-74, 40], [-74, 35], [-80, 35], [-80, 40]]] },
        }],
      },
    },
  },
  layers: [
    { id: 'bg',   type: 'background', paint: { 'background-color': '#e5e3df' } },
    { id: 'fill', type: 'fill', source: 'demo', paint: { 'fill-color': '#0a84ff', 'fill-opacity': 0.6 } },
    { id: 'line', type: 'line', source: 'demo', paint: { 'line-color': '#0050a0', 'line-width': 2 } },
  ],
};

const map = ref();
const center = ref<[number, number]>([-77, 37.5]);
const zoom = ref(4);
</script>

# MapLibre — live demo

This is the **real `@rozie-ui/maplibre-vue` package** running on this page (VitePress is itself a Vue app) — driving an actual WebGL [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) map. Pan it, scroll to zoom, or use the controls below — the `[lng, lat]` / zoom readout updates live because the camera is **two-way bound**. Everything below is driven by the same `MapLibre.rozie` source that compiles to all six frameworks. The map uses a network-free offline style (a solid background + a colored GeoJSON polygon), so it needs **no tiles and no network**.

<ClientOnly>
<div class="map-live">
  <div class="map-live__controls">
    <button @click="zoom = Math.min(zoom + 1, 22)">Zoom in ＋</button>
    <button @click="zoom = Math.max(zoom - 1, 0)">Zoom out －</button>
    <span class="map-live__sep" />
    <button @click="map?.flyTo({ center: [-74.006, 40.7128], zoom: 9 })">Fly to New York</button>
    <button @click="map?.flyTo({ center: [-0.1276, 51.5072], zoom: 9 })">Fly to London</button>
    <button @click="map?.flyTo({ center: [2.3522, 48.8566], zoom: 9 })">Fly to Paris</button>
    <span class="map-live__sep" />
    <button class="map-live__primary" @click="center = [-77, 37.5]; zoom = 4">Reset ▸</button>
  </div>

  <div class="map-live__stage">
    <MapLibre
      ref="map"
      :map-style="OFFLINE_STYLE"
      v-model:center="center"
      v-model:zoom="zoom"
      style="width: 100%; height: 360px;"
    />
  </div>

  <div class="map-live__readout">
    <code>center [{{ center[0].toFixed(3) }}, {{ center[1].toFixed(3) }}] · zoom {{ zoom.toFixed(2) }}</code>
  </div>
</div>
</ClientOnly>

The camera is two-way bound with `v-model:center` and `v-model:zoom` — the readout above updates live as you pan and zoom, and the **Fly to** buttons drive the imperative handle (`flyTo`), while **Zoom in / out** and **Reset** mutate the bound state directly. Because the binding is two-way, a `flyTo()` echoes back into `center`/`zoom` and the readout tracks it — the round-trip is the whole point. `center` is `[lng, lat]` — **longitude first** (MapLibre's convention). See the [full API](/components/maplibre) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/maplibre/src/MapLibre.rozie{html}[MapLibre.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/maplibre-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/maplibre/packages/react/src/MapLibre.tsx[React]
<<< ../../packages/ui/maplibre/packages/vue/src/MapLibre.vue[Vue]
<<< ../../packages/ui/maplibre/packages/svelte/src/MapLibre.svelte[Svelte]
<<< ../../packages/ui/maplibre/packages/angular/src/MapLibre.ts[Angular]
<<< ../../packages/ui/maplibre/packages/solid/src/MapLibre.tsx[Solid]
<<< ../../packages/ui/maplibre/packages/lit/src/MapLibre.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component with `model()` signals, a Solid component, and a Lit custom element. Same props, same 20 events, same eight-verb imperative handle, same reactive `marker` / `popup` / `control` portal slots, all from the one source above.

## See also

- [MapLibre — showcase & API](/components/maplibre) — install, quick starts for all six frameworks, the 20 events, the four two-way camera bindings, the imperative handle, and the portal slots.
- [MapLibre libraries comparison](/components/maplibre-comparison) — how `@rozie-ui/maplibre` stacks up against the per-framework wrappers (and the Solid / Lit gap it closes).

<style scoped>
.map-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.map-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.map-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.map-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.map-live__controls button.map-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.map-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.map-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  overflow: hidden;
}
.map-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
</style>
