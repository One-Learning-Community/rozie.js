<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount, untrack } from 'svelte';

interface Props {
  /**
   * The image URL the cropper attaches to. Bound onto the `<img>` and reconciled at runtime — changing it calls the engine `replace(url)`.
   * @example
   * <Cropper :src="imageUrl" r-model:data="crop" />
   */
  src?: string;
  /**
   * The crop box — `{ x, y, width, height, rotate, scaleX, scaleY }`. The lone two-way `model: true` prop: dragging or resizing the crop box writes the new box back (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write `setData`s the live cropper.
   */
  data?: unknown;
  /**
   * The crop box aspect ratio. `NaN` (the default) is Cropper's sentinel for a free ratio. Reconciled at runtime via `setAspectRatio`.
   */
  aspectRatio?: number;
  /**
   * The view constraint mode (`0`–`3`) that governs how the crop box is restricted to the canvas. Construction-only — Cropper.js v1 has no `setViewMode`.
   */
  viewMode?: number;
  /**
   * The drag behavior: `'crop'` draws a new box, `'move'` pans the canvas, `'none'` disables dragging. Reconciled at runtime via `setDragMode`.
   */
  dragMode?: string;
  /**
   * Freeze the cropper so it no longer responds to user interaction. Reconciled at runtime via `enable()` / `disable()`.
   */
  disabled?: boolean;
  /**
   * Show the dashed guide lines over the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  guides?: boolean;
  /**
   * Show the center indicator inside the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  center?: boolean;
  /**
   * Show the grid background behind the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  background?: boolean;
  /**
   * Allow moving (panning) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  movable?: boolean;
  /**
   * Allow rotating the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  rotatable?: boolean;
  /**
   * Allow scaling (flipping) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  scalable?: boolean;
  /**
   * Allow zooming the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomable?: boolean;
  /**
   * Allow zooming the image via the mouse wheel. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomOnWheel?: boolean;
  /**
   * Allow moving the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxMovable?: boolean;
  /**
   * Allow resizing the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxResizable?: boolean;
  /**
   * Render a crop box automatically when the cropper initializes. Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCrop?: boolean;
  /**
   * The initial crop-box size as a fraction of the canvas (`0`–`1`). Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCropArea?: number;
  /**
   * Re-render the cropper on window resize to keep it responsive. Construction-only — Cropper.js v1 has no runtime setter.
   */
  responsive?: boolean;
  /**
   * Live crop-thumbnail target(s) — a selector string or element ref(s) (`HTMLElement`, array, or `NodeList`). Construction-only (v1 has no `setPreview`). On Lit prefer an element ref: a document selector cannot cross the wrapper's shadow boundary.
   */
  preview?: unknown;
  /**
   * Raw Cropper.js `Options` passthrough — spread into the constructor before the curated keys (explicit props win). Use it for any v1 option not surfaced as a first-class prop (`modal`, `restore`, `minCropBoxWidth`, `wheelZoomRatio`, …).
   */
  options?: any;
  onready?: (...args: unknown[]) => void;
  oncropstart?: (...args: unknown[]) => void;
  oncropmove?: (...args: unknown[]) => void;
  oncropend?: (...args: unknown[]) => void;
  oncrop?: (...args: unknown[]) => void;
  onzoom?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => ({}))();

let {
  src = '',
  data = $bindable(undefined),
  aspectRatio = NaN,
  viewMode = 0,
  dragMode = 'crop',
  disabled = false,
  guides = true,
  center = true,
  background = true,
  movable = true,
  rotatable = true,
  scalable = true,
  zoomable = true,
  zoomOnWheel = true,
  cropBoxMovable = true,
  cropBoxResizable = true,
  autoCrop = true,
  autoCropArea = 0.8,
  responsive = true,
  preview = undefined,
  options = __defaultOptions,
  onready,
  oncropstart,
  oncropmove,
  oncropend,
  oncrop,
  onzoom,
  ...__rozieAttrs
}: Props = $props();

let imageEl = $state<HTMLElement | undefined>(undefined);

