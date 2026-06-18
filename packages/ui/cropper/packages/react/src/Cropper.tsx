import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import './Cropper.css';
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
  preview?: unknown;
  options?: Record<string, any>;
  onReady?: (...args: any[]) => void;
  onCropstart?: (...args: any[]) => void;
  onCropmove?: (...args: any[]) => void;
  onCropend?: (...args: any[]) => void;
  onCrop?: (...args: any[]) => void;
  onZoom?: (...args: any[]) => void;
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

const Cropper = forwardRef<CropperHandle, CropperProps>(function Cropper(_props: CropperProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<CropperProps, 'src' | 'aspectRatio' | 'viewMode' | 'dragMode' | 'disabled' | 'guides' | 'center' | 'background' | 'movable' | 'rotatable' | 'scalable' | 'zoomable' | 'zoomOnWheel' | 'cropBoxMovable' | 'cropBoxResizable' | 'autoCrop' | 'autoCropArea' | 'responsive' | 'preview' | 'options'> & { src: string; aspectRatio: number; viewMode: number; dragMode: string; disabled: boolean; guides: boolean; center: boolean; background: boolean; movable: boolean; rotatable: boolean; scalable: boolean; zoomable: boolean; zoomOnWheel: boolean; cropBoxMovable: boolean; cropBoxResizable: boolean; autoCrop: boolean; autoCropArea: number; responsive: boolean; preview: unknown; options: Record<string, any> } = {
    ..._props,
    src: _props.src ?? '',
    aspectRatio: _props.aspectRatio ?? NaN,
    viewMode: _props.viewMode ?? 0,
    dragMode: _props.dragMode ?? 'crop',
    disabled: _props.disabled ?? false,
    guides: _props.guides ?? true,
    center: _props.center ?? true,
    background: _props.background ?? true,
    movable: _props.movable ?? true,
    rotatable: _props.rotatable ?? true,
    scalable: _props.scalable ?? true,
    zoomable: _props.zoomable ?? true,
    zoomOnWheel: _props.zoomOnWheel ?? true,
    cropBoxMovable: _props.cropBoxMovable ?? true,
    cropBoxResizable: _props.cropBoxResizable ?? true,
    autoCrop: _props.autoCrop ?? true,
    autoCropArea: _props.autoCropArea ?? 0.8,
    responsive: _props.responsive ?? true,
    preview: _props.preview ?? undefined,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, data, aspectRatio, viewMode, dragMode, disabled, guides, center, background, movable, rotatable, scalable, zoomable, zoomOnWheel, cropBoxMovable, cropBoxResizable, autoCrop, autoCropArea, responsive, preview, options, defaultValue, onDataChange, defaultData, ...rest } = _props as CropperProps & Record<string, unknown>;
    void src; void data; void aspectRatio; void viewMode; void dragMode; void disabled; void guides; void center; void background; void movable; void rotatable; void scalable; void zoomable; void zoomOnWheel; void cropBoxMovable; void cropBoxResizable; void autoCrop; void autoCropArea; void responsive; void preview; void options; void defaultValue; void onDataChange; void defaultData;
    return rest;
  })();
  const imgEl = useRef<any>(null);
  const instance = useRef<any>(null);
  const [data, setData] = useControllableState({
    value: props.data,
    defaultValue: props.defaultData ?? undefined,
    onValueChange: props.onDataChange,
  });
  const imageEl = useRef<HTMLImageElement | null>(null);
  const _watch0First = useRef(true);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);
  const _watch3First = useRef(true);
  const _watch4First = useRef(true);

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
  const { onCrop: _rozieProp_onCrop, onCropend: _rozieProp_onCropend, onCropmove: _rozieProp_onCropmove, onCropstart: _rozieProp_onCropstart, onReady: _rozieProp_onReady, onZoom: _rozieProp_onZoom } = props;
    const buildCropper = useCallback((restoreData: any) => {
    let cfg: any = null;
    cfg = {
      ...props.options,
      aspectRatio: props.aspectRatio,
      viewMode: props.viewMode,
      dragMode: props.dragMode,
      guides: props.guides,
      center: props.center,
      background: props.background,
      movable: props.movable,
      rotatable: props.rotatable,
      scalable: props.scalable,
      zoomable: props.zoomable,
      zoomOnWheel: props.zoomOnWheel,
      cropBoxMovable: props.cropBoxMovable,
      cropBoxResizable: props.cropBoxResizable,
      autoCrop: props.autoCrop,
      autoCropArea: props.autoCropArea,
      responsive: props.responsive,
      // construction-time only — read DIRECTLY (NOT $snapshot'd): structuredClone
      // throws on the DOM element(s) a `preview` selector/ref resolves to.
      preview: props.preview,
      ready: (e: any) => {
        if (restoreData) instance.current.setData(restoreData);else if (data) instance.current.setData(data);
        if (props.disabled) instance.current.disable();
        // The engine's setup-time `crop` events (the default box fired BEFORE this
        // `ready`, and the `setData` echo just above) are suppressed by the `cropReady`
        // gate so they can't clobber the consumer's initial `:data` on unified-model
        // targets (Vue defineModel / Svelte $bindable / Angular model()). But two-way
        // consumers still need to READ the initial box, so echo the now-applied box
        // exactly ONCE here (after `$props.data` has been read for setData — no clobber),
        // then open the gate so genuine post-init user crops drive the model.
        setData(instance.current.getData());
        cropReady = true;
        _rozieProp_onReady && _rozieProp_onReady();
      },
      cropstart: (e: any) => _rozieProp_onCropstart && _rozieProp_onCropstart({
        action: e.detail && e.detail.action
      }),
      cropmove: (e: any) => _rozieProp_onCropmove && _rozieProp_onCropmove({
        action: e.detail && e.detail.action
      }),
      cropend: (e: any) => _rozieProp_onCropend && _rozieProp_onCropend({
        action: e.detail && e.detail.action
      }),
      // continuous crop → emit + drive the two-way model (guarded reverse $watch).
      crop: (e: any) => {
        // Suppress the engine's setup-time crops (the default box before `ready`, and
        // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
        // pre-init `crop` and (b) on unified-model targets clobber the consumer's
        // initial `:data`. Genuine user crops fire after `cropReady`.
        if (!cropReady) return;
        _rozieProp_onCrop && _rozieProp_onCrop(e.detail);
        if (e.detail) setData(e.detail);
      },
      zoom: (e: any) => _rozieProp_onZoom && _rozieProp_onZoom({
        ratio: e.detail && e.detail.ratio,
        oldRatio: e.detail && e.detail.oldRatio
      })
    };
    instance.current = new CropperEngine(imgEl.current, cfg);
  }, [_rozieProp_onCrop, _rozieProp_onCropend, _rozieProp_onCropmove, _rozieProp_onCropstart, _rozieProp_onReady, _rozieProp_onZoom, data, props.aspectRatio, props.autoCrop, props.autoCropArea, props.background, props.center, props.cropBoxMovable, props.cropBoxResizable, props.disabled, props.dragMode, props.guides, props.movable, props.options, props.preview, props.responsive, props.rotatable, props.scalable, props.viewMode, props.zoomOnWheel, props.zoomable, setData]);
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
    return instance.current;
  }
  function getData(rounded: any) {
    return instance.current ? instance.current.getData(rounded) : null;
  }
  function getCanvasData() {
    return instance.current ? instance.current.getCanvasData() : null;
  }
  function getCropBoxData() {
    return instance.current ? instance.current.getCropBoxData() : null;
  }
  function getImageData() {
    return instance.current ? instance.current.getImageData() : null;
  }
  function getContainerData() {
    return instance.current ? instance.current.getContainerData() : null;
  }
  function getCroppedCanvas(opts: any) {
    return instance.current ? instance.current.getCroppedCanvas(opts) : null;
  }
  function getCroppedDataURL(opts: any) {
    if (!instance.current) return null;
    const canvas = instance.current.getCroppedCanvas(opts);
    return canvas ? canvas.toDataURL() : null;
  }
  function reset() {
    if (instance.current) instance.current.reset();
  }
  function clear() {
    if (instance.current) instance.current.clear();
  }
  function showCropBox() {
    if (instance.current) instance.current.crop();
  }
  function replace(url: any) {
    if (instance.current) instance.current.replace(url);
  }
  function rotateTo(deg: any) {
    if (instance.current) instance.current.rotateTo(deg);
  }
  function rotateBy(deg: any) {
    if (instance.current) instance.current.rotate(deg);
  }
  function zoomTo(ratio: any, pivot: any) {
    if (instance.current) instance.current.zoomTo(ratio, pivot);
  }
  function zoomBy(ratio: any) {
    if (instance.current) instance.current.zoom(ratio);
  }
  function scaleX(n: any) {
    if (instance.current) instance.current.scaleX(n);
  }
  function scaleY(n: any) {
    if (instance.current) instance.current.scaleY(n);
  }
  function scale(x: any, y: any) {
    if (instance.current) instance.current.scale(x, y);
  }
  function setCanvasData(d: any) {
    if (instance.current) instance.current.setCanvasData(d);
  }
  function setCropBoxData(d: any) {
    if (instance.current) instance.current.setCropBoxData(d);
  }
  function moveTo(x: any, y: any) {
    if (instance.current) instance.current.moveTo(x, y);
  }
  function move(offsetX: any, offsetY: any) {
    if (instance.current) instance.current.move(offsetX, offsetY);
  }
  function enable() {
    if (instance.current) instance.current.enable();
  }
  function disable() {
    if (instance.current) instance.current.disable();
  }
  function setAspectRatio(ratio: any) {
    if (instance.current) instance.current.setAspectRatio(ratio);
  }
  function setDragMode(mode: any) {
    if (instance.current) instance.current.setDragMode(mode);
  }

  useEffect(() => {
    // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
    // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
    // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
    // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
    imgEl.current = imageEl.current;
    buildCropper(null);
    return () => {
      if (instance.current) instance.current.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch0First.current) { _watch0First.current = false; return; }
    const v = props.src;
    if (instance.current && typeof v === 'string' && v) instance.current.replace(v);
  }, [props.src]);
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    const v = props.aspectRatio;
    if (instance.current) instance.current.setAspectRatio(v);
  }, [props.aspectRatio]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    const v = props.dragMode;
    if (instance.current && typeof v === 'string') instance.current.setDragMode(v);
  }, [props.dragMode]);
  useEffect(() => {
    if (_watch3First.current) { _watch3First.current = false; return; }
    const v = props.disabled;
    if (!instance.current) return;
    if (v) instance.current.disable();else instance.current.enable();
  }, [props.disabled]);
  useEffect(() => {
    if (_watch4First.current) { _watch4First.current = false; return; }
    const v = data;
    if (!instance.current || !v) return;
    if (sameData(v, instance.current.getData())) return;
    instance.current.setData(v);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ getCropper, getData, getCanvasData, getCropBoxData, getImageData, getContainerData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, scale, setCanvasData, setCropBoxData, moveTo, move, enable, disable, setAspectRatio, setDragMode });
  _rozieExposeRef.current = { getCropper, getData, getCanvasData, getCropBoxData, getImageData, getContainerData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, scale, setCanvasData, setCropBoxData, moveTo, move, enable, disable, setAspectRatio, setDragMode };
  useImperativeHandle(ref, () => ({ getCropper: (...args: Parameters<typeof getCropper>): ReturnType<typeof getCropper> => _rozieExposeRef.current.getCropper(...args), getData: (...args: Parameters<typeof getData>): ReturnType<typeof getData> => _rozieExposeRef.current.getData(...args), getCanvasData: (...args: Parameters<typeof getCanvasData>): ReturnType<typeof getCanvasData> => _rozieExposeRef.current.getCanvasData(...args), getCropBoxData: (...args: Parameters<typeof getCropBoxData>): ReturnType<typeof getCropBoxData> => _rozieExposeRef.current.getCropBoxData(...args), getImageData: (...args: Parameters<typeof getImageData>): ReturnType<typeof getImageData> => _rozieExposeRef.current.getImageData(...args), getContainerData: (...args: Parameters<typeof getContainerData>): ReturnType<typeof getContainerData> => _rozieExposeRef.current.getContainerData(...args), getCroppedCanvas: (...args: Parameters<typeof getCroppedCanvas>): ReturnType<typeof getCroppedCanvas> => _rozieExposeRef.current.getCroppedCanvas(...args), getCroppedDataURL: (...args: Parameters<typeof getCroppedDataURL>): ReturnType<typeof getCroppedDataURL> => _rozieExposeRef.current.getCroppedDataURL(...args), reset: (...args: Parameters<typeof reset>): ReturnType<typeof reset> => _rozieExposeRef.current.reset(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args), showCropBox: (...args: Parameters<typeof showCropBox>): ReturnType<typeof showCropBox> => _rozieExposeRef.current.showCropBox(...args), replace: (...args: Parameters<typeof replace>): ReturnType<typeof replace> => _rozieExposeRef.current.replace(...args), rotateTo: (...args: Parameters<typeof rotateTo>): ReturnType<typeof rotateTo> => _rozieExposeRef.current.rotateTo(...args), rotateBy: (...args: Parameters<typeof rotateBy>): ReturnType<typeof rotateBy> => _rozieExposeRef.current.rotateBy(...args), zoomTo: (...args: Parameters<typeof zoomTo>): ReturnType<typeof zoomTo> => _rozieExposeRef.current.zoomTo(...args), zoomBy: (...args: Parameters<typeof zoomBy>): ReturnType<typeof zoomBy> => _rozieExposeRef.current.zoomBy(...args), scaleX: (...args: Parameters<typeof scaleX>): ReturnType<typeof scaleX> => _rozieExposeRef.current.scaleX(...args), scaleY: (...args: Parameters<typeof scaleY>): ReturnType<typeof scaleY> => _rozieExposeRef.current.scaleY(...args), scale: (...args: Parameters<typeof scale>): ReturnType<typeof scale> => _rozieExposeRef.current.scale(...args), setCanvasData: (...args: Parameters<typeof setCanvasData>): ReturnType<typeof setCanvasData> => _rozieExposeRef.current.setCanvasData(...args), setCropBoxData: (...args: Parameters<typeof setCropBoxData>): ReturnType<typeof setCropBoxData> => _rozieExposeRef.current.setCropBoxData(...args), moveTo: (...args: Parameters<typeof moveTo>): ReturnType<typeof moveTo> => _rozieExposeRef.current.moveTo(...args), move: (...args: Parameters<typeof move>): ReturnType<typeof move> => _rozieExposeRef.current.move(...args), enable: (...args: Parameters<typeof enable>): ReturnType<typeof enable> => _rozieExposeRef.current.enable(...args), disable: (...args: Parameters<typeof disable>): ReturnType<typeof disable> => _rozieExposeRef.current.disable(...args), setAspectRatio: (...args: Parameters<typeof setAspectRatio>): ReturnType<typeof setAspectRatio> => _rozieExposeRef.current.setAspectRatio(...args), setDragMode: (...args: Parameters<typeof setDragMode>): ReturnType<typeof setDragMode> => _rozieExposeRef.current.setDragMode(...args) }), []);

  return (
    <>
    <div {...attrs} className={clsx("rozie-cropper", (attrs.className as string | undefined))} data-rozie-s-cddf3b42="">
      <img className={"rozie-cropper-img"} ref={imageEl} src={props.src} alt="" data-rozie-s-cddf3b42="" />
    </div>
    </>
  );
});
export default Cropper;
