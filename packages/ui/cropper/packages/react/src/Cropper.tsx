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

const Cropper = forwardRef<CropperHandle, CropperProps>(function Cropper(_props: CropperProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<CropperProps, 'src' | 'aspectRatio' | 'viewMode' | 'dragMode' | 'disabled' | 'guides' | 'center' | 'background' | 'movable' | 'rotatable' | 'scalable' | 'zoomable' | 'zoomOnWheel' | 'cropBoxMovable' | 'cropBoxResizable' | 'autoCrop' | 'autoCropArea' | 'responsive' | 'options'> & { src: string; aspectRatio: number; viewMode: number; dragMode: string; disabled: boolean; guides: boolean; center: boolean; background: boolean; movable: boolean; rotatable: boolean; scalable: boolean; zoomable: boolean; zoomOnWheel: boolean; cropBoxMovable: boolean; cropBoxResizable: boolean; autoCrop: boolean; autoCropArea: number; responsive: boolean; options: Record<string, any> } = {
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
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { src, data, aspectRatio, viewMode, dragMode, disabled, guides, center, background, movable, rotatable, scalable, zoomable, zoomOnWheel, cropBoxMovable, cropBoxResizable, autoCrop, autoCropArea, responsive, options, defaultValue, onDataChange, defaultData, ...rest } = _props as CropperProps & Record<string, unknown>;
    void src; void data; void aspectRatio; void viewMode; void dragMode; void disabled; void guides; void center; void background; void movable; void rotatable; void scalable; void zoomable; void zoomOnWheel; void cropBoxMovable; void cropBoxResizable; void autoCrop; void autoCropArea; void responsive; void options; void defaultValue; void onDataChange; void defaultData;
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
      ready: (e: any) => {
        if (restoreData) instance.current.setData(restoreData);else if (data) instance.current.setData(data);
        if (props.disabled) instance.current.disable();
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
        _rozieProp_onCrop && _rozieProp_onCrop(e.detail);
        if (e.detail) setData(e.detail);
      },
      zoom: (e: any) => _rozieProp_onZoom && _rozieProp_onZoom({
        ratio: e.detail && e.detail.ratio,
        oldRatio: e.detail && e.detail.oldRatio
      })
    };
    instance.current = new CropperEngine(imgEl.current, cfg);
  }, [_rozieProp_onCrop, _rozieProp_onCropend, _rozieProp_onCropmove, _rozieProp_onCropstart, _rozieProp_onReady, _rozieProp_onZoom, data, props.aspectRatio, props.autoCrop, props.autoCropArea, props.background, props.center, props.cropBoxMovable, props.cropBoxResizable, props.disabled, props.dragMode, props.guides, props.movable, props.options, props.responsive, props.rotatable, props.scalable, props.viewMode, props.zoomOnWheel, props.zoomable, setData]);
  // ─── imperative handle (Phase 21 $expose) ───────────────────────────────────
  // 18 verbs, all collision-clear across the three classes documented at the top:
  // no bare `crop`/`zoom` (event⇄verb ROZ121 — exposed as showCropBox/zoomTo/zoomBy),
  // no `setData` (React data-model auto-setter ROZ524 — set via two-way `data`), and
  // none match a Lit reserved lifecycle name (update/render/firstUpdated/updated/
  // willUpdate/requestUpdate).
  function getCropper() {
    return instance.current;
  }
  function getData() {
    return instance.current ? instance.current.getData() : null;
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
  function zoomTo(ratio: any) {
    if (instance.current) instance.current.zoomTo(ratio);
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

  useImperativeHandle(ref, () => ({ getCropper, getData, getCroppedCanvas, getCroppedDataURL, reset, clear, showCropBox, replace, rotateTo, rotateBy, zoomTo, zoomBy, scaleX, scaleY, enable, disable, setAspectRatio, setDragMode }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div {...attrs} className={clsx("rozie-cropper", (attrs.className as string | undefined))} data-rozie-s-cddf3b42="">
      <img className={"rozie-cropper-img"} ref={imageEl} src={props.src} alt="" data-rozie-s-cddf3b42="" />
    </div>
    </>
  );
});
export default Cropper;
