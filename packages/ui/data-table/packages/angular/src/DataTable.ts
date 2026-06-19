import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/table-core';
// Vertical row windowing (phase 53). A3: this static import line is emitted UNCONDITIONALLY
// (virtual-core is a peer dep the consumer installs); byte-identical-off (req-1) is satisfied
// by ALL virtual-core RUNTIME references sitting behind `if ($props.virtual)` / a `virtualizer`
// guard so they never execute when off — the import token is the only static virtual-core
// presence. NO per-framework adapter (the codegen guard forbids @tanstack/<fw>-virtual).
// Vertical row windowing (phase 53). A3: this static import line is emitted UNCONDITIONALLY
// (virtual-core is a peer dep the consumer installs); byte-identical-off (req-1) is satisfied
// by ALL virtual-core RUNTIME references sitting behind `if ($props.virtual)` / a `virtualizer`
// guard so they never execute when off — the import token is the only static virtual-core
// presence. NO per-framework adapter (the codegen guard forbids @tanstack/<fw>-virtual).
import { Virtualizer, elementScroll, observeElementRect, observeElementOffset, measureElement } from '@tanstack/virtual-core';

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

interface EditorCtx {
  $implicit: { columnId: any; column: any; row: any; value: any; commit: any; cancel: any };
  columnId: any;
  column: any;
  row: any;
  value: any;
  commit: any;
  cancel: any;
}

interface CellCtx {
  $implicit: { columnId: any; column: any; row: any; value: any };
  columnId: any;
  column: any;
  row: any;
  value: any;
}

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

interface EditorCtx {
  $implicit: { columnId: any; column: any; row: any; value: any; commit: any; cancel: any };
  columnId: any;
  column: any;
  row: any;
  value: any;
  commit: any;
  cancel: any;
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

    @if (!!invalidMsg()) {
    <div class="rdt-sr-live" role="status" aria-live="polite" aria-atomic="true">{{ invalidMsg() }}</div>
    }<div class="rdt-toolbar">
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


