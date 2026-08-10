# Sources & layers

The declarative sources-and-layers sub-API of [`<MapLibre>`](/components/maplibre): the `:sources` / `:layers` config arrays, the `<Source>` / `<Layer>` children, hit-testing, and style-load timing.

## Declarative sources & layers via `:sources` / `:layers`

Add GeoJSON / vector / raster data and styled layers through the `:sources` and `:layers` props — MapLibre's own [source](https://maplibre.org/maplibre-style-spec/sources/) and [layer](https://maplibre.org/maplibre-style-spec/layers/) specs. The wrapper waits for the style to load, then reconciles them into the live style (add / update / remove); changing the bound arrays applies the diff with no remount:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';

const sources = ref([
  {
    id: 'route',
    spec: {
      type: 'geojson',
      data: { type: 'LineString', coordinates: [[-74.5, 40], [-74.0, 40.7]] },
    },
  },
]);
const layers = ref([
  { id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#e11', 'line-width': 3 } },
]);
</script>

<template>
  <MapLibre :center="[-74.25, 40.35]" :zoom="9" :sources="sources" :layers="layers" />
</template>
```

## Declarative `<Source>` / `<Layer>` children {#declarative-source-layer-children}

Sources and layers can also be authored as **declarative child components** — `<Source>` and `<Layer>` nested under `<MapLibre>`, the authoring shape the big-framework wrappers (`react-map-gl`, `vue-maplibre-gl`, `svelte-maplibre-gl`, `ngx-maplibre-gl`) are known for. Both shapes are supported, side by side with the `:sources` / `:layers` config arrays above:

```html
<MapLibre :center="[-74.25, 40.35]" :zoom="9">
  <Source id="pts" :spec="geojson">
    <Layer id="circles" type="circle" :paint="{ 'circle-radius': 5 }" />
  </Source>
  <Layer id="bg" type="background" :paint="{ 'background-color': '#eef' }" />
</MapLibre>
```

- **Nested `<Source><Layer/></Source>` auto-binds** the layer to its parent source via injected context — no `source` attr needed.
- **Flat `<Layer source="id" />`** directly under `<MapLibre>` also works, for background layers (no source) and cross-source references.
- **Both shapes coexist with `:sources` / `:layers`.** A config array and declarative children feed the **same id-keyed registry** through the same style-load-gated `addSource` / `addLayer` reconcile; on an id collision the declarative child wins (last-writer-wins, matching the engine's own reconcile).

`<Source>` takes `id` (required) plus `:spec` (the `SourceSpecification`); `<Layer>` takes `id` (required), `type`, `:paint` / `:layout`, an optional `source` (for the flat shape), and `beforeId` for draw order. This dogfoods Rozie's own [`$provide` / `$inject` cross-component context primitive](/guide/features) — the map provides the registry, each child injects it and registers on mount / updates on prop change / unregisters on unmount. The big incumbents still ship deeper component catalogs (see the [comparison page](/components/maplibre-comparison#declarative-children)) — Rozie's declarative children are a curated subset that works identically on all six targets.

## Hit-testing layer features

Set `:interactiveLayerIds` to the layer ids you want hover events on; `@mouseenter` / `@mouseleave` then fire with the hit `features` in the payload:

```vue
<MapLibre
  :sources="sources"
  :layers="layers"
  :interactive-layer-ids="['route-line']"
  @mouseenter="(e) => (hovered = e.features[0]?.id)"
  @mouseleave="() => (hovered = null)"
/>
```

## Sources & layers wait for the style to load

`addSource` / `addLayer` only work after the style has loaded. The wrapper gates the `:sources` / `:layers` reconcile on `isStyleLoaded()` (applying once the `load` event fires if needed), and re-applies them after a `mapStyle` change (a new style wipes imperatively-added sources / layers). You don't have to sequence this yourself — bind the arrays and the wrapper handles the timing.

## See also

- [MapLibre showcase & API](/components/maplibre): the `sources` / `layers` / `interactiveLayerIds` prop rows, the 20 events, and the imperative handle.
- [MapLibre libraries comparison](/components/maplibre-comparison#declarative-children): how the declarative-children subset compares to the big-framework wrappers.
