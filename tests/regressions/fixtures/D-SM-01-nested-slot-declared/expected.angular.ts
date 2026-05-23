import { Component, ContentChild, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface WrapperCtx {}

interface InnerCtx {}

@Component({
  selector: 'rozie-nested-slot-declared',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="outer" #rozieSpread_0>
      
      @if ((wrapperTpl ?? templates()?.['wrapper'])) {
    <ng-container *ngTemplateOutlet="(wrapperTpl ?? templates()?.['wrapper'])" />
    } @else {

        <div class="wrapper-fallback">
          <ng-container *ngTemplateOutlet="(innerTpl ?? templates()?.['inner'])" />
        </div>
      
    }
    </div>

  `,
  styles: [`
    .outer { display: block; }
  `],
})
export class NestedSlotDeclared {
  @ContentChild('wrapper', { read: TemplateRef }) wrapperTpl?: TemplateRef<WrapperCtx>;
  @ContentChild('inner', { read: TemplateRef }) innerTpl?: TemplateRef<InnerCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: NestedSlotDeclared,
    _ctx: unknown,
  ): _ctx is WrapperCtx | InnerCtx {
    return true;
  }

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

export default NestedSlotDeclared;