    @if (virtual()) {
    <div class="rdt-scroll" [style]="__style">
    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" [attr.role]="rozieAttr(tableRole())" [attr.aria-rowcount]="rows().length" (keydown)="onGridKeyDown($event)" (focusin)="syncActiveFromEvent($event)" (focusout)="onGridFocusOut($event)">
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
        
        <tr class="rdt-spacer" aria-hidden="true">
          <td [attr.colspan]="rozieAttr(visibleColCount())" [style]="'height:' + padTop() + 'px;padding:0;border:0'"></td>
        </tr>
        
        @for (wr of windowedRows(); track wr.row.id) {
    <tr class="rdt-tr" role="row" [attr.data-row]="rozieAttr(wr.vi.index)" [attr.aria-rowindex]="rozieAttr(wr.vi.index + 1)" [attr.data-index]="rozieAttr(wr.vi.index)">
          @for (cellCtx of visibleCellsFor(wr.row); track cellCtx.id) {
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }" [attr.role]="rozieAttr(cellRole())" [attr.data-col]="rozieAttr(cellCtx.column.id)" data-grid-cell="" [attr.data-row]="rozieAttr(wr.vi.index)" [attr.data-col-index]="rozieAttr(colIndexOf(wr.row, cellCtx))" [attr.tabindex]="rozieAttr(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx)))" [style]="pinStyle(cellCtx.column.id)" [attr.aria-invalid]="rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cellCtx)))">
            @if (isSelectColumn(cellCtx.column.id)) {
    <span style="display:contents">
              @if ((selectCellTpl ?? templates()?.['selectCell'])) {
    <ng-container *ngTemplateOutlet="(selectCellTpl ?? templates()?.['selectCell']); context: _selectCell_ctx(wr, cellCtx)" />
    } @else {

                <input class="rdt-select-row" type="checkbox" aria-label="Select row" [checked]="rowIsSelected(wr.row)" (change)="onToggleRow(wr.row, $event)" />
              
    }
            </span>
    } @else if (isEditing(wr.vi.index, colIndexOf(wr.row, cellCtx))) {
    <span style="display:contents">
              @if (hasEditorSlot(cellCtx.column.id)) {
    <span style="display:contents">
                <ng-container *ngTemplateOutlet="(editorTpl ?? templates()?.['editor']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: draftValue(), commit: commitEdit, cancel: cancelEdit }, columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: draftValue(), commit: commitEdit, cancel: cancelEdit }" />
              </span>
    } @else if (editorTypeOf(cellCtx.column.id) === 'number') {
    <input class="rdt-cell-editor" type="number" data-editing-cell="" [value]="draftValue()" (input)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else if (editorTypeOf(cellCtx.column.id) === 'select') {
    <select class="rdt-cell-editor" data-editing-cell="" [value]="draftValue()" (change)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)">
                @for (opt of editorOptionsOf(cellCtx.column.id); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
              </select>
    } @else if (editorTypeOf(cellCtx.column.id) === 'checkbox') {
    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [checked]="!!draftValue()" (change)="onEditorCheckboxChange($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else {
    <input class="rdt-cell-editor" type="text" data-editing-cell="" [value]="draftValue()" (input)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    }</span>
    } @else {
    <span class="rdt-cell-value">
              @if ((cellTpl ?? templates()?.['cell'])) {
    <ng-container *ngTemplateOutlet="(cellTpl ?? templates()?.['cell']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }, columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }" />
    } @else {
    {{ rozieDisplay(cellCtx.getValue()) }}
    }
            </span>
    }</td>
    }
        </tr>
    }
        
        <tr class="rdt-spacer" aria-hidden="true">
          <td [attr.colspan]="rozieAttr(visibleColCount())" [style]="'height:' + padBottom() + 'px;padding:0;border:0'"></td>
        </tr>
      </tbody>
    </table>
    </div>
    } @else {
    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" [attr.role]="rozieAttr(tableRole())" (keydown)="onGridKeyDown($event)" (focusin)="syncActiveFromEvent($event)" (focusout)="onGridFocusOut($event)">
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
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id) }" [attr.role]="rozieAttr(cellRole())" [attr.data-col]="rozieAttr(cellCtx.column.id)" data-grid-cell="" [attr.data-row]="rozieAttr(rowIndexOf(row))" [attr.data-col-index]="rozieAttr(colIndexOf(row, cellCtx))" [attr.tabindex]="rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))" [style]="pinStyle(cellCtx.column.id)" [attr.aria-invalid]="rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cellCtx)))">
            
            @if (isSelectColumn(cellCtx.column.id)) {
    <span style="display:contents">
              @if ((selectCellTpl ?? templates()?.['selectCell'])) {
    <ng-container *ngTemplateOutlet="(selectCellTpl ?? templates()?.['selectCell']); context: _selectCell_ctx_1(row, cellCtx)" />
    } @else {

                <input class="rdt-select-row" type="checkbox" aria-label="Select row" [checked]="rowIsSelected(row)" (change)="onToggleRow(row, $event)" />
              
    }
            </span>
    } @else if (isEditing(rowIndexOf(row), colIndexOf(row, cellCtx))) {
    <span style="display:contents">
              @if (hasEditorSlot(cellCtx.column.id)) {
    <span style="display:contents">
                <ng-container *ngTemplateOutlet="(editorTpl ?? templates()?.['editor']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: draftValue(), commit: commitEdit, cancel: cancelEdit }, columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: draftValue(), commit: commitEdit, cancel: cancelEdit }" />
              </span>
    } @else if (editorTypeOf(cellCtx.column.id) === 'number') {
    <input class="rdt-cell-editor" type="number" data-editing-cell="" [value]="draftValue()" (input)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else if (editorTypeOf(cellCtx.column.id) === 'select') {
    <select class="rdt-cell-editor" data-editing-cell="" [value]="draftValue()" (change)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)">
                @for (opt of editorOptionsOf(cellCtx.column.id); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
              </select>
    } @else if (editorTypeOf(cellCtx.column.id) === 'checkbox') {
    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [checked]="!!draftValue()" (change)="onEditorCheckboxChange($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else {
    <input class="rdt-cell-editor" type="text" data-editing-cell="" [value]="draftValue()" (input)="onEditorInput($event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    }</span>
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
    }@if (!virtual()) {
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
    }</div>

  `,
  styles: [`
    .rozie-data-table {
      border-collapse: collapse;
      width: 100%;
      font: var(--rdt-font, 14px system-ui, sans-serif);
      color: var(--rdt-color, inherit);
    }
    .rdt-sr-live {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    .rozie-data-table .rdt-cell-editor {
      font: inherit;
      width: 100%;
      box-sizing: border-box;
    }
    .rozie-data-table .rdt-td[aria-invalid="true"] {
      outline: var(--rdt-invalid-outline, 2px solid #d33);
      outline-offset: -2px;
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
    .rozie-data-table-wrap .rdt-scroll {
      max-height: var(--rozie-data-table-max-height);
      overflow: auto;
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
  data = model.required<any[]>();
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
  virtual = input<boolean>(false);
  estimateRowHeight = input<number>(40);
  maxHeight = input<string>('');
  dataDefault = signal<any[]>([]);
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
  windowVer = signal(0);
  activeRow = signal(0);
  activeColIndex = signal(0);
  activeIsHeader = signal(false);
  activeInControl = signal(false);
  editingRow = signal(-1);
  editingCol = signal(-1);
  draftValue = signal<any>(null);
  invalidMsg = signal('');
  editVer = signal(0);
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
  cellEditCommit = output<unknown>({ alias: 'cell-edit-commit' });
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('selectAll', { read: TemplateRef }) selectAllTpl?: TemplateRef<SelectAllCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('selectCell', { read: TemplateRef }) selectCellTpl?: TemplateRef<SelectCellCtx>;
  @ContentChild('editor', { read: TemplateRef }) editorTpl?: TemplateRef<EditorCtx>;
  @ContentChild('cell', { read: TemplateRef }) cellTpl?: TemplateRef<CellCtx>;
  @ContentChild('selectAll', { read: TemplateRef }) selectAllTpl?: TemplateRef<SelectAllCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('selectCell', { read: TemplateRef }) selectCellTpl?: TemplateRef<SelectCellCtx>;
  @ContentChild('editor', { read: TemplateRef }) editorTpl?: TemplateRef<EditorCtx>;
  @ContentChild('cell', { read: TemplateRef }) cellTpl?: TemplateRef<CellCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.virtualizerCleanup) this.virtualizerCleanup();
    });
    effect(() => () => {
      if (!this.table) return;
      // Phase 51 req-4: track currentData() (the bound prop OR the uncontrolled
      // $data.dataDefault) so a committed edit re-feeds on Lit whether or not r-model:data is
      // bound. Compare by reference AND length so a same-length single-cell edit (fresh array,
      // identical length) still re-feeds.
      const d = this.currentData() || [];
      if (d === this.lastData && d.length === this.lastDataLen) return;
      this.lastData = d;
      this.lastDataLen = d.length;
      this.reFeed();
    });
    effect(() => { const __watchVal = (() => [this.sorting(), this.globalFilter(), this.columnFilters(), this.pagination(), this.rowSelection(), this.columnVisibility(), this.columnSizing(), this.columnOrder(), this.columnPinning(), this.selectionMode(), (this.data() || []).length,
    // Phase 51 req-4: key on the data REFERENCE (both sinks) so a committed edit re-feeds
    // even when the fresh array is the SAME length (a single-cell edit replaces one row
    // object → new array ref, identical length → the .length key alone would miss it). The
    // controlled path observes $props.data; the uncontrolled path observes $data.dataDefault.
    // writeData is echo-guarded (programmatic) and reFeed writes neither sink, so no loop.
    this.data(), this.dataDefault(), this.colReg()])(); untracked(() => { if (this.__rozieWatchInitial_0) { this.__rozieWatchInitial_0 = false; return; } (() => {
      this.reFeed();
    })(); }); });
  }

  ngAfterViewInit() {
    const __manual = this.manual();
    const __selectionMode = this.selectionMode();
    // Seed the uncontrolled `data` fallback (Phase 51 req-4) from the initial prop so an
    // edit committed BEFORE the consumer ever pushes new rows (or when the consumer passes
    // a one-way `:data`) has a base array to whole-array-replace. currentData() then sources
    // the bound prop when controlled, this fallback otherwise.
    this.dataDefault.set(this.data() || []);
    // Build the table instance HERE so the closures below capture the live `table`.
    // Build the table instance HERE so the closures below capture the live `table`.
    this.table = createTable({
      // Plain value (NOT a `get data()` getter): an object-literal getter rebinds
      // `this` to the options object, and the Angular/Lit emitters resolve $props via
      // `this.data` — so `get data() { return $props.data }` lowers to `this.data`
      // re-entering the getter → infinite recursion (max call stack). `data` is re-fed
      // on every change by the watch's setOptions below, exactly like columns/state, so
      // the getter bought nothing. Snapshot the initial data here; setOptions owns updates.
      // currentData() = the bound prop when controlled, else the uncontrolled $data.dataDefault
      // (Phase 51 req-4 — so a committed edit's writeData re-feed is observed either way).
      data: this.currentData(),
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
      // windowingSource(): the FULL pre-pagination model when virtual (windowing replaces client
      // pagination, req-9), else the normal paginated row model (non-virtual path byte-unchanged).
      const nextRows = this.windowingSource().slice();
      const nextGroups = this.table.getHeaderGroups().slice();
      this.rows.set(nextRows);
      this.headerGroups.set(nextGroups);
      this.rowModelVer.set(this.rowModelVer() + 1);
      // Vertical windowing re-feed (Pitfall 2 — stale count): push the fresh full-model count
      // into the virtualizer + reconcile IMPERATIVELY here (the table.setOptions re-feed path),
      // NEVER in a render helper (Pitfall 1). Pass the COMPLETE options set (virtual-core's
      // setOptions replaces, not merges). Guarded so the off path executes no virtual-core code.
      if (this.virtual() && this.virtualizer) {
        this.virtualizer.setOptions(this.virtualizerOptions());
        this.virtualizer._willUpdate();
      }
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
    this.gridRoot = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rozie-data-table') : null;
    // WR-04: NO on-mount auto-focus of the entry cell. Auto-focusing here stole focus on
    // page load AND was non-deterministic on React/Solid (the entry cell may not be
    // committed to the DOM yet at the $onMount microtask). The roving tabindex="0" entry
    // cell IS the first Tab-in target (matching the Wave-0 probe's "no auto-focus on
    // mount"); the consumer drives focus by Tabbing/clicking in, never the component.

    // ── Vertical windowing: construct the virtualizer (req-1/2 — ONLY when virtual) ───────
    // Built HERE (post-mount) so getScrollElement resolves the rendered .rdt-scroll div and
    // getPrePaginationRowModel reads the live table. ENTIRELY inside the $props.virtual guard:
    // when off, NO virtual-core runtime code executes (byte-identical-off). _didMount() registers
    // the scroll-element ResizeObserver and returns the teardown stored for $onUnmount.
    // WR-04: NO on-mount auto-focus of the entry cell. Auto-focusing here stole focus on
    // page load AND was non-deterministic on React/Solid (the entry cell may not be
    // committed to the DOM yet at the $onMount microtask). The roving tabindex="0" entry
    // cell IS the first Tab-in target (matching the Wave-0 probe's "no auto-focus on
    // mount"); the consumer drives focus by Tabbing/clicking in, never the component.

    // ── Vertical windowing: construct the virtualizer (req-1/2 — ONLY when virtual) ───────
    // Built HERE (post-mount) so getScrollElement resolves the rendered .rdt-scroll div and
    // getPrePaginationRowModel reads the live table. ENTIRELY inside the $props.virtual guard:
    // when off, NO virtual-core runtime code executes (byte-identical-off). _didMount() registers
    // the scroll-element ResizeObserver and returns the teardown stored for $onUnmount.
    if (this.virtual()) {
      this.gridScrollEl = this.__rozieRoot()?.nativeElement ? this.__rozieRoot()!.nativeElement.querySelector('.rdt-scroll') : null;
      this.virtualizer = new Virtualizer(this.virtualizerOptions());
      this.virtualizerCleanup = this.virtualizer._didMount();
      // FINE-GRAINED FIRST-WINDOW KICK (Solid/Svelte): the windowed <For>/{#each} accessor was first
      // evaluated at initial render — while `virtualizer` was still null — and (because windowedRows()
      // reads $data.windowVer up top) subscribed to windowVer then returned []. `virtualizer` is a
      // non-reactive `let`, so its assignment above does NOT notify the accessor; we must bump the
      // SIGNAL it subscribed to. _didMount() computes the first window synchronously but its onChange
      // only fires on SUBSEQUENT scroll/resize, so without this explicit bump the first window would
      // never paint on the fine-grained targets. Idempotent + harmless on the coarse targets (they
      // re-render wholesale anyway). One bump = one re-run that now sees the non-null virtualizer and
      // pulls getVirtualItems().
      this.windowVer.set(this.windowVer() + 1);
      // After the first window commits (next frame), refine heights + fire the dev-mode warns
      // ONCE. Entirely inside the $props.virtual guard so the virtual=false emitted path adds NO
      // code and these warns can never fire there (req-1 byte-identical-off preserved).
      const afterFirstFrame = () => {
        // D-10: measure the rendered rows.
        this.remeasureWindow();
        // D-08/A1: a dev-mode runtime warn when the scroll container has no bounded height (the
        // bound may come from consumer CSS the compiler can't see — no compile diagnostic). No
        // process.env guard (not bundler-portable); always-warn-on-misconfig is acceptable.
        const h = this.gridScrollEl ? this.gridScrollEl.clientHeight : 0;
        if (!h) {
          console.warn('[rozie-data-table] virtual is on but the scroll container has no bounded height; set maxHeight or --rozie-data-table-max-height');
        }
        // D-07 (RESOLVED — runtime warn, not a compile diagnostic): warn ONCE when the consumer
        // CONFIGURED client pagination alongside virtual, in the non-manual case (the valid
        // virtual+manual combo per D-09 is silent). The pagination prop carries a non-null default
        // ({ pageIndex: 0, pageSize: 10 }) so it is never strictly null — "configured" is therefore
        // detected as a pagination that DIFFERS from that default (a consumer who set a real page
        // size / index). The uncontrolled default ({0,10}) does NOT trip the warn. Behavior + the
        // virtual=false path are untouched (this lives entirely inside the $props.virtual guard).
        const pg = this.pagination();
        const pgConfigured = pg != null && !(pg.pageIndex === 0 && pg.pageSize === 10);
        if (__manual !== true && pgConfigured) {
          console.warn('[rozie-data-table] virtual+pagination: client pagination is configured but virtual windowing replaces it — the pagination chrome is auto-suppressed. Remove the pagination prop or set manual to silence this.');
        }
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(afterFirstFrame));else setTimeout(afterFirstFrame, 0);
    }
  }

  table: any = null;
  virtualizer: any = null;
  virtualizerCleanup: any = null;
  gridScrollEl: any = null;
  remeasurePending = false;
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
  currentData = (): any => this.data() != null ? this.data() : this.dataDefault();
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
        width: c.width != null ? c.width : '',
        // Editable-cell config (Phase 51) → ColumnDef.meta, the table-core per-column
        // metadata carrier the display↔editor branch + runValidator read. Off by default.
        meta: {
          editable: c.editable === true,
          editor: c.editor != null ? c.editor : 'text',
          editorOptions: c.editorOptions != null ? c.editorOptions : [],
          validate: typeof c.validate === 'function' ? c.validate : null
        }
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
        width: spec.width != null ? spec.width : '',
        // Editable-cell config (Phase 51) → ColumnDef.meta from the <Column> registry spec.
        meta: {
          editable: spec.editable === true,
          editor: spec.editor != null ? spec.editor : 'text',
          editorOptions: spec.editorOptions != null ? spec.editorOptions : [],
          validate: typeof spec.validate === 'function' ? spec.validate : null
        }
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
  writeData = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.dataDefault.set(next); // fresh array only (never in-place)
    this.data.set(next); // two-way emit if bound (no-op-diff if not)
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
  windowingSource = () => {
    if (!this.table) return [];
    if (this.virtual()) return this.table.getPrePaginationRowModel().rows;
    return this.table.getRowModel().rows;
  };
  virtualItemKey = (i: any) => {
    const src = this.windowingSource();
    return src && src[i] ? src[i].id : undefined;
  };
  virtualizerOptions = (): any => ({
    count: this.windowingSource().length,
    getScrollElement: () => this.gridScrollEl,
    estimateSize: () => this.estimateRowHeight(),
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    measureElement,
    overscan: 8,
    getItemKey: this.virtualItemKey,
    onChange: () => {
      this.windowVer.set(this.windowVer() + 1);
      // CR-01: re-observe the freshly-committed window so RECYCLED rows get measured.
      // virtual-core only observe()s a node you explicitly hand to measureElement (it does
      // NOT auto-discover rendered rows — measureElement is the SOLE caller of
      // observer.observe, virtual-core@3.17.1 dist/esm/index.js:794-817). Rows that recycle
      // into view on scroll are brand-new DOM nodes; without re-sweeping they keep the
      // estimateRowHeight seed forever and the spacer math drifts (req-2). Deferred one frame
      // so the new <tr> set is in the DOM before we measure. Safe from an infinite
      // measure→onChange→measure loop: measureElement is idempotent on an already-observed
      // node (the `prevNode !== node` guard), and resizeItem only re-fires onChange when the
      // measured height actually DIFFERS from the cached one (delta !== 0) — an unchanged
      // re-measure is a no-op.
      this.scheduleRemeasure();
    }
  });
  scheduleRemeasure = () => {
    if (this.remeasurePending) return;
    this.remeasurePending = true;
    let ranMicro = false;
    const microPass = () => {
      this.remeasureWindow();
    };
    const rafPass = () => {
      this.remeasurePending = false;
      this.remeasureWindow();
    };
    if (typeof queueMicrotask !== 'undefined') {
      ranMicro = true;
      queueMicrotask(microPass);
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(rafPass);else if (ranMicro) this.remeasurePending = false;else setTimeout(rafPass, 0);
  };
  windowedRows = () => {
    const __rows = this.rows();
    // SUBSCRIBE FIRST (fine-grained targets): touch the reactive windowVer at the TOP — BEFORE any
    // early return — so Solid's <For>/Svelte's {#each} accessor subscribes to it on its FIRST eval,
    // which happens at initial render while `virtualizer` is still null (it is built in $onMount,
    // after the first render). `virtualizer` is a non-reactive `let`, so if the windowVer read sat
    // BELOW the `!virtualizer` guard the accessor would early-return [] without ever reading the
    // signal → it would NEVER re-run when onChange later bumps windowVer, and the window would stay
    // blank forever (the Solid/Svelte fine-grained bug). Coarse targets re-render wholesale so the
    // placement is a no-op for them. The post-construction windowVer bump in $onMount fires the
    // first re-run that picks up the now-non-null virtualizer.
    void this.windowVer();
    if (!this.virtualizer) {
      // Virtual OFF → full set (the r-else table never calls this, but keep it total). Virtual ON
      // but the virtualizer is not yet constructed (pre-$onMount first paint) → render NOTHING so
      // the template never dereferences a null `vi` (the windowed bindings read wr.vi.index); the
      // rows appear on the first onChange after _didMount.
      if (!this.virtual()) {
        const rowList = __rows || [];
        return rowList.map((r: any) => ({
          vi: null,
          row: r
        }));
      }
      return [];
    }
    const items = this.virtualizer.getVirtualItems();
    const rowList = __rows || [];
    // WR-01: drop any virtual item whose index outruns the current full-model rows (a brief
    // shrink window where the virtualizer count is stale relative to $data.rows on the async
    // onChange→windowVer path). The template keys on wr.row.id, so a row:undefined entry would
    // throw "Cannot read properties of undefined"; filter it here so the template never sees it.
    return items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
  };
  padTop = () => {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer at the TOP so the spacer-<td>
    // :style binding subscribes on the fine-grained targets before the `!virtualizer` early return.
    void this.windowVer();
    if (!this.virtual() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    return items.length ? items[0].start : 0;
  };
  padBottom = () => {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer before the early return so the
    // fine-grained spacer :style binding subscribes on its first eval while virtualizer is null.
    void this.windowVer();
    if (!this.virtual() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    if (!items.length) return 0;
    return this.virtualizer.getTotalSize() - items[items.length - 1].end;
  };
  rowIsOutsideWindow = (r: any) => {
    if (!this.virtual() || !this.virtualizer) return false;
    const items = this.virtualizer.getVirtualItems();
    for (const it of items as any) if (it.index === r) return false;
    return true;
  };
  remeasureWindow = () => {
    if (!this.virtualizer || !this.gridRoot) return;
    // Bail ONLY while a PROGRAMMATIC scroll is in flight: virtualizer.scrollState is non-null
    // exclusively during scrollToIndex / scrollToOffset (the D-12 scroll-then-focus seam) and
    // null for ordinary user/scrollTop-driven scrolling (verified virtual-core@3.17.1: set in
    // scrollToIndex L992, cleared to null on reconcile L378). Measuring mid-scrollToIndex lets
    // resizeItem nudge the offset and starve the scroll target (the Solid off-window focus
    // regression); the next settled onChange re-measures the stable window. Manual-scroll
    // recycling (the CR-01 case) has scrollState === null, so it measures normally.
    if (this.virtualizer.scrollState) return;
    const trs = this.gridRoot.querySelectorAll('tbody.rdt-tbody > tr[data-index]');
    for (const tr of trs as any) this.virtualizer.measureElement(tr);
  };
  reFeed = () => {
    if (!this.table) return;
    this.table.setOptions((prev: any) => ({
      ...prev,
      data: this.currentData(),
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
  editMetaOf = (colId: any) => {
    const d = this.defFor(colId);
    return d && d.meta ? d.meta : null;
  };
  columnEditable = (colId: any) => {
    const m = this.editMetaOf(colId);
    return !!(m && m.editable === true);
  };
  editorTypeOf = (colId: any) => {
    const m = this.editMetaOf(colId);
    return m && m.editor != null ? m.editor : 'text';
  };
  editorOptionsOf = (colId: any) => {
    const m = this.editMetaOf(colId);
    return m && m.editorOptions != null ? m.editorOptions : [];
  };
  hasEditorSlot = (colId: any) => this.editorTypeOf(colId) === 'custom' && !!(this.editorTpl ?? this.templates()?.['editor']);
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
  focusActiveCell = (nextRow: any = null, nextCol: any = null, nextIsHeader: any = null) => {
    if (!this.isGrid() || !this.gridRoot) return;
    const r = nextRow == null ? this.activeRow() : nextRow;
    const c = nextCol == null ? this.activeColIndex() : nextCol;
    // Thread the FRESH post-write isHeader flag (the plan-01-PROVEN contract): a header
    // crossing sets $data.activeIsHeader inside moveRow, but React's setState (ROZ138) and
    // Angular's signal write are async within one handler — re-reading $data.activeIsHeader
    // here returns the PRE-write value, resolving focus to the BODY cell instead of the
    // header. Callers pass the fresh isHeader local; falls back to $data when omitted.
    const header = nextIsHeader == null ? this.activeIsHeader() : nextIsHeader;
    // ── phase 53 scroll-then-focus (D-12): when windowing AND the target body row is OUTSIDE the
    // rendered window, scroll it in first, then defer focus to AFTER the new window commits (the
    // double-rAF — a single rAF can fire before React's async commit, Pitfall 4). Header cells and
    // in-window rows keep the synchronous path below (table-mode / non-windowed stay byte-stable).
    // The guard reads the resolved `header` (NOT the raw `nextIsHeader`) so an omitted-arg call
    // while a header cell is active falls back to $data.activeIsHeader and skips the scroll path.
    if (this.virtual() && this.virtualizer && !header && this.rowIsOutsideWindow(r)) {
      this.virtualizer.scrollToIndex(r, {
        align: 'center'
      });
      // Bounded rAF-poll-until-cell-present (D-12): scrollToIndex → virtual-core onChange → windowVer
      // bump → the framework commits the scrolled-in row. On React that commit is async (setState →
      // reconcile) and for a far scroll (e.g. row 4000) spans several frames — a one-shot double-rAF
      // fires BEFORE resolveCellEl can find the cell, so focus is silently lost (the deterministic
      // React off-window-focus failure). Poll resolveCellEl for up to ~30 frames: the five
      // fast-committing targets resolve on the first attempt (behavior unchanged), React retries
      // across the few frames its async commit needs. The poll ONLY focuses (never measures), so it
      // cannot re-introduce the remeasure-vs-scroll fight. Inside the $props.virtual guard only.
      let focusAttempts = 0;
      const focusWhenReady = () => {
        const el = this.resolveCellEl(String(r), c);
        if (el) {
          el.focus();
          return;
        }
        focusAttempts = focusAttempts + 1;
        if (focusAttempts >= 30) return;
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusWhenReady);else setTimeout(focusWhenReady, 16);
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(focusWhenReady);else setTimeout(focusWhenReady, 0);
      return;
    }
    const rowKey = header ? '__header' : String(r);
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
    // Editing mode (phase 51, Pitfall 5): an OPEN editor owns Tab/Enter/Escape (+ caret keys)
    // via its local onEditorKeyDown handler. This top check (BEFORE activeInControl) returns
    // early so the grid nav keymap never hijacks an arrow/Tab/Enter while editing — the three
    // modes (editing / in-control / navigation) stay mutually exclusive and ordered.
    if (this.editingRow() >= 0) return;
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
    const prevRow = __activeRow;
    const prevCol = __activeColIndex;
    const prevIsHeader = this.activeIsHeader();
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
    }
    // ── Edit-entry (phase 51 req-1/3, D-05) — BEFORE the reserved enterControl branch.
    // Gated by isActiveCellEditable(): a non-editable active cell falls through to
    // enterControl (the Phase-49 behavior is unchanged). F2/Enter seed the EXISTING value
    // (in-place edit); a single printable char (no Ctrl/Meta/Alt) REPLACES the value.
    else if ((key === 'Enter' || key === 'F2') && this.isActiveCellEditable()) {
      e.preventDefault();
      this.beginEdit(__activeRow, __activeColIndex, null);
      return;
    } else if (this.isActiveCellEditable() && key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      this.beginEdit(__activeRow, __activeColIndex, key);
      return;
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
      this.activecellChange.emit({
        rowIndex: nextRow,
        colIndex: nextCol
      });
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
    this.activeIsHeader.set(isHeader);
    if (!isHeader) {
      const row = parseInt(rowAttr, 10);
      if (Number.isFinite(row)) this.activeRow.set(row);
    }
    this.activeColIndex.set(col);
    // The cell box (not an inner control) receiving focus = navigation mode.
    if (tgt === cellEl) this.activeInControl.set(false);
  };
  onGridFocusOut = (e: any) => {
    if (!this.isGrid() || !this.activeInControl()) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = this.currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) this.activeInControl.set(false);
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
  activeCellColumnId = () => {
    if (this.activeIsHeader()) return null;
    const rowList = this.rows() || [];
    const row = rowList[this.activeRow()];
    if (!row) return null;
    const cells = this.visibleCellsFor(row);
    const cell = cells[this.activeColIndex()];
    return cell && cell.column ? cell.column.id : null;
  };
  isActiveCellEditable = () => {
    const colId = this.activeCellColumnId();
    return colId != null && this.columnEditable(colId);
  };
  isEditing = (rowIndex: any, colIndex: any) => this.editVer() >= 0 && this.editingRow() === rowIndex && this.editingCol() === colIndex;
  cellAriaInvalid = (rowIndex: any, colIndex: any): 'true' | null => this.isEditing(rowIndex, colIndex) && !!this.invalidMsg() ? 'true' : null;
  runValidator = (colId: any, value: any, row: any) => {
    const m = this.editMetaOf(colId);
    const v = m ? m.validate : null;
    if (typeof v !== 'function') return true;
    let r: any = null;
    try {
      r = v(value, row);
    } catch (err: any) {
      return 'Invalid value';
    }
    if (r === true) return true;
    if (typeof r === 'string') return r;
    return 'Invalid value';
  };
  setInvalid = (msg: any) => {
    this.invalidMsg.set(msg != null ? msg : '');
  };
  replaceRowValue = (rows: any, rowIndex: any, field: any, value: any) => {
    const src = rows || [];
    const out = [];
    for (let i = 0; i < src.length; i++) {
      if (i === rowIndex) {
        const merged = {};
        const orig = src[i] || {};
        for (const k in orig) merged[k] = orig[k];
        merged[field] = value;
        out.push(merged);
      } else {
        out.push(src[i]);
      }
    }
    return out;
  };
  sourceIndexOfRow = (visibleRowIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[visibleRowIndex];
    if (!row) return visibleRowIndex;
    const orig = row.original;
    const data = this.currentData() || [];
    const idx = data.indexOf(orig);
    return idx >= 0 ? idx : visibleRowIndex;
  };
  editingColumnId = () => {
    const rowList = this.rows() || [];
    const row = rowList[this.editingRow()];
    if (!row) return null;
    const cells = this.visibleCellsFor(row);
    const cell = cells[this.editingCol()];
    return cell && cell.column ? cell.column.id : null;
  };
  editingColumnField = () => {
    const colId = this.editingColumnId();
    if (colId == null) return null;
    const d = this.defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  };
  editingCellValue = () => {
    const rowList = this.rows() || [];
    const row = rowList[this.editingRow()];
    if (!row) return null;
    const cells = this.visibleCellsFor(row);
    const cell = cells[this.editingCol()];
    return cell ? cell.getValue() : null;
  };
  editingRowOriginal = () => {
    const rowList = this.rows() || [];
    const row = rowList[this.editingRow()];
    return row ? row.original : null;
  };
  editingRowId = () => {
    const rowList = this.rows() || [];
    const row = rowList[this.editingRow()];
    return row ? row.id : null;
  };
  focusEditorWhenReady = () => {
    if (!this.gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = this.gridRoot ? this.gridRoot.querySelector('[data-editing-cell]') : null;
      if (el) {
        el.focus();
        if (el.select) {
          try {
            el.select();
          } catch (e: any) {}
        }
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  };
  columnIdAt = (rowIndex: any, colIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[rowIndex];
    if (!row) return null;
    const cells = this.visibleCellsFor(row);
    const cell = cells[colIndex];
    return cell && cell.column ? cell.column.id : null;
  };
  cellValueAt = (rowIndex: any, colIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[rowIndex];
    if (!row) return null;
    const cells = this.visibleCellsFor(row);
    const cell = cells[colIndex];
    return cell ? cell.getValue() : null;
  };
  beginEdit = (rowIndex: any, colIndex: any, seed: any) => {
    const colId = this.columnIdAt(rowIndex, colIndex);
    if (colId == null || !this.columnEditable(colId)) return;
    this.setInvalid('');
    this.editingRow.set(rowIndex);
    this.editingCol.set(colIndex);
    this.draftValue.set(seed != null ? seed : this.cellValueAt(rowIndex, colIndex));
    this.activeInControl.set(true);
    this.editVer.set(this.editVer() + 1);
    this.focusEditorWhenReady();
  };
  focusCellWhenReady = (row: any, col: any) => {
    if (!this.gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = this.resolveCellEl(String(row), col);
      if (el) {
        el.focus();
        return;
      }
      attempts = attempts + 1;
      if (attempts >= 30) return;
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 16);
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tryFocus);else setTimeout(tryFocus, 0);
  };
  endEdit = () => {
    this.editingRow.set(-1);
    this.editingCol.set(-1);
    this.draftValue.set(null);
    this.invalidMsg.set('');
    this.activeInControl.set(false);
    this.editVer.set(this.editVer() + 1);
  };
  commitEdit = (overrideValue: any = undefined, skipFocusReturn: any = false) => {
    const __editingRow = this.editingRow();
    if (__editingRow < 0) return false;
    const colId = this.editingColumnId();
    if (colId == null) {
      this.endEdit();
      return false;
    }
    const field = this.editingColumnField();
    const oldValue = this.editingCellValue();
    const rowOriginal = this.editingRowOriginal();
    const rowId = this.editingRowId();
    const newValue = overrideValue !== undefined ? overrideValue : this.draftValue();
    const err = this.runValidator(colId, newValue, rowOriginal);
    if (err !== true) {
      // D-01: reject — keep the editor open, announce, re-trap focus, NEVER write the model.
      this.setInvalid(err);
      this.focusEditorWhenReady();
      return false;
    }
    this.setInvalid('');
    const srcIndex = this.sourceIndexOfRow(__editingRow);
    const next = this.replaceRowValue(this.currentData(), srcIndex, field, newValue);
    // Snapshot the EDITING cell to return focus to BEFORE endEdit clears editing state.
    const focusRow = __editingRow;
    const focusCol = this.editingCol();
    // Guard the teardown blur: writeData/endEdit re-render unmounts the editor → its blur
    // must NOT re-enter commitEdit (double cell-edit-commit). Cleared after the focus return.
    this.editTransition = true;
    this.writeData(next);
    // Exactly one emit per commit, from this single call site (writeData does NOT emit).
    this.cellEditCommit.emit({
      rowId,
      columnId: colId,
      oldValue,
      newValue
    });
    this.endEdit();
    this.editTransition = false;
    // Defer the focus return so the display↔editor re-render commits first (async on
    // React/Solid/Lit) — the cell is focusable with its roving tabindex only after the
    // editor unmounts and the display branch (+ tabindex) re-renders. Skipped on a
    // Tab-advance (the caller immediately opens the next editor and focuses THAT).
    if (skipFocusReturn !== true) this.focusCellWhenReady(focusRow, focusCol);
    return true;
  };
  cancelEdit = () => {
    if (this.editingRow() < 0) return;
    const focusRow = this.activeRow();
    const focusCol = this.activeColIndex();
    this.editTransition = true;
    this.endEdit();
    this.editTransition = false;
    this.focusCellWhenReady(focusRow, focusCol);
  };
  nextEditableCell = (fromRow: any, fromCol: any) => {
    const rowList = this.rows() || [];
    const rowCount = rowList.length;
    if (rowCount === 0) return null;
    let r = fromRow;
    let c = fromCol + 1;
    while (r < rowCount) {
      const row = rowList[r];
      const cells = row ? this.visibleCellsFor(row) : [];
      while (c < cells.length) {
        const cell = cells[c];
        const cid = cell && cell.column ? cell.column.id : null;
        if (cid != null && this.columnEditable(cid)) return {
          row: r,
          col: c
        };
        c = c + 1;
      }
      r = r + 1;
      c = 0;
    }
    return null;
  };
  editTransition = false;
  onEditorInput = (evt: any) => {
    this.draftValue.set(evt && evt.target ? evt.target.value : '');
  };
  onEditorCheckboxChange = (evt: any) => {
    this.draftValue.set(!!(evt && evt.target && evt.target.checked));
  };
  onEditorKeyDown = (e: any) => {
    if (!e) return;
    const key = e.key;
    if (key === 'Enter') {
      e.preventDefault();
      this.commitEdit(undefined);
    } else if (key === 'Tab') {
      e.preventDefault();
      // Resolve the advance target from the EDITING pair (the cell that is open), not the
      // active cell (they match here, but the editing pair is authoritative).
      const target = this.nextEditableCell(this.editingRow(), this.editingCol());
      // skipFocusReturn=true: don't bounce focus back to the committed cell — we advance
      // straight into the next editable cell's editor below. Use the RETURN value (not a
      // re-read of $data.editingRow — async-stale on React) to gate the advance: a validation
      // failure returns false and keeps the editor open (the user must fix the value first).
      const committed = this.commitEdit(undefined, true);
      if (committed && target) {
        this.activeRow.set(target.row);
        this.activeColIndex.set(target.col);
        this.beginEdit(target.row, target.col, null);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  };
  onEditorBlur = (e: any) => {
    if (this.editingRow() < 0 || this.editTransition) return;
    const next = e ? e.relatedTarget : null;
    // Commit ONLY on a genuine focus-away to a real element OUTSIDE the grid (click into
    // another widget). Skip when:
    //  - relatedTarget is inside gridRoot — a controlled move (Tab-advance to the next editor,
    //    Enter/Escape focus-return to the cell); the keyboard handler already acted, AND
    //  - relatedTarget is null — an unmount-blur (the editor left the DOM) or a focus drop the
    //    keyboard path owns; committing here would double-count. The explicit Enter/Tab/Escape
    //    keymap covers every keyboard commit, so a null-relatedTarget blur is never a commit.
    if (next == null) return;
    if (this.gridRoot && this.gridRoot.contains && this.gridRoot.contains(next)) return;
    this.commitEdit(undefined);
  };
  editCell = (rowIndex: any, colIndex: any) => {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const maxCol = this.visibleColCount() - 1;
    const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const c = this.clamp(Math.trunc(Number(colIndex)) || 0, 0, maxCol < 0 ? 0 : maxCol);
    this.activeIsHeader.set(false);
    this.activeRow.set(r);
    this.activeColIndex.set(c);
    this.beginEdit(r, c, null);
  };
  commitEditing = () => {
    if (this.editingRow() >= 0) this.commitEdit(undefined);
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
    // Thread isHeader=false EXPLICITLY (focusCell always lands in the body). Without it
    // focusActiveCell re-reads $data.activeIsHeader, which on React (setState async, ROZ138)
    // / Angular (async signal) returns the PRE-write value — and WR-03's @focusin sync sets
    // activeIsHeader=true whenever an inner control inside a HEADER cell (a sort button) was
    // last clicked, so a stale read would resolve focus to the header instead of body row r.
    this.focusActiveCell(r, c, false);
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
  ): _ctx is DefaultCtx | SelectAllCtx | ColHeaderCtx | ColHeaderCtx | SelectCellCtx | EditorCtx | CellCtx | SelectAllCtx | ColHeaderCtx | ColHeaderCtx | SelectCellCtx | EditorCtx | CellCtx {
    return true;
  }

  protected get __style() {
      const __maxHeight = this.maxHeight();
      return __maxHeight ? 'max-height:' + __maxHeight + ';overflow:auto;--rozie-data-table-max-height:' + __maxHeight : 'overflow:auto';
    }

  private _selectCell_ctx = (wr: any, cellCtx: any) => ({ $implicit: { row: wr.row.original, checked: this.rowIsSelected(wr.row), toggle: e => this.onToggleRow(wr.row, e) }, row: wr.row.original, checked: this.rowIsSelected(wr.row), toggle: e => this.onToggleRow(wr.row, e) });

  private _selectCell_ctx_1 = (row: any, cellCtx: any) => ({ $implicit: { row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) }, row: row.original, checked: this.rowIsSelected(row), toggle: e => this.onToggleRow(row, e) });

  protected readonly String = String;

  rozieDisplay(v: unknown): string { return __rozieDisplay(v); }

  rozieAttr(v: unknown): string | null { return __rozieAttr(v); }
}

export default DataTable;
