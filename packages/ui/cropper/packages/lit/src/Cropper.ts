import { LitElement, css, html } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { SignalWatcher, effect, untracked } from '@lit-labs/preact-signals';
import { adoptDocumentStyles, createLitControllableProperty, rozieListeners, rozieSpread } from '@rozie/runtime-lit';
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

@customElement('rozie-cropper')
export default class Cropper extends SignalWatcher(LitElement) {
  static styles = css`
:host{display:contents}
.rozie-cropper[data-rozie-s-cddf3b42] {
  max-width: 100%;
}
.rozie-cropper-img[data-rozie-s-cddf3b42] {
  display: block;
  max-width: 100%;
}
`;

  /**
   * The image URL the cropper attaches to. Bound onto the `<img>` and reconciled at runtime — changing it calls the engine `replace(url)`.
   * @example
   * <Cropper :src="imageUrl" r-model:data="crop" />
   */
  @property({ type: String, reflect: true }) src: string = '';
  /**
   * The crop box — `{ x, y, width, height, rotate, scaleX, scaleY }`. The lone two-way `model: true` prop: dragging or resizing the crop box writes the new box back (round-trip-guarded so a programmatic write does not ping-pong), and a consumer write `setData`s the live cropper.
   */
  @property({ type: Object, attribute: 'data' }) _data_attr?: unknown;
  private _dataControllable = createLitControllableProperty<unknown>({ host: this, eventName: 'data-change', defaultValue: undefined, initialControlledValue: undefined });
  /**
   * The crop box aspect ratio. `NaN` (the default) is Cropper's sentinel for a free ratio. Reconciled at runtime via `setAspectRatio`.
   */
  @property({ type: Number, reflect: true }) aspectRatio: number = NaN;
  /**
   * The view constraint mode (`0`–`3`) that governs how the crop box is restricted to the canvas. Construction-only — Cropper.js v1 has no `setViewMode`.
   */
  @property({ type: Number, reflect: true }) viewMode: number = 0;
  /**
   * The drag behavior: `'crop'` draws a new box, `'move'` pans the canvas, `'none'` disables dragging. Reconciled at runtime via `setDragMode`.
   */
  @property({ type: String, reflect: true }) dragMode: string = 'crop';
  /**
   * Freeze the cropper so it no longer responds to user interaction. Reconciled at runtime via `enable()` / `disable()`.
   */
  @property({ type: Boolean, reflect: true }) disabled: boolean = false;
  /**
   * Show the dashed guide lines over the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) guides: boolean = true;
  /**
   * Show the center indicator inside the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) center: boolean = true;
  /**
   * Show the grid background behind the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) background: boolean = true;
  /**
   * Allow moving (panning) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) movable: boolean = true;
  /**
   * Allow rotating the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) rotatable: boolean = true;
  /**
   * Allow scaling (flipping) the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) scalable: boolean = true;
  /**
   * Allow zooming the image. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) zoomable: boolean = true;
  /**
   * Allow zooming the image via the mouse wheel. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) zoomOnWheel: boolean = true;
  /**
   * Allow moving the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) cropBoxMovable: boolean = true;
  /**
   * Allow resizing the crop box. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) cropBoxResizable: boolean = true;
  /**
   * Render a crop box automatically when the cropper initializes. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) autoCrop: boolean = true;
  /**
   * The initial crop-box size as a fraction of the canvas (`0`–`1`). Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Number, reflect: true }) autoCropArea: number = 0.8;
  /**
   * Re-render the cropper on window resize to keep it responsive. Construction-only — Cropper.js v1 has no runtime setter.
   */
  @property({ type: Boolean, reflect: true }) responsive: boolean = true;
  /**
   * Live crop-thumbnail target(s) — a selector string or element ref(s) (`HTMLElement`, array, or `NodeList`). Construction-only (v1 has no `setPreview`). On Lit prefer an element ref: a document selector cannot cross the wrapper's shadow boundary.
   */
  @property({ type: Object }) preview?: unknown;
  /**
   * Raw Cropper.js `Options` passthrough — spread into the constructor before the curated keys (explicit props win). Use it for any v1 option not surfaced as a first-class prop (`modal`, `restore`, `minCropBoxWidth`, `wheelZoomRatio`, …).
   */
  @property({ type: Object }) options: any = {};
  @query('[data-rozie-ref="imageEl"]') private _refImageEl!: HTMLImageElement;
private __rozieWatchInitial_4 = true;
private __rozieFirstUpdateDone = false;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  firstUpdated(): void {
    adoptDocumentStyles(this);

    this._disconnectCleanups.push((() => {
      if (this.instance) this.instance.destroy();
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this.data)(); untracked(() => { if (this.__rozieWatchInitial_4) { this.__rozieWatchInitial_4 = false; return; } ((v: any) => {
      if (!this.instance || !v) return;
      if (this.sameData(v, this.instance.getData())) return;
      this.instance.setData(v);
    })(__watchVal); }); }));

