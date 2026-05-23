import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, signal, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-event-loop-var-shadow',
  standalone: true,
  template: `

    <ul #rozieSpread_0>
      @for (e of items(); track e.id) {
    <li>
        <span>{{ e.label }}</span>
        
        <button type="button" (click)="removeItem(e.id)">×</button>
      </li>
    }
    </ul>

  `,
})
export class EventLoopVarShadow {
  items = signal([{
    id: 'a',
    label: 'A'
  }, {
    id: 'b',
    label: 'B'
  }]);

  removeItem = (id: any) => {
    this.items.set(this.items().filter((x: any) => x.id !== id));
  };

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

export default EventLoopVarShadow;
