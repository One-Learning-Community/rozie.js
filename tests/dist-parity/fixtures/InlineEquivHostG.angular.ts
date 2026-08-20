import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-inline-equiv-host-g',
  standalone: true,
  template: `

    <div class="partial-inline-host" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="echo">{{ rozieDisplay(selectAllBoxG) }}</span>
      <span class="echo">{{ rozieDisplay(afterDeclG(1)) }}</span>
      <span class="echo">{{ rozieDisplay(rangeTransitionG) }}</span>
      <span class="echo">{{ rozieDisplay(beforeDeclG(1)) }}</span>
      <span class="echo">{{ rozieDisplay(fillDragUpG) }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-inline-equiv-host-g) { display: contents; }
  `],
})
export class InlineEquivHostG {
  base = input<number>(1);

  headG = (n: number): number => n + 1;
  selectAllBoxG = this.headG(1);
  afterDeclG = (k: number): number => k * 2;
  midDeclG = (k: number): number => k + 3;
  rangeTransitionG = this.midDeclG(1);
  beforeDeclG = (k: number): number => k * 5;
  fillDragUpG = this.beforeDeclG(1);

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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default InlineEquivHostG;
