import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

interface DefaultCtx {}

interface SelectAllCtx {
  $implicit: { checked: any; indeterminate: any; toggle: any };
  checked: any;
  indeterminate: any;
  toggle: any;
}

interface ColHeaderCtx {
  $implicit: { columnId: any; column: any; label: any };
  columnId: any;
  column: any;
  label: any;
}

interface ColHeaderCtx {
  $implicit: { columnId: any; column: any; label: any };
  columnId: any;
  column: any;
  label: any;
}

interface SelectCellCtx {
  $implicit: { row: any; checked: any; toggle: any };
  row: any;
  checked: any;
  toggle: any;
}

interface CellCtx {
  $implicit: { columnId: any; column: any; row: any; value: any };
  columnId: any;
  column: any;
  row: any;
  value: any;
}

function __rozieDisplay(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      // Circular structure or a non-serialisable value (BigInt nested in an
      // object). Degrade to a non-throwing form so the wrap never crashes the
      // render — that is the entire point of "safe" interpolation (SPEC-1).
      return String(v);
    }
  }
  return String(v);
}

function __rozieAttr(v: unknown): string | null {
  return v == null ? null : __rozieDisplay(v);
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
  selector: 'rozie-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, NgClass],
  template: `


    <div class="rozie-data-table-wrap" #__rozieRoot>

    <div class="rdt-column-defs" style="display:none" aria-hidden="true"><ng-container *ngTemplateOutlet="(defaultTpl ?? templates()?.['defaultSlot'])" /></div>

    <div class="rdt-toolbar">
      <input class="rdt-global-filter" type="text" role="searchbox" aria-label="Search table" [value]="globalFilterValue()" (input)="onGlobalFilterInput($event)" />
      
      @if (allLeafColumns().length) {
    <details class="rdt-colvis">
        <summary class="rdt-colvis-summary">Columns</summary>
        <div class="rdt-colvis-menu" role="group" aria-label="Toggle columns">
          @for (lc of allLeafColumns(); track lc.id) {
    <label class="rdt-colvis-item">
            <input type="checkbox" class="rdt-colvis-checkbox" [checked]="lc.visible" (change)="onToggleVisibility(lc.id)" />
            <span class="rdt-colvis-label">{{ rozieDisplay(lc.label) }}</span>
          </label>
    }
        </div>
      </details>
    }</div>

    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" [attr.role]="rozieAttr(tableRole())" (keydown)="onGridKeyDown($event)">
      <thead class="rdt-thead" role="rowgroup">
        @for (hg of headerGroups(); track hg.id) {
    <tr class="rdt-tr" role="row">
          @for (header of hg.headers; track header.id) {
    <th class="rdt-th" [ngClass]="{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }" role="columnheader" [attr.data-col]="rozieAttr(header.column.id)" data-grid-cell="" data-row="__header" [attr.data-col-index]="rozieAttr(headerColIndexOf(hg, header))" [attr.tabindex]="rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header)))" [attr.aria-sort]="rozieAttr(ariaSortFor(header.column.id))" [style]="thStyle(header.column.id)">
            
            
            @if (isSelectColumn(header.column.id)) {
    <span style="display:contents">
              @if ((selectAllTpl ?? templates()?.['selectAll'])) {
    <ng-container *ngTemplateOutlet="(selectAllTpl ?? templates()?.['selectAll']); context: { $implicit: { checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }, checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }" />
    } @else {

                
                @if (selectionMode() === 'multiple') {
    <input class="rdt-select-all" type="checkbox" aria-label="Select all rows" [checked]="isAllRowsSelected()" (change)="onToggleAllRows($event)" />
    }
    }
            </span>
    } @else {
    <span style="display:contents">
              
              @if (header.column.getCanSort && header.column.getCanSort()) {
    <button type="button" class="rdt-sort-btn" (click)="onHeaderSort(header.column.id, $event)">
                
                <span class="rdt-header-label">
                  @if ((colHeaderTpl ?? templates()?.['colHeader'])) {
    <ng-container *ngTemplateOutlet="(colHeaderTpl ?? templates()?.['colHeader']); context: { $implicit: { columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }, columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }" />
    } @else {
    {{ rozieDisplay(headerLabel(header.column.id)) }}
    }
                </span>
                <span class="rdt-sort-ind" aria-hidden="true">{{ rozieDisplay(sortIndicator(header.column.id)) }}</span>
              </button>
    } @else {
    <span style="display:contents">
                <span class="rdt-header-label">
                  @if ((colHeaderTpl ?? templates()?.['colHeader'])) {
    <ng-container *ngTemplateOutlet="(colHeaderTpl ?? templates()?.['colHeader']); context: { $implicit: { columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }, columnId: header.column.id, column: header.column, label: headerLabel(header.column.id) }" />
    } @else {
    {{ rozieDisplay(headerLabel(header.column.id)) }}
    }
                </span>
              </span>
    }@if (columnIsFilterable(header.column.id)) {
    <input class="rdt-col-filter" type="text" [attr.aria-label]="rozieAttr('Filter ' + headerLabel(header.column.id))" [value]="columnFilterValue(header.column.id)" (input)="onColumnFilterInput(header.column.id, $event)" (click)="stopEvent($event)" />
    }<span class="rdt-pin-controls" role="group" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id))">
                <button type="button" class="rdt-pin-btn rdt-pin-left" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')" [attr.aria-pressed]="columnPinSide(header.column.id) === 'left'" (click)="onPinColumn(header.column.id, 'left', $event)">⇤</button>
                <button type="button" class="rdt-pin-btn rdt-pin-none" [attr.aria-label]="rozieAttr('Unpin ' + headerLabel(header.column.id))" [attr.aria-pressed]="!columnPinSide(header.column.id)" (click)="onPinColumn(header.column.id, false, $event)">⇔</button>
                <button type="button" class="rdt-pin-btn rdt-pin-right" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')" [attr.aria-pressed]="columnPinSide(header.column.id) === 'right'" (click)="onPinColumn(header.column.id, 'right', $event)">⇥</button>
              </span>
              
              <button type="button" class="rdt-resize-handle" [attr.aria-label]="rozieAttr('Resize ' + headerLabel(header.column.id))" (pointerdown)="onResizeStart(header.column.id, $event)" (touchstart)="onResizeStart(header.column.id, $event)"><span class="rdt-resize-grip" aria-hidden="true"></span></button>
            </span>
    }</th>
    }
        </tr>
    }
      </thead>

      <tbody class="rdt-tbody" role="rowgroup">
        @for (row of rows(); track row.id) {
    <tr class="rdt-tr" role="row">
          @for (cellCtx of visibleCellsFor(row); track cellCtx.id) {
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }" [attr.role]="rozieAttr(cellRole())" [attr.data-col]="rozieAttr(cellCtx.column.id)" data-grid-cell="" [attr.data-row]="rozieAttr(rowIndexOf(row))" [attr.data-col-index]="rozieAttr(colIndexOf(row, cellCtx))" [attr.tabindex]="rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))" [style]="pinStyle(cellCtx.column.id)">
            
            @if (isSelectColumn(cellCtx.column.id)) {
    <span style="display:contents">
              @if ((selectCellTpl ?? templates()?.['selectCell'])) {
    <ng-container *ngTemplateOutlet="(selectCellTpl ?? templates()?.['selectCell']); context: _selectCell_ctx(row, cellCtx)" />
    } @else {

                <input class="rdt-select-row" type="checkbox" aria-label="Select row" [checked]="rowIsSelected(row)" (change)="onToggleRow(row, $event)" />
              
    }
            </span>
    } @else {
    <span class="rdt-cell-value">
              @if ((cellTpl ?? templates()?.['cell'])) {
    <ng-container *ngTemplateOutlet="(cellTpl ?? templates()?.['cell']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }, columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }" />
    } @else {
    {{ rozieDisplay(cellCtx.getValue()) }}
    }
            </span>
    }</td>
    }
        </tr>
    }
      </tbody>
    </table>


    <div class="rdt-pagination" role="group" aria-label="Pagination">
      <button type="button" class="rdt-page-btn rdt-page-prev" [disabled]="!canPrevPage()" (click)="onPrevPage()">Prev</button>
      <span class="rdt-page-status" aria-live="polite">
        {{ rozieDisplay('Page ' + (pageIndex() + 1) + ' of ' + pageCount()) }}
      </span>
      <button type="button" class="rdt-page-btn rdt-page-next" [disabled]="!canNextPage()" (click)="onNextPage()">Next</button>
      <select class="rdt-page-size" aria-label="Rows per page" [value]="pageSize()" (change)="onPageSizeChange($event)">
        <option [value]="10">10</option>
        <option [value]="25">25</option>
        <option [value]="50">50</option>
        <option [value]="100">100</option>
      </select>
    </div>
    </div>

  `,
  styles: [`
    .rozie-data-table {
      border-collapse: collapse;
      width: 100%;
      font: var(--rdt-font, 14px system-ui, sans-serif);
      color: var(--rdt-color, inherit);
    }
    .rozie-data-table .rdt-th,
    .rozie-data-table .rdt-td {
      padding: var(--rdt-cell-padding, 0.5rem 0.75rem);
      text-align: left;
      border-bottom: var(--rdt-border, 1px solid rgba(0, 0, 0, 0.08));
    }
    .rozie-data-table .rdt-thead .rdt-th {
      font-weight: var(--rdt-header-weight, 600);
      background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
    }
    .rozie-data-table .rdt-sort-btn {
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
    .rozie-data-table .rdt-sort-ind {
      font-size: 0.8em;
      opacity: var(--rdt-sort-ind-opacity, 0.7);
    }
    .rozie-data-table.rdt-sticky .rdt-thead .rdt-th {
      position: sticky;
      top: var(--rdt-sticky-top, 0);
      z-index: var(--rdt-sticky-z, 2);
      background: var(--rdt-header-bg, rgba(0, 0, 0, 0.03));
    }
    .rozie-data-table-wrap {
      display: flex;
      flex-direction: column;
      gap: var(--rdt-chrome-gap, 0.5rem);
    }
    .rozie-data-table-wrap .rdt-toolbar {
      display: flex;
      gap: var(--rdt-toolbar-gap, 0.5rem);
    }
    .rozie-data-table-wrap .rdt-global-filter,
    .rozie-data-table-wrap .rdt-col-filter {
      font: inherit;
      padding: var(--rdt-filter-padding, 0.25rem 0.5rem);
      border: var(--rdt-filter-border, 1px solid rgba(0, 0, 0, 0.2));
      border-radius: var(--rdt-filter-radius, 4px);
      background: var(--rdt-filter-bg, transparent);
      color: inherit;
    }
    .rozie-data-table-wrap .rdt-col-filter {
      display: block;
      margin-top: var(--rdt-col-filter-gap, 0.25rem);
      width: 100%;
      font-weight: normal;
    }
    .rozie-data-table-wrap .rdt-pagination {
      display: flex;
      align-items: center;
      gap: var(--rdt-pagination-gap, 0.5rem);
    }
    .rozie-data-table-wrap .rdt-page-btn {
      font: inherit;
      cursor: pointer;
      padding: var(--rdt-page-btn-padding, 0.25rem 0.6rem);
      border: var(--rdt-page-btn-border, 1px solid rgba(0, 0, 0, 0.2));
      border-radius: var(--rdt-page-btn-radius, 4px);
      background: var(--rdt-page-btn-bg, transparent);
      color: inherit;
    }
    .rozie-data-table-wrap .rdt-page-btn:disabled {
      opacity: var(--rdt-page-btn-disabled-opacity, 0.4);
      cursor: default;
    }
    .rozie-data-table-wrap .rdt-page-status {
      font-size: var(--rdt-page-status-size, 0.9em);
    }
    .rozie-data-table-wrap .rdt-page-size {
      font: inherit;
      padding: var(--rdt-page-size-padding, 0.2rem 0.4rem);
      border: var(--rdt-page-size-border, 1px solid rgba(0, 0, 0, 0.2));
      border-radius: var(--rdt-page-size-radius, 4px);
      background: var(--rdt-page-size-bg, transparent);
      color: inherit;
    }
    .rozie-data-table .rdt-th {
      position: relative;
    }
    .rozie-data-table .rdt-resize-handle {
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
    .rozie-data-table .rdt-resize-grip {
      display: block;
      width: var(--rdt-resize-grip-width, 2px);
      height: 100%;
      margin: 0 auto;
      background: var(--rdt-resize-grip-color, rgba(0, 0, 0, 0.12));
    }
    .rozie-data-table .rdt-resize-handle:hover .rdt-resize-grip,
    .rozie-data-table .rdt-th-resizing .rdt-resize-grip {
      background: var(--rdt-resize-grip-active, rgba(0, 0, 0, 0.4));
    }
    .rozie-data-table .rdt-pin-controls {
      display: inline-flex;
      gap: var(--rdt-pin-gap, 0.1em);
      margin-left: var(--rdt-pin-margin, 0.35em);
    }
    .rozie-data-table .rdt-pin-btn {
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
    .rozie-data-table .rdt-pin-btn[aria-pressed='true'] {
      background: var(--rdt-pin-btn-active-bg, rgba(0, 0, 0, 0.1));
      font-weight: 700;
    }
    .rozie-data-table-wrap .rdt-colvis {
      position: relative;
    }
    .rozie-data-table-wrap .rdt-colvis-summary {
      cursor: pointer;
      font: inherit;
      padding: var(--rdt-colvis-summary-padding, 0.25rem 0.6rem);
      border: var(--rdt-colvis-summary-border, 1px solid rgba(0, 0, 0, 0.2));
      border-radius: var(--rdt-colvis-summary-radius, 4px);
      list-style: none;
      user-select: none;
    }
    .rozie-data-table-wrap .rdt-colvis-menu {
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
    .rozie-data-table-wrap .rdt-colvis-item {
      display: flex;
      align-items: center;
      gap: var(--rdt-colvis-label-gap, 0.4em);
      cursor: pointer;
      white-space: nowrap;
    }
    .rozie-data-table .rdt-select-th,
    .rozie-data-table .rdt-select-td {
      width: var(--rdt-select-col-width, 1%);
      text-align: var(--rdt-select-col-align, center);
      white-space: nowrap;
    }
    .rozie-data-table .rdt-select-all,
    .rozie-data-table .rdt-select-row {
      cursor: pointer;
      accent-color: var(--rdt-select-accent, currentColor);
    }
  `],
  providers: [
    {
      provide: rozieToken('data-table:columns'),
      useFactory: () => { const __rozieCtxHost = inject(forwardRef(() => DataTable)); return ({
  registerColumn: (id: any, spec: any) => {
    if (id == null) return;
    const key = String(id);
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') return;
    __rozieCtxHost.colReg.set({
      ...__rozieCtxHost.colReg(),
      [key]: spec
    });
  },
  unregisterColumn: (id: any) => {
    if (id == null) return;
    const r = {
      ...__rozieCtxHost.colReg()
    };
    delete r[String(id)];
    __rozieCtxHost.colReg.set(r);
  }
}); },
    },
  ],
})
export class DataTable {
  data = input.required<any[]>();
  columns = input<any[]>((() => [])());
  selectionMode = input<string>('none');
  sorting = model<any[]>((() => [])());
  globalFilter = model<string>('');
  columnFilters = model<any[]>((() => [])());
  pagination = model<Record<string, any>>((() => ({
    pageIndex: 0,
    pageSize: 10
  }))());
  manual = input<boolean>(false);
  rowSelection = model<Record<string, any>>((() => ({}))());
  columnVisibility = model<Record<string, any>>((() => ({}))());
  columnSizing = model<Record<string, any>>((() => ({}))());
  columnOrder = model<any[]>((() => [])());
  columnPinning = model<Record<string, any>>((() => ({
    left: [],
    right: []
  }))());
  stickyHeader = input<boolean>(false);
  interactionMode = input<string>('table');
  sortingDefault = signal<any[]>([]);
  globalFilterDefault = signal('');
  columnFiltersDefault = signal<any[]>([]);
  paginationDefault = signal({
    pageIndex: 0,
    pageSize: 10
  });
  rowSelectionDefault = signal({});
  columnVisibilityDefault = signal({});
  columnSizingDefault = signal({});
  columnOrderDefault = signal<any[]>([]);
  columnPinningDefault = signal({
    left: [],
    right: []
  });
  columnSizingInfo = signal({
    startOffset: null,
    startSize: null,
    deltaOffset: null,
    deltaPercentage: null,
    isResizingColumn: false,
    columnSizingStart: []
  });
  colReg = signal({});
  rows = signal<any[]>([]);
  headerGroups = signal<any[]>([]);
  rowModelVer = signal(0);
  activeRow = signal(0);
  activeColIndex = signal(0);
  activeIsHeader = signal(false);
  activeInControl = signal(false);
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  sortChange = output<unknown>({ alias: 'sort-change' });
  filterChange = output<unknown>({ alias: 'filter-change' });
  pageChange = output<unknown>({ alias: 'page-change' });
  selectionChange = output<unknown>({ alias: 'selection-change' });
  visibilityChange = output<unknown>({ alias: 'visibility-change' });
  resizeChange = output<unknown>({ alias: 'resize-change' });
  reorderChange = output<unknown>({ alias: 'reorder-change' });
  pinChange = output<unknown>({ alias: 'pin-change' });
  activecellChange = output<unknown>({ alias: 'activecell-change' });
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('selectAll', { read: TemplateRef }) selectAllTpl?: TemplateRef<SelectAllCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('selectCell', { read: TemplateRef }) selectCellTpl?: TemplateRef<SelectCellCtx>;
  @ContentChild('cell', { read: TemplateRef }) cellTpl?: TemplateRef<CellCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    effect(() => () => {
      if (!this.table) return;
      const d = this.data() || [];
      if (d === this.lastData && d.length === this.lastDataLen) return;
      this.lastData = d;
      this.lastDataLen = d.length;
      this.reFeed();
    });
    effect(() => { const __watchVal = (() => [this.sorting(), this.globalFilter(), this.columnFilters(), this.pagination(), this.rowSelection(), this.columnVisibility(), this.columnSizing(), this.columnOrder(), this.columnPinning(), this.selectionMode(), (this.data() || []).length, this.colReg()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.reFeed();
    })(); }); });
  }

  ngAfterViewInit() {
    const __manual = this.manual();
    const __selectionMode = this.selectionMode();
    // Build the table instance HERE so the closures below capture the live `table`.
    this.table = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      data: this.data(),
      columns: this.tableColumns(),
      state: this.currentState(),
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getFilteredRowModel: getFilteredRowModel(),
      getPaginationRowModel: getPaginationRowModel(),
      // Server-side hook (req-6): when `manual` is set, table-core trusts the consumer's
      // rows verbatim (no client-side filter/sort/paginate) and only emits the change
      // events so the consumer can fetch the next page/filtered slice.
      manualPagination: __manual === true,
      manualFiltering: __manual === true,
      manualSorting: __manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: __selectionMode !== 'none',
      enableMultiRowSelection: __selectionMode === 'multiple',
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
      this.rows.set(nextRows);
      this.headerGroups.set(nextGroups);
      this.rowModelVer.set(this.rowModelVer() + 1);
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

    // ── Grid mode: capture the table root + focus the D-04 entry cell ──────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean. The entry-cell focus is gated by
    // isGrid() so 'table' mode is entirely untouched.
    // ── Grid mode: capture the table root + focus the D-04 entry cell ──────────────────
    // $el is the component root; the <table class="rozie-data-table"> is the grid root the
    // cell selectors hang off (the exact idiom proven ×6 by plan 01's probe). Captured here
    // (post-mount) so it is non-null and ROZ123-clean. The entry-cell focus is gated by
    // isGrid() so 'table' mode is entirely untouched.
    this.gridRoot = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-data-table') : null;
    if (this.isGrid()) {
      // D-04: first body data cell (row 0, first navigable column). Re-resolved fresh —
      // no DOM node is ever stored in $data. Deferred a microtask so the body cells have
      // mounted before the query (React/Solid commit their first render asynchronously).
      const focusEntry = () => this.focusActiveCell(this.activeRow(), this.activeColIndex());
      if (typeof queueMicrotask !== 'undefined') queueMicrotask(focusEntry);else Promise.resolve().then(focusEntry);
    }
  }

  table: any = null;
  GRID_PAGE_STEP = 10;
  gridRoot: any = null;
  programmatic = 0;
  currentState = (): any => ({
    sorting: this.sorting() != null ? this.sorting() : this.sortingDefault(),
    globalFilter: this.globalFilter() != null ? this.globalFilter() : this.globalFilterDefault(),
    columnFilters: this.columnFilters() != null ? this.columnFilters() : this.columnFiltersDefault(),
    pagination: this.pagination() != null ? this.pagination() : this.paginationDefault(),
    rowSelection: this.rowSelection() != null ? this.rowSelection() : this.rowSelectionDefault(),
    columnVisibility: this.columnVisibility() != null ? this.columnVisibility() : this.columnVisibilityDefault(),
    columnSizing: this.columnSizing() != null ? this.columnSizing() : this.columnSizingDefault(),
    columnOrder: this.columnOrder() != null ? this.columnOrder() : this.columnOrderDefault(),
    columnPinning: this.columnPinning() != null ? this.columnPinning() : this.columnPinningDefault(),
    // columnSizingInfo: table-core's transient resize-gesture state. We pass an
    // EXPLICIT `state` object, so table-core does NOT fill its own defaults — and
    // `column.getIsResizing()` / `getResizeHandler()` read
    // `getState().columnSizingInfo.isResizingColumn`, which THROWS if the key is
    // absent. Seed the default shape (matches table-core's
    // getDefaultColumnSizingInfoState) so the resize-chrome predicates are safe on
    // every render. Not a two-way model slice (transient gesture state, not consumer
    // state) — held in $data.columnSizingInfo and reset by table-core mid-drag.
    columnSizingInfo: this.columnSizingInfo()
  });
  isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
  columnDefs = () => {
    const byId = Object.create(null);
    const order = [];
    const cfg = this.columns() || [];
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
    const reg = this.colReg() || {};
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
  selectionEnabled = () => this.selectionMode() === 'single' || this.selectionMode() === 'multiple';
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
    this.sortingDefault.set(next); // fresh array only (never in-place)
    this.sorting.set(next); // two-way emit if bound (no-op-diff if not)
    this.sortChange.emit(next);
    this.programmatic--;
  };
  applyUpdater = (updater: any, current: any) => typeof updater === 'function' ? updater(current) : updater;
  writeGlobalFilter = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.globalFilterDefault.set(next);
    this.globalFilter.set(next);
    this.filterChange.emit({
      globalFilter: next
    });
    this.programmatic--;
  };
  writeColumnFilters = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.columnFiltersDefault.set(next);
    this.columnFilters.set(next);
    this.filterChange.emit({
      columnFilters: next
    });
    this.programmatic--;
  };
  writePagination = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.paginationDefault.set(next);
    this.pagination.set(next);
    this.pageChange.emit(next);
    this.programmatic--;
  };
  writeRowSelection = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.rowSelectionDefault.set(next);
    this.rowSelection.set(next);
    this.selectionChange.emit(next);
    this.programmatic--;
  };
  writeColumnVisibility = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.columnVisibilityDefault.set(next);
    this.columnVisibility.set(next);
    this.visibilityChange.emit(next);
    this.programmatic--;
  };
  writeColumnSizing = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.columnSizingDefault.set(next);
    this.columnSizing.set(next);
    this.resizeChange.emit(next);
    this.programmatic--;
  };
  writeColumnOrder = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.columnOrderDefault.set(next);
    this.columnOrder.set(next);
    this.reorderChange.emit(next);
    this.programmatic--;
  };
  writeColumnPinning = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.columnPinningDefault.set(next);
    this.columnPinning.set(next);
    this.pinChange.emit(next);
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
    const next = this.applyUpdater(updater, this.columnSizingInfo());
    this.columnSizingInfo.set(next != null ? next : this.columnSizingInfo());
  };
  reFeed = () => {
    if (!this.table) return;
    this.table.setOptions((prev: any) => ({
      ...prev,
      data: this.data(),
      columns: this.tableColumns(),
      state: this.currentState(),
      enableRowSelection: this.selectionMode() !== 'none',
      enableMultiRowSelection: this.selectionMode() === 'multiple',
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
  tick = () => this.rowModelVer();
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
  visibleCellsFor = (row: any) => this.rowModelVer() >= 0 ? row.getVisibleCells() : [];
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
    const groups = this.headerGroups() || [];
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
    if (!this.__rozieRoot()?.nativeElement || !this.__rozieRoot()!.nativeElement.querySelector) return;
    this.selectAllBox = this.__rozieRoot()!.nativeElement.querySelector('.rdt-select-all');
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
  isGrid = () => this.interactionMode() === 'grid';
  tableRole = () => this.isGrid() ? 'grid' : 'table';
  cellRole = () => this.isGrid() ? 'gridcell' : 'cell';
  rowIndexOf = (row: any) => this.tick() >= 0 ? (this.rows() || []).indexOf(row) : -1;
  colIndexOf = (row: any, cellCtx: any) => this.tick() >= 0 ? this.visibleCellsFor(row).indexOf(cellCtx) : -1;
  headerColIndexOf = (hg: any, header: any) => (hg && hg.headers ? hg.headers : []).indexOf(header);
  cellTabindex = (rowKey: any, colIndex: any) => {
    if (!this.isGrid()) return null;
    const activeKey = this.activeIsHeader() ? '__header' : String(this.activeRow());
    const isActive = rowKey === activeKey && colIndex === this.activeColIndex();
    return isActive ? 0 : -1;
  };
  resolveCellEl = (rowKey: any, colIndex: any) => {
    if (!this.gridRoot) return null;
    return this.gridRoot.querySelector('[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]');
  };
  focusActiveCell = (nextRow: any, nextCol: any) => {
    if (!this.isGrid() || !this.gridRoot) return;
    // ── phase 53 hooks HERE: scrollRowIntoWindow(nextRow ?? $data.activeRow) before resolve ──
    const r = nextRow == null ? this.activeRow() : nextRow;
    const c = nextCol == null ? this.activeColIndex() : nextCol;
    const rowKey = this.activeIsHeader() ? '__header' : String(r);
    const el = this.resolveCellEl(rowKey, c);
    if (el) el.focus();
  };
  visibleColCount = () => {
    // NB: local is `rowList` (NOT `rows`) — the React emitter lowers `$data.rows` to the bare
    // state binding `rows`, so a `const rows = $data.rows` self-shadows it (TS2448 TDZ). Same
    // self-shadow class as the deconflictPropShadows finding; avoid the $data-key name as a local.
    const rowList = this.rows() || [];
    if (rowList.length) return rowList[0].getVisibleCells().length;
    const hg = this.headerGroups() || [];
    return hg.length ? (hg[hg.length - 1].headers || []).length : 0;
  };
  bodyRowCount = () => (this.rows() || []).length;
  clamp = (v: any, lo: any, hi: any) => v < lo ? lo : v > hi ? hi : v;
  moveCol = (delta: any) => {
    const max = this.visibleColCount() - 1;
    const nextCol = this.clamp(this.activeColIndex() + delta, 0, max < 0 ? 0 : max);
    this.activeColIndex.set(nextCol);
    return nextCol;
  };
  moveRow = (delta: any) => {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    if (this.activeIsHeader()) {
      // In the header: any downward move lands on body row 0; upward stays in the header.
      if (delta > 0) {
        this.activeIsHeader.set(false);
        this.activeRow.set(0);
        return {
          row: 0,
          isHeader: false
        };
      }
      return {
        row: this.activeRow(),
        isHeader: true
      };
    }
    // In the body: an upward move from row 0 crosses into the header.
    if (delta < 0 && this.activeRow() === 0) {
      this.activeIsHeader.set(true);
      return {
        row: this.activeRow(),
        isHeader: true
      };
    }
    const nextRow = this.clamp(this.activeRow() + delta, 0, maxRow);
    this.activeRow.set(nextRow);
    this.activeIsHeader.set(false);
    return {
      row: nextRow,
      isHeader: false
    };
  };
  gotoColEdge = (toEnd: any) => {
    const max = this.visibleColCount() - 1;
    const nextCol = toEnd ? max < 0 ? 0 : max : 0;
    this.activeColIndex.set(nextCol);
    return nextCol;
  };
  gotoStart = () => {
    this.activeIsHeader.set(false);
    this.activeRow.set(0);
    this.activeColIndex.set(0);
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
    this.activeIsHeader.set(false);
    this.activeRow.set(maxRow);
    this.activeColIndex.set(maxCol);
    return {
      row: maxRow,
      col: maxCol
    };
  };
  currentCellEl = () => {
    const rowKey = this.activeIsHeader() ? '__header' : String(this.activeRow());
    return this.resolveCellEl(rowKey, this.activeColIndex());
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
    this.activeInControl.set(true);
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
    const __activeRow = this.activeRow();
    const __activeColIndex = this.activeColIndex();
    if (!this.isGrid() || !e) return;
    const key = e.key;
    // Interaction mode (D-08): Tab cycles within the cell, Escape exits. Focus containment.
    if (this.activeInControl()) {
      if (key === 'Escape') {
        e.preventDefault();
        this.activeInControl.set(false);
        // Return focus to the OWNING cell (no move happened) — pass the current indices
        // explicitly (the React-emitted seam types both params as required; a zero-arg call
        // is TS2554). Reading $data here is safe: no write to activeRow/activeColIndex precedes it.
        this.focusActiveCell(__activeRow, __activeColIndex);
      } else if (key === 'Tab') {
        e.preventDefault();
        this.cycleWithinCell(this.currentCellEl(), !e.shiftKey);
      }
      return;
    }
    // Navigation mode — compute fresh locals, write $data inside the helper, thread them out.
    let nextRow = __activeRow;
    let nextCol = __activeColIndex;
    if (key === 'ArrowRight') {
      e.preventDefault();
      nextCol = this.moveCol(1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      nextCol = this.moveCol(-1);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      nextRow = this.moveRow(1).row;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      nextRow = this.moveRow(-1).row;
    } else if (key === 'PageDown') {
      e.preventDefault();
      nextRow = this.moveRow(this.GRID_PAGE_STEP).row;
    } else if (key === 'PageUp') {
      e.preventDefault();
      nextRow = this.moveRow(-this.GRID_PAGE_STEP).row;
    } else if (key === 'Home') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const s = this.gotoStart();
        nextRow = s.row;
        nextCol = s.col;
      } else {
        nextCol = this.gotoColEdge(false);
      }
    } else if (key === 'End') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const en = this.gotoEnd();
        nextRow = en.row;
        nextCol = en.col;
      } else {
        nextCol = this.gotoColEdge(true);
      }
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      this.enterControl();
      return;
    } else return;
    // THE seam + the D-02 event — BOTH built from the SAME fresh post-write locals (Pitfall 2).
    this.focusActiveCell(nextRow, nextCol);
    this.activecellChange.emit({
      rowIndex: nextRow,
      colIndex: nextCol
    });
  };
  clampActiveCell = () => {
    if (!this.isGrid()) return;
    const maxCol = this.visibleColCount() - 1;
    const col = this.clamp(this.activeColIndex(), 0, maxCol < 0 ? 0 : maxCol);
    if (col !== this.activeColIndex()) this.activeColIndex.set(col);
    if (!this.activeIsHeader()) {
      const lastRow = this.bodyRowCount() - 1;
      const maxRow = lastRow < 0 ? 0 : lastRow;
      const row = this.clamp(this.activeRow(), 0, maxRow);
      if (row !== this.activeRow()) this.activeRow.set(row);
    }
  };
  focusCell = (rowIndex: any, colIndex: any) => {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const maxCol = this.visibleColCount() - 1;
    const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const c = this.clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    this.activeIsHeader.set(false);
    this.activeInControl.set(false);
    this.activeRow.set(r);
    this.activeColIndex.set(c);
    this.focusActiveCell(r, c);
    this.activecellChange.emit({
      rowIndex: r,
      colIndex: c
    });
  };
  getActiveCell = () => ({
    rowIndex: this.activeRow(),
    colIndex: this.activeColIndex()
  });
  clearActiveCell = () => {
    this.activeIsHeader.set(false);
    this.activeInControl.set(false);
    this.activeRow.set(0);
    this.activeColIndex.set(0);
  };

  static ngTemplateContextGuard(
    _dir: DataTable,
    _ctx: unknown,
  ): _ctx is DefaultCtx | SelectAllCtx | ColHeaderCtx | ColHeaderCtx | SelectCellCtx | CellCtx {
    return true;
  }

  private _selectCell_ctx = (row: any, cellCtx: any) => ({ $implicit: { row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) }, row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) });

  protected readonly String = String;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default DataTable;
