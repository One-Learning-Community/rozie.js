import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-card-header',
  standalone: true,
  template: `

    <header class="card-header" #rozieSpread_0>
      <h3 class="card-header__title">{{ title() }}</h3>
      @if (onClose()) {
    <button class="card-header__close" (click)="(onClose())($event)">×</button>
    }</header>

  `,
  styles: [`
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; }
    .card-header__title { margin: 0; font-size: 1rem; font-weight: 600; }
    .card-header__close { background: none; border: 0; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1; }
  `],
})
export class CardHeader {
  title = input<string>('');
  onClose = input<((...args: unknown[]) => unknown) | null>(null);

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

export default CardHeader;
