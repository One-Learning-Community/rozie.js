import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-rbind-probe',
  standalone: true,
  template: `

    <div class="rbind-probe">
      <span [ngClass]="['a', 'b']" #rozieSpread_0>canonical</span>
      <span #rozieSpread_1 [ngClass]="['b', 'a']">reordered</span>
    </div>

  `,
  styles: [`
    .rbind-probe {
      display: inline-flex;
      gap: 0.5rem;
      padding: 0.25rem;
    }
    .a { color: #1f2937; }
    .b { font-weight: 700; }
  `],
})
export class RBindProbe {


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

  private __rozieSpread_0_effect = effect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'x' });
  });

  private rozieSpread_1 = viewChild<ElementRef>('rozieSpread_1');

  private __rozieSpread_1_effect = effect(() => {
    const el = this.rozieSpread_1()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, { id: 'y' });
  });
}

export default RBindProbe;
