import { Component, ContentChild, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, computed, effect, inject, input, model, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface ItemCtx {
  $implicit: { item: any; remaining: any };
  item: any;
  remaining: any;
}

@Component({
  selector: 'rozie-scoped-slot-context',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <ul class="list" #rozieSpread_0>
      
      @for (item of items(); track item.id) {
    <li>
        @if ((itemTpl ?? templates()?.['item'])) {
    <ng-container *ngTemplateOutlet="(itemTpl ?? templates()?.['item']); context: { $implicit: { item: item, remaining: remaining() }, item: item, remaining: remaining() }" />
    } @else {

          {{ item.label }}
        
    }
      </li>
    }
    </ul>

  `,
  styles: [`
    .list { list-style: none; padding: 0; }
  `],
})
export class ScopedSlotContext {
  items = model<any[]>((() => [])());
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  remaining = computed(() => this.items().filter((i: any) => !i.done).length);

  static ngTemplateContextGuard(
    _dir: ScopedSlotContext,
    _ctx: unknown,
  ): _ctx is ItemCtx {
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

export default ScopedSlotContext;
