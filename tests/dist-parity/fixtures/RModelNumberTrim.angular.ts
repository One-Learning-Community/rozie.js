import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-rmodel-number-trim',
  standalone: true,
  imports: [FormsModule],
  template: `

    <div class="rmodel-number-trim" #rozieSpread_0>
      <input type="text" [ngModel]="quantity()" (ngModelChange)="quantity.set((Number.isNaN(Number.parseFloat((($event).trim()))) ? (($event).trim()) : Number.parseFloat((($event).trim()))))" [ngModelOptions]="{standalone: true}" placeholder="Enter a quantity" />
      <p class="echo">Quantity: {{ quantity() }}</p>
    </div>

  `,
  styles: [`
    .rmodel-number-trim { display: inline-flex; flex-direction: column; gap: 0.25rem; }
    .echo { color: rgba(0, 0, 0, 0.55); font-size: 0.85em; }
  `],
})
export class RModelNumberTrim {
  quantity = signal(0);

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

  protected readonly Number = Number;
}

export default RModelNumberTrim;
