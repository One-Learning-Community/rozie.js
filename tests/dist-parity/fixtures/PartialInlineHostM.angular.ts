import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-partial-inline-host-m',
  standalone: true,
  template: `

    <div class="partial-inline-host" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="echo">{{ rozieDisplay(gridKeydownHandlersM(1, 2)) }}</span>
      <span class="echo">{{ rozieDisplay(refreshRowModelM) }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-partial-inline-host-m) { display: contents; }
  `],
})
export class PartialInlineHostM {
  base = input<number>(1);

  ngAfterViewInit() {
    this.refreshRowModelM = this.gridKeydownHandlersM(1, this.headM(2));
  }

  headM = (n: number): number => n + 1;
  gridKeydownHandlersM = (rIdx: number, cIdx: number): number => {
    const active = rIdx + cIdx;
    return active;
  };
  // the row-selection slice tracks which rows are checked
  // across header-group and body rows alike
  // inRange(rIdx, cIdx) gates the active cell within the
  // current 2-D selection range before a keydown commits
  refreshRowModelM = 0;

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

export default PartialInlineHostM;
