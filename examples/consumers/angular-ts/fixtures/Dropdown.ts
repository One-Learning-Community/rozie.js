import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, forwardRef, inject, input, model, signal, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NG_VALUE_ACCESSOR } from '@angular/forms';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

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

    <div class="dropdown" #rozieSpread_0 #rozieListenersTarget_1>
      <div #triggerEl (click)="toggle()">
        <ng-container *ngTemplateOutlet="(triggerTpl ?? __rozieFillMap()['trigger'] ?? templates()?.['trigger']); context: { $implicit: { open: open(), toggle: toggle }, open: open(), toggle: toggle }" />
      </div>

      @if (open()) {
    <div #panelEl class="dropdown-panel" role="menu">
        <ng-container *ngTemplateOutlet="(defaultTpl ?? __rozieFillMap()['defaultSlot'] ?? templates()?.['defaultSlot']); context: { $implicit: { close: close }, close: close }" />
      </div>
    }</div>

  `,
  styles: [`
    :host(rozie-dropdown) { display: contents; }
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
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Dropdown),
      multi: true,
    },
  ],
  host: { '(focusout)': '__rozieCvaOnTouched()' },
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
  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });
  private __rozieWatchInitial_0 = true;

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

    effect(() => { const __watchVal = (() => this.open())(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.open()) this.reposition();
    })(); }); });
  }

  ngAfterViewInit() {
    // Initial reposition only if the panel is open at mount time.
    if (this.open()) this.reposition();

  }

  toggle = () => {
    this.open.set(!this.open()), this.__rozieCvaOnChange(!this.open());
  };
  close = () => {
    this.open.set(false), this.__rozieCvaOnChange(false);
  };
  reposition = () => {
    if (!this.panelEl()?.nativeElement || !this.triggerEl()?.nativeElement) return;
    const rect = this.triggerEl()!.nativeElement.getBoundingClientRect();
    Object.assign(this.panelEl()!.nativeElement.style, {
      top: `${rect.bottom}px`,
      left: `${rect.left}px`
    });
  };

  private __rozieCvaOnChange: (v: boolean) => void = () => {};
  private __rozieCvaOnTouchedFn: () => void = () => {};
  protected __rozieCvaDisabled = signal(false);

  writeValue(v: boolean | null): void {
    this.open.set(v ?? false);
  }
  registerOnChange(fn: (v: boolean) => void): void {
    this.__rozieCvaOnChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.__rozieCvaOnTouchedFn = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.__rozieCvaDisabled.set(isDisabled);
  }
  __rozieCvaOnTouched(): void {
    this.__rozieCvaOnTouchedFn();
  }

  static ngTemplateContextGuard(
    _dir: Dropdown,
    _ctx: unknown,
  ): _ctx is TriggerCtx | DefaultCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

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

  private __rozieApplyAttrs = createRozieAttrApplier(inject(Renderer2));

  private __rozieGetHostAttrs = createRozieHostAttrsReader(inject(ElementRef));

  private __rozieSpread_0_effect = afterRenderEffect(() => {
    const el = this.rozieSpread_0()?.nativeElement;
    if (!el) return;
    this.__rozieApplyAttrs(el, this.__rozieGetHostAttrs());
  });

  private rozieListenersTarget_1 = viewChild<ElementRef>('rozieListenersTarget_1');

  private __rozieListenersRenderer = inject(Renderer2);

  private __rozieListenersDisposers_1: Array<() => void> = [];

  private __rozieListenersDestroyRegistered_1 = false;

  private __rozieListenersEffect_1 = effect(() => {
    const el = this.rozieListenersTarget_1()?.nativeElement;
    if (!el) return;
    for (const off of this.__rozieListenersDisposers_1) off();
    this.__rozieListenersDisposers_1 = [];
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      if (typeof v !== 'function') continue;
      const norm = k.startsWith('on') ? k.slice(2).toLowerCase() : k;
      const dispose = this.__rozieListenersRenderer.listen(el, norm, v as EventListener);
      this.__rozieListenersDisposers_1.push(dispose);
    }
    if (!this.__rozieListenersDestroyRegistered_1) {
      this.__rozieListenersDestroyRegistered_1 = true;
      this.__rozieDestroyRef.onDestroy(() => {
        for (const off of this.__rozieListenersDisposers_1) off();
        this.__rozieListenersDisposers_1 = [];
      });
    }
  });
}

export default Dropdown;
