import { Component, DestroyRef, ElementRef, Renderer2, ViewEncapsulation, effect, inject, signal, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-class-selector-probe',
  standalone: true,
  template: `

    <div class="panel" [attr.data-handle]="'.panel'" [attr.data-grip]="gripSelector" #rozieSpread_0>
      <span class="grip" aria-hidden="true">⋮⋮</span>
      @if (ready()) {
    <span>ready</span>
    }</div>

  `,
  styles: [`
    .panel {
      display: block;
      padding: 0.5rem;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .grip {
      cursor: grab;
      user-select: none;
      color: rgba(0, 0, 0, 0.35);
    }
  `],
})
export class ClassSelectorProbe {
  ready = signal(false);

  ngAfterViewInit() {
    this.ready.set(true);
  }

  gripSelector = ".grip";

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

export default ClassSelectorProbe;
