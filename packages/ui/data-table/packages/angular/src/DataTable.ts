import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';

// table-core instance — top-level `let` referenced from hooks → React hoists to
// useRef (hoistModuleLet). NULL until $onMount: createTable lives in $onMount so its
// getRowModel-reading closures capture the LIVE instance, NOT an empty initial
// snapshot (the rete stale-closure anti-pattern — a top-level $computed/useCallback
// freezes the table at the empty-initial state on React).

interface SelectAllCtx {
  $implicit: { checked: any; indeterminate: any; toggle: any };
  checked: any;
  indeterminate: any;
  toggle: any;
}

interface SelectCellCtx {
  $implicit: { row: any; checked: any; toggle: any };
  row: any;
  checked: any;
  toggle: any;
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

    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" role="table">
      <thead class="rdt-thead" role="rowgroup">
        @for (hg of headerGroups(); track hg.id) {
    <tr class="rdt-tr" role="row">
          @for (header of hg.headers; track header.id) {
    <th class="rdt-th" [ngClass]="{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }" role="columnheader" [attr.data-col]="rozieAttr(header.column.id)" [attr.aria-sort]="rozieAttr(ariaSortFor(header.column.id))" [style]="thStyle(header.column.id)">
            
            @if (isSelectColumn(header.column.id)) {
    <template>
              @if ((selectAllTpl ?? templates()?.['selectAll'])) {
    <ng-container *ngTemplateOutlet="(selectAllTpl ?? templates()?.['selectAll']); context: { $implicit: { checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }, checked: isAllRowsSelected(), indeterminate: isSomeRowsSelected(), toggle: onToggleAllRows }" />
    } @else {

                <input class="rdt-select-all" type="checkbox" aria-label="Select all rows" [checked]="isAllRowsSelected()" [attr.indeterminate]="rozieAttr(isSomeRowsSelected())" (change)="onToggleAllRows($event)" />
              
    }
            </template>
    } @else {
    <template>
              
              @if (header.column.getCanSort && header.column.getCanSort()) {
    <button type="button" class="rdt-sort-btn" (click)="onHeaderSort(header.column.id, $event)">
                
                @if (columnHasHeaderTemplate(header.column.id)) {
    <span class="rdt-header-host" [attr.data-header-host]="rozieAttr('h:' + header.column.id)" [attr.data-col]="rozieAttr(header.column.id)"></span>
    } @else {
    <span class="rdt-header-label">{{ rozieDisplay(headerLabel(header.column.id)) }}</span>
    }<span class="rdt-sort-ind" aria-hidden="true">{{ rozieDisplay(sortIndicator(header.column.id)) }}</span>
              </button>
    } @else {
    <template>
                @if (columnHasHeaderTemplate(header.column.id)) {
    <span class="rdt-header-host" [attr.data-header-host]="rozieAttr('h:' + header.column.id)" [attr.data-col]="rozieAttr(header.column.id)"></span>
    } @else {
    <span class="rdt-header-label">{{ rozieDisplay(headerLabel(header.column.id)) }}</span>
    }</template>
    }@if (columnIsFilterable(header.column.id)) {
    <input class="rdt-col-filter" type="text" [attr.aria-label]="rozieAttr('Filter ' + headerLabel(header.column.id))" [value]="columnFilterValue(header.column.id)" (input)="onColumnFilterInput(header.column.id, $event)" (click)="_guardedUndefined($event)" />
    }<span class="rdt-pin-controls" role="group" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id))">
                <button type="button" class="rdt-pin-btn rdt-pin-left" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id) + ' to left')" [attr.aria-pressed]="columnPinSide(header.column.id) === 'left'" (click)="_guardedHandler1_1($event)">⇤</button>
                <button type="button" class="rdt-pin-btn rdt-pin-none" [attr.aria-label]="rozieAttr('Unpin ' + headerLabel(header.column.id))" [attr.aria-pressed]="!columnPinSide(header.column.id)" (click)="_guardedHandler2_2($event)">⇔</button>
                <button type="button" class="rdt-pin-btn rdt-pin-right" [attr.aria-label]="rozieAttr('Pin ' + headerLabel(header.column.id) + ' to right')" [attr.aria-pressed]="columnPinSide(header.column.id) === 'right'" (click)="_guardedHandler3_3($event)">⇥</button>
              </span>
              
              <button type="button" class="rdt-resize-handle" [attr.aria-label]="rozieAttr('Resize ' + headerLabel(header.column.id))" (pointerdown)="_guardedHandler4_4($event)" (touchstart)="_guardedHandler5_5($event)"><span class="rdt-resize-grip" aria-hidden="true"></span></button>
            </template>
    }</th>
    }
        </tr>
    }
      </thead>

      <tbody class="rdt-tbody" role="rowgroup">
        @for (row of rows(); track row.id) {
    <tr class="rdt-tr" role="row">
          @for (cellCtx of row.getVisibleCells(); track cellCtx.id) {
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }" role="cell" [attr.data-col]="rozieAttr(cellCtx.column.id)" [style]="pinStyle(cellCtx.column.id)">
            
            @if (isSelectColumn(cellCtx.column.id)) {
    <template>
              @if ((selectCellTpl ?? templates()?.['selectCell'])) {
    <ng-container *ngTemplateOutlet="(selectCellTpl ?? templates()?.['selectCell']); context: _selectCell_ctx_6(row, cellCtx)" />
    } @else {

                <input class="rdt-select-row" type="checkbox" aria-label="Select row" [checked]="rowIsSelected(row)" (change)="onToggleRow(row, $event)" />
              
    }
            </template>
    } @else {
    <template>
              
              @if (columnHasCellTemplate(cellCtx.column.id)) {
    <span class="rdt-cell-host" [attr.data-cell-host]="rozieAttr('c:' + row.id + ':' + cellCtx.column.id)" [attr.data-col]="rozieAttr(cellCtx.column.id)" [attr.data-row]="rozieAttr(row.id)"></span>
    } @else {
    <span class="rdt-cell-value">{{ rozieDisplay(cellCtx.getValue()) }}</span>
    }</template>
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
  colReg = signal({});
  rows = signal<any[]>([]);
  headerGroups = signal<any[]>([]);
  rowModelVer = signal(0);
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  sortChange = output<unknown>({ alias: 'sort-change' });
  filterChange = output<unknown>({ alias: 'filter-change' });
  pageChange = output<unknown>({ alias: 'page-change' });
  selectionChange = output<unknown>({ alias: 'selection-change' });
  visibilityChange = output<unknown>({ alias: 'visibility-change' });
  resizeChange = output<unknown>({ alias: 'resize-change' });
  reorderChange = output<unknown>({ alias: 'reorder-change' });
  pinChange = output<unknown>({ alias: 'pin-change' });
  @ContentChild('selectAll', { read: TemplateRef }) selectAllTpl?: TemplateRef<SelectAllCtx>;
  @ContentChild('selectCell', { read: TemplateRef }) selectCellTpl?: TemplateRef<SelectCellCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_0 = true;
  private __rozieWatchInitial_1 = true;

  constructor() {
    this.cellMounts = new Map();
    effect(() => { const __watchVal = (() => [this.sorting(), this.globalFilter(), this.columnFilters(), this.pagination(), this.rowSelection(), this.columnVisibility(), this.columnSizing(), this.columnOrder(), this.columnPinning(), this.selectionMode(), (this.data() || []).length, this.colReg()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      if (!this.table) return;
      this.table.setOptions((prev: any) => ({
        ...prev,
        data: this.data(),
        columns: this.tableColumns(),
        state: this.currentState(),
        enableRowSelection: this.selectionMode() !== 'none',
        enableMultiRowSelection: this.selectionMode() === 'multiple'
      }));
      if (this.refreshRowModel) this.refreshRowModel();
    })(); }); });
    effect(() => { const __watchVal = (() => this.rowModelVer())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      this.reconcileProjections();
    })(); }); });
  }

  ngAfterViewInit() {
    const __manual = this.manual();
    const __selectionMode = this.selectionMode();
    // Build the table instance HERE so the closures below capture the live `table`.
    this.table = createTable({
      get data() {
        return this.data();
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
      manualPagination: __manual === true,
      manualFiltering: __manual === true,
      manualSorting: __manual === true,
      // Row selection (req-7): enabled unless 'none'; 'single' caps at ≤1
      // (enableMultiRowSelection:false). Select-all scope = filtered rows (TanStack
      // default, D-06 — NOT overridden).
      enableRowSelection: __selectionMode !== 'none',
      enableMultiRowSelection: __selectionMode === 'multiple',
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
      this.rows.set(nextRows);
      this.headerGroups.set(nextGroups);
      this.rowModelVer.set(this.rowModelVer() + 1);
    };

    // initial pull
    // initial pull
    this.refreshRowModel();
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts (deferred a tick so the r-for DOM exists).
    // project the per-column #cell / #header templates into the freshly-rendered
    // framework-owned hosts (deferred a tick so the r-for DOM exists).
    this.reconcileProjections();
    this.__rozieDestroyRef.onDestroy(() => {
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
    });
  }

  table: any = null;
  programmatic = 0;
  currentState = () => ({
    sorting: this.sorting() != null ? this.sorting() : this.sortingDefault(),
    globalFilter: this.globalFilter() != null ? this.globalFilter() : this.globalFilterDefault(),
    columnFilters: this.columnFilters() != null ? this.columnFilters() : this.columnFiltersDefault(),
    pagination: this.pagination() != null ? this.pagination() : this.paginationDefault(),
    rowSelection: this.rowSelection() != null ? this.rowSelection() : this.rowSelectionDefault(),
    columnVisibility: this.columnVisibility() != null ? this.columnVisibility() : this.columnVisibilityDefault(),
    columnSizing: this.columnSizing() != null ? this.columnSizing() : this.columnSizingDefault(),
    columnOrder: this.columnOrder() != null ? this.columnOrder() : this.columnOrderDefault(),
    columnPinning: this.columnPinning() != null ? this.columnPinning() : this.columnPinningDefault()
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
        // config-array columns carry no template → plain-value fast path.
        hasCell: false,
        cellRenderer: null,
        hasHeader: false,
        headerRenderer: null,
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
  tableColumns = () => {
    const cols = this.columnDefs();
    if (this.selectionMode() === 'multiple') {
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
  cellMounts: any = null;
  reconcileProjections = () => {
    if (!this.__rozieRoot()?.nativeElement || !this.cellMounts) return;
    const seen = new Set();
    const defs = this.columnDefs();
    const defById = Object.create(null);
    for (const d of defs as any) defById[d.id] = d;
    // cells
    const cellHosts = this.__rozieRoot()!.nativeElement.querySelectorAll('[data-cell-host]');
    for (const host of cellHosts as any) {
      const key = host.getAttribute('data-cell-host');
      seen.add(key);
      if (this.cellMounts.has(key)) continue;
      const colId = host.getAttribute('data-col');
      const rowId = host.getAttribute('data-row');
      const def = defById[colId];
      if (!def || !def.hasCell || !def.cellRenderer) continue;
      const row = (this.rows() || []).find((r: any) => String(r.id) === String(rowId));
      if (!row) continue;
      const handle = def.cellRenderer(host, {
        row: row.original,
        value: row.getValue(def.accessorKey),
        column: def
      });
      if (handle) this.cellMounts.set(key, handle);
    }
    // headers
    const headerHosts = this.__rozieRoot()!.nativeElement.querySelectorAll('[data-header-host]');
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
    const groups = this.headerGroups() || [];
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

  static ngTemplateContextGuard(
    _dir: DataTable,
    _ctx: unknown,
  ): _ctx is SelectAllCtx | SelectCellCtx {
    return true;
  }

  private _guardedUndefined = ($event: any) => {
    $event.stopPropagation();
    this.undefined($event);
  };

  private _guardedHandler1_1 = ($event: any) => {
    $event.stopPropagation();
    onPinColumn(header.column.id, 'left');
  };

  private _guardedHandler2_2 = ($event: any) => {
    $event.stopPropagation();
    onPinColumn(header.column.id, false);
  };

  private _guardedHandler3_3 = ($event: any) => {
    $event.stopPropagation();
    onPinColumn(header.column.id, 'right');
  };

  private _guardedHandler4_4 = ($event: any) => {
    $event.stopPropagation();
    onResizeStart(header.column.id, $event);
  };

  private _guardedHandler5_5 = ($event: any) => {
    $event.stopPropagation();
    onResizeStart(header.column.id, $event);
  };

  private _selectCell_ctx_6 = (row: any, cellCtx: any) => ({ $implicit: { row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) }, row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) });

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default DataTable;
