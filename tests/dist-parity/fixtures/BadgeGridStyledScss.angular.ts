import { Component, ElementRef, Renderer2, ViewEncapsulation, effect, inject, input, viewChild } from '@angular/core';

@Component({
  selector: 'rozie-badge-grid-styled-scss',
  standalone: true,
  template: `

    <div class="badge-grid" #rozieSpread_0>
      @for (badge of badges(); track badge) {
    <span class="badge badge--neutral">
        {{ badge }}
      </span>
    }
    </div>

  `,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      font-weight: 600;
    }
    .badge-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px;
    }
    .badge {
      padding: 2px 8px;
    }
    .badge--neutral {
      color: #ffffff;
      background: #6b7280;
    }
    .badge--success {
      color: #ffffff;
      background: #16a34a;
    }
    .badge--warning {
      color: #ffffff;
      background: #d97706;
    }
    .badge--danger {
      color: #ffffff;
      background: #dc2626;
    }
    .badge-grid--gap-1 {
      gap: 4px;
    }
    .badge-grid--gap-2 {
      gap: 8px;
    }
    .badge-grid--gap-3 {
      gap: 12px;
    }
  `],
})
export class BadgeGridStyledScss {
  badges = input<any[]>((() => [])());

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

export default BadgeGridStyledScss;
