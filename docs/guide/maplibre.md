# MapLibre — the cross-framework interactive map

`MapLibre` is Rozie's data-bound port of [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) — the open-source (BSD-3) WebGL map engine, the community fork of Mapbox GL JS v1. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. The per-framework ecosystem is **uneven**: [react-map-gl / @vis.gl/react-maplibre](https://visgl.github.io/react-map-gl/) is deep, [@indoorequal/vue-maplibre-gl](https://indoorequal.github.io/vue-maplibre-gl/), [svelte-maplibre-gl](https://svelte-maplibre-gl.mierune.dev/) and [@maplibre/ngx-maplibre-gl](https://maplibre.org/ngx-maplibre-gl/) are solid — but **Solid has only a stale/Mapbox-first option and Lit has no real wrapper at all**. Rozie collapses all six into one source, and Solid + Lit get a category-leading wrapper for free. See the [MapLibre libraries comparison](/guide/maplibre-comparison) for the full per-framework matrix.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the 22 map events, the four two-way camera bindings, the imperative handle, the consumer-extensible `:sources` / `:layers` / `:options` passthroughs, and the per-target recipe for the reactive `marker` / `popup` portal slots and the mount-once `control` slot.

The full source for `MapLibre.rozie` lives in the [`@rozie-ui/maplibre` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/src/MapLibre.rozie).

## The `@rozie-ui/maplibre` packages

`MapLibre` ships as six pre-compiled, per-framework packages generated from a single `MapLibre.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/maplibre-react` | `npm i @rozie-ui/maplibre-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/react/README.md) |
| `@rozie-ui/maplibre-vue` | `npm i @rozie-ui/maplibre-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/vue/README.md) |
| `@rozie-ui/maplibre-svelte` | `npm i @rozie-ui/maplibre-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/svelte/README.md) |
| `@rozie-ui/maplibre-angular` | `npm i @rozie-ui/maplibre-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/angular/README.md) |
| `@rozie-ui/maplibre-solid` | `npm i @rozie-ui/maplibre-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/solid/README.md) |
| `@rozie-ui/maplibre-lit` | `npm i @rozie-ui/maplibre-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/packages/lit/README.md) |

Each package carries the **`maplibre-gl` engine peer** (`^5`) plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). Install the engine peer alongside the framework package:

```bash
npm i @rozie-ui/maplibre-react maplibre-gl
```

You must **import the engine CSS once** at your app entry. The component's scoped `<style>` cannot reach the engine-rendered control / popup / marker DOM (that DOM never carries Rozie's `[data-rozie-s-*]` scope attribute), so the base MapLibre styles come from the engine's own stylesheet:

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