// The engine default-import is aliased `CropperEngine` — a bare `import Cropper`
// would collide with the component name `Cropper` (the rozie `name`), which the
// emitters declare as a local `Cropper` class/function across React/Solid/Lit
// (TS2440 import-conflict + a cascade of "not newable" errors). MapLibre dodged
// this for free (its import was `maplibregl` ≠ `MapLibre`); same-named single-word
// engines must alias.
import CropperEngine from 'cropperjs';

// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// instance is the Cropper (whose strict Options/Data types the loosely-typed
// .rozie props don't satisfy), and imgEl holds the <img> the engine attaches to
// (queried from the ref'd container in $onMount). Both are the `let x = null`
// idiom the engine-wrapper recipe relies on.
// null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
// instance is the Cropper (whose strict Options/Data types the loosely-typed
// .rozie props don't satisfy), and imgEl holds the <img> the engine attaches to
// (queried from the ref'd container in $onMount). Both are the `let x = null`
// idiom the engine-wrapper recipe relies on.
let instance: any = null;
let imgEl: any = null;
// Gate that suppresses the engine's SETUP-time `crop` events from writing the
// two-way `$model.data`. Cropper fires an initial `crop` with its OWN default box
// (autoCropArea) BEFORE the `ready` callback runs, and the `setData($props.data)`
// inside `ready` fires another. Writing those transient engine-internal boxes to
// `$model.data` is wrong — and on unified-model targets (Vue defineModel / Svelte
// $bindable / Angular model() signal, where the model read and write share ONE
// local) the pre-ready write CLOBBERS the very `$props.data` that `ready` then
// reads, so the consumer's initial `:data` crop box is lost and the default box is
// applied instead. (React/Solid read the external prop and Lit's property binding
// is controlled, so the write doesn't change their read — which is why only the
// template-emit family regressed.) We flip this true at the END of `ready`, after
// the initial box is applied, so only genuine post-init user crops drive the model.
// Gate that suppresses the engine's SETUP-time `crop` events from writing the
// two-way `$model.data`. Cropper fires an initial `crop` with its OWN default box
// (autoCropArea) BEFORE the `ready` callback runs, and the `setData($props.data)`
// inside `ready` fires another. Writing those transient engine-internal boxes to
// `$model.data` is wrong — and on unified-model targets (Vue defineModel / Svelte
// $bindable / Angular model() signal, where the model read and write share ONE
// local) the pre-ready write CLOBBERS the very `$props.data` that `ready` then
// reads, so the consumer's initial `:data` crop box is lost and the default box is
// applied instead. (React/Solid read the external prop and Lit's property binding
// is controlled, so the write doesn't change their read — which is why only the
// template-emit family regressed.) We flip this true at the END of `ready`, after
// the initial box is applied, so only genuine post-init user crops drive the model.
let cropReady = false;

// pure crop-box equality (rounded px + exact transform) — no sigils, safe at top
// level. The round-trip guard that stops the setData→crop→$model.data→$watch loop.
// pure crop-box equality (rounded px + exact transform) — no sigils, safe at top
// level. The round-trip guard that stops the setData→crop→$model.data→$watch loop.
const sameData = (a: any, b: any) => {
  if (!a || !b) return false;
  return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height) && a.rotate === b.rotate && a.scaleX === b.scaleX && a.scaleY === b.scaleY;
};

