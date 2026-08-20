import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, signal, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-prop-default-coercion',
  standalone: true,
  template: `

    <div class="pdc" #rozieSpread_0 #rozieListenersTarget_1>
      <pre data-rozie-pdc-output="">{{ rozieDisplay(JSON.stringify(observed())) }}</pre>
      
      <span data-rozie-pdc-e-identity="">{{ rozieDisplay(e() === e() ? 'true' : 'false') }}</span>
      <span data-rozie-pdc-f-identity="">{{ rozieDisplay(f() === f() ? 'true' : 'false') }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-prop-default-coercion) { display: contents; }
    .pdc {
      display: inline-flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.25rem;
      font-family: ui-monospace, monospace;
    }
    .pdc pre {
      margin: 0;
    }
  `],
})
export class PropDefaultCoercion {
  a = input<(Record<string, any>) | null>(null);
  b = input<number>(0);
  c = input<string>('');
  d = input<boolean>(false);
  e = input<any[]>((() => [])());
  f = input<Record<string, any>>((() => ({
    k: 1
  }))());
  observed = signal<any>(null);

  ngAfterViewInit() {
    this.observed.set({
      a: this.a(),
      b: this.b(),
      c: this.c(),
      d: this.d(),
      e: this.e(),
      f: this.f()
    });
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

  protected readonly JSON = JSON;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default PropDefaultCoercion;
