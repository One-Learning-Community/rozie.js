# Cropper — the cross-framework image cropper

[Cropper.js](https://github.com/fengyuanchen/cropperjs) is the de-facto vanilla-JS image-cropping engine. But its framework wrappers are **lopsided**: React has the deep, maintained [`react-cropper`](https://github.com/react-cropper/react-cropper); Vue has the older `vue-cropperjs`; and Angular, Svelte, Solid and Lit have nothing comparable — thin, stale, or absent. That gap (React served, the rest stranded) is exactly what Rozie's write-once-ship-six thesis exists to close.

One `Cropper.rozie` source compiles to six idiomatic packages — so Angular, Svelte, Solid and Lit consumers get a category-leading cropper for free, with the same props, events, two-way crop box, and imperative handle as the React one.

## The `@rozie-ui/cropper` packages

| Package | Framework | Ships |
| --- | --- | --- |
| `@rozie-ui/cropper-react` | React 18+ | compiled `.tsx` + types |
| `@rozie-ui/cropper-vue` | Vue 3.4+ | `.vue` SFC source |
| `@rozie-ui/cropper-svelte` | Svelte 5+ | `.svelte` source |
| `@rozie-ui/cropper-angular` | Angular 19+ | standalone component source |
| `@rozie-ui/cropper-solid` | Solid 1.8+ | compiled `.tsx` + types |
| `@rozie-ui/cropper-lit` | Lit 3+ | compiled custom element + types |

All six wrap **Cropper.js v1** (`cropperjs@^1`), declared as a peer dependency. (Cropper.js v2 was rewritten as Web Components with a different API — see [Gotchas](#why-v1-not-v2).)

::: warning Import the engine CSS yourself
The scoped component `<style>` cannot reach the engine-rendered `.cropper-*` crop UI, so each app must import Cropper's stylesheet once at its entry:

```ts
import 'cropperjs/dist/cropper.css';
```
:::

## Quick start

The crop box is **two-way bound** through a single `data` model prop — `{ x, y, width, height, rotate, scaleX, scaleY }`. Dragging or resizing the crop box writes the new box back through the model path (round-trip-guarded so a programmatic `setData` doesn't ping-pong); a consumer write reflects into the live cropper. The image comes through `src`; crop/zoom lifecycle fires as native framework events.

### React

```tsx
import { useState } from 'react';
import { Cropper } from '@rozie-ui/cropper-react';
import 'cropperjs/dist/cropper.css';

export function Demo() {
  const [data, setData] = useState();
  return (
    <Cropper
      src="/photo.jpg"
      data={data}
      onDataChange={setData}
      aspectRatio={16 / 9}
      viewMode={1}
      onCrop={(e) => console.log(e)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Cropper from '@rozie-ui/cropper-vue';
import 'cropperjs/dist/cropper.css';

const data = ref();
</script>

<template>
  <Cropper
    src="/photo.jpg"
    v-model:data="data"
    :aspect-ratio="16 / 9"
    :view-mode="1"
    @crop="(e) => console.log(e)"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import Cropper from '@rozie-ui/cropper-svelte';
  import 'cropperjs/dist/cropper.css';

  let data = $state();
</script>

<Cropper
  src="/photo.jpg"
  bind:data
  aspectRatio={16 / 9}
  viewMode={1}
  oncrop={(e) => console.log(e)}
/>
```

### Angular

```ts
import { Component } from '@angular/core';
import { Cropper } from '@rozie-ui/cropper-angular';
// Add 'cropperjs/dist/cropper.css' to your global styles.

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Cropper],
  template: `
    <Cropper
      src="/photo.jpg"
      [(data)]="data"
      [aspectRatio]="16 / 9"
      [viewMode]="1"
      (crop)="onCrop($event)"
    />
  `,
})
export class DemoComponent {
  data: any;
  onCrop(e: any) { console.log(e); }
}
```

Because `data` is the lone two-way model, the Angular component is a real `ControlValueAccessor` — `[(ngModel)]="data"` and reactive `formControl` bindings work out of the box.

### Solid

```tsx
import { createSignal } from 'solid-js';
import { Cropper } from '@rozie-ui/cropper-solid';
import 'cropperjs/dist/cropper.css';

export function Demo() {
  const [data, setData] = createSignal();
  return (
    <Cropper
      src="/photo.jpg"
      data={data()}
      onDataChange={setData}
      aspectRatio={16 / 9}
      viewMode={1}
      onCrop={(e) => console.log(e)}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/cropper-lit';
import 'cropperjs/dist/cropper.css';

// <rozie-cropper> is a custom element. Bind `src`/`data` as properties and
// listen for `data-change` (the two-way change channel) + `crop`.
const el = document.querySelector('rozie-cropper');
el.src = '/photo.jpg';
el.aspectRatio = 16 / 9;
el.addEventListener('data-change', (e) => { el.data = e.detail; });
el.addEventListener('crop', (e) => console.log(e.detail));
```

## API

### Props

`data` is the lone **two-way** model prop (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onDataChange`). Five props reconcile into the live cropper on change — `src` (via `replace`), `aspectRatio` (`setAspectRatio`), `dragMode` (`setDragMode`), `disabled` (`enable` / `disable`) and `data` (`setData`). The remaining options are **set at construction** (Cropper.js v1 ships no runtime setter for them); anything not surfaced here can be passed through the `options` bag.

| Name | Type | Default | Two-way (model) | Runtime-updatable? | Description |
| --- | --- | --- | :---: | :---: | --- |
| `src` | `String` | `""` | | ✓ | The image URL the cropper attaches to. Changing it calls `replace(url)`. |
| `data` | `unknown` | `undefined` | ✓ | ✓ | The crop box — `{ x, y, width, height, rotate, scaleX, scaleY }`. Two-way: dragging/resizing writes the box back (round-trip-guarded); a consumer write `setData`s the live cropper. |
| `aspectRatio` | `Number` | `NaN` | | ✓ | The crop box aspect ratio. `NaN` = free ratio. Reconciled via `setAspectRatio`. |
| `viewMode` | `Number` | `0` | | | The view constraint mode (`0`–`3`). **Construction-only.** |
| `dragMode` | `String` | `"crop"` | | ✓ | `'crop'` (draw a new box) / `'move'` (pan the canvas) / `'none'`. Reconciled via `setDragMode`. |
| `disabled` | `Boolean` | `false` | | ✓ | Freeze the cropper. Reconciled via `enable()` / `disable()`. |
| `guides` | `Boolean` | `true` | | | Show the dashed guide lines over the crop box. **Construction-only.** |
| `center` | `Boolean` | `true` | | | Show the center indicator. **Construction-only.** |
| `background` | `Boolean` | `true` | | | Show the grid background. **Construction-only.** |
| `movable` | `Boolean` | `true` | | | Allow moving the image. **Construction-only.** |
| `rotatable` | `Boolean` | `true` | | | Allow rotating the image. **Construction-only.** |
| `scalable` | `Boolean` | `true` | | | Allow scaling (flipping) the image. **Construction-only.** |
| `zoomable` | `Boolean` | `true` | | | Allow zooming the image. **Construction-only.** |
| `zoomOnWheel` | `Boolean` | `true` | | | Allow zooming via the mouse wheel. **Construction-only.** |
| `cropBoxMovable` | `Boolean` | `true` | | | Allow moving the crop box. **Construction-only.** |
| `cropBoxResizable` | `Boolean` | `true` | | | Allow resizing the crop box. **Construction-only.** |
| `autoCrop` | `Boolean` | `true` | | | Render a crop box automatically on init. **Construction-only.** |
| `autoCropArea` | `Number` | `0.8` | | | Initial crop-box size as a fraction of the canvas (`0`–`1`). **Construction-only.** |
| `responsive` | `Boolean` | `true` | | | Re-render the cropper on window resize. **Construction-only.** |
| `options` | `Object` | `{}` | | | Raw [Cropper.js `Options`](https://github.com/fengyuanchen/cropperjs#options) passthrough — spread into the constructor **before** the curated keys (explicit props win). Use it for any v1 option not surfaced above (`modal`, `restore`, `minCropBoxWidth`, `wheelZoomRatio`, …). |

### Events

The wrapper forwards Cropper.js's six lifecycle events. The continuous `crop` event also drives the two-way `data` model.

| Event | Payload | Fires when |
| --- | --- | --- |
| `ready` | — | The image is loaded and the cropper is built and ready. |
| `cropstart` | `{ action }` | A pointer gesture on the crop box / canvas starts. |
| `cropmove` | `{ action }` | The crop box / canvas is being changed. |
| `cropend` | `{ action }` | A pointer gesture ends. |
| `crop` | `{ x, y, width, height, rotate, scaleX, scaleY }` | The crop box changes (fires continuously). Also drives the two-way `data` model. |
| `zoom` | `{ ratio, oldRatio }` | The canvas is zoomed in or out. |

### Imperative handle

Beyond props, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getCropper` | Return the underlying Cropper.js instance for direct API access (the raw-engine escape hatch). `null` before mount. |
| `getData` | Return the current crop box as `{ x, y, width, height, rotate, scaleX, scaleY }`, or `null` before mount. |
| `getCroppedCanvas` | Return an `HTMLCanvasElement` drawn from the cropped area — `getCroppedCanvas(opts?)`. |
| `getCroppedDataURL` | Convenience: the cropped area as a `toDataURL()` string — `getCroppedDataURL(opts?)`. |
| `reset` | Reset the image and crop box to their initial states. |
| `clear` | Clear (hide) the crop box. Pair with `showCropBox()`. |
| `showCropBox` | Show the crop box (Cropper `crop()`) — re-enables cropping after `clear()`. |
| `replace` | Replace the image with a new source URL — `replace(url)`. |
| `rotateTo` | Rotate the image to an absolute degree — `rotateTo(deg)`. |
| `rotateBy` | Rotate the image by a relative degree — `rotateBy(deg)`. |
| `zoomTo` | Zoom the canvas to an absolute ratio — `zoomTo(ratio)`. |
| `zoomBy` | Zoom the canvas by a relative ratio — `zoomBy(ratio)`. |
| `scaleX` | Flip/scale the image horizontally — `scaleX(n)` (e.g. `-1`). |
| `scaleY` | Flip/scale the image vertically — `scaleY(n)`. |
| `enable` | Enable (unfreeze) the cropper. |
| `disable` | Disable (freeze) the cropper. |
| `setAspectRatio` | Set the crop box aspect ratio — `setAspectRatio(ratio)` (`NaN` for free). |
| `setDragMode` | Set the drag mode — `setDragMode('crop' \| 'move' \| 'none')`. |

::: tip Why `crop`/`zoom` are not `$expose` verbs
Cropper.js names `crop` and `zoom` as **both** events and methods, and `data` is a model prop (so React auto-generates an internal `setData` setter). A bare `crop`/`zoom` verb would collide with the same-named emit (ROZ121) and a `setData` verb with the model setter (ROZ524). So the imperative crop/zoom are exposed under collision-free names — `showCropBox`, `zoomTo`/`zoomBy` — and the crop box is set through the two-way `data` binding (`getData` reads it). None of the 18 verbs shadows a Lit lifecycle method either.
:::

**React example:**

```tsx
import { useRef } from 'react';
import { Cropper, type CropperHandle } from '@rozie-ui/cropper-react';

const cropper = useRef<CropperHandle>(null);
// <Cropper ref={cropper} ... />
const url = cropper.current?.getCroppedDataURL();   // export the crop
cropper.current?.rotateBy(90);                       // rotate 90° clockwise
```

## Recipes

### Export the cropped image

The money method is `getCroppedCanvas()` — draw the cropped area into a fresh `<canvas>` you can read as a data URL or blob:

```tsx
const url = cropper.current?.getCroppedDataURL();
// or, for a Blob upload:
cropper.current?.getCroppedCanvas()?.toBlob((blob) => upload(blob), 'image/png');
```

### Aspect-ratio presets

Drive the crop box shape declaratively with the `aspectRatio` prop, or imperatively with `setAspectRatio`:

```ts
cropper.setAspectRatio(1);     // square
cropper.setAspectRatio(16 / 9);
cropper.setAspectRatio(NaN);   // free
```

### Rotate & flip

```ts
cropper.rotateBy(90);    // rotate 90° clockwise
cropper.scaleX(-1);      // flip horizontally
cropper.scaleY(-1);      // flip vertically
```

### Two-way crop box

Bind `data` to read **and** drive the crop box. The wrapper echoes the live box on every `crop` event and applies consumer writes via `setData`, with a round-trip guard so the two never oscillate:

```vue
<Cropper v-model:data="box" src="/photo.jpg" />
<pre>{{ box }}</pre>   <!-- { x, y, width, height, rotate, scaleX, scaleY } -->
```

### Pan vs. crop with `dragMode`

```ts
cropper.setDragMode('move');   // drag pans the image
cropper.setDragMode('crop');   // drag draws a new crop box
```

## Gotchas

### Import the engine CSS yourself

The crop UI (`.cropper-container`, `.cropper-view-box`, …) is engine-created DOM that never carries Rozie's scope attribute, so the scoped `<style>` can't ship it. Import `cropperjs/dist/cropper.css` once at your app entry, or the cropper renders unstyled.

### Why v1, not v2 {#why-v1-not-v2}

Cropper.js `latest` is **v2**, a ground-up rewrite as a set of Web Components (`<cropper-canvas>`, `<cropper-image>`, …) with a completely different API. It is already "cross-framework" via custom elements, so wrapping it would be redundant (especially into Lit). These packages wrap the mature, imperative **v1** (`new Cropper(img, options)`) — the engine the competing wrappers target. Pin `cropperjs@^1`.

### Construction-time vs. runtime-reconciled options

Cropper.js v1 ships runtime setters only for the aspect ratio, drag mode, crop box, enable/disable and source. Those props (`aspectRatio`, `dragMode`, `data`, `disabled`, `src`) reconcile live; the rest are **applied at construction** (see the *Runtime-updatable?* column). Set them once at mount.

### The crop box is rounded

`getData()` returns sub-pixel floats; the two-way round-trip guard compares the box rounded to whole pixels (plus exact `rotate`/`scaleX`/`scaleY`), so a consumer writing integer coordinates won't trigger a redundant `setData`.

## Cross-references

- [Cropper libraries comparison](/guide/cropper-comparison) — how `@rozie-ui/cropper` stacks up against the per-framework wrappers.
- [MapLibre — showcase & API](/guide/maplibre) — the sibling engine-wrapper port (the two-way object model + imperative handle pattern).
- [Features](/guide/features) — the full Rozie author-side API.
