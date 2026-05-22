import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, model, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'rozie-checkbox-rmodel',
  standalone: true,
  imports: [FormsModule],
  template: `

    <label class="toggle" #rozieSpread_0>
      
      <input type="checkbox" [ngModel]="checked()" (ngModelChange)="checked.set($event)" [ngModelOptions]="{standalone: true}" />
      <span>Enabled</span>
    </label>

  `,
  styles: [`
    .toggle { display: inline-flex; gap: 0.25rem; align-items: center; }
  `],
})
export class CheckboxRModel {
  checked = model<boolean>(false);

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

export default CheckboxRModel;
