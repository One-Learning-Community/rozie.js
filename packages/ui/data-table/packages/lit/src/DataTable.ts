import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher, effect, signal, untracked } from '@lit-labs/preact-signals';
import { createLitControllableProperty, rozieAttr, rozieDisplay } from '@rozie/runtime-lit';
import { ContextProvider, createContext } from '@lit/context';
import { repeat } from 'lit/directives/repeat.js';
import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

const __rozieCtx_data_table_columns = createContext(Symbol.for("rozie:data-table:columns"));

interface RozieSelectAllSlotCtx {
  checked: unknown;
  indeterminate: unknown;
  toggle: unknown;
}

interface RozieSelectCellSlotCtx {
  row: unknown;
  checked: unknown;
  toggle: unknown;
}

@customElement('rozie-data-table')
export default class DataTable extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-data-table[data-rozie-s-d5dcab4c] {
  border-collapse: collapse;
  width: 100%;
  font: var(--rdt-font, 14px system-ui, sans-serif);
  color: var(--rdt-color, inherit);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-td[data-rozie-s-d5dcab4c] {
  padding: var(--rdt-cell-padding, 0.5rem 0.75rem);
  text-align: left;
  border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-thead[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  font-weight: var(--rdt-header-weight, 600);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-sort-btn[data-rozie-s-d5dcab4c] {
  display: inline-flex;
  align-items: center;
  gap: var(--rdt-sort-gap, 0.35em);
  background: none;
  border: none;
  font: inherit;
  font-weight: inherit;
  color: inherit;
  cursor: pointer;
  padding: 0;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-sort-ind[data-rozie-s-d5dcab4c] {
  font-size: 0.8em;
  opacity: var(--rdt-sort-ind-opacity, 0.7);
}
.rozie-data-table.rdt-sticky[data-rozie-s-d5dcab4c] .rdt-thead[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  position: sticky;
  top: var(--rdt-sticky-top, 0);
  z-index: var(--rdt-sticky-z, 2);
  background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] {
  display: flex;
  flex-direction: column;
  gap: var(--rdt-chrome-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-toolbar[data-rozie-s-d5dcab4c] {
  display: flex;
  gap: var(--rdt-toolbar-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-global-filter[data-rozie-s-d5dcab4c],
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter[data-rozie-s-d5dcab4c] {
  font: inherit;
  padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
  border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-filter-radius, 4px);
  background: var(--rdt-filter-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-col-filter[data-rozie-s-d5dcab4c] {
  display: block;
  margin-top: var(--rdt-col-filter-gap, 0.25rem);
  width: 100%;
  font-weight: normal;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-pagination[data-rozie-s-d5dcab4c] {
  display: flex;
  align-items: center;
  gap: var(--rdt-pagination-gap, 0.5rem);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-btn[data-rozie-s-d5dcab4c] {
  font: inherit;
  cursor: pointer;
  padding: var(--rdt-page-btn-padding, 0.25rem 0.6rem);
  border: var(--rdt-page-btn-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-btn-radius, 4px);
  background: var(--rdt-page-btn-bg, transparent);
  color: inherit;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-btn[data-rozie-s-d5dcab4c]:disabled {
  opacity: var(--rdt-page-btn-disabled-opacity, 0.4);
  cursor: default;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-status[data-rozie-s-d5dcab4c] {
  font-size: var(--rdt-page-status-size, 0.9em);
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-page-size[data-rozie-s-d5dcab4c] {
  font: inherit;
  padding: var(--rdt-page-size-padding, 0.2rem 0.4rem);
  border: var(--rdt-page-size-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-page-size-radius, 4px);
  background: var(--rdt-page-size-bg, transparent);
  color: inherit;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th[data-rozie-s-d5dcab4c] {
  position: relative;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-handle[data-rozie-s-d5dcab4c] {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: var(--rdt-resize-handle-width, 6px);
  padding: 0;
  border: none;
  background: none;
  cursor: col-resize;
  touch-action: none;
  user-select: none;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-grip[data-rozie-s-d5dcab4c] {
  display: block;
  width: var(--rdt-resize-grip-width, 2px);
  height: 100%;
  margin: 0 auto;
  background: var(--rdt-resize-grip-color, rgba(0, 0, 0, 0.12));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-resize-handle[data-rozie-s-d5dcab4c]:hover .rdt-resize-grip[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-th-resizing[data-rozie-s-d5dcab4c] .rdt-resize-grip[data-rozie-s-d5dcab4c] {
  background: var(--rdt-resize-grip-active, rgba(0, 0, 0, 0.4));
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-controls[data-rozie-s-d5dcab4c] {
  display: inline-flex;
  gap: var(--rdt-pin-gap, 0.1em);
  margin-left: var(--rdt-pin-margin, 0.35em);
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-btn[data-rozie-s-d5dcab4c] {
  font: inherit;
  font-size: var(--rdt-pin-btn-size, 0.8em);
  line-height: 1;
  cursor: pointer;
  padding: var(--rdt-pin-btn-padding, 0.1em 0.25em);
  border: var(--rdt-pin-btn-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rdt-pin-btn-radius, 3px);
  background: var(--rdt-pin-btn-bg, transparent);
  color: inherit;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-pin-btn[aria-pressed='true'][data-rozie-s-d5dcab4c] {
  background: var(--rdt-pin-btn-active-bg, rgba(0, 0, 0, 0.1));
  font-weight: 700;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis[data-rozie-s-d5dcab4c] {
  position: relative;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-summary[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  font: inherit;
  padding: var(--rdt-colvis-summary-padding, 0.25rem 0.6rem);
  border: var(--rdt-colvis-summary-border, 1px solid rgba(0, 0, 0, 0.2));
  border-radius: var(--rdt-colvis-summary-radius, 4px);
  list-style: none;
  user-select: none;
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-menu[data-rozie-s-d5dcab4c] {
  position: absolute;
  z-index: var(--rdt-colvis-menu-z, 5);
  margin-top: var(--rdt-colvis-menu-gap, 0.25rem);
  padding: var(--rdt-colvis-menu-padding, 0.4rem 0.6rem);
  display: flex;
  flex-direction: column;
  gap: var(--rdt-colvis-item-gap, 0.25rem);
  border: var(--rdt-colvis-menu-border, 1px solid rgba(0, 0, 0, 0.15));
  border-radius: var(--rdt-colvis-menu-radius, 4px);
  background: var(--rdt-colvis-menu-bg, #fff);
  box-shadow: var(--rdt-colvis-menu-shadow, 0 2px 8px rgba(0, 0, 0, 0.12));
}
.rozie-data-table-wrap[data-rozie-s-d5dcab4c] .rdt-colvis-item[data-rozie-s-d5dcab4c] {
  display: flex;
  align-items: center;
  gap: var(--rdt-colvis-label-gap, 0.4em);
  cursor: pointer;
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-th[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-td[data-rozie-s-d5dcab4c] {
  width: var(--rdt-select-col-width, 1%);
  text-align: var(--rdt-select-col-align, center);
  white-space: nowrap;
}
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-all[data-rozie-s-d5dcab4c],
.rozie-data-table[data-rozie-s-d5dcab4c] .rdt-select-row[data-rozie-s-d5dcab4c] {
  cursor: pointer;
  accent-color: var(--rdt-select-accent, currentColor);
}
`;

  @property({ type: Array }) data!: any[];
  @property({ type: Array }) columns: any[] = [];
  @property({ type: String, reflect: true }) selectionMode: string = 'none';
  @property({ type: Array, attribute: 'sorting' }) _sorting_attr: any[] = [];
  private _sortingControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'sorting-change', defaultValue: [], initialControlledValue: undefined });
  @property({ type: String, attribute: 'global-filter' }) _globalFilter_attr: string = '';
  private _globalFilterControllable = createLitControllableProperty<string>({ host: this, eventName: 'global-filter-change', defaultValue: '', initialControlledValue: undefined });
  @property({ type: Array, attribute: 'column-filters' }) _columnFilters_attr: any[] = [];
  private _columnFiltersControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'column-filters-change', defaultValue: [], initialControlledValue: undefined });
  @property({ type: Object, attribute: 'pagination' }) _pagination_attr: any = {
  pageIndex: 0,
  pageSize: 10
};
  private _paginationControllable = createLitControllableProperty<any>({ host: this, eventName: 'pagination-change', defaultValue: {
  pageIndex: 0,
  pageSize: 10
}, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) manual: boolean = false;
  @property({ type: Object, attribute: 'row-selection' }) _rowSelection_attr: any = {};
  private _rowSelectionControllable = createLitControllableProperty<any>({ host: this, eventName: 'row-selection-change', defaultValue: {}, initialControlledValue: undefined });
  @property({ type: Object, attribute: 'column-visibility' }) _columnVisibility_attr: any = {};
  private _columnVisibilityControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-visibility-change', defaultValue: {}, initialControlledValue: undefined });
  @property({ type: Object, attribute: 'column-sizing' }) _columnSizing_attr: any = {};
  private _columnSizingControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-sizing-change', defaultValue: {}, initialControlledValue: undefined });
  @property({ type: Array, attribute: 'column-order' }) _columnOrder_attr: any[] = [];
  private _columnOrderControllable = createLitControllableProperty<any[]>({ host: this, eventName: 'column-order-change', defaultValue: [], initialControlledValue: undefined });
  @property({ type: Object, attribute: 'column-pinning' }) _columnPinning_attr: any = {
  left: [],
  right: []
};
  private _columnPinningControllable = createLitControllableProperty<any>({ host: this, eventName: 'column-pinning-change', defaultValue: {
  left: [],
  right: []
}, initialControlledValue: undefined });
  @property({ type: Boolean, reflect: true }) stickyHeader: boolean = false;
  @property({ type: String, reflect: true }) interactionMode: string = 'table';
  private _sortingDefault = signal([]);
  private _globalFilterDefault = signal('');
  private _columnFiltersDefault = signal([]);
  private _paginationDefault = signal({
  pageIndex: 0,
  pageSize: 10
});
  private _rowSelectionDefault = signal({});
  private _columnVisibilityDefault = signal({});
  private _columnSizingDefault = signal({});
  private _columnOrderDefault = signal([]);
  private _columnPinningDefault = signal({
  left: [],
  right: []
});
  private _columnSizingInfo = signal({
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: []
});
  private _colReg = signal({});
  private _rows = signal([]);
  private _headerGroups = signal([]);
  private _rowModelVer = signal(0);
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;
private __rozieWatchInitial_1 = true;
private __rozieCtxProvider_data_table_columns = new ContextProvider(this, { context: __rozieCtx_data_table_columns, initialValue: ((__rozieCtxHost) => ({
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    __rozieCtxHost._colReg.value = {
      ...__rozieCtxHost._colReg.value,
      [key]: spec
    };
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...__rozieCtxHost._colReg.value
    };
    delete r[String(id)];
    __rozieCtxHost._colReg.value = r;
  }
}))(this) });

  @state() private _hasSlotDefault = false;
  @queryAssignedElements({ flatten: true }) private _slotDefaultElements!: Element[];
  @state() private _hasSlotSelectAll = false;
  @queryAssignedElements({ slot: 'selectAll', flatten: true }) private _slotSelectAllElements!: Element[];
  @property({ attribute: false }) selectAll?: (scope: { checked: unknown; indeterminate: unknown; toggle: unknown }) => unknown;
  @state() private _hasSlotSelectCell = false;
  @queryAssignedElements({ slot: 'selectCell', flatten: true }) private _slotSelectCellElements!: Element[];
  @property({ attribute: false }) selectCell?: (scope: { row: unknown; checked: unknown; toggle: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot:not([name])');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotDefault = this._slotDefaultElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selectAll"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelectAll = this._slotSelectAllElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }

    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="selectCell"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotSelectCell = this._slotSelectCellElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotSelectAll = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectAll');
    this._hasSlotSelectCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectCell');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this.cellMounts = new Map();

    this._disconnectCleanups.push((() => {
      // dispose every live cell/header projection on unmount.
      if (this.cellMounts) {
        for (const h of this.cellMounts.values() as any) {
          if (h && h.dispose) {
            try {
              h.dispose();
            } catch (e: any) {}
          }
        }
        this.cellMounts.clear();
      }
    }));

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => [this.sorting, this.globalFilter, this.columnFilters, this.pagination, this.rowSelection, this.columnVisibility, this.columnSizing, this.columnOrder, this.columnPinning, this.selectionMode, (this.data || []).length, this._colReg.value])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (!this.table) return;
      this.table.setOptions((prev: any) => ({
        ...prev,
        data: this.data,
        columns: this.tableColumns(),
        state: this.currentState(),
        enableRowSelection: this.selectionMode !== 'none',
        enableMultiRowSelection: this.selectionMode === 'multiple'
      }));
      if (this.refreshRowModel) this.refreshRowModel();
    })(); }); }));
    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => this._rowModelVer.value)(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      this.scheduleReconcile();
    })(); }); }));

    this._disconnectCleanups.push(effect(() => { void this._colReg.value; this.__rozieCtxProvider_data_table_columns.setValue(((__rozieCtxHost) => ({
      registerColumn: (id: any, spec: any) => {
        if (id == null) return;
        const key = String(id);
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
        __rozieCtxHost._colReg.value = {
          ...__rozieCtxHost._colReg.value,
          [key]: spec
        };
      },
      unregisterColumn: (id: any) => {
        if (id == null) return;
        const r = {
          ...__rozieCtxHost._colReg.value
        };
        delete r[String(id)];
        __rozieCtxHost._colReg.value = r;
      }
    }))(this)); }));

    // Build the table instance HERE so the closures below capture the live `table`.
    this.table = createTable({
      get data() {
        return this.data;
      },
      columns: this.tableColumns(),
      state: this.currentState(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      // Server-side hook (req-6): when `manual` is set, table-core trusts the consumer's
      // rows verbatim (no client-side filter/sort/paginate) and only emits the change
      // events so the consumer can fetch the next page/filtered slice.
      manualPagination: this.manual === true,
      manualFiltering: this.manual === true,
      manualSorting: this.manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: this.selectionMode !== 'none',
      enableMultiRowSelection: this.selectionMode === 'multiple',
      // PER-SLICE callback (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff). Each applies the table-core Updater against the
      // CURRENT slice value, then funnels a FRESH value through the echo-guarded writer.
      onSortingChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().sorting);
        this.writeSorting(next);
      },
      onGlobalFilterChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().globalFilter);
        this.writeGlobalFilter(next);
      },
      onColumnFiltersChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().columnFilters);
        this.writeColumnFilters(next);
      },
      onPaginationChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().pagination);
        this.writePagination(next);
      },
      onRowSelectionChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().rowSelection);
        this.writeRowSelection(next);
      },
      // Column-management callbacks (req-8/9/10/11) — each applies the table-core Updater
      // against the CURRENT slice value, then funnels a FRESH value through its
      // echo-guarded writer (same A4 STATIC-key discipline as the slices above).
      onColumnVisibilityChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().columnVisibility);
        this.writeColumnVisibility(next);
      },
      onColumnSizingChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().columnSizing);
        this.writeColumnSizing(next);
      },
      onColumnOrderChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().columnOrder);
        this.writeColumnOrder(next);
      },
      onColumnPinningChange: (updater: any) => {
        const next = this.applyUpdater(updater, this.currentState().columnPinning);
        this.writeColumnPinning(next);
      },
      // Transient resize-gesture state — table-core drives this during a drag (NOT a
      // two-way model slice). Write a FRESH object to $data so getState() reflects
      // the live gesture; gate the row-model refresh on the resizing flag so a drag
      // re-pulls the sized columns. No change event (it is internal gesture state).
      onColumnSizingInfoChange: (updater: any) => {
        const next = this.applyUpdater(updater, this._columnSizingInfo.value);
        this._columnSizingInfo.value = next != null ? next : this._columnSizingInfo.value;
      },
      // Resize mode: 'onChange' so the bound columnSizing model updates live during the
      // drag (the behavioral width-delta assertion observes the in-progress width). Column
      // resizing is enabled at the table level; per-column opt-out is via the ColumnDef.
      columnResizeMode: 'onChange',
      enableColumnResizing: true,
      renderFallbackValue: null
    });
    this.refreshRowModel = () => {
      if (!this.table) return;
      // Capture fresh locals; never write a $data key then re-read it in the same fn
      // (ROZ138 / React stale-read — setState is async on React, the closure binds the
      // PRE-write value).
      const nextRows = this.table.getRowModel().rows.slice();
      const nextGroups = this.table.getHeaderGroups().slice();
      this._rows.value = nextRows;
      this._headerGroups.value = nextGroups;
      this._rowModelVer.value = this._rowModelVer.value + 1;
    };

    // initial pull
    // initial pull
    this.refreshRowModel();
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts — DEFERRED (scheduleReconcile) so the keyed r-for DOM
    // hosts exist before we query for them (a synchronous call here finds zero hosts
    // on first paint).
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts — DEFERRED (scheduleReconcile) so the keyed r-for DOM
    // hosts exist before we query for them (a synchronous call here finds zero hosts
    // on first paint).
    this.scheduleReconcile();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    super.attributeChangedCallback(name, old, value);
    if (name === 'sorting') this._sortingControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'global-filter') this._globalFilterControllable.notifyAttributeChange(value as unknown as string);
    if (name === 'column-filters') this._columnFiltersControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'pagination') this._paginationControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'row-selection') this._rowSelectionControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-visibility') this._columnVisibilityControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-sizing') this._columnSizingControllable.notifyAttributeChange(value as unknown as any);
    if (name === 'column-order') this._columnOrderControllable.notifyAttributeChange(value as unknown as any[]);
    if (name === 'column-pinning') this._columnPinningControllable.notifyAttributeChange(value as unknown as any);
  }

  render() {
    return html`

<div class="rozie-data-table-wrap" data-rozie-ref="__rozieRoot" data-rozie-s-d5dcab4c>

<div class="rdt-column-defs" style="display:none" aria-hidden="true" data-rozie-s-d5dcab4c><slot></slot></div>

<div class="rdt-toolbar" data-rozie-s-d5dcab4c>
  <input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" .value=${this.globalFilterValue()} @input=${($event: Event) => { this.onGlobalFilterInput($event); }} data-rozie-s-d5dcab4c />
  
  ${this.allLeafColumns().length ? html`<details class="rdt-colvis" data-rozie-s-d5dcab4c>
    <summary class="rdt-colvis-summary" data-rozie-s-d5dcab4c>Columns</summary>
    <div class="rdt-colvis-menu" role="group" aria-label="Toggle columns" data-rozie-s-d5dcab4c>
      ${repeat<any>(this.allLeafColumns(), (lc, _idx) => lc.id, (lc, _idx) => html`<label class="rdt-colvis-item" key=${rozieAttr(lc.id)} data-rozie-s-d5dcab4c>
        <input class="rdt-colvis-checkbox" type="checkbox" ?checked=${lc.visible} @change=${($event: Event) => { this.onToggleVisibility(lc.id); }} data-rozie-s-d5dcab4c />
        <span class="rdt-colvis-label" data-rozie-s-d5dcab4c>${rozieDisplay(lc.label)}</span>
      </label>`)}
    </div>
  </details>` : nothing}</div>

<table class="${Object.entries({ "rozie-data-table": true, 'rdt-sticky': this.stickyHeader }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="table" data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._headerGroups.value, (hg, _idx) => hg.id, (hg, _idx) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(hg.id)} data-rozie-s-d5dcab4c>
      ${repeat<any>(hg.headers, (header, _idx) => header.id, (header, _idx) => html`<th class="${Object.entries({ "rdt-th": true, 'rdt-select-th': this.isSelectColumn(header.column.id), 'rdt-th-resizing': this.columnIsResizing(header.column.id) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="columnheader" key=${rozieAttr(header.id)} data-col=${rozieAttr(header.column.id)} aria-sort=${rozieAttr(this.ariaSortFor(header.column.id))} style=${this.thStyle(header.column.id)} data-rozie-s-d5dcab4c>
        
        ${this.isSelectColumn(header.column.id) ? html`<template data-rozie-s-d5dcab4c>
          ${this.selectAll !== undefined ? this.selectAll({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected(), toggle: this.onToggleAllRows}) : html`<slot name="selectAll" data-rozie-params=${(() => { try { return JSON.stringify({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected()}); } catch { return '{}'; } })()} @rozie-select-all-toggle=${($event: CustomEvent) => ((this.onToggleAllRows) as (...args: any[]) => any)($event.detail)}>
            ${this.selectionMode === 'multiple' ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} indeterminate=${rozieAttr(this.isSomeRowsSelected())} @change=${($event: Event) => { this.onToggleAllRows($event); }} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </template>` : html`<template data-rozie-s-d5dcab4c>
          
          ${header.column.getCanSort && header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event: Event) => { this.onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c>
            
            ${this.columnHasHeaderTemplate(header.column.id) ? html`<span class="rdt-header-host" data-header-host=${rozieAttr('h:' + header.column.id)} data-col=${rozieAttr(header.column.id)} data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-header-label" data-rozie-s-d5dcab4c>${rozieDisplay(this.headerLabel(header.column.id))}</span>`}<span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(header.column.id))}</span>
          </button>` : html`<template data-rozie-s-d5dcab4c>
            ${this.columnHasHeaderTemplate(header.column.id) ? html`<span class="rdt-header-host" data-header-host=${rozieAttr('h:' + header.column.id)} data-col=${rozieAttr(header.column.id)} data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-header-label" data-rozie-s-d5dcab4c>${rozieDisplay(this.headerLabel(header.column.id))}</span>`}</template>`}${this.columnIsFilterable(header.column.id) ? html`<input class="rdt-col-filter" type="text" aria-label=${rozieAttr('Filter ' + this.headerLabel(header.column.id))} .value=${this.columnFilterValue(header.column.id)} @input=${($event: Event) => { this.onColumnFilterInput(header.column.id, $event); }} @click=${($event: MouseEvent) => { $event.stopPropagation(); ((undefined) as (...args: any[]) => any)($event); }} data-rozie-s-d5dcab4c />` : nothing}<span class="rdt-pin-controls" role="group" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id))} data-rozie-s-d5dcab4c>
            <button class="rdt-pin-btn rdt-pin-left" type="button" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id) + ' to left')} aria-pressed=${this.columnPinSide(header.column.id) === 'left'} @click=${($event: MouseEvent) => { $event.stopPropagation(); this.onPinColumn(header.column.id, 'left'); }} data-rozie-s-d5dcab4c>⇤</button>
            <button class="rdt-pin-btn rdt-pin-none" type="button" aria-label=${rozieAttr('Unpin ' + this.headerLabel(header.column.id))} aria-pressed=${!this.columnPinSide(header.column.id)} @click=${($event: MouseEvent) => { $event.stopPropagation(); this.onPinColumn(header.column.id, false); }} data-rozie-s-d5dcab4c>⇔</button>
            <button class="rdt-pin-btn rdt-pin-right" type="button" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id) + ' to right')} aria-pressed=${this.columnPinSide(header.column.id) === 'right'} @click=${($event: MouseEvent) => { $event.stopPropagation(); this.onPinColumn(header.column.id, 'right'); }} data-rozie-s-d5dcab4c>⇥</button>
          </span>
          
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr('Resize ' + this.headerLabel(header.column.id))} @pointerdown=${($event: PointerEvent) => { $event.stopPropagation(); this.onResizeStart(header.column.id, $event); }} @touchstart=${($event: TouchEvent) => { $event.stopPropagation(); this.onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </template>`}</th>`)}
    </tr>`)}
  </thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._rows.value, (row, _idx) => row.id, (row, _idx) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(row.id)} data-rozie-s-d5dcab4c>
      ${repeat<any>(row.getVisibleCells(), (cellCtx, _idx) => cellCtx.id, (cellCtx, _idx) => html`<td class="${Object.entries({ "rdt-td": true, 'rdt-select-td': this.isSelectColumn(cellCtx.column.id) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="cell" key=${rozieAttr(cellCtx.id)} data-col=${rozieAttr(cellCtx.column.id)} style=${this.pinStyle(cellCtx.column.id)} data-rozie-s-d5dcab4c>
        
        ${this.isSelectColumn(cellCtx.column.id) ? html`<template data-rozie-s-d5dcab4c>
          ${this.selectCell !== undefined ? this.selectCell({row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e)}) : html`<slot name="selectCell" data-rozie-params=${(() => { try { return JSON.stringify({row: row.original, checked: this.rowIsSelected(row)}); } catch { return '{}'; } })()} @rozie-select-cell-toggle=${($event: CustomEvent) => ((e => this.onToggleRow(row, e)) as (...args: any[]) => any)($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(row)} @change=${($event: Event) => { this.onToggleRow(row, $event); }} data-rozie-s-d5dcab4c />
          </slot>`}
        </template>` : html`<template data-rozie-s-d5dcab4c>
          
          ${this.columnHasCellTemplate(cellCtx.column.id) ? html`<span class="rdt-cell-host" data-cell-host=${rozieAttr('c:' + row.id + ':' + cellCtx.column.id)} data-col=${rozieAttr(cellCtx.column.id)} data-row=${rozieAttr(row.id)} data-rozie-s-d5dcab4c></span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>${rozieDisplay(cellCtx.getValue())}</span>`}</template>`}</td>`)}
    </tr>`)}
  </tbody>
</table>


<div class="rdt-pagination" role="group" aria-label="Pagination" data-rozie-s-d5dcab4c>
  <button class="rdt-page-btn rdt-page-prev" type="button" ?disabled=${!this.canPrevPage()} @click=${($event: Event) => { this.onPrevPage(); }} data-rozie-s-d5dcab4c>Prev</button>
  <span class="rdt-page-status" aria-live="polite" data-rozie-s-d5dcab4c>
    ${rozieDisplay('Page ' + (this.pageIndex() + 1) + ' of ' + this.pageCount())}
  </span>
  <button class="rdt-page-btn rdt-page-next" type="button" ?disabled=${!this.canNextPage()} @click=${($event: Event) => { this.onNextPage(); }} data-rozie-s-d5dcab4c>Next</button>
  <select class="rdt-page-size" aria-label="Rows per page" .value=${this.pageSize()} @change=${($event: Event) => { this.onPageSizeChange($event); }} data-rozie-s-d5dcab4c>
    <option value=${10} data-rozie-s-d5dcab4c>10</option>
    <option value=${25} data-rozie-s-d5dcab4c>25</option>
    <option value=${50} data-rozie-s-d5dcab4c>50</option>
    <option value=${100} data-rozie-s-d5dcab4c>100</option>
  </select>
</div>
</div>
`;
  }

  table: any = null;

  programmatic = 0;

  currentState = () => ({
  sorting: this.sorting != null ? this.sorting : this._sortingDefault.value,
  globalFilter: this.globalFilter != null ? this.globalFilter : this._globalFilterDefault.value,
  columnFilters: this.columnFilters != null ? this.columnFilters : this._columnFiltersDefault.value,
  pagination: this.pagination != null ? this.pagination : this._paginationDefault.value,
  rowSelection: this.rowSelection != null ? this.rowSelection : this._rowSelectionDefault.value,
  columnVisibility: this.columnVisibility != null ? this.columnVisibility : this._columnVisibilityDefault.value,
  columnSizing: this.columnSizing != null ? this.columnSizing : this._columnSizingDefault.value,
  columnOrder: this.columnOrder != null ? this.columnOrder : this._columnOrderDefault.value,
  columnPinning: this.columnPinning != null ? this.columnPinning : this._columnPinningDefault.value,
  // columnSizingInfo: table-core's transient resize-gesture state. We pass an
  // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
  // `column.getIsResizing()` / `getResizeHandler()` read
  // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
  // absent. Seed the default shape (matches table-core's
  // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
  // every render. Not a two-way model slice (transient gesture state, not consumer
  // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
  columnSizingInfo: this._columnSizingInfo.value
});

  isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';

  columnDefs = () => {
  const byId = Object.create(null);
  const order = [];
  const cfg = this.columns || [];
  for (const c of cfg as any) {
    if (!c) continue;
    const rawId = c.id != null ? c.id : c.field;
    if (rawId == null) continue;
    const id = String(rawId);
    if (!this.isSafeKey(id)) continue;
    if (!(id in byId)) order.push(id);
    byId[id] = {
      id,
      accessorKey: c.field != null ? c.field : id,
      header: c.header != null ? c.header : id,
      enableSorting: c.sortable === true,
      // per-column filter opt-in (req-5). table-core gates the filter input + value
      // funnel on enableColumnFilter; a column with filterable !== true cannot be
      // filtered (and renders no per-column filter input in the chrome below).
      enableColumnFilter: c.filterable === true,
      filterable: c.filterable === true,
      // config-array columns carry no template → plain-value fast path.
      hasCell: false,
      cellRenderer: null,
      hasHeader: false,
      headerRenderer: null,
      pinned: c.pinned != null ? c.pinned : '',
      width: c.width != null ? c.width : ''
    };
  }
  const reg = this._colReg.value || {};
  for (const id in reg) {
    if (!this.isSafeKey(id)) continue;
    const spec = reg[id];
    if (!spec) continue;
    if (!(id in byId)) order.push(id);
    byId[id] = {
      id,
      accessorKey: spec.field != null ? spec.field : id,
      header: spec.header != null ? spec.header : id,
      enableSorting: spec.sortable === true,
      enableColumnFilter: spec.filterable === true,
      filterable: spec.filterable === true,
      hasCell: spec.hasCell === true,
      cellRenderer: spec.cellRenderer != null ? spec.cellRenderer : null,
      hasHeader: spec.hasHeader === true,
      headerRenderer: spec.headerRenderer != null ? spec.headerRenderer : null,
      pinned: spec.pinned != null ? spec.pinned : '',
      width: spec.width != null ? spec.width : ''
    };
  }
  const out = [];
  for (const id of order as any) if (byId[id]) out.push(byId[id]);
  return out;
};

  SELECT_COL_ID = '__rdt_select';

  selectionEnabled = () => this.selectionMode === 'single' || this.selectionMode === 'multiple';

  tableColumns = () => {
  const cols = this.columnDefs();
  if (this.selectionEnabled()) {
    const selectCol = {
      id: this.SELECT_COL_ID,
      enableSorting: false,
      enableColumnFilter: false,
      filterable: false,
      isSelectColumn: true,
      hasCell: false,
      cellRenderer: null,
      hasHeader: false,
      headerRenderer: null,
      pinned: '',
      width: ''
    };
    return [selectCol].concat(cols);
  }
  return cols;
};

  writeSorting = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._sortingDefault.value = next; // fresh array only (never in-place)
  this._sortingControllable.write(next); // two-way emit if bound (no-op-diff if not)
  this.dispatchEvent(new CustomEvent("sort-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  applyUpdater = (updater: any, current: any) => typeof updater === 'function' ? updater(current) : updater;

  writeGlobalFilter = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._globalFilterDefault.value = next;
  this._globalFilterControllable.write(next);
  this.dispatchEvent(new CustomEvent("filter-change", {
    detail: {
      globalFilter: next
    },
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnFilters = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnFiltersDefault.value = next;
  this._columnFiltersControllable.write(next);
  this.dispatchEvent(new CustomEvent("filter-change", {
    detail: {
      columnFilters: next
    },
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writePagination = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._paginationDefault.value = next;
  this._paginationControllable.write(next);
  this.dispatchEvent(new CustomEvent("page-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeRowSelection = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._rowSelectionDefault.value = next;
  this._rowSelectionControllable.write(next);
  this.dispatchEvent(new CustomEvent("selection-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnVisibility = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnVisibilityDefault.value = next;
  this._columnVisibilityControllable.write(next);
  this.dispatchEvent(new CustomEvent("visibility-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnSizing = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnSizingDefault.value = next;
  this._columnSizingControllable.write(next);
  this.dispatchEvent(new CustomEvent("resize-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnOrder = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnOrderDefault.value = next;
  this._columnOrderControllable.write(next);
  this.dispatchEvent(new CustomEvent("reorder-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  writeColumnPinning = (next: any) => {
  if (this.programmatic) return;
  this.programmatic++;
  this._columnPinningDefault.value = next;
  this._columnPinningControllable.write(next);
  this.dispatchEvent(new CustomEvent("pin-change", {
    detail: next,
    bubbles: true,
    composed: true
  }));
  this.programmatic--;
};

  columnFilterValue = (colId: any) => {
  const cf = this.currentState().columnFilters || [];
  for (const f of cf as any) if (f && f.id === colId) return f.value != null ? f.value : '';
  return '';
};

  setColumnFilter = (colId: any, value: any) => {
  const prev = this.currentState().columnFilters || [];
  const next = [];
  for (const f of prev as any) if (f && f.id !== colId) next.push(f);
  if (value != null && value !== '') next.push({
    id: colId,
    value
  });
  this.writeColumnFilters(next);
};

  refreshRowModel: any = null;

  cellMounts: any = null;

  reconcileProjections = () => {
  if (!this._ref__rozieRoot || !this.cellMounts) return;
  const seen = new Set();
  const defs = this.columnDefs();
  const defById = Object.create(null);
  for (const d of defs as any) defById[d.id] = d;
  // cells
  const cellHosts = this._ref__rozieRoot.querySelectorAll('[data-cell-host]');
  for (const host of cellHosts as any) {
    const key = host.getAttribute('data-cell-host');
    seen.add(key);
    if (this.cellMounts.has(key)) continue;
    const colId = host.getAttribute('data-col');
    const rowId = host.getAttribute('data-row');
    const def = defById[colId];
    if (!def || !def.hasCell || !def.cellRenderer) continue;
    const row = (this._rows.value || []).find((r: any) => String(r.id) === String(rowId));
    if (!row) continue;
    const handle = def.cellRenderer(host, {
      row: row.original,
      value: row.getValue(def.accessorKey),
      column: def
    });
    if (handle) this.cellMounts.set(key, handle);
  }
  // headers
  const headerHosts = this._ref__rozieRoot.querySelectorAll('[data-header-host]');
  for (const host of headerHosts as any) {
    const key = host.getAttribute('data-header-host');
    seen.add(key);
    if (this.cellMounts.has(key)) continue;
    const colId = host.getAttribute('data-col');
    const def = defById[colId];
    if (!def || !def.hasHeader || !def.headerRenderer) continue;
    const handle = def.headerRenderer(host, {
      column: def
    });
    if (handle) this.cellMounts.set(key, handle);
  }
  // dispose handles whose host went away
  for (const key of Array.from(this.cellMounts.keys()) as any) {
    if (!seen.has(key)) {
      const h = this.cellMounts.get(key);
      this.cellMounts.delete(key);
      if (h && h.dispose) {
        try {
          h.dispose();
        } catch (e: any) {}
      }
    }
  }
};

  reconcilePending = false;

  scheduleReconcile = () => {
  if (this.reconcilePending) return;
  this.reconcilePending = true;
  const run = () => {
    this.reconcilePending = false;
    this.reconcileProjections();
  };
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      Promise.resolve().then(run);
    });
  } else {
    Promise.resolve().then(run);
  }
};

  onHeaderSort = (colId: any, evt: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (!col || !col.getCanSort()) return;
  const multi = !!(evt && evt.shiftKey);
  // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
  col.toggleSorting(undefined, multi);
};

  ariaSortFor = (colId: any) => {
  if (!this.table) return 'none';
  const col = this.table.getColumn(colId);
  if (!col) return 'none';
  const dir = col.getIsSorted();
  if (dir === 'asc') return 'ascending';
  if (dir === 'desc') return 'descending';
  return 'none';
};

  sortIndicator = (colId: any) => {
  if (!this.table) return '';
  const col = this.table.getColumn(colId);
  if (!col) return '';
  const dir = col.getIsSorted();
  if (dir === 'asc') return '▲';
  if (dir === 'desc') return '▼';
  return '';
};

  defFor = (colId: any) => {
  const defs = this.columnDefs();
  for (const d of defs as any) if (d.id === colId) return d;
  return null;
};

  columnHasCellTemplate = (colId: any) => {
  const d = this.defFor(colId);
  return !!(d && d.hasCell && d.cellRenderer);
};

  columnHasHeaderTemplate = (colId: any) => {
  const d = this.defFor(colId);
  return !!(d && d.hasHeader && d.headerRenderer);
};

  columnIsFilterable = (colId: any) => {
  const d = this.defFor(colId);
  return !!(d && d.filterable);
};

  headerLabel = (colId: any) => {
  const d = this.defFor(colId);
  return d ? d.header : colId;
};

  headerWidth = (colId: any) => {
  if (!this.table) return null;
  const col = this.table.getColumn(colId);
  if (!col) return null;
  const w = col.getSize();
  return w != null && w > 0 ? w + 'px' : null;
};

  onResizeStart = (colId: any, evt: any) => {
  if (!this.table) return;
  const header = this.findHeader(colId);
  if (!header || !header.getResizeHandler) return;
  const handler = header.getResizeHandler();
  if (handler) handler(evt);
};

  findHeader = (colId: any) => {
  const groups = this._headerGroups.value || [];
  for (const hg of groups as any) {
    const hs = hg.headers || [];
    for (const h of hs as any) if (h && h.column && h.column.id === colId) return h;
  }
  return null;
};

  columnIsResizing = (colId: any) => {
  if (!this.table) return false;
  const header = this.findHeader(colId);
  return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
};

  columnIsVisible = (colId: any) => {
  if (!this.table) return true;
  const col = this.table.getColumn(colId);
  return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
};

  onToggleVisibility = (colId: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.toggleVisibility) col.toggleVisibility();
};

  allLeafColumns = () => {
  if (!this.table) return [];
  const cols = this.table.getAllLeafColumns ? this.table.getAllLeafColumns() : [];
  const out = [];
  for (const c of cols as any) {
    if (!c || c.id === this.SELECT_COL_ID) continue;
    out.push({
      id: c.id,
      label: this.headerLabel(c.id),
      visible: !!(c.getIsVisible && c.getIsVisible())
    });
  }
  return out;
};

  columnPinSide = (colId: any) => {
  if (!this.table) return false;
  const col = this.table.getColumn(colId);
  if (!col || !col.getIsPinned) return false;
  return col.getIsPinned();
};

  onPinColumn = (colId: any, side: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.pin) col.pin(side);
};

  pinStyle = (colId: any) => {
  if (!this.table) return '';
  const col = this.table.getColumn(colId);
  if (!col || !col.getIsPinned) return '';
  const side = col.getIsPinned();
  if (side === 'left') {
    const left = col.getStart ? col.getStart('left') : 0;
    return 'position:sticky;left:' + left + 'px;z-index:1;';
  }
  if (side === 'right') {
    const right = col.getAfter ? col.getAfter('right') : 0;
    return 'position:sticky;right:' + right + 'px;z-index:1;';
  }
  return '';
};

  thStyle = (colId: any) => {
  let s = '';
  const w = this.headerWidth(colId);
  if (w) s += 'width:' + w + ';';
  s += this.pinStyle(colId);
  return s;
};

  onGlobalFilterInput = (evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  if (this.table) {
    this.table.setGlobalFilter(value);
    return;
  }
  this.writeGlobalFilter(value);
};

  onColumnFilterInput = (colId: any, evt: any) => {
  const value = evt && evt.target ? evt.target.value : '';
  this.setColumnFilter(colId, value);
};

  globalFilterValue = () => {
  const v = this.currentState().globalFilter;
  return v != null ? v : '';
};

  pageIndex = () => {
  if (this.table) return this.table.getState().pagination.pageIndex;
  const p = this.currentState().pagination;
  return p && p.pageIndex != null ? p.pageIndex : 0;
};

  pageSize = () => {
  if (this.table) return this.table.getState().pagination.pageSize;
  const p = this.currentState().pagination;
  return p && p.pageSize != null ? p.pageSize : 10;
};

  pageCount = () => {
  if (!this.table) return 1;
  const c = this.table.getPageCount();
  return c != null && c > 0 ? c : 1;
};

  canPrevPage = () => !!(this.table && this.table.getCanPreviousPage());

  canNextPage = () => !!(this.table && this.table.getCanNextPage());

  onPrevPage = () => {
  if (this.table) this.table.previousPage();
};

  onNextPage = () => {
  if (this.table) this.table.nextPage();
};

  onPageSizeChange = (evt: any) => {
  if (!this.table) return;
  const v = evt && evt.target ? evt.target.value : '';
  const n = parseInt(v, 10);
  this.table.setPageSize(Number.isFinite(n) && n > 0 ? n : 10);
};

  isSelectColumn = (colId: any) => colId === this.SELECT_COL_ID;

  isAllRowsSelected = () => !!(this.table && this.table.getIsAllRowsSelected());

  isSomeRowsSelected = () => !!(this.table && this.table.getIsSomeRowsSelected());

  onToggleAllRows = (evt: any) => {
  if (!this.table) return;
  this.table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
};

  rowIsSelected = (row: any) => !!(row && row.getIsSelected && row.getIsSelected());

  onToggleRow = (row: any, evt: any) => {
  if (!row || !row.toggleSelected) return;
  row.toggleSelected(!!(evt && evt.target && evt.target.checked));
};

  sortColumn = (colId: any, desc: any) => {
  if (this.table) this.table.getColumn(colId) && this.table.getColumn(colId).toggleSorting(desc, false);
};

  clearSorting = () => {
  if (this.table) this.table.resetSorting(true);
};

  getColumnDefs = () => this.columnDefs();

  toggleAllRows = (value: any) => {
  if (this.table) this.table.toggleAllRowsSelected(value);
};

  clearSelection = () => {
  if (this.table) this.table.resetRowSelection(true);
};

  getSelectedRows = () => this.table ? this.table.getSelectedRowModel().rows.map((r: any) => r.original) : [];

  setPage = (idx: any) => {
  if (this.table) this.table.setPageIndex(idx);
};

  setRowsPerPage = (size: any) => {
  if (this.table) this.table.setPageSize(size);
};

  toggleColumnVisibility = (colId: any) => {
  if (this.table) {
    const c = this.table.getColumn(colId);
    if (c && c.toggleVisibility) c.toggleVisibility();
  }
};

  applyColumnOrder = (order: any) => {
  if (this.table) this.table.setColumnOrder(order);
};

  resetColumnSizing = () => {
  if (this.table) this.table.resetColumnSizing(true);
};

  pinColumn = (colId: any, side: any) => {
  if (this.table) {
    const c = this.table.getColumn(colId);
    if (c && c.pin) c.pin(side);
  }
};

  get sorting(): any[] { return this._sortingControllable.read(); }
  set sorting(v: any[]) { this._sortingControllable.notifyPropertyWrite(v); }
  get globalFilter(): string { return this._globalFilterControllable.read(); }
  set globalFilter(v: string) { this._globalFilterControllable.notifyPropertyWrite(v); }
  get columnFilters(): any[] { return this._columnFiltersControllable.read(); }
  set columnFilters(v: any[]) { this._columnFiltersControllable.notifyPropertyWrite(v); }
  get pagination(): any { return this._paginationControllable.read(); }
  set pagination(v: any) { this._paginationControllable.notifyPropertyWrite(v); }
  get rowSelection(): any { return this._rowSelectionControllable.read(); }
  set rowSelection(v: any) { this._rowSelectionControllable.notifyPropertyWrite(v); }
  get columnVisibility(): any { return this._columnVisibilityControllable.read(); }
  set columnVisibility(v: any) { this._columnVisibilityControllable.notifyPropertyWrite(v); }
  get columnSizing(): any { return this._columnSizingControllable.read(); }
  set columnSizing(v: any) { this._columnSizingControllable.notifyPropertyWrite(v); }
  get columnOrder(): any[] { return this._columnOrderControllable.read(); }
  set columnOrder(v: any[]) { this._columnOrderControllable.notifyPropertyWrite(v); }
  get columnPinning(): any { return this._columnPinningControllable.read(); }
  set columnPinning(v: any) { this._columnPinningControllable.notifyPropertyWrite(v); }
}
