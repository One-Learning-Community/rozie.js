import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay, rozieToken } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-tab',
  standalone: true,
  imports: [NgClass],
  template: `

    <button class="tab" [ngClass]="{ 'is-active': tabs && tabs.active === index() }" data-tab="" type="button" role="tab" [attr.data-active]="rozieAttr(tabs && tabs.active === index())" #rozieSpread_0 (click)="tabs && tabs.setActive(index())" #rozieListenersTarget_1>
      {{ label() }}
    </button>

  `,
  styles: [`
    :host(rozie-tab) { display: contents; }
    .tab {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 0.375rem 0.75rem;
      border: 1px solid rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
    }
    .tab.is-active {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
    }
  `],
})
export class Tab {
  label = input<string>('');
  index = input<number>(0);
  tabs = inject(rozieToken('tabs'));

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

export default Tab;