…or `<link>` the CDN copy in your `index.html`. Anything the curated prop surface doesn't special-case (custom data sources, styled layers, the full `MapOptions` bag) comes through the first-class `:sources` / `:layers` / `:options` passthroughs — MapLibre's own config shapes. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `MapLibre.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

The camera is two-way bound across **four** model props — `center`, `zoom`, `bearing`, and `pitch`. Panning or zooming the map writes the new camera back through those model paths (echo-guarded so a programmatic move doesn't ping-pong); a consumer write reflects into the live map. **`center` is `[lng, lat]` — longitude FIRST** (MapLibre's convention, *not* Leaflet's `[lat, lng]`). The map style comes through `:map-style` (the prop is `mapStyle`, **not** `style` — a reserved attribute across the targets).

### React

```tsx
import { useState } from 'react';
import { MapLibre } from '@rozie-ui/maplibre-react';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Demo() {
  const [center, setCenter] = useState<[number, number]>([-74.5, 40]);
  const [zoom, setZoom] = useState(9);
  return (
    <div style={{ height: 400 }}>
      <MapLibre
        center={center}
        onCenterChange={setCenter}
        zoom={zoom}
        onZoomChange={setZoom}
        controls={['navigation', 'scale']}
        onClick={(e) => console.log(e.lngLat)}
      />
    </div>
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';
import 'maplibre-gl/dist/maplibre-gl.css';

const center = ref<[number, number]>([-74.5, 40]);
const zoom = ref(9);
</script>

<template>
  <div style="height: 400px">
    <MapLibre
      v-model:center="center"
      v-model:zoom="zoom"
      :controls="['navigation', 'scale']"
      @click="(e) => console.log(e.lngLat)"
    />
  </div>
</template>
```

### Svelte

```svelte
<script lang="ts">
  import MapLibre from '@rozie-ui/maplibre-svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let center = $state<[number, number]>([-74.5, 40]);
  let zoom = $state(9);
</script>

<div style="height: 400px">
  <MapLibre
    bind:center
    bind:zoom
    controls={['navigation', 'scale']}
    onclick={(e) => console.log(e.lngLat)}
  />
</div>
```

### Angular

```ts
import { Component } from '@angular/core';
import { MapLibre } from '@rozie-ui/maplibre-angular';
// Add 'maplibre-gl/dist/maplibre-gl.css' to your global styles.

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [MapLibre],
  template: `
    <div style="height: 400px">
      <MapLibre
        [(center)]="center"
        [(zoom)]="zoom"
        [controls]="['navigation', 'scale']"
        (click)="onClick($event)"
      />
    </div>
  `,
})
export class DemoComponent {
  center: [number, number] = [-74.5, 40];
  zoom = 9;
  onClick(e: any) { console.log(e.lngLat); }
}
```

### Solid

```tsx
import { createSignal } from 'solid-js';
import { MapLibre } from '@rozie-ui/maplibre-solid';
import 'maplibre-gl/dist/maplibre-gl.css';

export function Demo() {
  const [center, setCenter] = createSignal<[number, number]>([-74.5, 40]);
  const [zoom, setZoom] = createSignal(9);
  return (
    <div style={{ height: '400px' }}>
      <MapLibre
        center={center()}
        onCenterChange={setCenter}
        zoom={zoom()}
        onZoomChange={setZoom}
        controls={['navigation', 'scale']}
        onClick={(e) => console.log(e.lngLat)}
      />
    </div>
  );
}
```

### Lit

```ts
import '@rozie-ui/maplibre-lit';
import 'maplibre-gl/dist/maplibre-gl.css';

// <rozie-map-libre> is a custom element. Bind `center`/`zoom` as properties
// and listen for `center-change`/`zoom-change` (the two-way change channels).
const el = document.querySelector('rozie-map-libre');
el.center = [-74.5, 40];
el.zoom = 9;
el.controls = ['navigation', 'scale'];
el.addEventListener('center-change', (e) => { el.center = e.detail; });
el.addEventListener('click', (e) => console.log(e.detail.lngLat));
```

## API

### Props

The four camera props (`center` / `zoom` / `bearing` / `pitch`) are **two-way** (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onXChange`). All props except the construction-only `bounds` and `fitBoundsOptions` reconcile into the live map on change — no remount.

