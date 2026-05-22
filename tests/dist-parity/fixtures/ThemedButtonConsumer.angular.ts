import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, viewChild } from '@angular/core';

import { ThemedButton } from './ThemedButton';
import { ThemedButtonManual } from './ThemedButtonManual';

@Component({
  selector: 'rozie-themed-button-consumer',
  standalone: true,
  imports: [ThemedButton, ThemedButtonManual],
  template: `

    <div class="themed-button-consumer" #rozieSpread_0>
      <rozie-themed-button id="auto-btn" type="button" aria-label="Auto-fallthrough button" data-testid="auto-themed-button" class="extra-variant" style="--btn-bg: #ef4444" [label]="'Auto'"></rozie-themed-button>

      <rozie-themed-button-manual id="manual-btn" type="button" aria-label="Manual fallthrough button" data-testid="manual-themed-button" class="extra-variant" style="--btn-bg: #10b981" [label]="'Manual'"></rozie-themed-button-manual>
    </div>

  `,
  styles: [`
    .themed-button-consumer {
      display: inline-flex;
      gap: 0.75rem;
      padding: 0.5rem;
    }
    .extra-variant {
      font-weight: 600;
    }
  `],
})
export class ThemedButtonConsumer {


  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    let prevKeys: string[] = [];
    return (el: HTMLElement, obj: Record<string, unknown>) => {
      for (const k of prevKeys) {
        if (!(k in obj)) renderer.removeAttribute(el, k);
      }
      for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === false) renderer.removeAttribute(el, k);
        else renderer.setAttribute(el, k, String(v));
      }
      prevKeys = Object.keys(obj);
    };
  })();

  private __rozieGetHostAttrs = (() => {
    const host = inject(ElementRef);
    return () => {
      const el = host.nativeElement as HTMLElement;
      const out: Record<string, unknown> = {};
      for (const a of Array.from(el.attributes)) out[a.name] = a.value;
      return out;
    };
  })();

  private __rozieSpread_0_effect = effect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });
}

export default ThemedButtonConsumer;
