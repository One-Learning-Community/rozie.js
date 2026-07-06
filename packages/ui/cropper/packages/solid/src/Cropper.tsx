import type { JSX } from 'solid-js';
import { createEffect, mergeProps, on, onCleanup, onMount, splitProps, untrack } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal } from '@rozie/runtime-solid';
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

__rozieInjectStyle('Cropper-cddf3b42', `.rozie-cropper[data-rozie-s-cddf3b42] {
  max-width: 100%;
}
.rozie-cropper-img[data-rozie-s-cddf3b42] {
  display: block;
  max-width: 100%;
}`);

interface CropperProps {
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
  defaultData?: unknown;
  onDataChange?: (data: unknown) => void;
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
  options?: Record<string, any>;
  onReady?: (...args: unknown[]) => void;
  onCropstart?: (...args: unknown[]) => void;
  onCropmove?: (...args: unknown[]) => void;
  onCropend?: (...args: unknown[]) => void;
  onCrop?: (...args: unknown[]) => void;
  onZoom?: (...args: unknown[]) => void;
  ref?: (h: CropperHandle) => void;
}

export interface CropperHandle {
  getCropper: (...args: any[]) => any;
  getData: (...args: any[]) => any;
  getCanvasData: (...args: any[]) => any;
  getCropBoxData: (...args: any[]) => any;
  getImageData: (...args: any[]) => any;
  getContainerData: (...args: any[]) => any;
  getCroppedCanvas: (...args: any[]) => any;
  getCroppedDataURL: (...args: any[]) => any;
  reset: (...args: any[]) => any;
  clear: (...args: any[]) => any;
  showCropBox: (...args: any[]) => any;
  replace: (...args: any[]) => any;
  rotateTo: (...args: any[]) => any;
  rotateBy: (...args: any[]) => any;
  zoomTo: (...args: any[]) => any;
  zoomBy: (...args: any[]) => any;
  scaleX: (...args: any[]) => any;
  scaleY: (...args: any[]) => any;
  scale: (...args: any[]) => any;
  setCanvasData: (...args: any[]) => any;
  setCropBoxData: (...args: any[]) => any;
  moveTo: (...args: any[]) => any;
  move: (...args: any[]) => any;
  enable: (...args: any[]) => any;
  disable: (...args: any[]) => any;
  setAspectRatio: (...args: any[]) => any;
  setDragMode: (...args: any[]) => any;
}

