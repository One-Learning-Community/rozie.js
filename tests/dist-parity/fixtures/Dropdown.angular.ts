import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, effect, inject, input, model, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface TriggerCtx {
  $implicit: { open: any; toggle: any };
  open: any;
  toggle: any;
}

interface DefaultCtx {
  $implicit: { close: any };
  close: any;
}

@Component({
  selector: 'rozie-dropdown',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="dropdown" #rozieSpread_0>
      <div #triggerEl (click)="toggle()">
        <ng-container *ngTemplateOutlet="(triggerTpl ?? templates()?.['trigger']); context: { $implicit: { open: open(), toggle: toggle }, open: open(), toggle: toggle }" />
      </div>

      @if (open()) {
    <div #panelEl class="dropdown-panel" role="menu">
        <ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot']); context: { $implicit: { close: close }, close: close }" />
      </div>
    }</div>

  `,
  styles: [`
    .dropdown { position: relative; display: inline-block; }
    .dropdown-panel {
      position: fixed;
      z-index: var(--rozie-dropdown-z, 1000);
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.1);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    ::ng-deep :root {
    --rozie-dropdown-z: 1000;
    }
  `],
})
export class Dropdown {
  open = model<boolean>(false);
  closeOnOutsideClick = input<boolean>(true);
  closeOnEscape = input<boolean>(true);
  triggerEl = viewChild<ElementRef<HTMLDivElement>>('triggerEl');
  panelEl = viewChild<ElementRef<HTMLDivElement>>('panelEl');
  @ContentChild('trigger', { read: TemplateRef }) triggerTpl?: TemplateRef<TriggerCtx>;
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);

  constructor() {
      const renderer = inject(Renderer2);

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnOutsideClick())) return;
        const handler = ($event: MouseEvent) => {
          const target = $event.target as Node;
          if (this.triggerEl()?.nativeElement?.contains(target) || this.panelEl()?.nativeElement?.contains(target)) return;
          this.close();
        };
        const unlisten = renderer.listen('document', 'click', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open() && this.closeOnEscape())) return;
        const handler = ($event: KeyboardEvent) => {
          if ($event.key !== 'Escape') return;
          this.close();
        };
        const unlisten = renderer.listen('document', 'keydown', handler);
        onCleanup(unlisten);
      });

      effect((onCleanup) => {
        if (!(this.open())) return;
        const unlisten = renderer.listen('window', 'resize', this.throttledLReposition);
        onCleanup(unlisten);
      });

    effect(() => { const __watchVal = (() => this.open())(); untracked(() => (() => {
      if (this.open()) this.reposition();
    })()); });
  }

  ngAfterViewInit() {
    // Initial reposition only if the panel is open at mount time.
    if (this.open()) this.reposition();

  }

  toggle = () => {
    this.open.set(!this.open());
  };
  close = () => {
    this.open.set(false);
  };
  reposition = () => {
    if (!this.panelEl()?.nativeElement || !this.triggerEl()?.nativeElement) return;
    const rect = this.triggerEl()!.nativeElement.getBoundingClientRect();
    Object.assign(this.panelEl()!.nativeElement.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  };

  static ngTemplateContextGuard(
    _dir: Dropdown,
    _ctx: unknown,
  ): _ctx is TriggerCtx | DefaultCtx {
    return true;
  }

  private throttledLReposition = (() => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall < 100) return;
      lastCall = now;
      (this.reposition as (...a: any[]) => any)(...args);
    };
  })();

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

export default Dropdown;
