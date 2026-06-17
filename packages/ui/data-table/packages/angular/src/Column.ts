import { Component, ContentChild, DestroyRef, EmbeddedViewRef, InjectionToken, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, inject, input, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

interface CellCtx {
  $implicit: { row: any; value: any; column: any };
  row: any;
  value: any;
  column: any;
}

interface HeaderTemplateCtx {
  $implicit: { column: any };
  column: any;
}

const __rozieTokenRegistry: Map<string, InjectionToken<unknown>> =
  ((globalThis as Record<string, unknown>).__rozieCtx ??= new Map()) as Map<
    string,
    InjectionToken<unknown>
  >;
function rozieToken(key: string): InjectionToken<unknown> {
  let token = __rozieTokenRegistry.get(key);
  if (!token) {
    token = new InjectionToken<unknown>('rozie:' + key);
    __rozieTokenRegistry.set(key, token);
  }
  return token;
}

@Component({
  selector: 'rozie-column',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `






    <div class="rozie-data-table-column" style="display:none"></div>
    <ng-container #rozie_portalAnchor></ng-container>
  `,
})
export class Column {
  id = input<string>('');
  field = input<string>('');
  header = input<string>('');
  sortable = input<boolean>(false);
  filterable = input<boolean>(false);
  pinned = input<string>('');
  width = input<string | number>('');
  @ContentChild('cell', { read: TemplateRef }) cellTpl?: TemplateRef<CellCtx>;
  @ContentChild('headerTemplate', { read: TemplateRef }) headerTemplateTpl?: TemplateRef<HeaderTemplateCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _cellTpl = contentChild('cell', { read: TemplateRef });
  private _headerTemplateTpl = contentChild('headerTemplate', { read: TemplateRef });
  registry = inject(rozieToken('data-table:columns'));
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;

  constructor() {
    this.reg = this.registry;

    // idempotency flag so a reactive late-context registration (Lit async first paint,
    // REQ-30) and the $onMount registration never double-register the column.
    this.cellHandles = new Set();
    this.headerHandles = new Set();

    // The per-cell / per-header mount closures, DEFINED INSIDE $onMount (below) so they
    // capture the emitter-synthesized `portals` local — which on React/Angular/Lit is
    // scoped to the mount effect body, NOT visible from a spec callback the parent
    // invokes later (that escaped scope is exactly why a bare `$portals.cell(...)` in the
    // spec callback threw "portals is not defined" on those 3 targets, the NodeType
    // lesson). Stored in module-scope `any` so the spec callbacks — invoked by the
    // parent's keyed r-for from its own render scope — can delegate to them.
    effect(() => () => {
      if (this.registered) return;
      const live = this.registry;
      if (live == null) return;
      this.reg = live;
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    });
    effect(() => { const __watchVal = (() => [this.id(), this.field(), this.header(), this.sortable(), this.filterable(), this.pinned(), this.width()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }); });
  }

  ngAfterViewInit() {
    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      cell: (container: HTMLElement, scope: { row: unknown; value: unknown; column: unknown }): ReactivePortalHandle => {
        const tpl = this._cellTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-cell', '289f2d72');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
      headerTemplate: (container: HTMLElement, scope: { column: unknown }): ReactivePortalHandle => {
        const tpl = this._headerTemplateTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-headerTemplate', '289f2d72');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return {
          update: (s: unknown): void => {
            Object.assign(view.context as object, s as object);
            view.detectChanges();
          },
          dispose: (): void => {
            view.destroy();
            this._portalViews.delete(view as EmbeddedViewRef<unknown>);
          },
        };
      },
    };
    // The per-cell mount closure — captures the mount-scoped `portals` local. Mounts an
    // INDEPENDENT cell root PER rendered cell (the parent calls this once per visible
    // cell of the column), so every cell keeps its OWN #cell render — it must NOT
    // dispose any sibling's handle. The returned { dispose } deregisters ITSELF from the
    // live set; a leftover handle is swept by the component teardown below.
    this.mountCell = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = portals.cell(host, {
        row: s.row,
        value: s.value,
        column: s.column
      });
      if (!h) return null;
      this.cellHandles.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          this.cellHandles.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    this.mountHeader = (host: any, scope: any) => {
      if (!host) return null;
      const s = scope || {};
      const h = $portals.header(host, {
        column: s.column
      });
      if (!h) return null;
      this.headerHandles.add(h);
      return {
        update: (next: any) => {
          if (h && h.update) {
            try {
              return h.update(next);
            } catch (e: any) {}
          }
        },
        dispose: () => {
          this.headerHandles.delete(h);
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
      };
    };
    // register this column's spec INCLUDING the render callbacks. On Lit the injected
    // registry may still be undefined here (REQ-30 async context); the $onUpdate below
    // performs the registration once the value arrives.
    // register this column's spec INCLUDING the render callbacks. On Lit the injected
    // registry may still be undefined here (REQ-30 async context); the $onUpdate below
    // performs the registration once the value arrives.
    if (this.reg && !this.registered) {
      this.registered = true;
      this.reg.registerColumn(this.colId(), this.buildSpec());
    }
    this.__rozieDestroyRef.onDestroy(() => {
      // sweep any cell/header projections still live at teardown (the parent normally
      // disposes each per cell unmount, but a component-level unmount must clean any
      // stragglers).
      if (this.cellHandles) {
        for (const h of this.cellHandles as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        this.cellHandles.clear();
      }
      if (this.headerHandles) {
        for (const h of this.headerHandles as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        this.headerHandles.clear();
      }
      if (this.reg) this.reg.unregisterColumn(this.colId());
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  reg: any = null;
  registered = false;
  cellHandles: any = null;
  headerHandles: any = null;
  mountCell: any = null;
  mountHeader: any = null;
  colId = () => this.id() !== '' ? this.id() : this.field();
  buildSpec = () => ({
    id: this.colId(),
    field: this.field() !== '' ? this.field() : this.colId(),
    header: this.header(),
    sortable: this.sortable(),
    filterable: this.filterable(),
    pinned: this.pinned(),
    width: this.width(),
    // present only when the consumer declared a #cell template (else the parent renders
    // the plain accessor value — the template-less fast path). Delegates to the
    // mount-scoped closure; try/catch so a per-target portal hiccup can NEVER abort the
    // parent's keyed-r-for render loop (a thrown renderer would stop the whole body).
    hasCell: !!(this.cellTpl ?? this.templates()?.['cell']),
    cellRenderer: (host: any, scope: any) => {
      if (host && this.mountCell) {
        try {
          return this.mountCell(host, scope);
        } catch (e: any) {}
      }
      return null;
    },
    hasHeader: !!(this.headerTemplateTpl ?? this.templates()?.['headerTemplate']),
    headerRenderer: (host: any, scope: any) => {
      if (host && this.mountHeader) {
        try {
          return this.mountHeader(host, scope);
        } catch (e: any) {}
      }
      return null;
    }
  });

  static ngTemplateContextGuard(
    _dir: Column,
    _ctx: unknown,
  ): _ctx is CellCtx | HeaderTemplateCtx {
    return true;
  }
}

export default Column;