export default function Cropper(_props: CropperProps): JSX.Element {
  const _merged = mergeProps({ src: '', aspectRatio: NaN, viewMode: 0, dragMode: 'crop', disabled: false, guides: true, center: true, background: true, movable: true, rotatable: true, scalable: true, zoomable: true, zoomOnWheel: true, cropBoxMovable: true, cropBoxResizable: true, autoCrop: true, autoCropArea: 0.8, responsive: true, preview: undefined, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'data', 'aspectRatio', 'viewMode', 'dragMode', 'disabled', 'guides', 'center', 'background', 'movable', 'rotatable', 'scalable', 'zoomable', 'zoomOnWheel', 'cropBoxMovable', 'cropBoxResizable', 'autoCrop', 'autoCropArea', 'responsive', 'preview', 'options', 'ref']);
  onMount(() => { local.ref?.({ getCropper, getData, getCanvasData, getCropBoxData, getImageData, getContainerData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, scale, setCanvasData, setCropBoxData, moveTo, move, enable, disable, setAspectRatio, setDragMode }); });

  const [data, setData] = createControllableSignal<unknown>(_props as unknown as Record<string, unknown>, 'data', undefined);
  onMount(() => {
    const _cleanup = (() => {
    // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
    // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
    // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
    // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
    imgEl = imageElRef;
    buildCropper(null);
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    if (instance) instance.destroy();
  });
  });
  createEffect(on(() => (() => local.src)(), (v) => untrack(() => ((v: any) => {
    if (instance && typeof v === 'string' && v) instance.replace(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.aspectRatio)(), (v) => untrack(() => ((v: any) => {
    if (instance) instance.setAspectRatio(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.dragMode)(), (v) => untrack(() => ((v: any) => {
    if (instance && typeof v === 'string') instance.setDragMode(v);
  })(v)), { defer: true }));
  createEffect(on(() => (() => local.disabled)(), (v) => untrack(() => ((v: any) => {
    if (!instance) return;
    if (v) instance.disable();else instance.enable();
  })(v)), { defer: true }));
  createEffect(on(() => (() => data())(), (v) => untrack(() => ((v: any) => {
    if (!instance || !v) return;
    if (sameData(v, instance.getData())) return;
    instance.setData(v);
  })(v)), { defer: true }));
  let imageElRef: HTMLImageElement | null = null;

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
  let cropReady = false;

  // pure crop-box equality (rounded px + exact transform) — no sigils, safe at top
  // level. The round-trip guard that stops the setData→crop→$model.data→$watch loop.
  function sameData(a: any, b: any) {
    if (!a || !b) return false;
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height) && a.rotate === b.rotate && a.scaleX === b.scaleX && a.scaleY === b.scaleY;
  }

  // Construct (or, on a future option change, re-construct) the engine. The whole
  // options object is a null-let `any` so the constructor's 2nd arg is unchecked —
  // the event-callback `e` params (CustomEvent) would otherwise fail the strict
  // react/solid/lit tsc against Cropper's Options callback types (the MapLibre
  // mapOptions idiom). restoreData re-applies the crop box if we ever rebuild.
  function buildCropper(restoreData: any) {
    let cfg: any = null;
    cfg = {
      ...local.options,
      aspectRatio: local.aspectRatio,
      viewMode: local.viewMode,
      dragMode: local.dragMode,
      guides: local.guides,
      center: local.center,
      background: local.background,
      movable: local.movable,
      rotatable: local.rotatable,
      scalable: local.scalable,
      zoomable: local.zoomable,
      zoomOnWheel: local.zoomOnWheel,
      cropBoxMovable: local.cropBoxMovable,
      cropBoxResizable: local.cropBoxResizable,
      autoCrop: local.autoCrop,
      autoCropArea: local.autoCropArea,
      responsive: local.responsive,
      // construction-time only — read DIRECTLY (NOT $snapshot'd): structuredClone
      // throws on the DOM element(s) a `preview` selector/ref resolves to.
      preview: local.preview,
      ready: (e: any) => {
        if (restoreData) instance.setData(restoreData);else if (data()) instance.setData(data());
        if (local.disabled) instance.disable();
        // The engine's setup-time `crop` events (the default box fired BEFORE this
        // `ready`, and the `setData` echo just above) are suppressed by the `cropReady`
        // gate so they can't clobber the consumer's initial `:data` on unified-model
        // targets (Vue defineModel / Svelte $bindable / Angular model()). But two-way
        // consumers still need to READ the initial box, so echo the now-applied box
        // exactly ONCE here (after `$props.data` has been read for setData — no clobber),
        // then open the gate so genuine post-init user crops drive the model.
        setData(instance.getData());
        cropReady = true;
        _props.onReady?.();
      },
      cropstart: (e: any) => _props.onCropstart?.({
        action: e.detail && e.detail.action
      }),
      cropmove: (e: any) => _props.onCropmove?.({
        action: e.detail && e.detail.action
      }),
      cropend: (e: any) => _props.onCropend?.({
        action: e.detail && e.detail.action
      }),
      // continuous crop → emit + drive the two-way model (guarded reverse $watch).
      crop: (e: any) => {
        // Suppress the engine's setup-time crops (the default box before `ready`, and
        // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
        // pre-init `crop` and (b) on unified-model targets clobber the consumer's
        // initial `:data`. Genuine user crops fire after `cropReady`.
        if (!cropReady) return;
        _props.onCrop?.(e.detail);
        if (e.detail) setData(e.detail);
      },
      zoom: (e: any) => _props.onZoom?.({
        ratio: e.detail && e.detail.ratio,
        oldRatio: e.detail && e.detail.oldRatio
      })
    };
    instance = new CropperEngine(imgEl, cfg);
  }
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
  function getCropper() {
    return instance;
  }
  function getData(rounded: any) {
    return instance ? instance.getData(rounded) : null;
  }
  function getCanvasData() {
    return instance ? instance.getCanvasData() : null;
  }
  function getCropBoxData() {
    return instance ? instance.getCropBoxData() : null;
  }
  function getImageData() {
    return instance ? instance.getImageData() : null;
  }
  function getContainerData() {
    return instance ? instance.getContainerData() : null;
  }
  function getCroppedCanvas(opts: any) {
    return instance ? instance.getCroppedCanvas(opts) : null;
  }
  function getCroppedDataURL(opts: any) {
    if (!instance) return null;
    const canvas = instance.getCroppedCanvas(opts);
    return canvas ? canvas.toDataURL() : null;
  }
  function reset() {
    if (instance) instance.reset();
  }
  function clear() {
    if (instance) instance.clear();
  }
  function showCropBox() {
    if (instance) instance.crop();
  }
  function replace(url: any) {
    if (instance) instance.replace(url);
  }
  function rotateTo(deg: any) {
    if (instance) instance.rotateTo(deg);
  }
  function rotateBy(deg: any) {
    if (instance) instance.rotate(deg);
  }
  function zoomTo(ratio: any, pivot: any) {
    if (instance) instance.zoomTo(ratio, pivot);
  }
  function zoomBy(ratio: any) {
    if (instance) instance.zoom(ratio);
  }
  function scaleX(n: any) {
    if (instance) instance.scaleX(n);
  }
  function scaleY(n: any) {
    if (instance) instance.scaleY(n);
  }
  function scale(x: any, y: any) {
    if (instance) instance.scale(x, y);
  }
  function setCanvasData(d: any) {
    if (instance) instance.setCanvasData(d);
  }
  function setCropBoxData(d: any) {
    if (instance) instance.setCropBoxData(d);
  }
  function moveTo(x: any, y: any) {
    if (instance) instance.moveTo(x, y);
  }
  function move(offsetX: any, offsetY: any) {
    if (instance) instance.move(offsetX, offsetY);
  }
  function enable() {
    if (instance) instance.enable();
  }
  function disable() {
    if (instance) instance.disable();
  }
  function setAspectRatio(ratio: any) {
    if (instance) instance.setAspectRatio(ratio);
  }
  function setDragMode(mode: any) {
    if (instance) instance.setDragMode(mode);
  }

  return (
    <>
    <div {...attrs} class={"rozie-cropper" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-cddf3b42="">
      <img class={"rozie-cropper-img"} ref={(el) => { imageElRef = el as HTMLImageElement; }} src={local.src} alt="" data-rozie-s-cddf3b42="" />
    </div>
    </>
  );
}
