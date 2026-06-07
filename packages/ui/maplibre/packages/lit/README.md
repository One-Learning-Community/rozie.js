# @rozie-ui/maplibre-lit

Idiomatic **lit** `MapLibre` — a cross-framework interactive map component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/). The camera is two-way bound across `center`/`zoom`/`bearing`/`pitch`; `center` is `[lng, lat]` (lng FIRST). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/maplibre-lit
```

Peer dependencies: the `maplibre-gl` engine (`^5`) + `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the engine-rendered control/popup/marker DOM):

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Usage

```ts
import '@rozie-ui/maplibre-lit';
import 'maplibre-gl/dist/maplibre-gl.css';

// <rozie-map-libre> is a custom element. Bind `center`/`zoom` as properties
// and listen for `center-change`/`zoom-change` (the two-way change channels).
const el = document.querySelector('rozie-map-libre');
el.center = [0, 0];
el.zoom = 2;
el.controls = ['navigation', 'scale'];
el.addEventListener('center-change', (e) => { el.center = e.detail; });
el.addEventListener('click', (e) => console.log(e.detail.lngLat));
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

```ts
// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-map-libre');
el.flyTo({ center: [-74.5, 40], zoom: 9 });
const raw = el.getMap();
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
