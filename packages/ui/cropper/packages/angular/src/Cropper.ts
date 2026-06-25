import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

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

@Component({
  selector: 'rozie-cropper',
  standalone: true,
  template: `

    <div class="rozie-cropper" #rozieSpread_0 #rozieListenersTarget_1>
      <img class="rozie-cropper-img" #imageEl [src]="src()" alt="" />
    </div>

  `,
  styles: [`
    .rozie-cropper {
      max-width: 100%;
    }
    .rozie-cropper-img {
      display: block;
      max-width: 100%;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Cropper),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
})
export class Cropper {
  /**
   * The image URL the cropper attaches to. Bound onto the `<img>` and reconciled at runtime — changing it calls the engine `replace(url)`.
   * @example
   * <Cropper :src="imageUrl" r-model:data="crop" />
   */
  src = input<string>('');
  /**
   * The crop box — `{ x, y, width, height, rotate, scaleX, scaleY }`. The lone two-way `model: true` prop: dragging or resizing the crop box writes the new box back (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write `setData`s the live cropper.
   */
  data = model<unknown>(undefined);
  /**
   * The crop box aspect ratio. `NaN` (the default) is Cropper's sentinel for a free ratio. Reconciled at runtime via `setAspectRatio`.
   */
  aspectRatio = input<number>(NaN);
  /**
   * The view constraint mode (`0`–`3`) that governs how the crop box is restricted to the canvas. Construction-only — Cropper.js v1 has no `setViewMode`.
   */
  viewMode = input<number>(0);
  /**
   * The drag behavior: `'crop'` draws a new box, `'move'` pans the canvas, `'none'` disables dragging. Reconciled at runtime via `setDragMode`.
   */
  dragMode = input<string>('crop');
  /**
   * Freeze the cropper so it no longer responds to user interaction. Reconciled at runtime via `enable()` / `disable()`.
   */
  disabled = input<boolean>(false);
  /**
   * Show the dashed guide lines over the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  guides = input<boolean>(true);
  /**
   * Show the center indicator inside the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  center = input<boolean>(true);
  /**
   * Show the grid background behind the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  background = input<boolean>(true);
  /**
   * Allow moving (panning) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  movable = input<boolean>(true);
  /**
   * Allow rotating the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  rotatable = input<boolean>(true);
  /**
   * Allow scaling (flipping) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  scalable = input<boolean>(true);
  /**
   * Allow zooming the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomable = input<boolean>(true);
  /**
   * Allow zooming the image via the mouse wheel. Construction-only — Cropper.js v1 has no runtime setter.
   */
  zoomOnWheel = input<boolean>(true);
  /**
   * Allow moving the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxMovable = input<boolean>(true);
  /**
   * Allow resizing the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  cropBoxResizable = input<boolean>(true);
  /**
   * Render a crop box automatically when the cropper initializes. Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCrop = input<boolean>(true);
  /**
   * The initial crop-box size as a fraction of the canvas (`0`–`1`). Construction-only — Cropper.js v1 has no runtime setter.
   */
  autoCropArea = input<number>(0.8);
  /**
   * Re-render the cropper on window resize to keep it responsive. Construction-only — Cropper.js v1 has no runtime setter.
   */
  responsive = input<boolean>(true);
  /**
   * Live crop-thumbnail target(s) — a selector string or element ref(s) (`HTMLElement`, array, or `NodeList`). Construction-only (v1 has no `setPreview`). On Lit prefer an element ref: a document selector cannot cross the wrapper's shadow boundary.
   */
  preview = input<unknown>(undefined);
  /**
   * Raw Cropper.js `Options` passthrough — spread into the constructor before the curated keys (explicit props win). Use it for any v1 option not surfaced as a first-class prop (`modal`, `restore`, `minCropBoxWidth`, `wheelZoomRatio`, …).
   */
  options = input<Record<string, any>>((() => ({}))());
  imageEl = viewChild<ElementRef<HTMLElement>>('imageEl');
  ready = output<void>();
  cropstart = output<unknown>();
  cropmove = output<unknown>();
  cropend = output<unknown>();
  crop = output<unknown>();
  zoom = output<unknown>();
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;
  private __rozieWatchInitial_4 = true;

  constructor() {
    effect(() => { const __watchVal = (() => this.src())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
      if (this.instance && typeof v === 'string' && v) this.instance.replace(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.aspectRatio())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      if (this.instance) this.instance.setAspectRatio(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.dragMode())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } ((v: any) => {
      if (this.instance && typeof v === 'string') this.instance.setDragMode(v);
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => (this.disabled() || this.__rozieCvaDisabled()))(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } ((v: any) => {
      if (!this.instance) return;
      if (v) this.instance.disable();else this.instance.enable();
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.data())(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (!this.instance || !v) return;
      if (this.sameData(v, this.instance.getData())) return;
      this.instance.setData(v);
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
    // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
    // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
    // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
    this.imgEl = this.imageEl()?.nativeElement;
    this.buildCropper(null);
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.instance) this.instance.destroy();
    });
  }

  instance: any = null;
  imgEl: any = null;
  cropReady = false;
  sameData = (a: any, b: any) => {
    if (!a || !b) return false;
    return Math.round(a.x) === Math.round(b.x) && Math.round(a.y) === Math.round(b.y) && Math.round(a.width) === Math.round(b.width) && Math.round(a.height) === Math.round(b.height) && a.rotate === b.rotate && a.scaleX === b.scaleX && a.scaleY === b.scaleY;
  };
  buildCropper = (restoreData: any) => {
    let cfg: any = null;
    cfg = {
      ...this.options(),
      aspectRatio: this.aspectRatio(),
      viewMode: this.viewMode(),
      dragMode: this.dragMode(),
      guides: this.guides(),
      center: this.center(),
      background: this.background(),
      movable: this.movable(),
      rotatable: this.rotatable(),
      scalable: this.scalable(),
      zoomable: this.zoomable(),
      zoomOnWheel: this.zoomOnWheel(),
      cropBoxMovable: this.cropBoxMovable(),
      cropBoxResizable: this.cropBoxResizable(),
      autoCrop: this.autoCrop(),
      autoCropArea: this.autoCropArea(),
      responsive: this.responsive(),
      // construction-time only — read DIRECTLY (NOT $snapshot'd): structuredClone
      // throws on the DOM element(s) a `preview` selector/ref resolves to.
      preview: this.preview(),
      ready: (e: any) => {
        if (restoreData) this.instance.setData(restoreData);else if (this.data()) this.instance.setData(this.data());
        if ((this.disabled() || this.__rozieCvaDisabled())) this.instance.disable();
        // The engine's setup-time `crop` events (the default box fired BEFORE this
        // `ready`, and the `setData` echo just above) are suppressed by the `cropReady`
        // gate so they can't clobber the consumer's initial `:data` on unified-model
        // targets (Vue defineModel / Svelte $bindable / Angular model()). But two-way
        // consumers still need to READ the initial box, so echo the now-applied box
        // exactly ONCE here (after `$props.data` has been read for setData — no clobber),
        // then open the gate so genuine post-init user crops drive the model.
        this.data.set(this.instance.getData()), this.__rozieCvaOnChange(this.instance.getData());
        this.cropReady = true;
        this.ready.emit();
      },
      cropstart: (e: any) => this.cropstart.emit({
        action: e.detail && e.detail.action
      }),
      cropmove: (e: any) => this.cropmove.emit({
        action: e.detail && e.detail.action
      }),
      cropend: (e: any) => this.cropend.emit({
        action: e.detail && e.detail.action
      }),
      // continuous crop → emit + drive the two-way model (guarded reverse $watch).
      crop: (e: any) => {
        // Suppress the engine's setup-time crops (the default box before `ready`, and
        // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
        // pre-init `crop` and (b) on unified-model targets clobber the consumer's
        // initial `:data`. Genuine user crops fire after `cropReady`.
        if (!this.cropReady) return;
        this.crop.emit(e.detail);
        if (e.detail) this.data.set(e.detail), this.__rozieCvaOnChange(e.detail);
      },
      zoom: (e: any) => this.zoom.emit({
        ratio: e.detail && e.detail.ratio,
        oldRatio: e.detail && e.detail.oldRatio
      })
    };
    this.instance = new CropperEngine(this.imgEl, cfg);
  };
  getCropper = () => {
    return this.instance;
  };
  getData = (rounded: any) => {
    return this.instance ? this.instance.getData(rounded) : null;
  };
  getCanvasData = () => {
    return this.instance ? this.instance.getCanvasData() : null;
  };
  getCropBoxData = () => {
    return this.instance ? this.instance.getCropBoxData() : null;
  };
  getImageData = () => {
    return this.instance ? this.instance.getImageData() : null;
  };
  getContainerData = () => {
    return this.instance ? this.instance.getContainerData() : null;
  };
  getCroppedCanvas = (opts: any) => {
    return this.instance ? this.instance.getCroppedCanvas(opts) : null;
  };
  getCroppedDataURL = (opts: any) => {
    if (!this.instance) return null;
    const canvas = this.instance.getCroppedCanvas(opts);
    return canvas ? canvas.toDataURL() : null;
  };
  reset = () => {
    if (this.instance) this.instance.reset();
  };
  clear = () => {
    if (this.instance) this.instance.clear();
  };
  showCropBox = () => {
    if (this.instance) this.instance.crop();
  };
  replace = (url: any) => {
    if (this.instance) this.instance.replace(url);
  };
  rotateTo = (deg: any) => {
    if (this.instance) this.instance.rotateTo(deg);
  };
  rotateBy = (deg: any) => {
    if (this.instance) this.instance.rotate(deg);
  };
  zoomTo = (ratio: any, pivot: any) => {
    if (this.instance) this.instance.zoomTo(ratio, pivot);
  };
  zoomBy = (ratio: any) => {
    if (this.instance) this.instance.zoom(ratio);
  };
  scaleX = (n: any) => {
    if (this.instance) this.instance.scaleX(n);
  };
  scaleY = (n: any) => {
    if (this.instance) this.instance.scaleY(n);
  };
  scale = (x: any, y: any) => {
    if (this.instance) this.instance.scale(x, y);
  };
  setCanvasData = (d: any) => {
    if (this.instance) this.instance.setCanvasData(d);
  };
  setCropBoxData = (d: any) => {
    if (this.instance) this.instance.setCropBoxData(d);
  };
  moveTo = (x: any, y: any) => {
    if (this.instance) this.instance.moveTo(x, y);
  };
  move = (offsetX: any, offsetY: any) => {
    if (this.instance) this.instance.move(offsetX, offsetY);
  };
  enable = () => {
    if (this.instance) this.instance.enable();
  };
  disable = () => {
    if (this.instance) this.instance.disable();
  };
  setAspectRatio = (ratio: any) => {
    if (this.instance) this.instance.setAspectRatio(ratio);
  };
  setDragMode = (mode: any) => {
    if (this.instance) this.instance.setDragMode(mode);
  };

  private __rozieCvaOnChange: (v: unknown) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: unknown | null): void {
    this.data.set(v ?? undefined);
  }
  registerOnChange(fn: (v: unknown) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default Cropper;
