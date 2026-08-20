import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, signal, viewChild } from '@angular/core';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

import { DynamicSlots } from './DynamicSlots';

@Component({
  selector: 'rozie-dynamic-slots-consumer',
  standalone: true,
  imports: [RozieSlot, DynamicSlots],
  template: `

    <div class="dynamic-slots-consumer" #rozieSpread_0 #rozieListenersTarget_1>
      <rozie-dynamic-slots [columns]="[{ key: 'status' }, { key: 'score' }]" [row]="{ status: 'Active', score: 42 }" [total]="7"><ng-template [rozieSlot]="'cell-status'" let-row="row" let-value="value">
          <span class="status">{{ rozieDisplay(value) }}</span>
        </ng-template><ng-template [rozieSlot]="'cell-score'" let-row="row" let-value="value">
          <span class="score">{{ rozieDisplay(value) }}</span>
        </ng-template><ng-template [rozieSlot]="'cell-total'" let-value="value">
          <strong>{{ rozieDisplay(value) }}</strong>
        </ng-template><ng-template #headerCell let-title="title">
          <h2>{{ rozieDisplay(title) }}</h2>
        </ng-template><ng-template [rozieSlot]="dynamicFillKey()" let-label="label">
          <em>{{ rozieDisplay(label) }}</em>
        </ng-template></rozie-dynamic-slots>
    </div>

  `,
  styles: [`
    :host(rozie-dynamic-slots-consumer) { display: contents; }
  `],
})
export class DynamicSlotsConsumer {
  dynamicFillKey = signal('freeform');

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

export default DynamicSlotsConsumer;
