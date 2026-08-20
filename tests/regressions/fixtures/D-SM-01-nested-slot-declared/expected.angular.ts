import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

interface WrapperCtx {}

interface InnerCtx {}

@Component({
  selector: 'rozie-nested-slot-declared',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="outer" #rozieSpread_0 #rozieListenersTarget_1>
      
      @if ((wrapperTpl ?? __rozieFillMap()['wrapper'] ?? templates()?.['wrapper'])) {
    <ng-container *ngTemplateOutlet="(wrapperTpl ?? __rozieFillMap()['wrapper'] ?? templates()?.['wrapper'])" />
    } @else {

        <div class="wrapper-fallback">
          <ng-container *ngTemplateOutlet="(innerTpl ?? __rozieFillMap()['inner'] ?? templates()?.['inner'])" />
        </div>
      
    }
    </div>

  `,
  styles: [`
    :host(rozie-nested-slot-declared) { display: contents; }
    .outer { display: block; }
  `],
})
export class NestedSlotDeclared {
  @ContentChild('wrapper', { read: TemplateRef }) wrapperTpl?: TemplateRef<WrapperCtx>;
  @ContentChild('inner', { read: TemplateRef }) innerTpl?: TemplateRef<InnerCtx>;
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

  static ngTemplateContextGuard(
    _dir: NestedSlotDeclared,
    _ctx: unknown,
  ): _ctx is WrapperCtx | InnerCtx {
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

export default NestedSlotDeclared;
