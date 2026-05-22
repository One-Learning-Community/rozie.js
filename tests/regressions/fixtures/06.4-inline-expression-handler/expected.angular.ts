import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, input, signal, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-inline-expr-handler',
  standalone: true,
  template: `

    <div class="backdrop" #rozieSpread_0 (click)="closeOnBackdrop() && close()">
      
      <button (click)="close()">Close</button>
    </div>

  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; }
  `],
})
export class InlineExprHandler {
  closeOnBackdrop = input<boolean>(true);
  open = signal(false);

  close = () => {
    this.open.set(false);
  };

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

export default InlineExprHandler;
