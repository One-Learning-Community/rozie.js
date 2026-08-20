import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-expose-probe',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="expose-probe" #rozieSpread_0 #rozieListenersTarget_1>
      <input #field type="text" [ngModel]="value()" (ngModelChange)="value.set($event)" [ngModelOptions]="{standalone: true}" placeholder="Type something" />
      <span class="echo">{{ value() }}</span>
    </div>

  `,
  styles: [`
    :host(rozie-expose-probe) { display: contents; }
    .expose-probe { display: inline-flex; align-items: center; gap: 0.5rem; }
    input { padding: 0.25rem 0.5rem; }
    .echo { font-variant-numeric: tabular-nums; color: rgba(0, 0, 0, 0.6); }
  `],
})
export class ExposeProbe {
  value = signal('');
  field = viewChild<ElementRef<HTMLInputElement>>('field');

  reset = (): void => {
    this.value.set('');
  };
  focus = (): void => {
    this.field()!.nativeElement.focus();
  };

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

export default ExposeProbe;
