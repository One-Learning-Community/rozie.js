import { Component, ContentChild, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface StatusCtx {}

@Component({
  selector: 'rozie-default-content-fallback-fixture',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="default-content-fallback-fixture" #rozieSpread_0>
      @if ((statusTpl ?? templates()?.['status'])) {
    <ng-container *ngTemplateOutlet="(statusTpl ?? templates()?.['status'])" />
    } @else {

        <span class="fallback">No status provided.</span>
      
    }
    </div>

  `,
})
export class DefaultContentFallbackFixture {
  @ContentChild('status', { read: TemplateRef }) statusTpl?: TemplateRef<StatusCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  static ngTemplateContextGuard(
    _dir: DefaultContentFallbackFixture,
    _ctx: unknown,
  ): _ctx is StatusCtx {
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

export default DefaultContentFallbackFixture;
