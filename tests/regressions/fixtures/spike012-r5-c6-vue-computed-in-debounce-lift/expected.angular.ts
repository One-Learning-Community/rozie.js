import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, computed, effect, inject, signal, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-computed-in-debounce-lift',
  standalone: true,
  template: `

    <input #rozieSpread_0 (input)="debouncedHandler1_1($event)" #rozieListenersTarget_2 />

  `,
  styles: [`
    :host(rozie-computed-in-debounce-lift) { display: contents; }
  `],
})
export class ComputedInDebounceLift {
  q = signal('');

  label = computed(() => 'x');

  private __rozieDestroyRef = inject(DestroyRef);

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private debouncedHandler1_1 = (() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: any[]) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => ((($event: any) => { this.q.set(this.label()); }) as (...a: any[]) => any)(...args), 300);
    };
  })();

  private rozieListenersTarget_2 = viewChild<ElementRef>('rozieListenersTarget_2');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_2: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_2 = false;

  private __rozieListenersEffect_2 = effect(() => {
    const el = this.rozieListenersTarget_2()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_2) off();
    this.__rozieListenersDisposers_2 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_2.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_2) {
      this.__rozieListenersDestroyRegistered_2 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_2) off();
        this.__rozieListenersDisposers_2 = [];
      });
    }
  });
}

export default ComputedInDebounceLift;
