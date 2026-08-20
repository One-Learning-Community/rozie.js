import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, afterRenderEffect, effect, inject, input, viewChild } from '@angular/core';
import { createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-badge-grid-styled-scss',
  standalone: true,
  template: `

    <div class="badge-grid" #rozieSpread_0 #rozieListenersTarget_1>
      @for (badge of badges(); track badge) {
    <span class="badge badge--neutral">
        {{ rozieDisplay(badge) }}
      </span>
    }
    </div>

  `,
  styles: [`
    :host(rozie-badge-grid-styled-scss) { display: contents; }
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .badge {
      padding: 2px 8px;
    }
    .badge--neutral {
      color: #ffffff;
      background: #6b7280;
    }
    .badge--success {
      color: #ffffff;
      background: #16a34a;
    }
    .badge--warning {
      color: #ffffff;
      background: #d97706;
    }
    .badge--danger {
      color: #ffffff;
      background: #dc2626;
    }
    .badge-grid--gap-1 {
      gap: 4px;
    }
    .badge-grid--gap-2 {
      gap: 8px;
    }
    .badge-grid--gap-3 {
      gap: 12px;
    }
  `],
})
export class BadgeGridStyledScss {
  badges = input<any[]>((() => [])());

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

export default BadgeGridStyledScss;
