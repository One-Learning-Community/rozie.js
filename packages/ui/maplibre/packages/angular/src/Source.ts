import { Component, ContentChild, DestroyRef, TemplateRef, ViewEncapsulation, computed, contentChildren, effect, forwardRef, inject, input, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, rozieToken } from '@rozie/runtime-angular';

interface DefaultCtx {}

@Component({
  selector: 'rozie-source',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />

  `,
  styles: [`
    :host(rozie-source) { display: contents; }
  `],
  providers: [
    {
      provide: rozieToken('maplibre:source'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => Source)); return ({
  get id() {
    return __rozieCtxHost.id();
  }
}); },
    },
  ],
})
export class Source {
  /**
   * The MapLibre source id (required). A `LayerSpecification.source` references this string, and nested `<Layer>` children auto-bind to it. Exposed to children as a live getter so it stays reactive.
   * @example
   * <rozie-source id="pts" [spec]="geojson"><rozie-layer id="circles" type="circle" /></rozie-source>
   */
  id = input.required<string>();
  /**
   * The `SourceSpecification` (geojson / vector / raster / …). Registered into the parent `<MapLibre>` on mount and reconciled via `setData` (geojson) or re-add on change, once the style has loaded.
   */
  spec = input<unknown>(undefined);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });
  sources = inject(rozieToken('maplibre:sources'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;

  constructor() {
    this.reg = this.sources;
    effect(() => { const __watchVal = (() => this.sources)(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((live: any) => {
      const __id = this.id();
      if (this.didRegister || live == null) return;
      this.reg = live;
      this.didRegister = true;
      this.reg.register(__id, {
        id: __id,
        spec: this.spec()
      });
    })(__watchVal); }); });
    effect(() => { const __watchVal = (() => this.spec())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } ((v: any) => {
      const __id = this.id();
      if (this.reg) this.reg.update(__id, {
        id: __id,
        spec: v
      });
    })(__watchVal); }); });
  }

  ngAfterViewInit() {
    const __id = this.id();
    // register this source's spec into the parent registry; the parent's
    // applyLayers() reconcile (style-load gated) picks it up via its registry watch.
    // On Lit the injected sources registry may still be undefined here (async
    // context, REQ-30) — the $onUpdate below registers once it resolves.
    if (this.reg && !this.didRegister) {
      this.didRegister = true;
      this.reg.register(__id, {
        id: __id,
        spec: this.spec()
      });
    }
    // unregister on unmount so the parent reaps this source (its layers first).
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.reg) this.reg.unregister(__id);
    });
  }

  // $inject is typed `unknown` (Phase 36 D-4: no rich type synthesis yet), which the
  // STRICT BUNDLED-LEAF tsc rejects on `.register(...)` (TS2339). The .rozie-native
  // fix is the null-let → `any` typeNeutralize idiom: alias the injected API through
  // a MODULE-SCOPE `let reg = null` (typeNeutralize types it `any`) kept fresh from
  // the live inject every setup pass. Module-scope (not hook-local) so the alias is
  // in scope from the Solid teardown — which the Solid emitter hoists into a sibling
  // onCleanup() OUTSIDE the mount closure (the same reason MapLibre keeps its entry
  // maps at component scope). On React the alias is auto-hoisted to per-instance
  // useRef storage and re-synced every render — the stable registry-API object makes
  // that benign. ZERO emitter change (the Phase 35 NO-emitter-touch lesson).
  reg: any = null;
  // idempotency flag so the $onMount register and the late-context $onUpdate path
  // (Lit async, REQ-30) never double-register the source.
  didRegister = false;

  static ngTemplateContextGuard(
    _dir: Source,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default Source;
