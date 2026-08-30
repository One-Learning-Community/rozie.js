import { Component, DestroyRef, ViewEncapsulation, effect, inject, input, untracked } from '@angular/core';
import { rozieToken } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-layer',
  standalone: true,
  template: `

  `,
  styles: [`
    :host(rozie-layer) { display: contents; }
  `],
})
export class Layer {
  /**
   * The MapLibre layer id (required). Identifies the layer in the parent `<MapLibre>` registry and the underlying style.
   * @example
   * <rozie-layer id="circles" type="circle" [paint]="{ 'circle-radius': 5 }" />
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

  // $inject is typed `unknown` (Phase 36 D-4), which the STRICT BUNDLED-LEAF tsc
  // rejects on `.register(...)` / `srcCtx.id` (TS2339). The .rozie-native fix is the
  // null-let → `any` typeNeutralize idiom: alias each injected value through a
  // MODULE-SCOPE `let … = null` (typeNeutralize types it `any`). Module-scope (not
  // hook-local) so the alias is in scope from the Solid teardown — which the Solid
  // emitter hoists into a sibling onCleanup() OUTSIDE the mount closure. On React the
  // aliases auto-hoist to per-instance useRef storage and re-sync every render — the
  // stable registry-API object / source ctx make that benign. ZERO emitter change.
  reg: any = null;
  ctx: any = null;
  // Effective source id: explicit prop wins, else the nearest <Source> ancestor id,
  // else undefined (a sourceless layer e.g. background). Reads the LIVE `ctx`/`srcCtx`
  // at CALL time so a late-resolving <Source> context (parent mounts AFTER this child
  // on React/Vue/Svelte/Angular; async on Lit) is picked up on re-register. `ctx` is
  // the `any` alias so the `.id` read type-checks on the strict bundled leaves.
  resolveSource = () => this.source() ?? (this.ctx && this.ctx.id);
  // The last source id we registered with. A nested <Layer> may register on mount
  // (React/Vue/Svelte/Angular) BEFORE its <Source> parent has mounted, so its
  // injected source ctx is null and resolveSource() yields undefined — registering a
  // non-background layer with no source, which applyLayers can't add. When the source
  // ctx resolves we re-register with the now-correct source id (idempotent upsert in
  // the parent registry). null = not yet registered.
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
