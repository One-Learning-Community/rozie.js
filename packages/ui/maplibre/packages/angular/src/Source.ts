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
  id = input.required<string>();
  spec = input<unknown>(undefined);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  sources = inject(rozieToken('maplibre:sources'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
    this.reg = this.sources;
    effect(() => { const __watchVal = (() => this.spec())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } ((v: any) => {
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
    if (this.reg) this.reg.register(__id, {
      id: __id,
      spec: this.spec()
    });
    // unregister on unmount so the parent reaps this source (its layers first).
    this.__rozieDestroyRef.onDestroy(() => {
      if (this.reg) this.reg.unregister(__id);
    });
  }

  reg: any = null;

  static ngTemplateContextGuard(
    _dir: Source,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }
}

export default Source;
