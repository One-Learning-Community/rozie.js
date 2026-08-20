import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { createRozieAttrApplier } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-rbind-probe',
  standalone: true,
  imports: [NgClass],
  template: `

    <div class="rbind-probe" #rozieListenersTarget_0>
      <span [ngClass]="['a', 'b']" #rozieSpread_1>canonical</span>
      <span #rozieSpread_2 [ngClass]="['b', 'a']">reordered</span>
    </div>

  `,
  styles: [`
    :host(rozie-rbind-probe) { display: contents; }
    .rbind-probe {
      display: inline-flex;
      gap: 0.5rem;
      padding: 0.25rem;
    }
    .a { color: #1f2937; }
    .b { font-weight: 700; }
  `],
})
export class RBindProbe {


  private __rozieDestroyRef = inject(DestroyRef);

  private rozieListenersTarget_0 = viewChild<ElementRef>('rozieListenersTarget_0');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_0: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_0 = false;

  private __rozieListenersEffect_0 = effect(() => {
    const el = this.rozieListenersTarget_0()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_0) off();
    this.__rozieListenersDisposers_0 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_0.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_0) {
      this.__rozieListenersDestroyRegistered_0 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_0) off();
        this.__rozieListenersDisposers_0 = [];
      });
    }
  });

  private rozieSpread_1 = viewChild<ElementRef>('rozieSpread_1');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieSpread_1_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_1()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'x' });
  });

  private rozieSpread_2 = viewChild<ElementRef>('rozieSpread_2');

  private __rozieSpread_2_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_2()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'y' });
  });
}

export default RBindProbe;