| Name | Type | Default | Two-way (model) | Description |
| --- | --- | --- | :---: | --- |
| `center` | `Array` | `[…]` | ✓ | The map center as `[lng, lat]` — **longitude first** (MapLibre's convention, not Leaflet's `[lat, lng]`). Two-way: panning the map writes the new center back through the model path (echo-guarded); a consumer write `easeTo`s the live map. The `moveend` echo reads `getCenter()` as `[lng, lat]`. |
| `zoom` | `Number` | `1` | ✓ | The zoom level. Two-way: scroll / pinch writes the new zoom back; a consumer write `easeTo`s the camera. Echo-guarded against the wrapper's own programmatic moves. |
| `bearing` | `Number` | `0` | ✓ | The map rotation (bearing) in degrees. Two-way via the `rotateend` echo / `easeTo` reconcile. |
| `pitch` | `Number` | `0` | ✓ | The map tilt (pitch) in degrees. Two-way via the `pitchend` echo / `easeTo` reconcile. |
| `mapStyle` | `unknown` | `"https://demotiles.maplibre.org/style.json"` | | The map style — a [StyleSpecification](https://maplibre.org/maplibre-style-spec/) object **or** a style-URL string. Named `mapStyle` (not `style`) because `style` is a reserved attribute across the targets — `react-map-gl` and `vue-maplibre-gl` use the same name for the same reason. Defaults to MapLibre's official no-token demo tiles, so the component "just works" with zero config. Changing it calls `setStyle` and re-applies your `:sources` / `:layers` once the new style loads. |
| `minZoom` | `Number` | `undefined` | | Minimum zoom level. Applied at construction and via `setMinZoom` on change. |
| `maxZoom` | `Number` | `undefined` | | Maximum zoom level. Applied at construction and via `setMaxZoom` on change. |
| `maxBounds` | `unknown` | `undefined` | | A [`LngLatBoundsLike`](https://maplibre.org/maplibre-gl-js/docs/API/types/LngLatBoundsLike/) the camera is constrained to. Applied via `setMaxBounds` on change (pass `undefined` to clear). |
| `bounds` | `unknown` | `undefined` | | **Construction-only** initial fit — a `LngLatBoundsLike` the map fits to on mount (overrides `center` / `zoom` when set). Pair with `fitBoundsOptions`. |
| `fitBoundsOptions` | `Object` | `undefined` | | **Construction-only** options for the initial `bounds` fit (padding, max-zoom, etc.). |
| `dragPan` | `Boolean` | `true` | | Toggle drag-to-pan. Applied at construction and reconciled live via the handler's `enable()` / `disable()`. |
| `dragRotate` | `Boolean` | `true` | | Toggle right-drag / ctrl-drag rotation. Live-reconciled. |
| `scrollZoom` | `Boolean` | `true` | | Toggle scroll-wheel zoom. Live-reconciled. |
| `doubleClickZoom` | `Boolean` | `true` | | Toggle double-click zoom. Live-reconciled. |
| `boxZoom` | `Boolean` | `true` | | Toggle shift-drag box zoom. Live-reconciled. |
| `keyboard` | `Boolean` | `true` | | Toggle keyboard navigation. Live-reconciled. |
| `touchZoomRotate` | `Boolean` | `true` | | Toggle touch pinch-zoom + rotate. Live-reconciled. |
| `touchPitch` | `Boolean` | `true` | | Toggle two-finger touch pitch. Live-reconciled. |
| `markers` | `Array` | `[]` | | The marker data that drives the reactive multi-instance `marker` slot — one entry per marker (`{ lng, lat, id?, anchor?, offset?, draggable?, ... }`). One portal handle mounts per entry; changing the array reconciles markers keep / update / dispose with no remount. Only meaningful when the `marker` slot is filled. |
| `popups` | `Array` | `[]` | | The popup data that drives the reactive multi-instance `popup` slot — one entry per popup (`{ lng, lat, id?, anchor?, offset?, closeButton?, closeOnClick?, ... }`). One portal handle mounts per entry. Only meaningful when the `popup` slot is filled. |
| `sources` | `Array` | `[]` | | Declarative [GeoJSON / vector / raster sources](https://maplibre.org/maplibre-style-spec/sources/) — `[{ id, spec }]` (or a bare `SourceSpecification` carrying an `id`). Reconciled into the live style (add / `setData` / remove) once the style has loaded. The config-prop authoring shape for sources (see [What Rozie defers](/guide/maplibre-comparison#what-rozie-defers)). |
| `layers` | `Array` | `[]` | | Declarative [layers](https://maplibre.org/maplibre-style-spec/layers/) — `LayerSpecification[]` (each with an `id`). Reconciled into the live style (add / `setPaintProperty` / `setLayoutProperty` / remove) once the style has loaded; `beforeId` controls draw order. |
| `interactiveLayerIds` | `Array` | `[]` | | Layer ids whose feature `mouseenter` / `mouseleave` fire the `@mouseenter` / `@mouseleave` events (populating `e.features`). Registered / unregistered per id on change. |
| `controls` | `Array` | `[]` | | Standard map controls — strings (`'navigation'` / `'geolocate'` / `'scale'` / `'fullscreen'` / `'attribution'`) or `{ type, position?, options? }` objects. Reconciled (remove-all + re-add) on change. |
| `options` | `Object` | `{}` | | The raw [`MapOptions`](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapOptions/) passthrough — spread into the `Map` constructor **before** the curated keys, so explicit props win. The MapLibre analog of an options bag for anything the curated surface doesn't special-case. |

### Events

MapLibre is event-ful, and the wrapper forwards **22** structured events. The four camera-lifecycle events (`moveend` / `zoomend` / `rotateend` / `pitchend`) also drive the two-way camera model; the pointer events (`click` / `dblclick` / `contextmenu` / `mousemove` / `mouseenter` / `mouseleave`) carry a structured payload (`{ lngLat, point, features, originalEvent }`) so the raw engine event (with its circular `target: Map`) is never handed to consumers.

| Event | Payload | Fires when |
| --- | --- | --- |
| `load` | engine event | The map's style and initial resources finish loading. |
| `move` | engine event | The camera is moving (fires continuously during pan / zoom). |
| `moveend` | engine event | A camera move ends. Also drives the two-way `center` / `zoom` model (echo-guarded). |
| `zoom` | engine event | The zoom level is changing. |
| `zoomend` | engine event | A zoom change ends. Drives the two-way `zoom` model. |
| `rotate` | engine event | The bearing is changing. |
| `rotateend` | engine event | A rotation ends. Drives the two-way `bearing` model. |
| `pitch` | engine event | The pitch is changing. |
| `pitchend` | engine event | A pitch change ends. Drives the two-way `pitch` model. |
| `dragstart` | engine event | A drag-pan starts. |
| `drag` | engine event | The map is being dragged. |
| `dragend` | engine event | A drag-pan ends. |
| `click` | `{ lngLat, point, features, originalEvent }` | The map is clicked. |
| `dblclick` | `{ lngLat, point, features, originalEvent }` | The map is double-clicked. |
| `contextmenu` | `{ lngLat, point, features, originalEvent }` | The map is right-clicked. |
| `mousemove` | `{ lngLat, point, features, originalEvent }` | The pointer moves over the map. |
| `mouseenter` | `{ lngLat, point, features, originalEvent }` | The pointer enters a feature in an `interactiveLayerIds` layer (`features` populated). |
| `mouseleave` | `{ lngLat, point, features, originalEvent }` | The pointer leaves a feature in an `interactiveLayerIds` layer. |
| `idle` | engine event | The map has settled — no pending transitions, all tiles loaded. |
| `error` | engine event | The map encountered an error (tile load failure, etc.). |
| `styledata` | engine event | The map's style data is loaded or changed. |
| `sourcedata` | engine event | One of the map's sources loads or changes. |

### Imperative handle

Beyond props, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getMap` | Return the underlying MapLibre `Map` instance for direct API access (the raw-engine escape hatch). `null` before mount and after destroy. |
| `flyTo` | Fly the camera to a target with an animated curve — `flyTo(options)` (MapLibre's `CameraOptions` + `AnimationOptions`). |
| `easeTo` | Ease the camera to a target — `easeTo(options)`. |
| `jumpTo` | Jump the camera instantly (no animation) — `jumpTo(options)`. |
| `fitBounds` | Fit the camera to a bounding box — `fitBounds(bounds, options?)`. |
| `getCenter` | Return the current center as `[lng, lat]` (longitude first) — normalized from MapLibre's `LngLat`. |
| `getZoom` | Return the current zoom level as a number. |
| `resize` | Resize the map to its container (call after the container's size changes). |

::: tip The camera verbs echo back into the two-way model
The `$expose` camera verbs (`flyTo` / `easeTo` / `jumpTo` / `fitBounds`) deliberately **do not** pass the wrapper's programmatic echo-guard marker, so an imperative `flyTo()` echoes back into the bound `center` / `zoom` / `bearing` / `pitch` model — and the prop `$watch` then no-ops (the camera already matches). This keeps the handle and the two-way binding consistent. The internal prop-driven reconcile *does* mark its moves, so a consumer state write never bounces.
:::

The eight handle method names are clear of all three collision classes (ROZ121 / ROZ524 / Lit lifecycle): none is a React model-setter (`setCenter` / `setZoom` / `setBearing` / `setPitch` would be the auto-generated ones — none here), none is an emitted event name (`move` / `zoom` / `rotate` / `pitch` / `drag` / `click` / `idle` / `error` all differ from the verbs), and none shadows a LitElement lifecycle method (`update` / `render` / `requestUpdate` / …).

**React example:**

```tsx
import { useRef } from 'react';
import { MapLibre, type MapLibreHandle } from '@rozie-ui/maplibre-react';

const map = useRef<MapLibreHandle>(null);
// <MapLibre ref={map} ... />
map.current?.flyTo({ center: [-74.5, 40], zoom: 9 });
const [lng, lat] = map.current?.getCenter() ?? [0, 0];
const raw = map.current?.getMap();   // the raw MapLibre Map instance
```

## Slots

The wrapper surfaces **three** portal slots — two **reactive multi-instance** overlay slots (`marker` / `popup`, driven by the `markers` / `popups` props) and one **mount-once** `control` slot for a custom map control. Each is **guarded** — fill it and your fragments render; leave it unfilled and the surface stays absent.

Each slot's **singular** name (`marker` / `popup` / `control`) is distinct from its **plural** driving prop (`markers` / `popups` / `controls`), keeping the surface ROZ127-clean (a slot name equal to a prop key is a hard error).

| Slot | Mounts via | Renders | Scope params | Kind | Driven by |
| --- | --- | --- | --- | --- | --- |
| `marker` | `new maplibregl.Marker({ element })` | A framework fragment as a map marker | `marker`, `index` | **reactive multi-instance** | `markers` prop |
| `popup` | `new maplibregl.Popup().setDOMContent(el)` | A framework fragment as a map popup | `popup`, `index` | **reactive multi-instance** | `popups` prop |
| `control` | A custom `IControl` host added via `addControl` | A framework fragment as a custom map control | `map` | mount-once | — |

`marker` and `popup` are **reactive multi-instance** slots: the wrapper mounts **one portal handle per entry** in the driving prop, so a single slot fill renders an unbounded number of live fragments — one per marker in `markers` (scope: the `marker` data + its `index`) or per popup in `popups` (scope: the `popup` data + its `index`). When the driving array changes, the wrapper reconciles keep / update / dispose: an existing entry's fragment **re-renders in place** (engine-driven `{ update, dispose }` handle) and its engine marker / popup is moved with `setLngLat`, a new entry mounts a fresh fragment, and a dropped entry is disposed. No remount of the surviving fragments.

`control` is a **mount-once** portal slot: its fragment mounts once into a custom `IControl` host (added via `addControl` at `top-right`) and is disposed on unmount. Its scope carries the live `map`.

Portal slots unlock the "foreign-engine cell rendering" pattern: MapLibre owns the marker / popup / control DOM, but the consumer's framework-native fragment is mounted inside it and disposed when the engine tears it down. This is the strongest part of the wedge — **Solid and Lit get framework-native marker / popup content they otherwise can't have**. See [the portal-slot primitive](/examples/portal-list) for the underlying mechanism. Each target fills `#marker` through its native imperative-render API:

**React** (render prop):

```tsx
<MapLibre
  center={center}
  onCenterChange={setCenter}
  markers={[{ id: 'a', lng: -74.5, lat: 40, label: 'NYC' }]}
  renderMarker={({ marker }) => (
    <span className="pin" title={marker.label}>📍</span>
  )}
/>
```

**Solid** (render prop):

```tsx
<MapLibre
  center={center()}
  onCenterChange={setCenter}
  markers={[{ id: 'a', lng: -74.5, lat: 40, label: 'NYC' }]}
  marker={({ marker }) => <span class="pin" title={marker.label}>📍</span>}
/>
```

**Vue** (scoped slot):

```vue
<MapLibre v-model:center="center" :markers="markers">
  <template #marker="{ marker }">
    <span class="pin" :title="marker.label">📍</span>
  </template>
</MapLibre>
```

**Svelte** (snippet):

```svelte
<MapLibre bind:center {markers}>
  {#snippet marker({ marker })}
    <span class="pin" title={marker.label}>📍</span>
  {/snippet}
</MapLibre>
```

**Angular** (content child `<ng-template>`):

```html
<MapLibre [(center)]="center" [markers]="markers">
  <ng-template #marker let-marker="marker">
    <span class="pin" [title]="marker.label">📍</span>
  </ng-template>
</MapLibre>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-map-libre');
el.markers = [{ id: 'a', lng: -74.5, lat: 40, label: 'NYC' }];
el.marker = ({ marker }) => html`<span class="pin" title=${marker.label}>📍</span>`;
```

On every target the wrapper's `$portals.marker(node, { marker, index })` closure mounts the consumer's fragment into the engine-owned `Marker` element and returns the reactive `{ update, dispose }` handle the wrapper calls as the marker data changes or the marker is removed. The `popup` slot mirrors it exactly (`renderPopup` / `#popup` / `popup` property, scope `{ popup, index }`), and `control` uses the same shape with a `{ map }` scope.

## Recipes

### Markers from a data array

The `marker` slot renders a framework fragment as a map marker for each entry in the `markers` prop. It is **reactive multi-instance** — one portal handle per entry — so the markers track your data: add / remove entries and the wrapper mounts / disposes the matching fragments, and an entry that stays (matched by `id`, falling back to array index) re-renders in place while its marker is moved with `setLngLat`. Give each entry a stable `id` so a reorder doesn't churn fragments:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';
import 'maplibre-gl/dist/maplibre-gl.css';

const center = ref<[number, number]>([-74.5, 40]);
const markers = ref([
  { id: 'nyc', lng: -74.006, lat: 40.7128, label: 'New York' },
  { id: 'bos', lng: -71.0589, lat: 42.3601, label: 'Boston' },
]);
</script>

<template>
  <div style="height: 400px">
    <MapLibre v-model:center="center" :markers="markers">
      <template #marker="{ marker }">
        <span class="pin" :title="marker.label">📍</span>
      </template>
    </MapLibre>
  </div>
</template>
```

### Popups from a data array

The `popup` slot mirrors `marker` exactly — drive it with the `popups` prop (entries `{ lng, lat, id?, closeButton?, closeOnClick?, anchor?, offset? }`) and fill the `#popup` scoped slot / `renderPopup` render prop / snippet / content-child. Each fragment is mounted into a `maplibregl.Popup` via `setDOMContent`, with the live `{ popup, index }` in scope:

```tsx
<MapLibre
  center={center}
  onCenterChange={setCenter}
  popups={[{ id: 'nyc', lng: -74.006, lat: 40.7128, title: 'New York' }]}
  renderPopup={({ popup }) => <strong>{popup.title}</strong>}
/>
```

### Two-way camera binding

Bind any of the four camera props two-way to keep your component state and the map in sync. The wrapper echo-guards its own programmatic moves (via the `eventData` 2nd arg merged onto camera ops), so a consumer state write never ping-pongs:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import MapLibre from '@rozie-ui/maplibre-vue';

const center = ref<[number, number]>([0, 0]);
const zoom = ref(2);
const bearing = ref(0);
const pitch = ref(0);
</script>

<template>
  <button @click="center = [-0.1276, 51.5072]; zoom = 10">Fly to London</button>
  <MapLibre
    v-model:center="center"
    v-model:zoom="zoom"
    v-model:bearing="bearing"
    v-model:pitch="pitch"
  />
  <p>Center: {{ center[0].toFixed(3) }}, {{ center[1].toFixed(3) }} @ z{{ zoom.toFixed(1) }}</p>
</template>
```

### Declarative sources & layers via `:sources` / `:layers`

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

> The `:sources` / `:layers` **config-prop** shape is Rozie v1's authoring model. Declarative `<Source>` / `<Layer>` *children* (as react-map-gl / vue-maplibre-gl offer) need a cross-component context primitive Rozie defers — same `addSource` / `addLayer` runtime, different authoring shape. See [What Rozie defers](/guide/maplibre-comparison#what-rozie-defers).

### Hit-testing layer features

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

### Driving the map from the handle

The eight `$expose` verbs cover the imperative surface props alone can't express. Grab the handle and call the camera verbs (`flyTo` / `easeTo` / `jumpTo` / `fitBounds`) or the readers (`getCenter` / `getZoom`), or reach the raw engine via `getMap()`:

```tsx
const map = useRef<MapLibreHandle>(null);
// <MapLibre ref={map} ... />
<button onClick={() => map.current?.flyTo({ center: [2.3522, 48.8566], zoom: 11 })}>Paris</button>
<button onClick={() => map.current?.fitBounds([[-74.3, 40.5], [-73.7, 40.9]])}>Fit NYC</button>
<button onClick={() => console.log(map.current?.getCenter())}>Log center</button>
```

### A custom control with the `control` slot

Fill the `control` slot to mount a framework-native fragment as a custom map control (added to the `top-right` corner via a custom `IControl`). It is **mount-once** — its `{ map }` scope is the live `Map`, so the control can drive the map directly:

```vue
<MapLibre v-model:center="center">
  <template #control="{ map }">
    <button @click="map.zoomIn()">＋</button>
    <button @click="map.zoomOut()">－</button>
  </template>
</MapLibre>
```

## Gotchas

### `center` is `[lng, lat]` — longitude first

The single most common porting bug: MapLibre uses `[lng, lat]` order everywhere — `center`, marker / popup `setLngLat`, GeoJSON coordinates — **not** Leaflet's `[lat, lng]`. `getCenter()` (the prop and the handle verb) returns `[lng, lat]` too. If your markers land in the ocean off Africa, you've swapped the order.

### The camera echo-guard survives batched moves

A two-way camera binding can ping-pong: the wrapper's own `easeTo` fires a `moveend` that would echo straight back into the model. The wrapper guards this with the `eventData` 2nd arg — programmatic camera ops pass `{ rozieProgrammatic: true }`, which merges onto the fired `moveend` / `zoomend` / `rotateend` / `pitchend`, and the echo handlers skip when they see it. This is more robust than a single boolean flag: it survives batched / nested camera ops with no stale-flag race. (The `$expose` camera verbs deliberately omit the marker so an imperative move *does* echo into the model — see the handle tip above.)

### Import the engine CSS yourself

The component's `<style>` is scoped, so it cannot ship the `.maplibregl-*` selectors — the engine-rendered control / popup / marker DOM never carries Rozie's `[data-rozie-s-*]` scope attribute. You must `import 'maplibre-gl/dist/maplibre-gl.css'` at your app entry (or `<link>` the CDN copy). The wrapper's own marker / control affordances reach that engine DOM through the `:root { }` engine-DOM escape hatch, but the base MapLibre styles are the engine's responsibility.

### Sources & layers wait for the style to load

`addSource` / `addLayer` only work after the style has loaded. The wrapper gates the `:sources` / `:layers` reconcile on `isStyleLoaded()` (applying once the `load` event fires if needed), and re-applies them after a `mapStyle` change (a new style wipes imperatively-added sources / layers). You don't have to sequence this yourself — bind the arrays and the wrapper handles the timing.

### The container needs a height

MapLibre needs an explicitly-sized container. The wrapper's `.rozie-maplibre` host sets `width: 100%; height: 100%; min-height: 300px`, so give the **parent** a height (the quick-start examples wrap the map in a `400px`-tall `<div>`). A zero-height parent renders a zero-height map.

## Cross-references

- [MapLibre libraries comparison](/guide/maplibre-comparison) — the per-framework wrapper matrix, the Solid / Lit gap, and the honest "what Rozie defers" row.
- [`MapLibre.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/maplibre/src/MapLibre.rozie) — the canonical wrapper.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal reactive />` routes a consumer fragment through each target's imperative-render API.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [`r-model` — two-way binding everywhere](/guide/features#model-true-→-idiomatic-two-way-binding-everywhere)
