# @rozie-ui/maplibre-svelte

Idiomatic **svelte** `MapLibre` — a cross-framework interactive map component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/). The camera is two-way bound across `center`/`zoom`/`bearing`/`pitch`; `center` is `[lng, lat]` (lng FIRST). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/maplibre-svelte
```

Peer dependencies: the `maplibre-gl` engine (`^5`) + `svelte`. Install them alongside this package.

Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the engine-rendered control/popup/marker DOM):

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Usage

```svelte
<script lang="ts">
  import MapLibre from '@rozie-ui/maplibre-svelte';
  import 'maplibre-gl/dist/maplibre-gl.css';

  let center = $state<[number, number]>([0, 0]);
  let zoom = $state(2);
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

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `center` | `Array` | `[…]` | ✓ |  |
| `zoom` | `Number` | `1` | ✓ |  |
| `bearing` | `Number` | `0` | ✓ |  |
| `pitch` | `Number` | `0` | ✓ |  |
| `mapStyle` | `unknown` | `undefined` |  |  |
| `minZoom` | `Number` | `0` |  |  |
| `maxZoom` | `Number` | `22` |  |  |
| `maxBounds` | `unknown` | `undefined` |  |  |
| `bounds` | `unknown` | `undefined` |  |  |
| `fitBoundsOptions` | `Object` | `{}` |  |  |
| `dragPan` | `Boolean` | `true` |  |  |
| `dragRotate` | `Boolean` | `true` |  |  |
| `scrollZoom` | `Boolean` | `true` |  |  |
| `doubleClickZoom` | `Boolean` | `true` |  |  |
| `boxZoom` | `Boolean` | `true` |  |  |
| `keyboard` | `Boolean` | `true` |  |  |
| `touchZoomRotate` | `Boolean` | `true` |  |  |
| `touchPitch` | `Boolean` | `true` |  |  |
| `markers` | `Array` | `[]` |  |  |
| `popups` | `Array` | `[]` |  |  |
| `sources` | `Array` | `[]` |  |  |
| `layers` | `Array` | `[]` |  |  |
| `interactiveLayerIds` | `Array` | `[]` |  |  |
| `controls` | `Array` | `[]` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Description |
| --- | --- |
| `load` | |
| `idle` | |
| `move` | |
| `rotate` | |
| `dragstart` | |
| `drag` | |
| `dragend` | |
| `click` | |
| `dblclick` | |
| `contextmenu` | |
| `mousemove` | |
| `error` | |
| `styledata` | |
| `sourcedata` | |
| `moveend` | |
| `zoomend` | |
| `rotateend` | |
| `pitchend` | |
| `mouseenter` | |
| `mouseleave` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let map;                 // component instance via bind:this
</script>

<MapLibre bind:this={map} />
<button onclick={() => map.flyTo({ center: [-74.5, 40], zoom: 9 })}>Fly</button>
```

| Method | Description |
| --- | --- |
| `getMap` | Return the underlying MapLibre GL `Map` instance for direct API access (the engine escape hatch). |
| `flyTo` | Animate the camera along a curved flight path — `flyTo(opts)` (MapLibre `FlyToOptions`). |
| `easeTo` | Animate the camera with an eased transition — `easeTo(opts)` (MapLibre `EaseToOptions`). |
| `jumpTo` | Move the camera instantly with no animation — `jumpTo(opts)` (MapLibre `JumpToOptions`). |
| `fitBounds` | Pan and zoom to contain the given bounds — `fitBounds(bounds, opts)`. |
| `getCenter` | Return the current map center as `[lng, lat]` (lng FIRST), or null before mount. |
| `getZoom` | Return the current zoom level as a number, or null before mount. |
| `resize` | Re-read the container size and resize the map — call after a layout change reveals the container. |

## Slots

| Slot | Params |
| --- | --- |
| marker | marker, index |
| popup | popup, index |
| control | map |
