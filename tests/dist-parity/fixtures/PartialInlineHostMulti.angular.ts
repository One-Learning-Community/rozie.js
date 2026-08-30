import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, computed, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import { clampB } from './partial-helpers.js';
import { clampD } from './wr01-helpers.js';

@Component({
  selector: 'rozie-partial-inline-host-multi',
  standalone: true,
  template: `

    <div class="partial-inline-host" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="echo">{{ rozieDisplay(editTransitionM) }}</span>
      <span class="echo">{{ rozieDisplay(hostTailM(1)) }}</span>
      <span class="echo">{{ rozieDisplay(columnChromeM(1)) }}</span>
      <span class="echo">{{ rozieDisplay(outerM()) }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-partial-inline-host-multi) { display: contents; }
  `],
})
export class PartialInlineHostMulti {
  base = input<number>(1);

  ngAfterViewInit() {
    this.editTransitionM = 2;
  }

  inner = computed(() => this.base() + 10);
  outerM = computed(() => clampD(this.inner() + this.base()));

  headM = (n: number): number => n + 1;
  editTransitionM = 1;
  // after-side: comment trails the host let editTransitionM and leads the spliced editorBindingsM below
  editorBindingsM = (k: number): number => k * 2;
  // trailing-seam: the inline host successor trails the spliced editorBindingsM
  hostTailM = (n: number): number => this.editorBindingsM(1) + this.headM(n);
  tickM = (): number => this.base() * 2;
  // gap-0 leading: stays with the extracted columnChromeM, must NOT float to the hoisted import
  columnChromeM = (k: number): number => clampB(this.tickM() + k);

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

export default PartialInlineHostMulti;
