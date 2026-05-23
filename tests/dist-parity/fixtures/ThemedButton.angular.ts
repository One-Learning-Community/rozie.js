import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-themed-button',
  standalone: true,
  template: `

    <button class="btn" [ngClass]="variant()" [style]="{ '--btn-bg': '#3b82f6', '--btn-fg': '#ffffff' }" #rozieSpread_0>
      {{ label() }}
    </button>

  `,
  styles: [`
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      border: 1px solid rgba(0, 0, 0, 0.15);
      background: var(--btn-bg, #3b82f6);
      color: var(--btn-fg, #ffffff);
      font: inherit;
      cursor: pointer;
    }
    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class ThemedButton {
  label = input<string>('Click me');
  variant = input<string>('primary');

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (v === null || v === false) renderer.removeAttribute(el, k);
        else renderer.setAttribute(el, k, String(v));
      }
      prevKeysByElement.set(el, Object.keys(safeObj));
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

export default ThemedButton;
