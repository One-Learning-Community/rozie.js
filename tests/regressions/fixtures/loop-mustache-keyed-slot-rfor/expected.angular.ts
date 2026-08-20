import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader } from '@rozie/runtime-angular';

@Component({
  selector: 'rozie-loop-mustache-keyed-slot-rfor',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `


    <div class="r" #rozieSpread_0 #rozieListenersTarget_1>@for (row of rows(); track row.id) {
    <ng-container *ngTemplateOutlet="(__rozieFillMap()[row] ?? templates()?.[row])" />
    }</div>

  `,
  styles: [`
    :host(rozie-loop-mustache-keyed-slot-rfor) { display: contents; }
  `],
})
export class LoopMustacheKeyedSlotRfor {
  rows = input<any[]>((() => [])());
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
  __rozieProjectedTpls = contentChildren(TemplateRef, { descendants: true });
  __rozieSlotWarned = false;

  constructor() {
    effect(() => {
      if (!(globalThis as { ngDevMode?: unknown }).ngDevMode || this.__rozieSlotWarned) return;
      const fills = this.__rozieFills();
      const seen = new Set<string>();
      for (const f of fills) {
        const k = f.rozieSlot();
        if (k == null) continue;
        if (seen.has(k)) {
          this.__rozieSlotWarned = true;
          console.warn('[ROZ750] LoopMustacheKeyedSlotRfor: duplicate keyed fill "' + k + '" — the last fill (in content-query order) wins.');
          return;
        }
        seen.add(k);
      }
      if (fills.length === 0 && this.__rozieProjectedTpls().length > 0) {
        this.__rozieSlotWarned = true;
        console.warn('[ROZ750] LoopMustacheKeyedSlotRfor: projected template content was found but no keyed fills were collected — did you forget to add RozieSlot to the consumer\'s imports: array?');
      }
    });
  }

  noop = (): void => {};

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

export default LoopMustacheKeyedSlotRfor;
