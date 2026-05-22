import { Component, ContentChild, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CardHeader } from './CardHeader';

interface DefaultCtx {}

@Component({
  selector: 'rozie-card',
  standalone: true,
  imports: [NgTemplateOutlet, CardHeader],
  template: `

    <article class="card" #rozieSpread_0>
      <rozie-card-header [title]="title()" [onClose]="onClose()"></rozie-card-header>
      <div class="card__body">
        <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" />
      </div>
    </article>

  `,
  styles: [`
    .card { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; background: #fff; }
    .card__body { padding: 1rem; }
  `],
})
export class Card {
  title = input<string>('');
  onClose = input<((...args: unknown[]) => unknown) | null>(null);
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: Card,
    _ctx: unknown,
  ): _ctx is DefaultCtx {
    return true;
  }

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

export default Card;
