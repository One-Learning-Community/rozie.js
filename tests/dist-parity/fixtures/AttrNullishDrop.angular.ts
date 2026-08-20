import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, signal, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-attr-nullish-drop',
  standalone: true,
  template: `

    <div class="attr-nullish-drop" #rozieSpread_0 #rozieListenersTarget_1>
      <span [attr.data-x]="rozieAttr(cond() ? 'v' : null)" [attr.aria-expanded]="rozieAttr(cond() ? 'true' : 'false')" [attr.title]="rozieAttr(maybeNull())">probe</span>
      <span class="attr-nullish-drop-prop" [attr.title]="rozieAttr(maybeNullProp())">probe-prop</span>
      @for (c of loopItems(); track c) {
    <i class="attr-nullish-drop-loop" [attr.title]="rozieAttr(maybeNullProp())">{{ rozieDisplay(c) }}</i>
    }
    </div>

  `,
  styles: [`
    :host(rozie-attr-nullish-drop) { display: contents; }
  `],
})
export class AttrNullishDrop {
  maybeNullProp = input<(string) | null>(null);
  cond = signal(false);
  maybeNull = signal<any>(null);
  loopItems = signal(['a', 'b']);

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

export default AttrNullishDrop;
