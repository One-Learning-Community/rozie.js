import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-prop-docs',
  standalone: true,
  template: `

    <div class="prop-docs" #rozieSpread_0 #rozieListenersTarget_1>
      <span class="label">{{ label() }}</span>
      <span class="count">{{ count() }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-prop-docs) { display: contents; }
    .prop-docs { display: inline-flex; gap: 0.5rem; align-items: center; }
    .label { font-weight: 600; }
    .count { font-variant-numeric: tabular-nums; }
  `],
})
export class PropDocs {
  /**
   * The visible text label for the control.
   * @deprecated Use `text` instead — `label` is retained only for back-compat.
   * @example
   * <rozie-prop-docs label="Save" />
   */
  label = input<string>('');
  count = input<number>(0);

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

export default PropDocs;
