import { Component, ContentChild, DestroyRef, InjectionToken, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface DefaultCtx {}

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
  selector: 'rozie-source',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />

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
   * <Source id="pts" :spec="geojson"><Layer id="circles" type="circle" /></Source>
   */
  id = input.required<string>();
  /**
   * The `SourceSpecification` (geojson / vector / raster / …). Registered into the parent `<MapLibre>` on mount and reconciled via `setData` (geojson) or re-add on change, once the style has loaded.
   */
  spec = input<unknown>(undefined);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  sources = inject(rozieToken('maplibre:sources'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;

  constructor() {
    this.reg = this.sources;

    // idempotency flag so the $onMount register and the late-context $onUpdate path
    // (Lit async, REQ-30) never double-register the source.
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

  reg: any = null;
  didRegister = false;

  static ngTemplateContextGuard(
    _dir: Source,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default Source;
