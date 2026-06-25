import { Component, DestroyRef, InjectionToken, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-layer',
  standalone: true,
  template: `

  `,
})
export class Layer {
  /**
   * The MapLibre layer id (required). Identifies the layer in the parent `<MapLibre>` registry and the underlying style.
   * @example
   * <Layer id="circles" type="circle" :paint="{ 'circle-radius': 5 }" />
   */
  id = input.required<string>();
  /**
   * The `LayerSpecification.type` — `'circle'` / `'fill'` / `'line'` / `'symbol'` / `'raster'` / `'background'` / … A `'background'` layer needs no source; every other type requires a `source` (explicit or injected from a parent `<Source>`).
   */
  type = input<string>(undefined);
  /**
   * The layer's `paint` properties (the `LayerSpecification.paint` object, e.g. `{ 'line-color': '#e11', 'line-width': 3 }`). Changes are reconciled via `setPaintProperty` with no remount.
   */
  paint = input<unknown>(undefined);
  /**
   * The layer's `layout` properties (the `LayerSpecification.layout` object, e.g. `{ 'line-cap': 'round' }`). Changes are reconciled via `setLayoutProperty` with no remount.
   */
  layout = input<unknown>(undefined);
  /**
   * Explicit source id for the flat shape (a background layer needs none, or a cross-source reference). When omitted inside a `<Source>`, the injected source context supplies the id automatically.
   */
  source = input<string>(undefined);
  /**
   * Insert this layer immediately **before** the layer with this id, controlling draw order (the `addLayer` `beforeId` argument). Omit to append on top.
   */
  beforeId = input<string>(undefined);
  srcCtx = inject(rozieToken('maplibre:source'), { optional: true }) ?? null;
  layers = inject(rozieToken('maplibre:layers'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;
  private __rozieWatchInitial_3 = true;

  constructor() {
    this.reg = this.layers;
    this.ctx = this.srcCtx;

    // Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
    // else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
    // at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
    // on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
    // the `any` alias so the `.id` read type-checks on the strict bundled leaves.
    effect(() => { const __watchVal = (() => this.resolveSource())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((src: any) => {
      if (!this.reg || src == null || src === this.appliedSource) return;
      this.appliedSource = src;
      this.reg.update(this.id(), this.buildSpec());
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.paint())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      const __id = this.id();
      if (this.reg) this.reg.update(__id, {
        id: __id,
        type: this.type(),
        paint: this.paint(),
        layout: this.layout(),
        source: this.resolveSource(),
        beforeId: this.beforeId()
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.layout())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => {
      const __id = this.id();
      if (this.reg) this.reg.update(__id, {
        id: __id,
        type: this.type(),
        paint: this.paint(),
        layout: this.layout(),
        source: this.resolveSource(),
        beforeId: this.beforeId()
      });
    })(); }); });
    effect(() => { const __watchVal = (() => this.type())(); untracked(() => { if (this.__rozieWatchInitial_3) { this.__rozieWatchInitial_3 = false; return; } (() => {
      const __id = this.id();
      if (this.reg) this.reg.update(__id, {
        id: __id,
        type: this.type(),
        paint: this.paint(),
        layout: this.layout(),
        source: this.resolveSource(),
        beforeId: this.beforeId()
      });
    })(); }); });
  }

  ngAfterViewInit() {
    if (this.reg) {
      this.didRegister = true;
      this.appliedSource = this.resolveSource();
      this.reg.register(this.id(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.reg) this.reg.unregister(this.id());
    });
  }

  reg: any = null;
  ctx: any = null;
  resolveSource = () => this.source() ?? (this.ctx && this.ctx.id);
  appliedSource: any = null;
  didRegister = false;
  buildSpec = () => ({
    id: this.id(),
    type: this.type(),
    paint: this.paint(),
    layout: this.layout(),
    source: this.resolveSource(),
    beforeId: this.beforeId()
  });
}

export default Layer;
