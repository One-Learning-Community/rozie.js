import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-class-selector-probe',
  standalone: true,
  template: `

    <div class="panel" [attr.data-handle]="rozieAttr('.panel')" [attr.data-grip]="rozieAttr(gripSelector)" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="grip" aria-hidden="true">⋮⋮</span>
      @if (ready()) {
    <span>ready</span>
    }</div>

  `,
  styles: [`
    :host(rozie-class-selector-probe) { display: contents; }
    .panel {
      display: block;
      padding: 0.5rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .grip {
      cursor: grab;
      user-select: none;
      color: rgba(0, 0, 0, 0.35);
    }
  `],
})
export class ClassSelectorProbe {
  ready = signal(false);

  ngAfterViewInit() {
    this.ready.set(true);
  }

  // script-position class-selector helper call — exercises the rewriteScript.ts
  // hook. Lowers per-target: ".grip" literal (Vue/Svelte/Solid/Angular/Lit) or
  // "." + styles.grip (React).
  gripSelector = ".grip";

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

export default ClassSelectorProbe;
