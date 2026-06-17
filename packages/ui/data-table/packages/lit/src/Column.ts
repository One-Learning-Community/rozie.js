import { LitElement, html, nothing, render } from 'lit';
import { customElement, property, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { ContextConsumer, createContext } from '@lit/context';

const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));

interface RozieCellSlotCtx {
  row: unknown;
  value: unknown;
  column: unknown;
}

interface RozieHeaderTemplateSlotCtx {
  column: unknown;
}

@customElement('rozie-column')
export default class Column extends SignalWatcher(LitElement) {
  @property({ type: String, reflect: true }) id: string = '';
  @property({ type: String, reflect: true }) field: string = '';
  @property({ type: String, reflect: true }) header: string = '';
  @property({ type: Boolean, reflect: true }) sortable: boolean = false;
  @property({ type: Boolean, reflect: true }) filterable: boolean = false;
  @property({ type: String, reflect: true }) pinned: string = '';
  @property({ type: String }) width: string | number = '';
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();
private __rozieCtxConsumer_data_table_columns = new ContextConsumer(this, { context: __rozieCtx_data_table_columns, subscribe: true });
private get registry() { return this.__rozieCtxConsumer_data_table_columns.value; }

  @state() private _hasSlotCell = false;
  @queryAssignedElements({ slot: 'cell', flatten: true }) private _slotCellElements!: Element[];
  @property({ attribute: false }) cell?: (scope: { row: unknown; value: unknown; column: unknown }) => unknown;
  @state() private _hasSlotHeaderTemplate = false;
  @queryAssignedElements({ slot: 'headerTemplate', flatten: true }) private _slotHeaderTemplateElements!: Element[];
  @property({ attribute: false }) headerTemplate?: (scope: { column: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="cell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotCell = this._slotCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="headerTemplate"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotHeaderTemplate = this._slotHeaderTemplateElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'cell');
    this._hasSlotHeaderTemplate = Array.from(this.children).some((el) => el.getAttribute('slot') === 'headerTemplate');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    interface ReactivePortalHandle {
      update(scope: unknown): void;
      dispose(): void;
    }
    const portals = {
      cell: (container: HTMLElement, scope: { row: unknown; value: unknown; column: unknown }): ReactivePortalHandle => {
        const tpl = this.cell;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-cell', '289f2d72');
        const renderScope = (s: { row: unknown; value: unknown; column: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { row: unknown; value: unknown; column: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
      headerTemplate: (container: HTMLElement, scope: { column: unknown }): ReactivePortalHandle => {
        const tpl = this.headerTemplate;
        if (typeof tpl !== 'function') return { update() {}, dispose() {} };
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-headerTemplate', '289f2d72');
        const renderScope = (s: { column: unknown }): void => {
          render(tpl(s), container);
        };
        renderScope(scope);
        this._portalContainers.add(container);
        return {
          update: (s: { column: unknown }): void => renderScope(s),
          dispose: (): void => {
            render(nothing, container);
            this._portalContainers.delete(container);
          },
        };
      },
    };

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

    this._disconnectCleanups.push((() => {
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
    }));

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
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (this.__rozieFirstUpdateDone && (changedProperties.has('id') || changedProperties.has('field') || changedProperties.has('header') || changedProperties.has('sortable') || changedProperties.has('filterable') || changedProperties.has('pinned') || changedProperties.has('width'))) { const __watchVal = (() => [this.id, this.field, this.header, this.sortable, this.filterable, this.pinned, this.width])(); (() => {
      if (this.reg) this.reg.registerColumn(this.colId(), this.buildSpec());
    })(); }
    this.__rozieFirstUpdateDone = true;

    if (this.registered) return;
    const live = this.registry;
    if (live == null) return;
    this.reg = live;
    this.registered = true;
    this.reg.registerColumn(this.colId(), this.buildSpec());
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`

<slot name="cell"></slot>

<slot name="headerTemplate"></slot>

<div class="rozie-data-table-column" style="display:none" data-rozie-s-289f2d72></div>
`;
  }

  reg: any = null;

  registered = false;

  cellHandles: any = null;

  headerHandles: any = null;

  mountCell: any = null;

  mountHeader: any = null;

  colId = () => this.id !== '' ? this.id : this.field;

  buildSpec = () => ({
  id: this.colId(),
  field: this.field !== '' ? this.field : this.colId(),
  header: this.header,
  sortable: this.sortable,
  filterable: this.filterable,
  pinned: this.pinned,
  width: this.width,
  // present only when the consumer declared a #cell template (else the parent renders
  // the plain accessor value — the template-less fast path). Delegates to the
  // mount-scoped closure; try/catch so a per-target portal hiccup can NEVER abort the
  // parent's keyed-r-for render loop (a thrown renderer would stop the whole body).
  hasCell: !!(this.cell !== undefined),
  cellRenderer: (host: any, scope: any) => {
    if (host && this.mountCell) {
      try {
        return this.mountCell(host, scope);
      } catch (e: any) {}
    }
    return null;
  },
  hasHeader: !!(this.headerTemplate !== undefined),
  headerRenderer: (host: any, scope: any) => {
    if (host && this.mountHeader) {
      try {
        return this.mountHeader(host, scope);
      } catch (e: any) {}
    }
    return null;
  }
});
}
