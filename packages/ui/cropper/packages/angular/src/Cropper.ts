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
  src = input<string>('');
  data = model<unknown>(undefined);
  aspectRatio = input<number>(NaN);
  viewMode = input<number>(0);
  dragMode = input<string>('crop');
  disabled = input<boolean>(false);
  guides = input<boolean>(true);
  center = input<boolean>(true);
  background = input<boolean>(true);
  movable = input<boolean>(true);
  rotatable = input<boolean>(true);
  scalable = input<boolean>(true);
  zoomable = input<boolean>(true);
  zoomOnWheel = input<boolean>(true);
  cropBoxMovable = input<boolean>(true);
  cropBoxResizable = input<boolean>(true);
  autoCrop = input<boolean>(true);
  autoCropArea = input<number>(0.8);
  responsive = input<boolean>(true);
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
      ready: (e: any) => {
        const __data = this.data();
        if (restoreData) this.instance.setData(restoreData);else if (__data) this.instance.setData(__data);
        if ((this.disabled() || this.__rozieCvaDisabled())) this.instance.disable();
        // Initial box is applied — from here on, real user crops drive the model.
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
  getData = () => {
    return this.instance ? this.instance.getData() : null;
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
  zoomTo = (ratio: any) => {
    if (this.instance) this.instance.zoomTo(ratio);
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
  private __rozieCvaDisabled = signal(false);

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
