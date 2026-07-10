import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, Renderer2, TemplateRef, ViewContainerRef, ViewEncapsulation, afterRenderEffect, contentChild, effect, inject, input, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface ItemCtx {
  $implicit: { item: any };
  item: any;
}

// Tiny inline "engine" — same shape as examples/PortalList.rozie but
// with the inline-style ceremony removed. The engine now just creates
// structural DOM; cosmetic styling is the wrapper's <style> block's job.
//
// Destruction order still matters: dispose all cells BEFORE removing
// the structural container (same constraint as FullCalendar / AG-Grid).
class MiniListEngine {
  constructor(rootEl: any, opts: any) {
    this.rootEl = rootEl;
    this.items = opts.items;
    this.cellRenderer = opts.cellRenderer;
    this.disposers = [];
    this._mount();
  }
  _mount() {
    const ul = document.createElement('ul');
    for (const item of this.items as any) {
      const li = document.createElement('li');
      const cell = this.cellRenderer(item);
      li.appendChild(cell.node);
      this.disposers.push(cell.dispose);
      ul.appendChild(li);
    }
    this.rootEl.appendChild(ul);
  }
  destroy() {
    for (const dispose of this.disposers as any) dispose();
    this.disposers = [];
    while (this.rootEl.firstChild) this.rootEl.removeChild(this.rootEl.firstChild);
  }
}

@Component({
  selector: 'rozie-portal-list-styled-scss',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-portal-list" #__rozieRoot #rozieSpread_0 #rozieListenersTarget_1>
      
    </div>
    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [
    `
    :host(rozie-portal-list-styled-scss) { display: contents; }
    .rozie-portal-list {
      display: block;
      font-family: system-ui, -apple-system, sans-serif;
      color: var(--rozie-portal-list-fg);
    }
    .rozie-portal-list ul {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid #ededed;
      border-radius: 6px;
    }

    ::ng-deep :root {
    --rozie-portal-list-gap: 8px;
      --rozie-portal-list-fg: #1a1a1a;
    }
  `,
    // Spike 004 NEW — @portal item { … } as a separate styles entry
    // wrapped in :host ::ng-deep so view-encapsulation's
    // _ngcontent-* attribute scoping doesn't prevent matching
    // engine-created DOM.
    `
    :host ::ng-deep [data-rozie-portal-item="860cc87e"] ul {
      list-style: none;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    :host ::ng-deep [data-rozie-portal-item="860cc87e"] li {
      padding: 0.5rem 0.75rem;
    }
    :host ::ng-deep [data-rozie-portal-item="860cc87e"] li + li {
      border-top: 1px solid #ededed;
    }
    :host ::ng-deep [data-rozie-portal-item="860cc87e"] li:hover {
      background: #f5f5f5;
    }
    :host ::ng-deep [data-rozie-portal-item="860cc87e"] div {
      display: flex;
      align-items: center;
      gap: var(--rozie-portal-list-gap);
    }
  `,
  ],
})
export class PortalListStyledScss {
  items = input<any[]>((() => [])());
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  @ContentChild('item', { read: TemplateRef }) itemTpl?: TemplateRef<ItemCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _itemTpl = contentChild('item', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);

  ngAfterViewInit() {
    const portals = {
      item: (container: HTMLElement, scope: { item: unknown }): (() => void) => {
        const tpl = this._itemTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-item', '860cc87e');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as globalThis.Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
    };
    this.instance = new MiniListEngine(this.__rozieRoot()!.nativeElement, {
      items: this.items(),
      cellRenderer: (item: any) => {
        const node = document.createElement('div');
        const dispose = portals.item(node, {
          item
        });
        return {
          node,
          dispose
        };
      }
    });
    this.__rozieDestroyRef.onDestroy(() => this.instance?.destroy());
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  instance: any = null;

  static ngTemplateContextGuard(
    _dir: PortalListStyledScss,
    _ctx: unknown,
  ): _ctx is ItemCtx {
    return true;
  }

  private rozieSpread_0 = viewChild<ElementRef>('rozieSpread_0');

  private __rozieApplyAttrs = (() => {
    const renderer = inject(Renderer2);
    const prevKeysByElement = new WeakMap<HTMLElement, string[]>();
    const prevClassTokensByElement = new WeakMap<HTMLElement, string[]>();
    const prevStylePropsByElement = new WeakMap<HTMLElement, string[]>();
    const parseClassTokens = (value: unknown): string[] => {
      if (typeof value !== 'string') return [];
      const out: string[] = [];
      for (const tok of value.split(/\s+/)) {
        if (tok.length > 0) out.push(tok);
      }
      return out;
    };
    const parseStyleDecls = (value: unknown): Array<[string, string]> => {
      if (typeof value !== 'string') return [];
      const out: Array<[string, string]> = [];
      for (const decl of value.split(';')) {
        const colon = decl.indexOf(':');
        if (colon < 0) continue;
        const prop = decl.slice(0, colon).trim();
        const val = decl.slice(colon + 1).trim();
        if (prop.length > 0) out.push([prop, val]);
      }
      return out;
    };
    const applyClassMerge = (el: HTMLElement, value: unknown) => {
      const next = parseClassTokens(value);
      const prev = prevClassTokensByElement.get(el) ?? [];
      const nextSet = new Set(next);
      for (const tok of prev) {
        if (!nextSet.has(tok)) el.classList.remove(tok);
      }
      for (const tok of next) el.classList.add(tok);
      prevClassTokensByElement.set(el, next);
    };
    const applyStyleMerge = (el: HTMLElement, value: unknown) => {
      const next = parseStyleDecls(value);
      const prev = prevStylePropsByElement.get(el) ?? [];
      const nextProps = next.map(([p]) => p);
      const nextSet = new Set(nextProps);
      for (const prop of prev) {
        if (!nextSet.has(prop)) el.style.removeProperty(prop);
      }
      for (const [prop, val] of next) el.style.setProperty(prop, val, 'important');
      prevStylePropsByElement.set(el, nextProps);
    };
    return (el: HTMLElement, obj: Record<string, unknown> | null | undefined) => {
      const safeObj: Record<string, unknown> = obj ?? {};
      const prevKeys = prevKeysByElement.get(el) ?? [];
      for (const k of prevKeys) {
        if (k === 'class' || k === 'style') continue;
        if (!(k in safeObj)) renderer.removeAttribute(el, k);
      }
      if (!('class' in safeObj) && prevClassTokensByElement.has(el)) {
        applyClassMerge(el, '');
      }
      if (!('style' in safeObj) && prevStylePropsByElement.has(el)) {
        applyStyleMerge(el, '');
      }
      for (const [k, v] of Object.entries(safeObj)) {
        if (k === 'class') {
          applyClassMerge(el, v);
        } else if (k === 'style') {
          applyStyleMerge(el, v);
        } else if (v === null || v === false) {
          renderer.removeAttribute(el, k);
        } else {
          renderer.setAttribute(el, k, String(v));
        }
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

export default PortalListStyledScss;
