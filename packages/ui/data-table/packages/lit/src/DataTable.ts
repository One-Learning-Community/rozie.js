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

interface RozieColHeaderSlotCtx {
  columnId: unknown;
  column: unknown;
  label: unknown;
}

interface RozieSelectCellSlotCtx {
  row: unknown;
  checked: unknown;
  toggle: unknown;
}

interface RozieCellSlotCtx {
  columnId: unknown;
  column: unknown;
  row: unknown;
  value: unknown;
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
  private _activeRow = signal(0);
  private _activeColIndex = signal(0);
  private _activeIsHeader = signal(false);
  private _activeInControl = signal(false);
  @query('[data-rozie-ref="__rozieRoot"]') private _ref__rozieRoot!: HTMLElement;
private __rozieWatchInitial_0 = true;
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
  @state() private _hasSlotColHeader = false;
  @queryAssignedElements({ slot: 'colHeader', flatten: true }) private _slotColHeaderElements!: Element[];
  @property({ attribute: false }) colHeader?: (scope: { columnId: unknown; column: unknown; label: unknown }) => unknown;
  @state() private _hasSlotSelectCell = false;
  @queryAssignedElements({ slot: 'selectCell', flatten: true }) private _slotSelectCellElements!: Element[];
  @property({ attribute: false }) selectCell?: (scope: { row: unknown; checked: unknown; toggle: unknown }) => unknown;
  @state() private _hasSlotCell = false;
  @queryAssignedElements({ slot: 'cell', flatten: true }) private _slotCellElements!: Element[];
  @property({ attribute: false }) cell?: (scope: { columnId: unknown; column: unknown; row: unknown; value: unknown }) => unknown;

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
      const slotEl = this.shadowRoot?.querySelector('slot[name="colHeader"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotColHeader = this._slotColHeaderElements.length > 0; };
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
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotDefault = Array.from(this.children).some((el) => !el.hasAttribute('slot') && (el.nodeType !== 3 || (el.textContent?.trim().length ?? 0) > 0));
    this._hasSlotSelectAll = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectAll');
    this._hasSlotColHeader = Array.from(this.children).some((el) => el.getAttribute('slot') === 'colHeader');
    this._hasSlotSelectCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'selectCell');
    this._hasSlotCell = Array.from(this.children).some((el) => el.getAttribute('slot') === 'cell');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    this._disconnectCleanups.push(effect(() => { const __watchVal = (() => [this.sorting, this.globalFilter, this.columnFilters, this.pagination, this.rowSelection, this.columnVisibility, this.columnSizing, this.columnOrder, this.columnPinning, this.selectionMode, (this.data || []).length, this._colReg.value])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.reFeed();
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
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      data: this.data,
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
      // PER-SLICE callbacks (Open-Q1: each maps 1:1 to a slice's r-model + change event,
      // no global onStateChange diff) — hoisted top-level consts, re-passed by the re-feed
      // $watch so React reads fresh currentState (the stale-closure fix, F6).
      onSortingChange: this.onSortingChangeCb,
      onGlobalFilterChange: this.onGlobalFilterChangeCb,
      onColumnFiltersChange: this.onColumnFiltersChangeCb,
      onPaginationChange: this.onPaginationChangeCb,
      onRowSelectionChange: this.onRowSelectionChangeCb,
      onColumnVisibilityChange: this.onColumnVisibilityChangeCb,
      onColumnSizingChange: this.onColumnSizingChangeCb,
      onColumnOrderChange: this.onColumnOrderChangeCb,
      onColumnPinningChange: this.onColumnPinningChangeCb,
      onColumnSizingInfoChange: this.onColumnSizingInfoChangeCb,
      // Resize mode: 'onChange' so the bound columnSizing model updates live during the
      // drag (the behavioral width-delta assertion observes the in-progress width). Column
      // resizing is enabled at the table level; per-column opt-out is via the ColumnDef.
      columnResizeMode: 'onChange',
      enableColumnResizing: true,
      renderFallbackValue: null,
      // table-core's RESOLVED options type (TableOptionsResolved) requires a global
      // onStateChange + renderFallbackValue; we drive state via the per-slice on<Slice>Change
      // callbacks above, so the global hook is a no-op. Present so the createTable() argument
      // satisfies the strict bundled-leaf tsc (deferred-items strict-tsc #2 close).
      onStateChange: () => {}
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
      // D-05: on every data change (re-sort/filter/paginate/page-size — all re-pull here),
      // clamp the active cell to the new bounds (same indices, clamped if the grid shrank;
      // no row-id following, no top-bounce). isGrid()-gated so 'table' mode is untouched.
      this.clampActiveCell();
      // keep the select-all checkbox's `indeterminate` DOM property in lockstep with the
      // selection state (bound :indeterminate is inert on 5/6 targets). The box persists
      // across selection changes; a microtask defer covers React's post-render DOM patch.
      this.syncIndeterminate();
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(this.syncIndeterminate);else Promise.resolve().then(this.syncIndeterminate);
    };

    // initial pull
    // initial pull
    this.refreshRowModel();

    // ── Grid mode: capture the table root ──────────────────────────────────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean.
    // ── Grid mode: capture the table root ──────────────────────────────────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean.
    this.gridRoot = this._ref__rozieRoot ? this._ref__rozieRoot.querySelector('.rozie-data-table') : null;
    // WR-04: NO on-mount auto-focus of the entry cell. Auto-focusing here stole focus on
    // page load AND was non-deterministic on React/Solid (the entry cell may not be
    // committed to the DOM yet at the $onMount microtask). The roving tabindex="0" entry
    // cell IS the first Tab-in target (matching the Wave-0 probe's "no auto-focus on
    // mount"); the consumer drives focus by Tabbing/clicking in, never the component.
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (!this.table) return;
    const d = this.data || [];
    if (d === this.lastData && d.length === this.lastDataLen) return;
    this.lastData = d;
    this.lastDataLen = d.length;
    this.reFeed();
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

<table class="${Object.entries({ "rozie-data-table": true, 'rdt-sticky': this.stickyHeader }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.tableRole())} @keydown=${($event: Event) => { this.onGridKeyDown($event); }} @focusin=${($event: Event) => { this.syncActiveFromEvent($event); }} @focusout=${($event: Event) => { this.onGridFocusOut($event); }} data-rozie-s-d5dcab4c>
  <thead class="rdt-thead" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._headerGroups.value, (hg, _idx) => hg.id, (hg, _idx) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(hg.id)} data-rozie-s-d5dcab4c>
      ${repeat<any>(hg.headers, (header, _idx) => header.id, (header, _idx) => html`<th class="${Object.entries({ "rdt-th": true, 'rdt-select-th': this.isSelectColumn(header.column.id), 'rdt-th-resizing': this.columnIsResizing(header.column.id) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role="columnheader" key=${rozieAttr(header.id)} data-col=${rozieAttr(header.column.id)} data-grid-cell="" data-row="__header" data-col-index=${rozieAttr(this.headerColIndexOf(hg, header))} tabindex=${rozieAttr(this.cellTabindex('__header', this.headerColIndexOf(hg, header)))} aria-sort=${rozieAttr(this.ariaSortFor(header.column.id))} style=${this.thStyle(header.column.id)} data-rozie-s-d5dcab4c>
        
        
        ${this.isSelectColumn(header.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectAll !== undefined ? this.selectAll({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected(), toggle: this.onToggleAllRows}) : html`<slot name="selectAll" data-rozie-params=${(() => { try { return JSON.stringify({checked: this.isAllRowsSelected(), indeterminate: this.isSomeRowsSelected()}); } catch { return '{}'; } })()} @rozie-select-all-toggle=${($event: CustomEvent) => ((this.onToggleAllRows) as (...args: any[]) => any)($event.detail)}>
            
            ${this.selectionMode === 'multiple' ? html`<input class="rdt-select-all" type="checkbox" aria-label="Select all rows" ?checked=${this.isAllRowsSelected()} @change=${($event: Event) => { this.onToggleAllRows($event); }} data-rozie-s-d5dcab4c />` : nothing}</slot>`}
        </span>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
          
          ${header.column.getCanSort && header.column.getCanSort() ? html`<button class="rdt-sort-btn" type="button" @click=${($event: Event) => { this.onHeaderSort(header.column.id, $event); }} data-rozie-s-d5dcab4c>
            
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
            <span class="rdt-sort-ind" aria-hidden="true" data-rozie-s-d5dcab4c>${rozieDisplay(this.sortIndicator(header.column.id))}</span>
          </button>` : html`<span style="display:contents" data-rozie-s-d5dcab4c>
            <span class="rdt-header-label" data-rozie-s-d5dcab4c>
              ${this.colHeader !== undefined ? this.colHeader({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}) : html`<slot name="colHeader" data-rozie-params=${(() => { try { return JSON.stringify({columnId: header.column.id, column: header.column, label: this.headerLabel(header.column.id)}); } catch { return '{}'; } })()}>${rozieDisplay(this.headerLabel(header.column.id))}</slot>`}
            </span>
          </span>`}${this.columnIsFilterable(header.column.id) ? html`<input class="rdt-col-filter" type="text" aria-label=${rozieAttr('Filter ' + this.headerLabel(header.column.id))} .value=${this.columnFilterValue(header.column.id)} @input=${($event: Event) => { this.onColumnFilterInput(header.column.id, $event); }} @click=${($event: Event) => { this.stopEvent($event); }} data-rozie-s-d5dcab4c />` : nothing}<span class="rdt-pin-controls" role="group" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id))} data-rozie-s-d5dcab4c>
            <button class="rdt-pin-btn rdt-pin-left" type="button" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id) + ' to left')} aria-pressed=${this.columnPinSide(header.column.id) === 'left'} @click=${($event: Event) => { this.onPinColumn(header.column.id, 'left', $event); }} data-rozie-s-d5dcab4c>⇤</button>
            <button class="rdt-pin-btn rdt-pin-none" type="button" aria-label=${rozieAttr('Unpin ' + this.headerLabel(header.column.id))} aria-pressed=${!this.columnPinSide(header.column.id)} @click=${($event: Event) => { this.onPinColumn(header.column.id, false, $event); }} data-rozie-s-d5dcab4c>⇔</button>
            <button class="rdt-pin-btn rdt-pin-right" type="button" aria-label=${rozieAttr('Pin ' + this.headerLabel(header.column.id) + ' to right')} aria-pressed=${this.columnPinSide(header.column.id) === 'right'} @click=${($event: Event) => { this.onPinColumn(header.column.id, 'right', $event); }} data-rozie-s-d5dcab4c>⇥</button>
          </span>
          
          <button class="rdt-resize-handle" type="button" aria-label=${rozieAttr('Resize ' + this.headerLabel(header.column.id))} @pointerdown=${($event: Event) => { this.onResizeStart(header.column.id, $event); }} @touchstart=${($event: Event) => { this.onResizeStart(header.column.id, $event); }} data-rozie-s-d5dcab4c><span class="rdt-resize-grip" aria-hidden="true" data-rozie-s-d5dcab4c></span></button>
        </span>`}</th>`)}
    </tr>`)}
  </thead>

