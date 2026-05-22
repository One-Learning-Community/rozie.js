import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, inject, input, viewChild } from '@angular/core';
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

    <div class="rozie-portal-list" #__rozieRoot>
      
    </div>
    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [
    `
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
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
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
}

export default PortalListStyledScss;