    // Ref the <img> directly — the engine's attach target (the flatpickr/codemirror
    // pattern). $refs is read ONLY here (ROZ123). The React emitter types an `img`
    // ref as HTMLElement (not HTMLImageElement) — a strict-tsc mismatch fixed by a
    // codegen type-aid (scripts/codegen.mjs), NOT an emitter edit (scope fence).
    this.imgEl = this._refImageEl;
    this.buildCropper(null);
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('src'))) { const __watchVal = (() => this.src)(); ((v: any) => {
      if (this.instance && typeof v === 'string' && v) this.instance.replace(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('aspectRatio'))) { const __watchVal = (() => this.aspectRatio)(); ((v: any) => {
      if (this.instance) this.instance.setAspectRatio(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('dragMode'))) { const __watchVal = (() => this.dragMode)(); ((v: any) => {
      if (this.instance && typeof v === 'string') this.instance.setDragMode(v);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('disabled'))) { const __watchVal = (() => this.disabled)(); ((v: any) => {
      if (!this.instance) return;
      if (v) this.instance.disable();else this.instance.enable();
    })(__watchVal); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'data') this._dataControllable.notifyAttributeChange(value as unknown as unknown);
  }

  render() {
    return html`
<div class="rozie-cropper" ${rozieSpread(this.$attrs)} ${rozieListeners(this.$listeners)} data-rozie-s-cddf3b42>
  <img class="rozie-cropper-img" src=${this.src} alt="" data-rozie-ref="imageEl" data-rozie-s-cddf3b42 />
</div>
`;
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
    ...this.options,
    aspectRatio: this.aspectRatio,
    viewMode: this.viewMode,
    dragMode: this.dragMode,
    guides: this.guides,
    center: this.center,
    background: this.background,
    movable: this.movable,
    rotatable: this.rotatable,
    scalable: this.scalable,
    zoomable: this.zoomable,
    zoomOnWheel: this.zoomOnWheel,
    cropBoxMovable: this.cropBoxMovable,
    cropBoxResizable: this.cropBoxResizable,
    autoCrop: this.autoCrop,
    autoCropArea: this.autoCropArea,
    responsive: this.responsive,
    // construction-time only — read DIRECTLY (NOT $snapshot'd): structuredClone
    // throws on the DOM element(s) a `preview` selector/ref resolves to.
    preview: this.preview,
    ready: (e: any) => {
      if (restoreData) this.instance.setData(restoreData);else if (this.data) this.instance.setData(this.data);
      if (this.disabled) this.instance.disable();
      // The engine's setup-time `crop` events (the default box fired BEFORE this
      // `ready`, and the `setData` echo just above) are suppressed by the `cropReady`
      // gate so they can't clobber the consumer's initial `:data` on unified-model
      // targets (Vue defineModel / Svelte $bindable / Angular model()). But two-way
      // consumers still need to READ the initial box, so echo the now-applied box
      // exactly ONCE here (after `$props.data` has been read for setData — no clobber),
      // then open the gate so genuine post-init user crops drive the model.
      this._dataControllable.write(this.instance.getData());
      this.cropReady = true;
      this.dispatchEvent(new CustomEvent("ready", {
        detail: undefined,
        bubbles: true,
        composed: true
      }));
    },
    cropstart: (e: any) => this.dispatchEvent(new CustomEvent("cropstart", {
      detail: {
        action: e.detail && e.detail.action
      },
      bubbles: true,
      composed: true
    })),
    cropmove: (e: any) => this.dispatchEvent(new CustomEvent("cropmove", {
      detail: {
        action: e.detail && e.detail.action
      },
      bubbles: true,
      composed: true
    })),
    cropend: (e: any) => this.dispatchEvent(new CustomEvent("cropend", {
      detail: {
        action: e.detail && e.detail.action
      },
      bubbles: true,
      composed: true
    })),
    // continuous crop → emit + drive the two-way model (guarded reverse $watch).
    crop: (e: any) => {
      // Suppress the engine's setup-time crops (the default box before `ready`, and
      // the `setData($props.data)` echo). Propagating them would (a) emit a spurious
      // pre-init `crop` and (b) on unified-model targets clobber the consumer's
      // initial `:data`. Genuine user crops fire after `cropReady`.
      if (!this.cropReady) return;
      this.dispatchEvent(new CustomEvent("crop", {
        detail: e.detail,
        bubbles: true,
        composed: true
      }));
      if (e.detail) this._dataControllable.write(e.detail);
    },
    zoom: (e: any) => this.dispatchEvent(new CustomEvent("zoom", {
      detail: {
        ratio: e.detail && e.detail.ratio,
        oldRatio: e.detail && e.detail.oldRatio
      },
      bubbles: true,
      composed: true
    }))
  };
  this.instance = new CropperEngine(this.imgEl, cfg);
};

  getCropper() {
    return this.instance;
  }

  getData(rounded: any) {
    return this.instance ? this.instance.getData(rounded) : null;
  }

  getCanvasData() {
    return this.instance ? this.instance.getCanvasData() : null;
  }

  getCropBoxData() {
    return this.instance ? this.instance.getCropBoxData() : null;
  }

  getImageData() {
    return this.instance ? this.instance.getImageData() : null;
  }

  getContainerData() {
    return this.instance ? this.instance.getContainerData() : null;
  }

  getCroppedCanvas(opts: any) {
    return this.instance ? this.instance.getCroppedCanvas(opts) : null;
  }

  getCroppedDataURL(opts: any) {
    if (!this.instance) return null;
    const canvas = this.instance.getCroppedCanvas(opts);
    return canvas ? canvas.toDataURL() : null;
  }

  reset() {
    if (this.instance) this.instance.reset();
  }

  clear() {
    if (this.instance) this.instance.clear();
  }

  showCropBox() {
    if (this.instance) this.instance.crop();
  }

  replace(url: any) {
    if (this.instance) this.instance.replace(url);
  }

  rotateTo(deg: any) {
    if (this.instance) this.instance.rotateTo(deg);
  }

  rotateBy(deg: any) {
    if (this.instance) this.instance.rotate(deg);
  }

  zoomTo(ratio: any, pivot: any) {
    if (this.instance) this.instance.zoomTo(ratio, pivot);
  }

  zoomBy(ratio: any) {
    if (this.instance) this.instance.zoom(ratio);
  }

  scaleX(n: any) {
    if (this.instance) this.instance.scaleX(n);
  }

  scaleY(n: any) {
    if (this.instance) this.instance.scaleY(n);
  }

  scale(x: any, y: any) {
    if (this.instance) this.instance.scale(x, y);
  }

  setCanvasData(d: any) {
    if (this.instance) this.instance.setCanvasData(d);
  }

  setCropBoxData(d: any) {
    if (this.instance) this.instance.setCropBoxData(d);
  }

  moveTo(x: any, y: any) {
    if (this.instance) this.instance.moveTo(x, y);
  }

  move(offsetX: any, offsetY: any) {
    if (this.instance) this.instance.move(offsetX, offsetY);
  }

  enable() {
    if (this.instance) this.instance.enable();
  }

  disable() {
    if (this.instance) this.instance.disable();
  }

  setAspectRatio(ratio: any) {
    if (this.instance) this.instance.setAspectRatio(ratio);
  }

  setDragMode(mode: any) {
    if (this.instance) this.instance.setDragMode(mode);
  }

  get data(): unknown { return this._dataControllable.read(); }
  set data(v: unknown) { this._dataControllable.notifyPropertyWrite(v); }

  /**
   * Plan 14-05 — cross-framework attribute fallthrough source. Reads the
   * host custom element's attributes on each call so a consumer-side bound
   * attribute flows through on every render. The `rozieSpread` directive
   * (D-02) does the cross-render diff downstream.
   *
   * Phase 15 follow-up Bug A — declared-prop attribute names are filtered
   * out so `$attrs` returns "rest after declared props" (semantic parity
   * with React/Vue/Svelte/Solid/Angular). Both Lit attribute-naming
   * forms are folded into the skip set: kebab-case for model props
   * (explicit `attribute:`) AND lowercased property name (Lit's default).
   *
   * command-palette-per-level-virtual / portal-through-portal cluster —
   * `data-rozie-ref` is ALWAYS skipped too (a reserved compiler bookkeeping
   * attribute, never a consumer prop) so a parent-assigned `ref=` on this
   * component's own host tag can never clobber this component's OWN
   * internal `data-rozie-ref` ref markers via fallthrough re-application.
   */
  private get $attrs(): Record<string, string> {
    const __skip = new Set<string>(['data-rozie-ref', 'src', 'data', 'aspect-ratio', 'aspectratio', 'view-mode', 'viewmode', 'drag-mode', 'dragmode', 'disabled', 'guides', 'center', 'background', 'movable', 'rotatable', 'scalable', 'zoomable', 'zoom-on-wheel', 'zoomonwheel', 'crop-box-movable', 'cropboxmovable', 'crop-box-resizable', 'cropboxresizable', 'auto-crop', 'autocrop', 'auto-crop-area', 'autocroparea', 'responsive', 'preview', 'options']);
    const out: Record<string, string> = {};
    for (const a of Array.from(this.attributes)) {
      if (__skip.has(a.name)) continue;
      out[a.name] = a.value;
    }
    return out;
  }

  /**
   * Phase 15 D-19 — consumer-passed listener cluster placeholder.
   * Lit attaches event listeners directly on the host element via
   * `addEventListener` (no per-instance prop rest binding), so the
   * runtime value is undefined; the `rozieListeners` directive's
   * nullish coercion (`obj ?? {}`) handles the no-op cleanly.
   * The declaration exists to satisfy `tsc --noEmit` on consumer
   * projects with strict mode — bare `$listeners` in `render()`
   * would otherwise raise TS2304 (Cannot find name).
   */
  private get $listeners(): Record<string, EventListener> | undefined {
    return undefined;
  }
}
