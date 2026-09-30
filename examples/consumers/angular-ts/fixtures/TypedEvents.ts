import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

interface RowCtx {
  $implicit: { count: Count; tone: string };
  count: Count;
  tone: string;
}

@Component({
  selector: 'rozie-typed-events',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

      <div class="typed-events" #rozieSpread_0 #rozieListenersTarget_1>
        <button class="bump" (click)="bump()">+</button>
        <button class="clear" (click)="clear()" (dblclick)="select.emit(count())">reset</button>
        <button class="open" (click)="rowOpen.emit({ index: count() })">open</button>
        <ng-container *ngTemplateOutlet="(rowTpl ?? __rozieFillMap()['row'] ?? templates()?.['row']); context: { $implicit: { count: count(), tone: tone() }, count: count(), tone: tone() }" />
      </div>

  `,
  styles: [`
    :host(rozie-typed-events) { display: contents; }
  `],
})
export class TypedEvents {
  tone = input<string>('info');
  count = signal(0);
  ping = output<unknown>();
  reset = output<void>();
  select = output<unknown>();
  rowOpen = output<unknown>({ alias: 'row-open' });
  @ContentChild('row', { read: TemplateRef }) rowTpl?: TemplateRef<RowCtx>;
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

  bump = () => {
    const next = this.count() + 1;
    this.count.set(next);
    this.ping.emit({
      count: next,
      label: this.tone()
    });
  };
  clear = () => {
    this.count.set(0);
    this.reset.emit();
  };
  getCount = () => {
    return this.count();
  };
  jump = (...a: any[]) => {
    this.count.set(a.length);
  };

  static ngTemplateContextGuard(
    _dir: TypedEvents,
    _ctx: unknown,
  ): _ctx is RowCtx {
    return true;
  }

  private __rozieDestroyRef = inject(DestroyRef);

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

export default TypedEvents;
