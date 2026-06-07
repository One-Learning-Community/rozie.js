# @rozie-ui/maplibre-angular

Idiomatic **angular** `MapLibre` — a cross-framework interactive map component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/). The camera is two-way bound across `center`/`zoom`/`bearing`/`pitch`; `center` is `[lng, lat]` (lng FIRST). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/maplibre-angular
```

Peer dependencies: the `maplibre-gl` engine (`^5`) + `@angular/core + @angular/common`. Install them alongside this package.

Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the engine-rendered control/popup/marker DOM):

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
```

## Usage

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
  center: [number, number] = [0, 0];
  zoom = 2;
  onClick(e: any) { console.log(e.lngLat); }
}
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `center` | `Array` | `[…]` | ✓ |  |
| `zoom` | `Number` | `1` | ✓ |  |
| `bearing` | `Number` | `0` | ✓ |  |
| `pitch` | `Number` | `0` | ✓ |  |
| `mapStyle` | `unknown` | `"https://demotiles.maplibre.org/style.json"` |  |  |
| `minZoom` | `Number` | `undefined` |  |  |
| `maxZoom` | `Number` | `undefined` |  |  |
| `maxBounds` | `unknown` | `undefined` |  |  |
| `bounds` | `unknown` | `undefined` |  |  |
| `fitBoundsOptions` | `Object` | `undefined` |  |  |
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
| `zoom` | |
| `rotate` | |
| `pitch` | |
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
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(MapLibre) map!: MapLibre;  // or the viewChild() signal
  fly() { this.map.flyTo({ center: [-74.5, 40], zoom: 9 }); }
  raw() { return this.map.getMap(); }
}
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