// Construct (or, on a future option change, re-construct) the engine. The whole
// options object is a null-let `any` so the constructor's 2nd arg is unchecked —
// the event-callback `e` params (CustomEvent) would otherwise fail the strict
// react/solid/lit tsc against Cropper's Options callback types (the MapLibre
// mapOptions idiom). restoreData re-applies the crop box if we ever rebuild.
// Construct (or, on a future option change, re-construct) the engine. The whole
// options object is a null-let `any` so the constructor's 2nd arg is unchecked —
// the event-callback `e` params (CustomEvent) would otherwise fail the strict
// react/solid/lit tsc against Cropper's Options callback types (the MapLibre
// mapOptions idiom). restoreData re-applies the crop box if we ever rebuild.
const buildCropper = (restoreData: any) => {
  let cfg: any = null;
  cfg = {
    ...$state.snapshot(options),
    aspectRatio: aspectRatio,
    viewMode: viewMode,
    dragMode: dragMode,
    guides: guides,
    center: center,
    background: background,
    movable: movable,
    rotatable: rotatable,
    scalable: scalable,
    zoomable: zoomable,
    zoomOnWheel: zoomOnWheel,
    cropBoxMovable: cropBoxMovable,
    cropBoxResizable: cropBoxResizable,
    autoCrop: autoCrop,
    autoCropArea: autoCropArea,
    responsive: responsive,
    // construction-time only — read DIRECTLY (NOT $snapshot'd): structuredClone
    // throws on the DOM element(s) a `preview` selector/ref resolves to.
    preview: preview,
    ready: (e: any) => {
      if (restoreData) instance.setData(restoreData);else if (data) instance.setData($state.snapshot(data));
      if (disabled) instance.disable();
      // The engine's setup-time `crop` events (the default box fired BEFORE this
      // `ready`, and the `setData` echo just above) are suppressed by the `cropReady`
      // gate so they can't clobber the consumer's initial `:data` on unified-model
      // targets (Vue defineModel / Svelte $bindable / Angular model()). But two-way
      // consumers still need to READ the initial box, so echo the now-applied box
      // exactly ONCE here (after `$props.data` has been read for setData — no clobber),
      // then open the gate so genuine post-init user crops drive the model.
      data = instance.getData();
      cropReady = true;
      onready?.();
    },
    cropstart: (e: any) => oncropstart?.({
      action: e.detail && e.detail.action
    }),
    cropmove: (e: any) => oncropmove?.({
      action: e.detail && e.detail.action
    }),
    cropend: (e: any) => oncropend?.({
      action: e.detail && e.detail.action
    }),
    // continuous crop → emit + drive the two-way model (guarded reverse $watch).
    crop: (e: any) => {
      // Suppress the engine's setup-time crops (the default box before `ready`, and
      // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
      // pre-init `crop` and (b) on unified-model targets clobber the consumer's
      // initial `:data`. Genuine user crops fire after `cropReady`.
      if (!cropReady) return;
      oncrop?.(e.detail);
      if (e.detail) data = e.detail;
    },
    zoom: (e: any) => onzoom?.({
      ratio: e.detail && e.detail.ratio,
      oldRatio: e.detail && e.detail.oldRatio
    })
  };
  instance = new CropperEngine(imgEl, cfg);
};
// ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
// 27 verbs, all collision-clear across the three classes documented at the top:
// no bare `crop`/`zoom` (event⇄verb ROZ121 — exposed as showCropBox/zoomTo/zoomBy),
// no `setData` (React data-model auto-setter ROZ524 — set via two-way `data`; the new
// setCanvasData/setCropBoxData are DISTINCT names, NOT the model auto-setter), and
// none match a Lit reserved lifecycle name (update/render/firstUpdated/updated/
// willUpdate/requestUpdate). The added geometry getters (getCanvasData/getCropBoxData/
// getImageData/getContainerData) and movement setters (setCanvasData/setCropBoxData/
// moveTo/move/scale) expose v1's full canvas/crop-box geometry surface; getData and
// zoomTo gain their optional v1 args (rounded, pivot).
export function getCropper() {
  return instance;
}
export function getData(rounded: any) {
  return instance ? instance.getData(rounded) : null;
}
export function getCanvasData() {
  return instance ? instance.getCanvasData() : null;
}
export function getCropBoxData() {
  return instance ? instance.getCropBoxData() : null;
}
export function getImageData() {
  return instance ? instance.getImageData() : null;
}
export function getContainerData() {
  return instance ? instance.getContainerData() : null;
}
export function getCroppedCanvas(opts: any) {
  return instance ? instance.getCroppedCanvas(opts) : null;
}
export function getCroppedDataURL(opts: any) {
  if (!instance) return null;
  const canvas = instance.getCroppedCanvas(opts);
  return canvas ? canvas.toDataURL() : null;
}
export function reset() {
  if (instance) instance.reset();
}
export function clear() {
  if (instance) instance.clear();
}
export function showCropBox() {
  if (instance) instance.crop();
}
export function replace(url: any) {
  if (instance) instance.replace(url);
}
export function rotateTo(deg: any) {
  if (instance) instance.rotateTo(deg);
}
export function rotateBy(deg: any) {
  if (instance) instance.rotate(deg);
}
export function zoomTo(ratio: any, pivot: any) {
  if (instance) instance.zoomTo(ratio, pivot);
}
export function zoomBy(ratio: any) {
  if (instance) instance.zoom(ratio);
}
export function scaleX(n: any) {
  if (instance) instance.scaleX(n);
}
export function scaleY(n: any) {
  if (instance) instance.scaleY(n);
}
export function scale(x: any, y: any) {
  if (instance) instance.scale(x, y);
}
export function setCanvasData(d: any) {
  if (instance) instance.setCanvasData(d);
}
export function setCropBoxData(d: any) {
  if (instance) instance.setCropBoxData(d);
}
export function moveTo(x: any, y: any) {
  if (instance) instance.moveTo(x, y);
}
export function move(offsetX: any, offsetY: any) {
  if (instance) instance.move(offsetX, offsetY);
}
export function enable() {
  if (instance) instance.enable();
}
export function disable() {
  if (instance) instance.disable();
}
export function setAspectRatio(ratio: any) {
  if (instance) instance.setAspectRatio(ratio);
}
export function setDragMode(mode: any) {
  if (instance) instance.setDragMode(mode);
}

