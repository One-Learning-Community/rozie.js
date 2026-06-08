# @rozie-ui/cropper-svelte

Idiomatic **svelte** `Cropper` — a cross-framework image cropper compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Cropper.js](https://github.com/fengyuanchen/cropperjs) (v1). The crop box is two-way bound via `data` (`{ x, y, width, height, rotate, scaleX, scaleY }`). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/cropper-svelte
```

Peer dependencies: the `cropperjs` engine (`^1`) + `svelte`. Install them alongside this package.

Import the engine CSS once at your app entry (the scoped component `<style>` cannot reach the engine-rendered `.cropper-*` crop UI):

```ts
import 'cropperjs/dist/cropper.css';
```

## Usage

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

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `src` | `String` | `""` |  |  |
| `data` | `unknown` | `undefined` | ✓ |  |
| `aspectRatio` | `Number` | `NaN` |  |  |
| `viewMode` | `Number` | `0` |  |  |
| `dragMode` | `String` | `"crop"` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `guides` | `Boolean` | `true` |  |  |
| `center` | `Boolean` | `true` |  |  |
| `background` | `Boolean` | `true` |  |  |
| `movable` | `Boolean` | `true` |  |  |
| `rotatable` | `Boolean` | `true` |  |  |
| `scalable` | `Boolean` | `true` |  |  |
| `zoomable` | `Boolean` | `true` |  |  |
| `zoomOnWheel` | `Boolean` | `true` |  |  |
| `cropBoxMovable` | `Boolean` | `true` |  |  |
| `cropBoxResizable` | `Boolean` | `true` |  |  |
| `autoCrop` | `Boolean` | `true` |  |  |
| `autoCropArea` | `Number` | `0.8` |  |  |
| `responsive` | `Boolean` | `true` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Description |
| --- | --- |
| `ready` | |
| `cropstart` | |
| `cropmove` | |
| `cropend` | |
| `crop` | |
| `zoom` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let cropper;              // component instance via bind:this
</script>

<Cropper bind:this={cropper} ... />
<button onclick={() => cropper.rotateBy(90)}>Rotate</button>
```

| Method | Description |
| --- | --- |
| `getCropper` | Return the underlying Cropper.js instance for direct API access (the engine escape hatch). |
| `getData` | Return the current crop box as `{ x, y, width, height, rotate, scaleX, scaleY }`, or null before mount. |
| `getCroppedCanvas` | Return an `HTMLCanvasElement` drawn from the cropped area — `getCroppedCanvas(opts?)` (Cropper `GetCroppedCanvasOptions`). Null before mount. |
| `getCroppedDataURL` | Convenience: the cropped area as a `toDataURL()` string — `getCroppedDataURL(opts?)` (same options as getCroppedCanvas). Null before mount. |
| `reset` | Reset the image and crop box to their initial states. |
| `clear` | Clear (hide) the crop box. Pair with `showCropBox()` to re-show it. |
| `showCropBox` | Show the crop box (Cropper `crop()`) — re-enables cropping after `clear()`. |
| `replace` | Replace the image with a new source URL — `replace(url)`. |
| `rotateTo` | Rotate the image to an absolute degree — `rotateTo(deg)`. |
| `rotateBy` | Rotate the image by a relative degree (Cropper `rotate()`) — `rotateBy(deg)`. |
| `zoomTo` | Zoom the canvas to an absolute ratio — `zoomTo(ratio)`. |
| `zoomBy` | Zoom the canvas by a relative ratio (Cropper `zoom()`) — `zoomBy(ratio)`. |
| `scaleX` | Flip/scale the image horizontally — `scaleX(n)` (e.g. -1 to flip). |
| `scaleY` | Flip/scale the image vertically — `scaleY(n)` (e.g. -1 to flip). |
| `enable` | Enable (unfreeze) the cropper. |
| `disable` | Disable (freeze) the cropper. |
| `setAspectRatio` | Set the crop box aspect ratio — `setAspectRatio(ratio)` (NaN for free). |
| `setDragMode` | Set the drag mode — `setDragMode('crop' | 'move' | 'none')`. |