  <tbody class="rdt-tbody" role="rowgroup" data-rozie-s-d5dcab4c>
    ${repeat<any>(this._rows.value, (row, _idx) => row.id, (row, _idx) => html`<tr class="rdt-tr" role="row" key=${rozieAttr(row.id)} data-rozie-s-d5dcab4c>
      ${repeat<any>(this.visibleCellsFor(row), (cellCtx, _idx) => cellCtx.id, (cellCtx, _idx) => html`<td class="${Object.entries({ "rdt-td": true, 'rdt-select-td': this.isSelectColumn(cellCtx.column.id) }).filter(([, v]) => v).map(([k]) => k).join(' ')}" role=${rozieAttr(this.cellRole())} key=${rozieAttr(cellCtx.id)} data-col=${rozieAttr(cellCtx.column.id)} data-grid-cell="" data-row=${rozieAttr(this.rowIndexOf(row))} data-col-index=${rozieAttr(this.colIndexOf(row, cellCtx))} tabindex=${rozieAttr(this.cellTabindex(String(this.rowIndexOf(row)), this.colIndexOf(row, cellCtx)))} style=${this.pinStyle(cellCtx.column.id)} data-rozie-s-d5dcab4c>
        
        ${this.isSelectColumn(cellCtx.column.id) ? html`<span style="display:contents" data-rozie-s-d5dcab4c>
          ${this.selectCell !== undefined ? this.selectCell({row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e)}) : html`<slot name="selectCell" data-rozie-params=${(() => { try { return JSON.stringify({row: row.original, checked: this.rowIsSelected(row)}); } catch { return '{}'; } })()} @rozie-select-cell-toggle=${($event: CustomEvent) => ((e => this.onToggleRow(row, e)) as (...args: any[]) => any)($event.detail)}>
            <input class="rdt-select-row" type="checkbox" aria-label="Select row" ?checked=${this.rowIsSelected(row)} @change=${($event: Event) => { this.onToggleRow(row, $event); }} data-rozie-s-d5dcab4c />
          </slot>`}
        </span>` : html`<span class="rdt-cell-value" data-rozie-s-d5dcab4c>
          ${this.cell !== undefined ? this.cell({columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue()}) : html`<slot name="cell" data-rozie-params=${(() => { try { return JSON.stringify({columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue()}); } catch { return '{}'; } })()}>${rozieDisplay(cellCtx.getValue())}</slot>`}
        </span>`}</td>`)}
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

  GRID_PAGE_STEP = 10;

  gridRoot: any = null;

  programmatic = 0;

  currentState = (): any => ({
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

  onSortingChangeCb = (updater: any) => {
  this.writeSorting(this.applyUpdater(updater, this.currentState().sorting));
};

  onGlobalFilterChangeCb = (updater: any) => {
  this.writeGlobalFilter(this.applyUpdater(updater, this.currentState().globalFilter));
};

  onColumnFiltersChangeCb = (updater: any) => {
  this.writeColumnFilters(this.applyUpdater(updater, this.currentState().columnFilters));
};

  onPaginationChangeCb = (updater: any) => {
  this.writePagination(this.applyUpdater(updater, this.currentState().pagination));
};

  onRowSelectionChangeCb = (updater: any) => {
  this.writeRowSelection(this.applyUpdater(updater, this.currentState().rowSelection));
};

  onColumnVisibilityChangeCb = (updater: any) => {
  this.writeColumnVisibility(this.applyUpdater(updater, this.currentState().columnVisibility));
};

  onColumnSizingChangeCb = (updater: any) => {
  this.writeColumnSizing(this.applyUpdater(updater, this.currentState().columnSizing));
};

  onColumnOrderChangeCb = (updater: any) => {
  this.writeColumnOrder(this.applyUpdater(updater, this.currentState().columnOrder));
};

  onColumnPinningChangeCb = (updater: any) => {
  this.writeColumnPinning(this.applyUpdater(updater, this.currentState().columnPinning));
};

  onColumnSizingInfoChangeCb = (updater: any) => {
  const next = this.applyUpdater(updater, this._columnSizingInfo.value);
  this._columnSizingInfo.value = next != null ? next : this._columnSizingInfo.value;
};

  reFeed = () => {
  if (!this.table) return;
  this.table.setOptions((prev: any) => ({
    ...prev,
    data: this.data,
    columns: this.tableColumns(),
    state: this.currentState(),
    enableRowSelection: this.selectionMode !== 'none',
    enableMultiRowSelection: this.selectionMode === 'multiple',
    // Re-pass the per-slice callbacks so React captures fresh currentState each cycle
    // (table-core keeps the prior callbacks otherwise → mount-time stale closure, F6).
    onSortingChange: this.onSortingChangeCb,
    onGlobalFilterChange: this.onGlobalFilterChangeCb,
    onColumnFiltersChange: this.onColumnFiltersChangeCb,
    onPaginationChange: this.onPaginationChangeCb,
    onRowSelectionChange: this.onRowSelectionChangeCb,
    onColumnVisibilityChange: this.onColumnVisibilityChangeCb,
    onColumnSizingChange: this.onColumnSizingChangeCb,
    onColumnOrderChange: this.onColumnOrderChangeCb,
    onColumnPinningChange: this.onColumnPinningChangeCb,
    onColumnSizingInfoChange: this.onColumnSizingInfoChangeCb
  }));
  if (this.refreshRowModel) this.refreshRowModel();
};

  lastData: any = null;

  lastDataLen = -1;

  onHeaderSort = (colId: any, evt: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (!col || !col.getCanSort()) return;
  const multi = !!(evt && evt.shiftKey);
  // toggleSorting(desc?, isMulti?) cycles asc → desc → none; multi accumulates.
  col.toggleSorting(undefined, multi);
};

  tick = () => this._rowModelVer.value;

  ariaSortFor = (colId: any) => {
  if (this.tick() < 0 || !this.table) return 'none';
  const col = this.table.getColumn(colId);
  if (!col) return 'none';
  const dir = col.getIsSorted();
  if (dir === 'asc') return 'ascending';
  if (dir === 'desc') return 'descending';
  return 'none';
};

  sortIndicator = (colId: any) => {
  if (this.tick() < 0 || !this.table) return '';
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

  visibleCellsFor = (row: any) => this._rowModelVer.value >= 0 ? row.getVisibleCells() : [];

  columnIsFilterable = (colId: any) => {
  const d = this.defFor(colId);
  return !!(d && d.filterable);
};

  headerLabel = (colId: any) => {
  const d = this.defFor(colId);
  return d ? d.header : colId;
};

  headerWidth = (colId: any) => {
  if (this.tick() < 0 || !this.table) return null;
  const col = this.table.getColumn(colId);
  if (!col) return null;
  const w = col.getSize();
  return w != null && w > 0 ? w + 'px' : null;
};

  onResizeStart = (colId: any, evt: any) => {
  // stop here (NOT a `.stop` modifier) — the Angular `.stop`-in-@for hoist is broken (F5).
  if (evt && evt.stopPropagation) evt.stopPropagation();
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
  if (this.tick() < 0 || !this.table) return false;
  const header = this.findHeader(colId);
  return !!(header && header.column && header.column.getIsResizing && header.column.getIsResizing());
};

  columnIsVisible = (colId: any) => {
  if (this.tick() < 0 || !this.table) return true;
  const col = this.table.getColumn(colId);
  return !!(col && (col.getIsVisible ? col.getIsVisible() : true));
};

  onToggleVisibility = (colId: any) => {
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.toggleVisibility) col.toggleVisibility();
};

  allLeafColumns = () => {
  if (this.tick() < 0 || !this.table) return [];
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
  if (this.tick() < 0 || !this.table) return false;
  const col = this.table.getColumn(colId);
  if (!col || !col.getIsPinned) return false;
  return col.getIsPinned();
};

  onPinColumn = (colId: any, side: any, evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
  if (!this.table) return;
  const col = this.table.getColumn(colId);
  if (col && col.pin) col.pin(side);
};

  pinStyle = (colId: any) => {
  if (this.tick() < 0 || !this.table) return '';
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
  if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageIndex;
  const p = this.currentState().pagination;
  return p && p.pageIndex != null ? p.pageIndex : 0;
};

  pageSize = () => {
  if (this.tick() >= 0 && this.table) return this.table.getState().pagination.pageSize;
  const p = this.currentState().pagination;
  return p && p.pageSize != null ? p.pageSize : 10;
};

  pageCount = () => {
  if (this.tick() < 0 || !this.table) return 1;
  const c = this.table.getPageCount();
  return c != null && c > 0 ? c : 1;
};

  canPrevPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanPreviousPage());

  canNextPage = () => !!(this.tick() >= 0 && this.table && this.table.getCanNextPage());

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

  stopEvent = (evt: any) => {
  if (evt && evt.stopPropagation) evt.stopPropagation();
};

  isAllRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsAllRowsSelected());

  isSomeRowsSelected = () => !!(this.tick() >= 0 && this.table && this.table.getIsSomeRowsSelected());

  onToggleAllRows = (evt: any) => {
  if (!this.table) return;
  this.table.toggleAllRowsSelected(!!(evt && evt.target && evt.target.checked));
};

  rowIsSelected = (row: any) => {
  if (!row) return false;
  const id = row.id;
  const sel = this.currentState().rowSelection || {};
  if (id != null && Object.prototype.hasOwnProperty.call(sel, id)) return !!sel[id];
  return !!(row.getIsSelected && row.getIsSelected());
};

  onToggleRow = (row: any, evt: any) => {
  if (!row || !row.toggleSelected) return;
  row.toggleSelected(!!(evt && evt.target && evt.target.checked));
};

  selectAllBox: any = null;

  syncIndeterminate = () => {
  if (!this._ref__rozieRoot || !this._ref__rozieRoot.querySelector) return;
  this.selectAllBox = this._ref__rozieRoot.querySelector('.rdt-select-all');
  if (this.selectAllBox) this.selectAllBox.indeterminate = this.isSomeRowsSelected() && !this.isAllRowsSelected();
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

  isGrid = () => this.interactionMode === 'grid';

  tableRole = () => this.isGrid() ? 'grid' : 'table';

  cellRole = () => this.isGrid() ? 'gridcell' : 'cell';

  rowIndexOf = (row: any) => this.tick() >= 0 ? (this._rows.value || []).indexOf(row) : -1;

  colIndexOf = (row: any, cellCtx: any) => this.tick() >= 0 ? this.visibleCellsFor(row).indexOf(cellCtx) : -1;

  headerColIndexOf = (hg: any, header: any) => (hg && hg.headers ? hg.headers : []).indexOf(header);

  cellTabindex = (rowKey: any, colIndex: any) => {
  if (!this.isGrid()) return null;
  const activeKey = this._activeIsHeader.value ? '__header' : String(this._activeRow.value);
  const isActive = rowKey === activeKey && colIndex === this._activeColIndex.value;
  return isActive ? 0 : -1;
};

  resolveCellEl = (rowKey: any, colIndex: any) => {
  if (!this.gridRoot) return null;
  return this.gridRoot.querySelector('[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]');
};

  focusActiveCell = (nextRow = null, nextCol = null, nextIsHeader = null) => {
  if (!this.isGrid() || !this.gridRoot) return;
  // ── phase 53 hooks HERE: scrollRowIntoWindow(nextRow ?? $data.activeRow) before resolve ──
  const r = nextRow == null ? this._activeRow.value : nextRow;
  const c = nextCol == null ? this._activeColIndex.value : nextCol;
  // Thread the FRESH post-write isHeader flag (the plan-01-PROVEN contract): a header
  // crossing sets $data.activeIsHeader inside moveRow, but React's setState (ROZ138) and
  // Angular's signal write are async within one handler — re-reading $data.activeIsHeader
  // here returns the PRE-write value, resolving focus to the BODY cell instead of the
  // header. Callers pass the fresh isHeader local; falls back to $data when omitted.
  const header = nextIsHeader == null ? this._activeIsHeader.value : nextIsHeader;
  const rowKey = header ? '__header' : String(r);
  const el = this.resolveCellEl(rowKey, c);
  if (el) el.focus();
};

  visibleColCount = () => {
  // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
  // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
  // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
  const rowList = this._rows.value || [];
  if (rowList.length) return rowList[0].getVisibleCells().length;
  const hg = this._headerGroups.value || [];
  return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
};

  bodyRowCount = () => (this._rows.value || []).length;

  clamp = (v: any, lo: any, hi: any) => v < lo ? lo : v > hi ? hi : v;

  moveCol = (delta: any) => {
  const max = this.visibleColCount() - 1;
  const nextCol = this.clamp(this._activeColIndex.value + delta, 0, max < 0 ? 0 : max);
  this._activeColIndex.value = nextCol;
  return nextCol;
};

  moveRow = (delta: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  if (this._activeIsHeader.value) {
    // In the header: any downward move lands on body row 0; upward stays in the header.
    if (delta > 0) {
      this._activeIsHeader.value = false;
      this._activeRow.value = 0;
      return {
        row: 0,
        isHeader: false
      };
    }
    return {
      row: this._activeRow.value,
      isHeader: true
    };
  }
  // In the body: an upward move from row 0 crosses into the header.
  if (delta < 0 && this._activeRow.value === 0) {
    this._activeIsHeader.value = true;
    return {
      row: this._activeRow.value,
      isHeader: true
    };
  }
  const nextRow = this.clamp(this._activeRow.value + delta, 0, maxRow);
  this._activeRow.value = nextRow;
  this._activeIsHeader.value = false;
  return {
    row: nextRow,
    isHeader: false
  };
};

  gotoColEdge = (toEnd: any) => {
  const max = this.visibleColCount() - 1;
  const nextCol = toEnd ? max < 0 ? 0 : max : 0;
  this._activeColIndex.value = nextCol;
  return nextCol;
};

  gotoStart = () => {
  this._activeIsHeader.value = false;
  this._activeRow.value = 0;
  this._activeColIndex.value = 0;
  return {
    row: 0,
    col: 0
  };
};

  gotoEnd = () => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const max = this.visibleColCount() - 1;
  const maxCol = max < 0 ? 0 : max;
  this._activeIsHeader.value = false;
  this._activeRow.value = maxRow;
  this._activeColIndex.value = maxCol;
  return {
    row: maxRow,
    col: maxCol
  };
};

  currentCellEl = () => {
  const rowKey = this._activeIsHeader.value ? '__header' : String(this._activeRow.value);
  return this.resolveCellEl(rowKey, this._activeColIndex.value);
};

  focusables = (cellEl: any) => {
  if (!cellEl || !cellEl.querySelectorAll) return [];
  const list = Array.prototype.slice.call(cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'));
  return list.filter((n: any) => !n.disabled);
};

  enterControl = () => {
  const cellEl = this.currentCellEl();
  const list = this.focusables(cellEl);
  if (!list.length) return;
  this._activeInControl.value = true;
  list[0].focus();
};

  cycleWithinCell = (cellEl: any, forward: any) => {
  const list = this.focusables(cellEl);
  if (!list.length) return;
  const active = this.gridRoot ? this.gridRoot.getRootNode().activeElement : null;
  const cur = list.indexOf(active);
  let i = cur < 0 ? 0 : forward ? cur + 1 : cur - 1;
  if (i >= list.length) i = 0;
  if (i < 0) i = list.length - 1;
  list[i].focus();
};

  onGridKeyDown = (e: any) => {
  if (!this.isGrid() || !e) return;
  const key = e.key;
  // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
  if (this._activeInControl.value) {
    if (key === 'Escape') {
      e.preventDefault();
      this._activeInControl.value = false;
      // Return focus to the OWNING cell (no move happened) — pass the current indices
      // explicitly (the React-emitted seam types both params as required; a zero-arg call
      // is TS2554). Reading $data here is safe: no write to activeRow/activeColIndex precedes it.
      this.focusActiveCell(this._activeRow.value, this._activeColIndex.value);
    } else if (key === 'Tab') {
      e.preventDefault();
      this.cycleWithinCell(this.currentCellEl(), !e.shiftKey);
    }
    return;
  }
  // WR-05: in navigation mode, only hijack arrow/Home/End/Page keys when focus is ON a
  // grid cell. An inner control reached WITHOUT Enter (e.g. a header filter <input> the
  // user clicked into directly, or a per-cell control tabbed/clicked to) must keep its
  // NATIVE key behavior — caret movement, option cycling, etc. e.target is the deepest
  // focused node; if it is not itself a [data-grid-cell], let the event pass through.
  const tgt = e.target;
  if (!tgt || !tgt.hasAttribute || !tgt.hasAttribute('data-grid-cell')) return;
  // Navigation mode — compute fresh locals, write $data inside the helper, thread them out.
  // nextIsHeader is threaded alongside nextRow/nextCol so the focus seam never re-reads the
  // async-stale $data.activeIsHeader after a header crossing (React ROZ138 / Angular signal —
  // plan-01 Pitfall 2). moveRow returns the fresh { row, isHeader }; every other branch lands
  // in the body (isHeader = false). WR-06: snapshot the PRE-move indices so the emit below
  // fires ONLY on a real move (a clamped no-op edge move leaves them identical).
  const prevRow = this._activeRow.value;
  const prevCol = this._activeColIndex.value;
  const prevIsHeader = this._activeIsHeader.value;
  let nextRow = prevRow;
  let nextCol = prevCol;
  let nextIsHeader = prevIsHeader;
  if (key === 'ArrowRight') {
    e.preventDefault();
    nextCol = this.moveCol(1);
  } else if (key === 'ArrowLeft') {
    e.preventDefault();
    nextCol = this.moveCol(-1);
  } else if (key === 'ArrowDown') {
    e.preventDefault();
    const m = this.moveRow(1);
    nextRow = m.row;
    nextIsHeader = m.isHeader;
  } else if (key === 'ArrowUp') {
    e.preventDefault();
    const m = this.moveRow(-1);
    nextRow = m.row;
    nextIsHeader = m.isHeader;
  } else if (key === 'PageDown') {
    e.preventDefault();
    const m = this.moveRow(this.GRID_PAGE_STEP);
    nextRow = m.row;
    nextIsHeader = m.isHeader;
  } else if (key === 'PageUp') {
    e.preventDefault();
    const m = this.moveRow(-this.GRID_PAGE_STEP);
    nextRow = m.row;
    nextIsHeader = m.isHeader;
  } else if (key === 'Home') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const s = this.gotoStart();
      nextRow = s.row;
      nextCol = s.col;
      nextIsHeader = false;
    } else {
      nextCol = this.gotoColEdge(false);
    }
  } else if (key === 'End') {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const en = this.gotoEnd();
      nextRow = en.row;
      nextCol = en.col;
      nextIsHeader = false;
    } else {
      nextCol = this.gotoColEdge(true);
    }
  } else if (key === 'Enter' || key === 'F2') {
    e.preventDefault();
    this.enterControl();
    return;
  } else return;
  // THE seam — built from the SAME fresh post-write locals (Pitfall 2). Always re-assert
  // focus on the resolved cell (harmless on a no-op clamp; corrects any drift otherwise).
  this.focusActiveCell(nextRow, nextCol, nextIsHeader);
  // WR-06: the D-02 activecell-change event fires ONLY when the resolved cell actually
  // changed. A clamped no-op edge move (ArrowLeft at col 0, ArrowDown at the page-last
  // row, …) leaves the indices identical → no spurious emit (a no-op is not a navigation).
  if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader) {
    this.dispatchEvent(new CustomEvent("activecell-change", {
      detail: {
        rowIndex: nextRow,
        colIndex: nextCol
      },
      bubbles: true,
      composed: true
    }));
  }
};

  syncActiveFromEvent = (e: any) => {
  if (!this.isGrid() || !e) return;
  const tgt = e.target;
  if (!tgt || !tgt.closest) return;
  const cellEl = tgt.closest('[data-grid-cell]');
  if (!cellEl) return;
  const rowAttr = cellEl.getAttribute('data-row');
  const colAttr = cellEl.getAttribute('data-col-index');
  if (rowAttr == null || colAttr == null) return;
  const col = parseInt(colAttr, 10);
  if (!Number.isFinite(col)) return;
  const isHeader = rowAttr === '__header';
  this._activeIsHeader.value = isHeader;
  if (!isHeader) {
    const row = parseInt(rowAttr, 10);
    if (Number.isFinite(row)) this._activeRow.value = row;
  }
  this._activeColIndex.value = col;
  // The cell box (not an inner control) receiving focus = navigation mode.
  if (tgt === cellEl) this._activeInControl.value = false;
};

  onGridFocusOut = (e: any) => {
  if (!this.isGrid() || !this._activeInControl.value) return;
  const next = e ? e.relatedTarget : null;
  const cellEl = this.currentCellEl();
  if (!cellEl || !next || !cellEl.contains(next)) this._activeInControl.value = false;
};

  clampActiveCell = () => {
  if (!this.isGrid()) return;
  const maxCol = this.visibleColCount() - 1;
  const col = this.clamp(this._activeColIndex.value, 0, maxCol < 0 ? 0 : maxCol);
  if (col !== this._activeColIndex.value) this._activeColIndex.value = col;
  if (!this._activeIsHeader.value) {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const row = this.clamp(this._activeRow.value, 0, maxRow);
    if (row !== this._activeRow.value) this._activeRow.value = row;
  }
};

  focusCell = (rowIndex: any, colIndex: any) => {
  const lastRow = this.bodyRowCount() - 1;
  const maxRow = lastRow < 0 ? 0 : lastRow;
  const maxCol = this.visibleColCount() - 1;
  const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
  const c = this.clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
  this._activeIsHeader.value = false;
  this._activeInControl.value = false;
  this._activeRow.value = r;
  this._activeColIndex.value = c;
  // Thread isHeader=false EXPLICITLY (focusCell always lands in the body). Without it
  // focusActiveCell re-reads $data.activeIsHeader, which on React (setState async, ROZ138)
  // / Angular (async signal) returns the PRE-write value — and WR-03's @focusin sync sets
  // activeIsHeader=true whenever an inner control inside a HEADER cell (a sort button) was
  // last clicked, so a stale read would resolve focus to the header instead of body row r.
  this.focusActiveCell(r, c, false);
  this.dispatchEvent(new CustomEvent("activecell-change", {
    detail: {
      rowIndex: r,
      colIndex: c
    },
    bubbles: true,
    composed: true
  }));
};

  getActiveCell = () => ({
  rowIndex: this._activeRow.value,
  colIndex: this._activeColIndex.value
});

  clearActiveCell = () => {
  this._activeIsHeader.value = false;
  this._activeInControl.value = false;
  this._activeRow.value = 0;
  this._activeColIndex.value = 0;
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
