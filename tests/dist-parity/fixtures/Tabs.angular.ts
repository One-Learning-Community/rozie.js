import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieToken } from '@rozie/runtime-angular';

interface DefaultCtx {}

@Component({
  selector: 'rozie-tabs',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="tabs" data-tabs="" role="tablist" #rozieSpread_0 #rozieListenersTarget_1>
      <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot'])" />
    </div>

  `,
  styles: [`
    :host(rozie-tabs) { display: contents; }
    .tabs {
      display: flex;
      gap: 0.25rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
  `],
  providers: [
    {
      provide: rozieToken('tabs'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => Tabs)); return ({
  get active() {
    return __rozieCtxHost.active();
  },
  setActive: __rozieCtxHost.selectActive
}); },
    },
  ],
})
export class Tabs {
  active = signal(0);
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

  // NOTE: this helper is intentionally NOT named `setActive` — React
  // auto-generates a `setActive` setter for the `$data.active` state field, and a
  // same-named user function collides with it (ROZ524: "already declared" +
  // infinite recursion when `$data.active = v` rewrites to `setActive(v)`). The
  // PROVIDED key is still `setActive` (the consumer-facing API); only the local
  // implementation name differs.
  selectActive = (index: any) => {
    this.active.set(index);
  };

  static ngTemplateContextGuard(
    _dir: Tabs,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

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

export default Tabs;
