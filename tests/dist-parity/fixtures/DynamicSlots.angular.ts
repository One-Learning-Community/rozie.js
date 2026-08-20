import { Component, ContentChild, DestroyRef, ElementRef, Renderer2, TemplateRef, ViewEncapsulation, afterRenderEffect, computed, contentChildren, effect, inject, input, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RozieSlot, createRozieAttrApplier, createRozieHostAttrsReader, rozieAttr as __rozieAttr, rozieDisplay as __rozieDisplay } from '@rozie/runtime-angular';

interface HeaderCellCtx {
  $implicit: { title: any };
  title: any;
}

interface CellCtx {
  $implicit: { row: any; value: any };
  row: any;
  value: any;
}

@Component({
  selector: 'rozie-dynamic-slots',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="dynamic-slots" #rozieSpread_0 #rozieListenersTarget_1>

      
      @if ((__rozieFillMap()['cell-total'] ?? templates()?.['cell-total'])) {
    <ng-container *ngTemplateOutlet="(__rozieFillMap()['cell-total'] ?? templates()?.['cell-total']); context: { $implicit: { value: total() }, value: total() }" />
    } @else {

        <strong>{{ total() }}</strong>
      
    }

      
      @for (col of columns(); track col.key) {
    <div>
        @if ((__rozieFillMap()[\`cell-\${col.key}\`] ?? templates()?.[\`cell-\${col.key}\`])) {
    <ng-container *ngTemplateOutlet="(__rozieFillMap()[\`cell-\${col.key}\`] ?? templates()?.[\`cell-\${col.key}\`]); context: { $implicit: { row: row(), value: row()[col.key] }, row: row(), value: row()[col.key] }" />
    } @else {

          <span>{{ rozieDisplay(row()[col.key]) }}</span>
        
    }
      </div>
    }

      
      @if ((__rozieFillMap()[freeSlotName()] ?? templates()?.[freeSlotName()])) {
    <ng-container *ngTemplateOutlet="(__rozieFillMap()[freeSlotName()] ?? templates()?.[freeSlotName()]); context: { $implicit: { label: freeSlotName() }, label: freeSlotName() }" />
    } @else {

        <em>fallback</em>
      
    }

      
      @if ((headerCellTpl ?? __rozieFillMap()['headerCell'] ?? templates()?.['headerCell'])) {
    <ng-container *ngTemplateOutlet="(headerCellTpl ?? __rozieFillMap()['headerCell'] ?? templates()?.['headerCell']); context: { $implicit: { title: heading() }, title: heading() }" />
    } @else {

        <h2>{{ heading() }}</h2>
      
    }

    </div>

  `,
  styles: [`
    :host(rozie-dynamic-slots) { display: contents; }
  `],
})
export class DynamicSlots {
  columns = input<any[]>((() => [])());
  row = input<Record<string, any>>((() => ({}))());
  total = input<number>(0);
  heading = input<string>('Header');
  freeSlotName = signal('freeform');
  @ContentChild('headerCell', { read: TemplateRef }) headerCellTpl?: TemplateRef<HeaderCellCtx>;
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
          console.warn('[ROZ750] DynamicSlots: duplicate keyed fill "' + k + '" — the last fill (in content-query order) wins.');
          return;
        }
        seen.add(k);
      }
    });
  }

  ngAfterContentInit() {
    if (!(globalThis as { ngDevMode?: unknown }).ngDevMode || this.__rozieSlotWarned) return;
    const claimedByStaticRefs = [this.headerCellTpl].filter((t) => t != null).length;
    if (this.__rozieFills().length === 0 && this.__rozieProjectedTpls().length > claimedByStaticRefs) {
      this.__rozieSlotWarned = true;
      console.warn('[ROZ750] DynamicSlots: projected template content was found but no keyed fills were collected — did you forget to add RozieSlot to the consumer\'s imports: array?');
    }
  }

  static ngTemplateContextGuard(
    _dir: DynamicSlots,
    _ctx: unknown,
  ): _ctx is HeaderCellCtx | CellCtx {
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

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default DynamicSlots;
