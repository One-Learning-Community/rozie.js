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
  src?: string;
  data?: unknown;
  defaultData?: unknown;
  onDataChange?: (data: unknown) => void;
  aspectRatio?: number;
  viewMode?: number;
  dragMode?: string;
  disabled?: boolean;
  guides?: boolean;
  center?: boolean;
  background?: boolean;
  movable?: boolean;
  rotatable?: boolean;
  scalable?: boolean;
  zoomable?: boolean;
  zoomOnWheel?: boolean;
  cropBoxMovable?: boolean;
  cropBoxResizable?: boolean;
  autoCrop?: boolean;
  autoCropArea?: number;
  responsive?: boolean;
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
  enable: (...args: any[]) => any;
  disable: (...args: any[]) => any;
  setAspectRatio: (...args: any[]) => any;
  setDragMode: (...args: any[]) => any;
}

export default function Cropper(_props: CropperProps): JSX.Element {
  const _merged = mergeProps({ src: '', aspectRatio: NaN, viewMode: 0, dragMode: 'crop', disabled: false, guides: true, center: true, background: true, movable: true, rotatable: true, scalable: true, zoomable: true, zoomOnWheel: true, cropBoxMovable: true, cropBoxResizable: true, autoCrop: true, autoCropArea: 0.8, responsive: true, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['src', 'data', 'aspectRatio', 'viewMode', 'dragMode', 'disabled', 'guides', 'center', 'background', 'movable', 'rotatable', 'scalable', 'zoomable', 'zoomOnWheel', 'cropBoxMovable', 'cropBoxResizable', 'autoCrop', 'autoCropArea', 'responsive', 'options', 'ref']);
  onMount(() => { local.ref?.({ getCropper, getData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, enable, disable, setAspectRatio, setDragMode }); });

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
  let imageElRef: HTMLElement | null = null;

  // null-lets so the bundled-leaf typeNeutralize pass annotates them `any`:
  // instance is the Cropper (whose strict Options/Data types the loosely-typed
  // .rozie props don't satisfy), and imgEl holds the <img> the engine attaches to
  // (queried from the ref'd container in $onMount). Both are the `let x = null`
  // idiom the engine-wrapper recipe relies on.
  let instance: any = null;
  let imgEl: any = null;

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
      ready: (e: any) => {
        if (restoreData) instance.setData(restoreData);else if (data()) instance.setData(data());
        if (local.disabled) instance.disable();
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
  // 18 verbs, all collision-clear across the three classes documented at the top:
  // no bare `crop`/`zoom` (event⇄verb ROZ121 — exposed as showCropBox/zoomTo/zoomBy),
  // no `setData` (React data-model auto-setter ROZ524 — set via two-way `data`), and
  // none match a Lit reserved lifecycle name (update/render/firstUpdated/updated/
  // willUpdate/requestUpdate).
  function getCropper() {
    return instance;
  }
  function getData() {
    return instance ? instance.getData() : null;
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
  function zoomTo(ratio: any) {
    if (instance) instance.zoomTo(ratio);
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
      <img class={"rozie-cropper-img"} ref={(el) => { imageElRef = el as HTMLElement; }} src={local.src} alt="" data-rozie-s-cddf3b42="" />
    </div>
    </>
  );
}