onMount(() => {
  // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
  // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
  // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
  // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
  imgEl = imageEl;
  buildCropper(null);
  return () => {
    if (instance) instance.destroy();
  };
});

let __rozieWatchInitial_0 = true;
$effect(() => { const __watchVal = (() => src)(); untrack(() => { if (__rozieWatchInitial_0) { __rozieWatchInitial_0 = false; return; } ((v: any) => {
  if (instance && typeof v === 'string' && v) instance.replace(v);
})(__watchVal); }); });
let __rozieWatchInitial_1 = true;
$effect(() => { const __watchVal = (() => aspectRatio)(); untrack(() => { if (__rozieWatchInitial_1) { __rozieWatchInitial_1 = false; return; } ((v: any) => {
  if (instance) instance.setAspectRatio(v);
})(__watchVal); }); });
let __rozieWatchInitial_2 = true;
$effect(() => { const __watchVal = (() => dragMode)(); untrack(() => { if (__rozieWatchInitial_2) { __rozieWatchInitial_2 = false; return; } ((v: any) => {
  if (instance && typeof v === 'string') instance.setDragMode(v);
})(__watchVal); }); });
let __rozieWatchInitial_3 = true;
$effect(() => { const __watchVal = (() => disabled)(); untrack(() => { if (__rozieWatchInitial_3) { __rozieWatchInitial_3 = false; return; } ((v: any) => {
  if (!instance) return;
  if (v) instance.disable();else instance.enable();
})(__watchVal); }); });
let __rozieWatchInitial_4 = true;
$effect(() => { const __watchVal = (() => data)(); untrack(() => { if (__rozieWatchInitial_4) { __rozieWatchInitial_4 = false; return; } ((v: any) => {
  if (!instance || !v) return;
  if (sameData(v, instance.getData())) return;
  instance.setData($state.snapshot(v));
})(__watchVal); }); });
</script>

<div {...__rozieAttrs} class={["rozie-cropper", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-cddf3b42><img class="rozie-cropper-img" bind:this={imageEl} src={src} alt="" data-rozie-s-cddf3b42 /></div>

<style>
:global {
  .rozie-cropper[data-rozie-s-cddf3b42] {
    max-width: 100%;
  }
  .rozie-cropper-img[data-rozie-s-cddf3b42] {
    display: block;
    max-width: 100%;
  }
}
</style>
