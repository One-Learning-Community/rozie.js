import { Component, ContentChild, DestroyRef, ElementRef, InjectionToken, TemplateRef, ViewEncapsulation, effect, forwardRef, inject, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';

import { createTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, getPaginationRowModel, getExpandedRowModel, getGroupedRowModel,
// Faceted filtering (phase 50 reqs 8-9, D-03). All three are supplied UNCONDITIONALLY
// (mirrors the expand/group models) — inert until a consumer READS a column facet via the
// getFaceted* $expose verbs or the #filter slot props, so byte-identical-off (req-10) holds.
// getFacetedUniqueValues/getFacetedMinMaxValues default impls are CROSS-FILTERED out of the
// box (D-03 — reflect rows passing all OTHER active column filters); unique values + min/max
// ONLY — occurrence counts are deliberately NOT exposed (Array.from(map.keys()) — D-03).
getFacetedRowModel,
// Aliased to make<…> so the bare names `getFacetedUniqueValues`/`getFacetedMinMaxValues`
// are FREE for the $expose verb helpers below. The $expose IR carries only the verb NAME
// (the `key:value` alias is discarded — ExposedMethod.name), so an exposed
// `getFacetedUniqueValues` lowers to the shorthand `{ getFacetedUniqueValues }`, which MUST
// resolve to the in-scope helper, NOT this table-core factory import (the collision that made
// the verb return the factory fn instead of the keys array — roundout facet block).
getFacetedUniqueValues as makeFacetedUniqueValues, getFacetedMinMaxValues as makeFacetedMinMaxValues } from '@tanstack/table-core';
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

interface GroupBarCtx {
  $implicit: { grouping: any; groupableColumns: any; applyGrouping: any; clearGrouping: any };
  grouping: any;
  groupableColumns: any;
  applyGrouping: any;
  clearGrouping: any;
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

interface FilterCtx {
  $implicit: { columnId: any; uniqueValues: any; minMax: any; setFilter: any };
  columnId: any;
  uniqueValues: any;
  minMax: any;
  setFilter: any;
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

interface DetailCtx {
  $implicit: { row: any };
  row: any;
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
    }@if (!!pasteAnnounce()) {
    <div class="rdt-sr-live rdt-sr-paste" data-testid="paste-announce" role="status" aria-live="polite" aria-atomic="true">{{ pasteAnnounce() }}</div>
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


    @if (groupable()) {
    <div class="rdt-group-bar-host">
      @if ((groupBarTpl ?? templates()?.['groupBar'])) {
    <ng-container *ngTemplateOutlet="(groupBarTpl ?? templates()?.['groupBar']); context: { $implicit: { grouping: groupingKeys(), groupableColumns: groupableColumns(), applyGrouping: applyGrouping, clearGrouping: clearGrouping }, grouping: groupingKeys(), groupableColumns: groupableColumns(), applyGrouping: applyGrouping, clearGrouping: clearGrouping }" />
    } @else {

        @for (gk of groupingKeys(); track gk) {
    <span class="rdt-group-token" data-group-token="">{{ rozieDisplay(gk) }}</span>
    }
      
    }
    </div>
    }@if (virtual()) {
    <div class="rdt-scroll" [style]="__style">
    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" [attr.role]="rozieAttr(tableRole())" [attr.aria-rowcount]="rows().length" (keydown)="onGridKeyDown($event)" (focusin)="syncActiveFromEvent($event)" (focusout)="onGridFocusOut($event)" (mousedown)="onGridMouseDown($event)">
      <thead class="rdt-thead" role="rowgroup">
        @for (hg of headerGroups(); track hg.id; let hgLevel = $index) {
    <tr class="rdt-tr" role="row">
          @for (header of hg.headers; track header.id) {
    <th class="rdt-th" [ngClass]="{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }" role="columnheader" [attr.data-col]="rozieAttr(header.column.id)" data-grid-cell="" data-row="__header" [attr.data-header-level]="rozieAttr(hgLevel)" [attr.colspan]="rozieAttr(header.colSpan > 1 ? header.colSpan : null)" [attr.data-col-index]="rozieAttr(headerColIndexOf(hg, header))" [attr.tabindex]="rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header), hgLevel))" [attr.aria-sort]="rozieAttr(ariaSortFor(header.column.id))" [style]="thStyle(header.column.id)">
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
    }@if (columnIsFilterable(header.column.id)) {
    <span style="display:contents">
                <ng-container *ngTemplateOutlet="(filterTpl ?? templates()?.['filter']); context: { $implicit: { columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter }, columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter }" />
              </span>
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
    <tr class="rdt-tr" [ngClass]="{ 'rdt-row-pinned': wr.pinned }" role="row" [attr.data-row]="rozieAttr(wr.vi.index)" [attr.aria-rowindex]="rozieAttr(wr.vi.index + 1)" [attr.data-index]="rozieAttr(wr.vi.index)" [attr.data-pinned]="rozieAttr(wr.pinned ? 'true' : null)">
          @for (cellCtx of visibleCellsFor(wr.row); track cellCtx.id) {
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id), 'rdt-in-range': inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) }" [attr.role]="rozieAttr(cellRole())" [attr.data-col]="rozieAttr(cellCtx.column.id)" data-grid-cell="" [attr.data-row]="rozieAttr(wr.vi.index)" [attr.data-col-index]="rozieAttr(colIndexOf(wr.row, cellCtx))" [attr.tabindex]="rozieAttr(cellTabindex(String(wr.vi.index), colIndexOf(wr.row, cellCtx)))" [style]="pinStyle(cellCtx.column.id)" [attr.aria-invalid]="rozieAttr(cellAriaInvalid(wr.vi.index, colIndexOf(wr.row, cellCtx)))" [attr.data-in-range]="rozieAttr(inRange(wr.vi.index, colIndexOf(wr.row, cellCtx)) ? 'true' : null)">
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
                <ng-container *ngTemplateOutlet="(editorTpl ?? templates()?.['editor']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() }, columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() }" />
              </span>
    } @else if (editorTypeOf(cellCtx.column.id) === 'number') {
    <input class="rdt-cell-editor" type="number" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (input)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else if (editorTypeOf(cellCtx.column.id) === 'select') {
    <select class="rdt-cell-editor" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (change)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)">
                @for (opt of editorOptionsOf(cellCtx.column.id); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
              </select>
    } @else if (editorTypeOf(cellCtx.column.id) === 'checkbox') {
    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [checked]="editorCheckedFor(cellCtx.column.id)" (change)="onCellEditorCheckbox(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else {
    <input class="rdt-cell-editor" type="text" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (input)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    }</span>
    } @else {
    <span class="rdt-cell-value">
              @if ((cellTpl ?? templates()?.['cell'])) {
    <ng-container *ngTemplateOutlet="(cellTpl ?? templates()?.['cell']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }, columnId: cellCtx.column.id, column: cellCtx.column, row: wr.row.original, value: cellCtx.getValue() }" />
    } @else {
    {{ rozieDisplay(cellCtx.getValue()) }}
    }
            </span>
    }@if (isFillHandleCell(wr.vi.index, colIndexOf(wr.row, cellCtx))) {
    <span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" (pointerdown)="onFillHandlePointerDown($event)"></span>
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
    <table class="rozie-data-table" [ngClass]="{ 'rdt-sticky': stickyHeader() }" [attr.role]="rozieAttr(tableRole())" [attr.aria-rowcount]="rozieAttr(totalRowCount())" (keydown)="onGridKeyDown($event)" (focusin)="syncActiveFromEvent($event)" (focusout)="onGridFocusOut($event)" (mousedown)="onGridMouseDown($event)">
      <thead class="rdt-thead" role="rowgroup">
        @for (hg of headerGroups(); track hg.id; let hgLevel = $index) {
    <tr class="rdt-tr" role="row">
          @for (header of hg.headers; track header.id) {
    <th class="rdt-th" [ngClass]="{ 'rdt-select-th': isSelectColumn(header.column.id), 'rdt-th-resizing': columnIsResizing(header.column.id) }" role="columnheader" [attr.data-col]="rozieAttr(header.column.id)" data-grid-cell="" data-row="__header" [attr.data-header-level]="rozieAttr(hgLevel)" [attr.colspan]="rozieAttr(header.colSpan > 1 ? header.colSpan : null)" [attr.data-col-index]="rozieAttr(headerColIndexOf(hg, header))" [attr.tabindex]="rozieAttr(cellTabindex('__header', headerColIndexOf(hg, header), hgLevel))" [attr.aria-sort]="rozieAttr(ariaSortFor(header.column.id))" [style]="thStyle(header.column.id)">
            
            
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
    }@if (columnIsFilterable(header.column.id)) {
    <span style="display:contents">
                <ng-container *ngTemplateOutlet="(filterTpl ?? templates()?.['filter']); context: { $implicit: { columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter }, columnId: header.column.id, uniqueValues: getFacetedUniqueValues(header.column.id), minMax: getFacetedMinMaxValues(header.column.id), setFilter: setColumnFilter }" />
              </span>
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

        <tr class="rdt-tr" [ngClass]="{ 'rdt-group-header': rowIsGrouped(row) }" role="row" [attr.data-depth]="rozieAttr(row.depth)" [attr.data-group-header]="rozieAttr(rowIsGrouped(row) ? row.id : null)" [attr.data-group-leaf]="rozieAttr(groupingActive() && !rowIsGrouped(row) ? row.id : null)">
          @for (cellCtx of visibleCellsFor(row); track cellCtx.id) {
    <td class="rdt-td" [ngClass]="{ 'rdt-select-td': isSelectColumn(cellCtx.column.id), 'rdt-in-range': inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) }" [attr.role]="rozieAttr(cellRole())" [attr.data-col]="rozieAttr(cellCtx.column.id)" data-grid-cell="" [attr.data-row]="rozieAttr(rowIndexOf(row))" [attr.data-col-index]="rozieAttr(colIndexOf(row, cellCtx))" [attr.tabindex]="rozieAttr(cellTabindex(String(rowIndexOf(row)), colIndexOf(row, cellCtx)))" [style]="bodyCellStyle(row, cellCtx.column.id)" [attr.aria-invalid]="rozieAttr(cellAriaInvalid(rowIndexOf(row), colIndexOf(row, cellCtx)))" [attr.data-in-range]="rozieAttr(inRange(rowIndexOf(row), colIndexOf(row, cellCtx)) ? 'true' : null)" [attr.data-agg-cell]="rozieAttr(cellIsAggregated(cellCtx) ? cellCtx.column.id : null)">
            
            @if (isExpanderColumn(cellCtx.column.id)) {
    <span style="display:contents">
              @if (rowCanExpand(row)) {
    <button type="button" class="rdt-expander" data-expander="" [attr.aria-expanded]="!!rowIsExpanded(row)" [attr.aria-label]="rozieAttr(rowIsExpanded(row) ? 'Collapse row' : 'Expand row')" (click)="onToggleExpand(row, $event)">{{ rozieDisplay(rowIsExpanded(row) ? '▾' : '▸') }}</button>
    }</span>
    } @else if (isSelectColumn(cellCtx.column.id)) {
    <span style="display:contents">
              @if ((selectCellTpl ?? templates()?.['selectCell'])) {
    <ng-container *ngTemplateOutlet="(selectCellTpl ?? templates()?.['selectCell']); context: _selectCell_ctx_1(row, cellCtx)" />
    } @else {

                <input class="rdt-select-row" type="checkbox" aria-label="Select row" [checked]="rowIsSelected(row)" (change)="onToggleRow(row, $event)" />
              
    }
            </span>
    } @else if (cellIsGrouped(cellCtx)) {
    <span style="display:contents">
              <button type="button" class="rdt-expander rdt-group-toggle" data-expander="" [attr.aria-expanded]="!!rowIsExpanded(row)" [attr.aria-label]="rozieAttr(rowIsExpanded(row) ? 'Collapse group' : 'Expand group')" (click)="onToggleExpand(row, $event)">{{ rozieDisplay(rowIsExpanded(row) ? '▾' : '▸') }}</button>
              <span class="rdt-group-value">
                @if ((cellTpl ?? templates()?.['cell'])) {
    <ng-container *ngTemplateOutlet="(cellTpl ?? templates()?.['cell']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }, columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }" />
    } @else {
    {{ rozieDisplay(cellCtx.getValue()) }}
    }
              </span>
              <span class="rdt-group-count">{{ rozieDisplay('(' + groupSubRowCount(row) + ')') }}</span>
            </span>
    } @else if (isEditing(rowIndexOf(row), colIndexOf(row, cellCtx))) {
    <span style="display:contents">
              @if (hasEditorSlot(cellCtx.column.id)) {
    <span style="display:contents">
                <ng-container *ngTemplateOutlet="(editorTpl ?? templates()?.['editor']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() }, columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: editorValueFor(cellCtx.column.id), commit: editorCommitFor(cellCtx.column.id), cancel: editorCancelFor() }" />
              </span>
    } @else if (editorTypeOf(cellCtx.column.id) === 'number') {
    <input class="rdt-cell-editor" type="number" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (input)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else if (editorTypeOf(cellCtx.column.id) === 'select') {
    <select class="rdt-cell-editor" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (change)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)">
                @for (opt of editorOptionsOf(cellCtx.column.id); track opt.value) {
    <option [attr.value]="rozieAttr(opt.value)">{{ rozieDisplay(opt.label) }}</option>
    }
              </select>
    } @else if (editorTypeOf(cellCtx.column.id) === 'checkbox') {
    <input class="rdt-cell-editor" type="checkbox" data-editing-cell="" [checked]="editorCheckedFor(cellCtx.column.id)" (change)="onCellEditorCheckbox(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    } @else {
    <input class="rdt-cell-editor" type="text" data-editing-cell="" [value]="editorValueFor(cellCtx.column.id)" (input)="onCellEditorInput(cellCtx.column.id, $event)" (keydown)="onEditorKeyDown($event)" (blur)="onEditorBlur($event)" />
    }</span>
    } @else {
    <span class="rdt-cell-value">
              @if ((cellTpl ?? templates()?.['cell'])) {
    <ng-container *ngTemplateOutlet="(cellTpl ?? templates()?.['cell']); context: { $implicit: { columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }, columnId: cellCtx.column.id, column: cellCtx.column, row: row.original, value: cellCtx.getValue() }" />
    } @else {
    {{ rozieDisplay(cellCtx.getValue()) }}
    }
            </span>
    }@if (isFillHandleCell(rowIndexOf(row), colIndexOf(row, cellCtx))) {
    <span class="rdt-fill-handle" data-fill-handle="" data-testid="fill-handle" aria-hidden="true" (pointerdown)="onFillHandlePointerDown($event)"></span>
    }</td>
    }
        </tr>
        
        @if (rowShowsDetail(row)) {
    <tr class="rdt-detail-row" role="row" [attr.data-detail-row]="rozieAttr(row.id)">
          <td class="rdt-detail-cell" [attr.colspan]="rozieAttr(visibleColCount())">
            <ng-container *ngTemplateOutlet="(detailTpl ?? templates()?.['detail']); context: { $implicit: { row: row.original }, row: row.original }" />
          </td>
        </tr>
    }
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
    .rozie-data-table .rdt-td.rdt-in-range {
      background: var(--rdt-range-bg, rgba(37, 99, 235, 0.12));
    }
    .rozie-data-table .rdt-td {
      position: relative;
    }
    .rozie-data-table .rdt-fill-handle {
      position: absolute;
      right: -3px;
      bottom: -3px;
      width: 8px;
      height: 8px;
      background: var(--rdt-fill-handle-bg, #2563eb);
      border: 1px solid #fff;
      cursor: crosshair;
      z-index: 1;
      touch-action: none;
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
    .rozie-data-table-wrap .rdt-group-bar-host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--rdt-group-bar-gap, 0.375rem);
    }
    .rozie-data-table-wrap .rdt-group-token {
      display: inline-flex;
      align-items: center;
      padding: var(--rdt-group-token-pad, 0.125rem 0.5rem);
      border-radius: var(--rdt-group-token-radius, 999px);
      background: var(--rdt-group-token-bg, rgba(0, 0, 0, 0.06));
      font-size: var(--rdt-group-token-size, 0.8125em);
    }
    .rozie-data-table .rdt-group-header {
      background: var(--rdt-group-header-bg, rgba(0, 0, 0, 0.025));
      font-weight: var(--rdt-group-header-weight, 600);
    }
    .rozie-data-table .rdt-group-toggle {
      margin-right: var(--rdt-group-toggle-gap, 0.375rem);
    }
    .rozie-data-table .rdt-group-count {
      margin-left: var(--rdt-group-count-gap, 0.375rem);
      opacity: var(--rdt-group-count-opacity, 0.65);
      font-weight: 400;
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
  /**
   * The row data — `model: true`, so a committed cell/row edit writes a **fresh** array back through `r-model:data` (uncontrolled fallback `dataDefault`). A stable reference per Rozie's setup-once model — fed directly into table-core (never map/cloned in the watcher).
   * @example
   * <DataTable r-model:data="rows" :columns="cols" />
   */
  data = model.required<any[]>();
  /**
   * Config-array column fallback (lower precedence than `<Column>` children). Each entry: `{ id?, field, header?, sortable?, filterable?, pinned?, width? }`. Columns may come from this array, from `<Column>` children, or both (id-keyed last-write-wins union).
   */
  columns = input<any[]>((() => [])());
  /**
   * Row-selection mode: `'none'` | `'single'` | `'multiple'`. `'multiple'` auto-injects a leading checkbox column with a select-all header.
   */
  selectionMode = input<string>('none');
  /**
   * `SortingState` — `[{ id, desc }]`. Uncontrolled fallback when unbound. Two-way: writes funnel a fresh value through the `sort-change` event regardless of binding.
   */
  sorting = model<any[]>((() => [])());
  /**
   * The global search string — narrows all columns. Feeds `getFilteredRowModel()`. Surfaces through `filter-change`. Two-way: fires `filter-change` regardless of binding.
   */
  globalFilter = model<string>('');
  /**
   * `ColumnFiltersState` — `[{ id, value }]` per-column narrowing (gated by each column's `filterable`). Two-way: whole-array replace on write, fires `filter-change`.
   */
  columnFilters = model<any[]>((() => [])());
  /**
   * `{ pageIndex, pageSize }`. Defaults to `{ pageIndex: 0, pageSize: 10 }`; feeds the prev/next + page-size chrome (and `getPaginationRowModel()`). Two-way: funnels a fresh object through `page-change`.
   */
  pagination = model<Record<string, any>>((() => ({
    pageIndex: 0,
    pageSize: 10
  }))());
  /**
   * Server-side hook: sets `manualPagination` / `manualFiltering` / `manualSorting` so table-core trusts the consumer-supplied rows and only emits the change events (the consumer fetches each page).
   */
  manual = input<boolean>(false);
  /**
   * Opt-in **expandable rows**. When `true`, a leading chevron expander column auto-injects (after the select column) and `getExpandedRowModel` activates; default `false` is byte-identical-off. Every row can expand to reveal a `#detail` panel unless `getSubRows` is supplied (then only rows with children expand). Bind `:expandable="true"` (a bare attr only coerces on Vue+Lit).
   */
  expandable = input<boolean>(false);
  /**
   * `ExpandedState` — `{ [rowId]: true }`, or the `true` literal after `expandAll` (declared `type: [Object, Boolean]`). Multi-expand (multiple rows open at once). Surfaces through `expand-change`; uncontrolled fallback (`$data.expandedDefault`) when unbound — the default is `null` so the uncontrolled fallback AND the grouping auto-expand default are reachable (a non-null default would short-circuit them). When grouping is active and `expanded` is untouched, group subtrees auto-expand.
   */
  expanded = model<(Record<string, any> | boolean) | null>(null);
  /**
   * Table-level child-row accessor `(originalRow, index) => TData[] | undefined` that drives nested sub-rows. When supplied (with `expandable`), table-core flattens the hierarchy and the expand seam reveals depth-indented child rows. Null → the `#detail` scoped slot is the expand mode.
   */
  getSubRows = input<((...args: unknown[]) => unknown) | null>(null);
  /**
   * Opt-in gate for the **headless `#groupBar`** host region. Default `false` is byte-identical-off. `getGroupedRowModel` is wired unconditionally (inert when `grouping` is empty), so grouping is driven by the `grouping` model; this flag only gates the consumer-facing group-bar surface (the component ships **no** built-in drag UI).
   */
  groupable = input<boolean>(false);
  /**
   * `GroupingState` — an ordered `string[]` of column ids (multi-column → nested groups, e.g. `['region','category']`). An empty/unbound list is ungrouped (byte-identical-off). Group-header rows are collapsible (they ride the expand model). Surfaces through `group-change`; uncontrolled fallback (`$data.groupingDefault`, default `[]`) when unbound — the default is `null` (mirroring `expanded`) so the uncontrolled fallback is reachable and the grouping auto-expand default can activate when a consumer applies grouping without binding `r-model:grouping` (a non-null `[]` default would short-circuit it). All reads are null-guarded, so table-core still receives an array.
   */
  grouping = model<(any[]) | null>(null);
  /**
   * `RowSelectionState` — `{ [rowId]: true }`. Checkbox-only toggle (the row body does not select). Driven by the `selectionMode` chrome. Two-way: fires `selection-change` regardless of binding.
   */
  rowSelection = model<Record<string, any>>((() => ({}))());
  /**
   * `VisibilityState` — `{ [colId]: boolean }`. Hidden columns drop automatically from header + body. Two-way: funnels a fresh object through `visibility-change`.
   */
  columnVisibility = model<Record<string, any>>((() => ({}))());
  /**
   * `ColumnSizingState` — `{ [colId]: number }`. Driven live by the pointer-drag resize handle (`columnResizeMode: 'onChange'`). Two-way: fires `resize-change`.
   */
  columnSizing = model<Record<string, any>>((() => ({}))());
  /**
   * `ColumnOrderState` — `string[]`. A fresh order array on reorder (never an in-place splice). Two-way: fires `reorder-change`.
   */
  columnOrder = model<any[]>((() => [])());
  /**
   * `ColumnPinningState` — `{ left: string[], right: string[] }`. Pinned columns get `position: sticky` + computed offsets. Defaults to `{ left: [], right: [] }`. Two-way: fires `pin-change`.
   */
  columnPinning = model<Record<string, any>>((() => ({
    left: [],
    right: []
  }))());
  /**
   * Pure-CSS sticky header: the `<thead>` sticks to the top of the scroll container.
   */
  stickyHeader = input<boolean>(false);
  /**
   * `'table'` (default, row-oriented) | `'grid'`. `'grid'` lights up the full WAI-ARIA **[grid interaction mode](/components/data-table-grid-mode)** — `role="grid"`, a roving single tab-stop, and 2-D APG arrow-key cell navigation. `'table'` is byte-behaviorally identical to a plain accessible table.
   * @deprecated Reserved forward-compat seam — grid cell-navigation is not implemented yet; do not rely on the `grid` mode.
   */
  interactionMode = input<string>('table');
  /**
   * Opt-in vertical **row windowing**. When `true`, only the visible slice of rows renders inside a bounded `rdt-scroll` container (with leading/trailing spacer rows preserving total scroll height), windowing over the full filtered + sorted (pre-pagination) model and suppressing the client pagination chrome. Default `false` is byte-identical to a non-virtual table.
   */
  virtual = input<boolean>(false);
  /**
   * Estimated row height (px) seeding the windowing engine before `measureElement` refines actual heights. Only consulted when `virtual` is on.
   */
  estimateRowHeight = input<number>(40);
  /**
   * A CSS length string bounding the `rdt-scroll` container when `virtual` is on (e.g. `'400px'`). Mirrored to the `--rozie-data-table-max-height` custom property; the prop wins, the token is the fallback.
   */
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
  expandedDefault = signal({});
  groupingDefault = signal<any[]>([]);
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
  activeHeaderLevel = signal(0);
  gridEmptyFallback = signal(false);
  activeInControl = signal(false);
  editingRow = signal(-1);
  editingCol = signal(-1);
  draftValue = signal<any>(null);
  invalidMsg = signal('');
  editVer = signal(0);
  editingRowIndex = signal<any>(null);
  rowDraft = signal({});
  rangeAnchor = signal<any>(null);
  rangeFocus = signal<any>(null);
  pasteAnnounce = signal('');
  __rozieRoot = viewChild<ElementRef<HTMLDivElement>>('__rozieRoot');
  sortChange = output<unknown>({ alias: 'sort-change' });
  expandChange = output<unknown>({ alias: 'expand-change' });
  groupChange = output<unknown>({ alias: 'group-change' });
  filterChange = output<unknown>({ alias: 'filter-change' });
  pageChange = output<unknown>({ alias: 'page-change' });
  selectionChange = output<unknown>({ alias: 'selection-change' });
  visibilityChange = output<unknown>({ alias: 'visibility-change' });
  resizeChange = output<unknown>({ alias: 'resize-change' });
  reorderChange = output<unknown>({ alias: 'reorder-change' });
  pinChange = output<unknown>({ alias: 'pin-change' });
  activecellChange = output<unknown>({ alias: 'activecell-change' });
  rangeChange = output<unknown>({ alias: 'range-change' });
  cellEditCommit = output<unknown>({ alias: 'cell-edit-commit' });
  rowEditCommit = output<unknown>({ alias: 'row-edit-commit' });
  @ContentChild('defaultSlot', { read: TemplateRef }) defaultTpl?: TemplateRef<DefaultCtx>;
  @ContentChild('groupBar', { read: TemplateRef }) groupBarTpl?: TemplateRef<GroupBarCtx>;
  @ContentChild('selectAll', { read: TemplateRef }) selectAllTpl?: TemplateRef<SelectAllCtx>;
  @ContentChild('colHeader', { read: TemplateRef }) colHeaderTpl?: TemplateRef<ColHeaderCtx>;
  @ContentChild('filter', { read: TemplateRef }) filterTpl?: TemplateRef<FilterCtx>;
  @ContentChild('selectCell', { read: TemplateRef }) selectCellTpl?: TemplateRef<SelectCellCtx>;
  @ContentChild('editor', { read: TemplateRef }) editorTpl?: TemplateRef<EditorCtx>;
  @ContentChild('cell', { read: TemplateRef }) cellTpl?: TemplateRef<CellCtx>;
  @ContentChild('detail', { read: TemplateRef }) detailTpl?: TemplateRef<DetailCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private __rozieWatchInitial_0 = true;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      if (this.virtualizerCleanup) this.virtualizerCleanup();
      // CR-04: remove any live fill-drag document listeners if we unmount mid-drag.
      this.teardownFillDrag();
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
    effect(() => { const __watchVal = (() => [this.sorting(), this.globalFilter(), this.columnFilters(), this.pagination(), this.rowSelection(), this.expanded(), this.expandable(), this.grouping(), this.groupable(), this.columnVisibility(), this.columnSizing(), this.columnOrder(), this.columnPinning(), this.selectionMode(), (this.data() || []).length,
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
    const __getSubRows = this.getSubRows();
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
      // Expandable rows (phase 50, D-04): the expanded row model is supplied UNCONDITIONALLY
      // (mirrors the other models) — inert when `expanded` is empty + no getSubRows
      // (byte-identical-off, req-10). getSubRows is the TABLE-level child accessor (NOT a
      // ColumnDef field). getRowCanExpand makes EVERY row expandable for the #detail seam
      // (no subRows to gate on); when getSubRows IS supplied, leave it undefined so the
      // default `!!subRows.length` rule applies (only parents with children expand).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (__getSubRows || undefined) as any,
      getRowCanExpand: this.expandable() === true && __getSubRows == null ? () => true : undefined,
      onExpandedChange: this.onExpandedChangeCb,
      // Grouping auto-expand (phase 50 req-4): table-core's autoResetExpanded defaults TRUE, so a
      // POST-MOUNT setGrouping (the consumer #groupBar / applyGrouping verb) auto-fires
      // onExpandedChange({}) to reset the expanded set. That spurious reset funnels through
      // writeExpanded and would LATCH expandedTouched=true — defeating the grouping auto-expand
      // default (currentState().expanded would fall back to {} → nested group subtrees collapsed).
      // Disabling it makes post-mount grouping behave like initial grouping (subtrees auto-expanded
      // until the FIRST real user toggle). Inert for the plain/expand-only table (no grouping/sort/
      // filter mutation triggers an auto-reset there); explicit expandAll/collapseAll/toggle verbs
      // are unaffected (they fire regardless of this flag).
      autoResetExpanded: false,
      // Grouping (phase 50 reqs 4-7, D-04/D-05): the grouped row model is supplied
      // UNCONDITIONALLY (mirrors the expand model) — inert when `grouping` is empty
      // (byte-identical-off, req-10). When `grouping` is a non-empty ordered key list,
      // table-core FLATTENS group-header rows (carrying getIsGrouped()/subRows) and their
      // members into getRowModel().rows, so they ride the SAME D-04 <template r-for> seam (no
      // nested r-for — Pitfall 1). Group rows are expandable via the EXISTING expanded model
      // (getRowCanExpand default `!!subRows.length`), so collapsing a group hides its subtree.
      getGroupedRowModel: getGroupedRowModel(),
      onGroupingChange: this.onGroupingChangeCb,
      // Faceted filtering (phase 50 reqs 8-9, D-03): the 3 faceted models are supplied
      // UNCONDITIONALLY (mirrors the expand/group models) — INERT until a consumer reads a
      // column facet (the getFaceted* verbs / #filter slot), so byte-identical-off holds (req-10).
      // The default getFacetedUniqueValues/getFacetedMinMaxValues impls are cross-filtered (D-03).
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: makeFacetedUniqueValues(),
      getFacetedMinMaxValues: makeFacetedMinMaxValues(),
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
      // B8/B23: pass the FRESH bounds derived from `nextRows` (NOT $data.rows, which is the
      // async-stale useState snapshot on React) so a filter-to-fewer clamps the active cell AND
      // the range corners on React too — never re-reading the pre-change model.
      const nextRowCount = nextRows.length;
      const nextColCount = nextRows.length ? nextRows[0].getVisibleCells().length : nextGroups.length ? (nextGroups[nextGroups.length - 1].headers || []).length : 0;
      this.clampActiveCell(nextRowCount, nextColCount);
      // B23: a just-committed single-cell edit may have RELOCATED its row under an active sort/
      // filter. `nextRows` is the FRESH visible model (its index space == the rendered data-row
      // indices), so resolve the committed row's NEW index by identity HERE (never from the React-
      // stale state) and re-seat focus on that cell via the DOM-only poll (focusCellWhenReady reads
      // gridRoot only → React-safe). Consumed ONCE (cleared) so a multi-render re-feed focuses once;
      // a no-relocation commit resolves the same index → byte-behaviorally identical to before.
      if (this.pendingEditFollow && this.isGrid()) {
        const follow = this.pendingEditFollow;
        this.pendingEditFollow = null;
        const followIdx = this.indexOfRowIn(nextRows, follow.rowOriginal, follow.rowId);
        if (followIdx >= 0) this.focusCellWhenReady(followIdx, follow.col);
      }
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
  expandedTouched = false;
  groupingActiveDefault = () => ((this.grouping() != null ? this.grouping() : this.groupingDefault()) || []).length > 0;
  currentState = (): any => ({
    sorting: this.sorting() != null ? this.sorting() : this.sortingDefault(),
    globalFilter: this.globalFilter() != null ? this.globalFilter() : this.globalFilterDefault(),
    columnFilters: this.columnFilters() != null ? this.columnFilters() : this.columnFiltersDefault(),
    pagination: this.pagination() != null ? this.pagination() : this.paginationDefault(),
    rowSelection: this.rowSelection() != null ? this.rowSelection() : this.rowSelectionDefault(),
    // expanded (phase 50 req-1/3): ExpandedState ({ [rowId]: true } | the `true` expand-all
    // literal). Passed to table-core verbatim — never Object.keys'd without a `=== true`
    // guard (Pitfall 2). Falls back to $data.expandedDefault when r-model:expanded is unbound.
    // GROUPING AUTO-EXPAND (req-4): when grouping is active and the consumer has neither bound
    // `expanded` nor toggled a group yet (!expandedTouched), default to the `true` expand-all
    // literal so the grouped subtree is visible by default; the first toggle latches
    // expandedTouched and the user's expanded state wins thereafter. Non-grouping path is
    // unchanged → byte-identical-off (the table + the expandable-rows feature both keep
    // $data.expandedDefault).
    expanded: this.expanded() != null ? this.expanded() : this.groupingActiveDefault() && !this.expandedTouched ? true : this.expandedDefault(),
    // grouping (phase 50 reqs 4-7): GroupingState = ordered string[] of column ids. Falls back
    // to $data.groupingDefault when r-model:grouping is unbound. table-core's getGroupedRowModel
    // is inert when this is empty (byte-identical-off, req-10).
    grouping: this.grouping() != null ? this.grouping() : this.groupingDefault(),
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
  wrapAggregationFn = (fn: any) => {
    if (typeof fn === 'string') return fn;
    if (typeof fn !== 'function') return undefined;
    return (columnId: any, leafRows: any, childRows: any) => {
      try {
        return fn(columnId, leafRows, childRows);
      } catch (err: any) {
        return undefined;
      }
    };
  };
  buildConfigDef = (c: any) => {
    if (!c) return null;
    // Grouped (multi-level) header column: an entry carrying a `columns` array. table-core's
    // getHeaderGroups() yields ONE extra header-row level per group depth — the parent group
    // header spans its leaf children (B12). The group id falls back to its header text so it
    // stays addressable (no accessor; group columns carry no data).
    if (Array.isArray(c.columns)) {
      const gid = c.id != null ? c.id : c.header;
      if (gid == null) return null;
      const id = String(gid);
      if (!this.isSafeKey(id)) return null;
      const kids = [];
      for (const child of c.columns as any) {
        const cd = this.buildConfigDef(child);
        if (cd) kids.push(cd);
      }
      if (!kids.length) return null;
      return {
        id,
        header: c.header != null ? c.header : id,
        columns: kids
      };
    }
    const rawId = c.id != null ? c.id : c.field;
    if (rawId == null) return null;
    const id = String(rawId);
    if (!this.isSafeKey(id)) return null;
    return {
      id,
      accessorKey: c.field != null ? c.field : id,
      header: c.header != null ? c.header : id,
      enableSorting: c.sortable === true,
      // per-column filter opt-in (req-5). table-core gates the filter input + value
      // funnel on enableColumnFilter; a column with filterable !== true cannot be
      // filtered (and renders no per-column filter input in the chrome below).
      enableColumnFilter: c.filterable === true,
      filterable: c.filterable === true,
      // Expandable-rows reserved per-column metadata (phase 50, D-04).
      expandable: c.expandable === true,
      // Grouping (phase 50 reqs 4-7): groupable defaults TRUE (opt-OUT via groupable:false)
      // so every data column is offered to the headless #groupBar by default; the per-column
      // aggregationFn (built-in name OR custom fn) flows straight onto the ColumnDef (D-05),
      // a custom fn defensively wrapped (T-50-04).
      groupable: c.groupable !== false,
      aggregationFn: this.wrapAggregationFn(c.aggregationFn),
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
  };
  columnDefs = () => {
    const byId = Object.create(null);
    const order = [];
    const cfg = this.columns() || [];
    for (const c of cfg as any) {
      const def = this.buildConfigDef(c);
      if (!def) continue;
      const id = def.id;
      if (!(id in byId)) order.push(id);
      byId[id] = def;
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
        // Expandable-rows reserved per-column metadata (phase 50, D-04).
        expandable: spec.expandable === true,
        // Grouping (phase 50 reqs 4-7) — same shape as the config branch (D-05 / T-50-04).
        groupable: spec.groupable !== false,
        aggregationFn: this.wrapAggregationFn(spec.aggregationFn),
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
  EXPANDER_COL_ID = '__rdt_expander';
  selectionEnabled = () => this.selectionMode() === 'single' || this.selectionMode() === 'multiple';
  tableColumns = () => {
    const cols = this.columnDefs();
    // Expander column (phase 50, D-04): injected LEADING when expandable, carrying an
    // isExpanderColumn marker the template uses to render the chevron toggle (NOT an accessor
    // value). enableSorting/enableColumnFilter:false (it is chrome, not data). Off by default
    // → byte-identical-off (req-10).
    let withExpander = cols;
    if (this.expandable() === true) {
      const expanderCol = {
        id: this.EXPANDER_COL_ID,
        enableSorting: false,
        enableColumnFilter: false,
        filterable: false,
        isExpanderColumn: true,
        pinned: '',
        width: ''
      };
      withExpander = [expanderCol].concat(cols);
    }
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
      return [selectCol].concat(withExpander);
    }
    return withExpander;
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
  writeExpanded = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    // Latch the grouping auto-expand default (req-4): the FIRST expand/collapse toggle means
    // the user now owns the expanded state, so currentState() stops defaulting grouped rows to
    // the `true` expand-all literal and honors $data.expandedDefault from here on.
    this.expandedTouched = true;
    this.expandedDefault.set(next); // fresh value only (never in-place)
    this.expanded.set(next); // two-way emit if bound (no-op-diff if not)
    // Event stem is `expand-change`, NOT `expanded-change`: the model:true `expanded`
    // prop auto-generates an `onExpandedChange` callback on the React/Solid flat Props
    // interface, and an `expanded-change` event would camelCase to the SAME identifier
    // → duplicate-identifier TS2300 (the model-prop==emit-name collision class). Every
    // sibling slice avoids this by stemming the event off a DISTINCT name (sorting→
    // sort-change, rowSelection→selection-change); `expanded`→`expand-change` follows suit.
    this.expandChange.emit(next);
    this.programmatic--;
  };
  writeGrouping = (next: any) => {
    if (this.programmatic) return;
    this.programmatic++;
    this.groupingDefault.set(next); // fresh ordered array only (never in-place push)
    this.grouping.set(next); // two-way emit if bound (no-op-diff if not)
    this.groupChange.emit(next);
    this.programmatic--;
  };
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
  onExpandedChangeCb = (updater: any) => {
    this.writeExpanded(this.applyUpdater(updater, this.currentState().expanded));
  };
  onGroupingChangeCb = (updater: any) => {
    this.writeGrouping(this.applyUpdater(updater, this.currentState().grouping));
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
  pinnedEditIndex = () => {
    const __editingRow = this.editingRow();
    const __editingRowIndex = this.editingRowIndex();
    if (__editingRow >= 0) return __editingRow;
    if (__editingRowIndex != null) return __editingRowIndex;
    return -1;
  };
  pinnedMeasurement = (pin: any) => {
    if (!this.virtualizer || pin < 0) return null;
    const ms = this.virtualizer.getMeasurements();
    return ms && ms[pin] ? ms[pin] : null;
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
    // ALSO subscribe to editVer here so the slice re-derives when an editor opens/closes (the
    // pin/unpin transition), mirroring the probe's windowVer bump on pin (Solid/Svelte fine-grained).
    void this.windowVer();
    void this.editVer();
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
    const out = items.map((vi: any) => ({
      vi,
      row: rowList[vi.index]
    })).filter((wr: any) => wr.row);
    // ── D-02 pin-row union (req-9): if an editor is open on a row that is NOT in the current
    // window, UNION it into the slice (keyed on row.id so Lit repeat / Solid For never recycle it
    // into another full-model row), LEADING the slice when it sits above the window and TRAILING
    // it when below — so DOM order matches visual/aria order. The spacer subtraction (padTop/
    // padBottom) keeps the total exactly getTotalSize(). This is the 51-01-proven mechanism wired
    // into the real windowing.
    const pin = this.pinnedEditIndex();
    if (pin >= 0 && rowList[pin]) {
      let inWindow = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].index === pin) {
          inWindow = true;
          break;
        }
      }
      if (!inWindow) {
        const pm = this.pinnedMeasurement(pin);
        const firstStart = items.length ? items[0].start : 0;
        const above = pm ? pm.start < firstStart : pin < (items.length ? items[0].index : pin);
        const pinnedEntry = {
          vi: pm != null ? pm : {
            index: pin
          },
          row: rowList[pin],
          pinned: true
        };
        if (above) out.unshift(pinnedEntry);else out.push(pinnedEntry);
      }
    }
    return out;
  };
  padTop = () => {
    // SUBSCRIBE FIRST (the windowedRows() discipline): touch windowVer + editVer at the TOP so the
    // spacer-<td> :style binding subscribes on the fine-grained targets before the early return,
    // and re-derives on the pin/unpin transition (the D-02 spacer subtraction below).
    void this.windowVer();
    void this.editVer();
    if (!this.virtual() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    let pad = items.length ? items[0].start : 0;
    // D-02 spacer subtraction: when the pinned editing row sits ABOVE the window it is rendered
    // in-flow as the slice's LEADING <tr> (its measured height is now a real <tr>), so subtract
    // that height from the leading spacer to keep padTop + Σ rendered <tr> + padBottom = total.
    const pin = this.pinnedEditIndex();
    if (pin >= 0) {
      const pm = this.pinnedMeasurement(pin);
      const inWindow = this.pmIndexInWindow(items, pin);
      if (pm && !inWindow && pm.start < pad) pad = pad - pm.size;
    }
    return pad < 0 ? 0 : pad;
  };
  padBottom = () => {
    // subscribe-first, see windowedRows() (IN-04): touch windowVer + editVer before the early
    // return so the fine-grained spacer :style binding subscribes on its first eval + re-derives
    // on pin/unpin.
    void this.windowVer();
    void this.editVer();
    if (!this.virtual() || !this.virtualizer) return 0;
    const items = this.virtualizer.getVirtualItems();
    if (!items.length) return 0;
    let pad = this.virtualizer.getTotalSize() - items[items.length - 1].end;
    // D-02 spacer subtraction: when the pinned editing row sits BELOW the window it is rendered
    // in-flow as the slice's TRAILING <tr>, so subtract its height from the trailing spacer.
    const pin = this.pinnedEditIndex();
    if (pin >= 0) {
      const pm = this.pinnedMeasurement(pin);
      const inWindow = this.pmIndexInWindow(items, pin);
      // WR-01: decide "below the window" by INDEX, not by start-OFFSET. On variable-height rows
      // measurement drift can leave pm.start at-or-past items[0].start while the pinned row's
      // index is actually ABOVE the window, mis-subtracting its height from the trailing spacer.
      // The pinned full-model index vs the last rendered item's index is drift-proof. Fall back to
      // the offset comparison only if the measurement lacks an index (defensive).
      const lastItemIdx = items[items.length - 1].index;
      const below = pm && pm.index != null ? pm.index > lastItemIdx : pm && pm.start >= items[0].start;
      if (pm && !inWindow && below) {
        // below the window → it trailed the slice; subtract its height from the trailing spacer.
        if (pm.end > items[items.length - 1].end) pad = pad - pm.size;
      }
    }
    return pad < 0 ? 0 : pad;
  };
  pmIndexInWindow = (items: any, idx: any) => {
    for (let i = 0; i < items.length; i++) if (items[i].index === idx) return true;
    return false;
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
      // Re-pass the expand model fns + callback (Pitfall 4 — virtual-core/table-core's
      // setOptions REPLACES, so an omitted fn would drop the model on re-feed; on React the
      // onExpandedChange callback must re-capture fresh currentState each cycle, F6).
      getExpandedRowModel: getExpandedRowModel(),
      getSubRows: (this.getSubRows() || undefined) as any,
      getRowCanExpand: this.expandable() === true && this.getSubRows() == null ? () => true : undefined,
      onExpandedChange: this.onExpandedChangeCb,
      // Grouping auto-expand (phase 50 req-4): table-core's autoResetExpanded defaults TRUE, so a
      // POST-MOUNT setGrouping (the consumer #groupBar / applyGrouping verb) auto-fires
      // onExpandedChange({}) to reset the expanded set. That spurious reset funnels through
      // writeExpanded and would LATCH expandedTouched=true — defeating the grouping auto-expand
      // default (currentState().expanded would fall back to {} → nested group subtrees collapsed).
      // Disabling it makes post-mount grouping behave like initial grouping (subtrees auto-expanded
      // until the FIRST real user toggle). Inert for the plain/expand-only table (no grouping/sort/
      // filter mutation triggers an auto-reset there); explicit expandAll/collapseAll/toggle verbs
      // are unaffected (they fire regardless of this flag).
      autoResetExpanded: false,
      // Re-pass the grouped row model + callback (Pitfall 4 — setOptions REPLACES, so an
      // omitted fn would drop the model on re-feed; on React onGroupingChange must re-capture
      // fresh currentState each cycle, F6).
      getGroupedRowModel: getGroupedRowModel(),
      onGroupingChange: this.onGroupingChangeCb,
      // Re-pass the 3 faceted models (Pitfall 4 — setOptions REPLACES, so an omitted fn would
      // drop the model on re-feed; on React the faceted closures must re-capture so exposed
      // unique values + min/max update when an upstream filter changes, F6 / req-8 cross-filter).
      getFacetedRowModel: getFacetedRowModel(),
      getFacetedUniqueValues: makeFacetedUniqueValues(),
      getFacetedMinMaxValues: makeFacetedMinMaxValues(),
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
  isExpanderColumn = (colId: any) => colId === this.EXPANDER_COL_ID;
  rowCanExpand = (row: any) => !!(this.tick() >= 0 && row && row.getCanExpand && row.getCanExpand());
  rowIsExpanded = (row: any) => !!(this.tick() >= 0 && row && row.getIsExpanded && row.getIsExpanded());
  rowShowsDetail = (row: any) => this.getSubRows() == null && this.rowIsExpanded(row);
  onToggleExpand = (row: any, evt: any) => {
    if (!row || !row.toggleExpanded) return;
    // Capture the owning row element BEFORE the toggle so DOM focus can be restored after the
    // expanded-state re-render. On Solid the expander <td>/<button> is RECREATED on that
    // re-render (the reference-keyed cell <For> receives fresh table-core cell instances each
    // pull — the <tr> persists but its cells are rebuilt), which drops DOM focus to <body> and
    // breaks keyboard activation (Enter/Space on the focused expander leaves nothing focused).
    // Re-focusing the (possibly-recreated) expander in the SAME row keeps the control focused —
    // the focusActiveCell imperative-refocus precedent. The rAF defers past the synchronous
    // reactive flush so the fresh node exists. Harmless on the targets that keep the node
    // (Vue/React/Svelte/Angular/Lit re-focus the same element → no-op).
    const ownerRow = evt && evt.currentTarget && evt.currentTarget.closest ? evt.currentTarget.closest('tr') : null;
    row.toggleExpanded();
    if (ownerRow && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        const btn = ownerRow.querySelector('[data-expander]');
        if (btn) btn.focus();
      });
    }
  };
  bodyCellStyle = (row: any, colId: any) => {
    const base = this.pinStyle(colId);
    if (this.isExpanderColumn(colId) && row && row.depth) {
      const pad = 'padding-left:' + (0.5 + row.depth * 1.25) + 'rem';
      return base ? base + ';' + pad : pad;
    }
    return base;
  };
  rowIsGrouped = (row: any) => !!(this.tick() >= 0 && row && row.getIsGrouped && row.getIsGrouped());
  groupingActive = () => this.tick() >= 0 && (this.currentState().grouping || []).length > 0;
  cellIsGrouped = (cellCtx: any) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsGrouped && cellCtx.getIsGrouped());
  cellIsAggregated = (cellCtx: any) => !!(this.tick() >= 0 && cellCtx && cellCtx.getIsAggregated && cellCtx.getIsAggregated());
  groupSubRowCount = (row: any) => row && row.subRows ? row.subRows.length : 0;
  groupingKeys = () => this.currentState().grouping || [];
  groupableColumns = () => {
    const out = [];
    const defs = this.columnDefs();
    for (const d of defs as any) {
      if (!d || d.groupable === false) continue;
      out.push({
        id: d.id,
        label: d.header != null ? d.header : d.id
      });
    }
    return out;
  };
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
  cellTabindex = (rowKey: any, colIndex: any, level: any = null) => {
    const __activeColIndex = this.activeColIndex();
    if (!this.isGrid()) return null;
    // B6: an empty / all-filtered grid (no body rows) must STILL be keyboard-reachable. Fall
    // the single roving tab-stop back to the FIRST leaf-header cell so the grid never has ZERO
    // tab-stops (a keyboard trap). Only the leaf-level header col 0 carries the tab-stop.
    if (this.bodyRowCount() === 0) {
      return rowKey === '__header' && colIndex === 0 && level === this.headerLeafLevel() ? 0 : -1;
    }
    // B12: when a header cell is active, address it by BOTH its level AND its colIndex so a
    // grouped multi-level header carries exactly ONE tab-stop. The pre-fix level-blind compare
    // lit BOTH the parent (level 0) and the leaf (level 1) at the same colIndex → multiple
    // tab-stops (the roving invariant broke under grouped headers).
    if (this.activeIsHeader()) {
      if (rowKey !== '__header') return -1;
      return colIndex === __activeColIndex && level === this.activeHeaderLevel() ? 0 : -1;
    }
    const isActive = rowKey === String(this.activeRow()) && colIndex === __activeColIndex;
    return isActive ? 0 : -1;
  };
  resolveCellEl = (rowKey: any, colIndex: any, level: any = null) => {
    if (!this.gridRoot) return null;
    // B12: a grouped multi-level header has MULTIPLE cells sharing data-row="__header" at the
    // same data-col-index across levels (parent vs leaf). Disambiguate header lookups by the
    // integer data-header-level so resolveCellEl('__header', 0) no longer returns the FIRST DOM
    // match (the parent) when the leaf is meant. level is an integer (NO consumer string is
    // interpolated — T-49-01 stays safe); body lookups pass level=null → the selector is
    // byte-unchanged.
    let sel = '[data-grid-cell][data-row="' + rowKey + '"][data-col-index="' + colIndex + '"]';
    if (rowKey === '__header' && level != null) sel = sel + '[data-header-level="' + level + '"]';
    return this.gridRoot.querySelector(sel);
  };
  focusActiveCell = (nextRow: any = null, nextCol: any = null, nextIsHeader: any = null, nextLevel: any = null) => {
    if (!this.isGrid() || !this.gridRoot) return;
    const r = nextRow == null ? this.activeRow() : nextRow;
    const c = nextCol == null ? this.activeColIndex() : nextCol;
    // B12: thread the FRESH post-write header level (the grouped-header analog of the
    // nextIsHeader threading) so a leaf↔parent header move resolves the cell at the correct
    // level, never the async-stale $data.activeHeaderLevel re-read (React ROZ138 / Angular signal).
    const lvl = nextLevel == null ? this.activeHeaderLevel() : nextLevel;
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
    const el = this.resolveCellEl(rowKey, c, header ? lvl : null);
    if (el) el.focus();
  };
  totalRowCount = () => {
    const __rows = this.rows();
    if (!this.table) return (__rows || []).length;
    const fm = this.table.getFilteredRowModel();
    return fm && fm.rows ? fm.rows.length : (__rows || []).length;
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
  headerLeafLevel = () => {
    const hg = this.headerGroups() || [];
    return hg.length ? hg.length - 1 : 0;
  };
  headerAt = (level: any, colIndex: any) => {
    const hg = this.headerGroups() || [];
    const grp = hg[level];
    if (!grp || !grp.headers) return null;
    return grp.headers[colIndex] || null;
  };
  parentHeaderColIndex = (level: any, colIndex: any) => {
    if (level <= 0) return -1;
    const h = this.headerAt(level, colIndex);
    if (!h || !h.column || !h.column.parent) return -1;
    const parentId = h.column.parent.id;
    const hg = this.headerGroups() || [];
    const pg = hg[level - 1];
    if (!pg || !pg.headers) return -1;
    for (let i = 0; i < pg.headers.length; i++) {
      const ph = pg.headers[i];
      if (ph && ph.column && ph.column.id === parentId) return i;
    }
    return -1;
  };
  firstChildHeaderColIndex = (level: any, colIndex: any) => {
    const h = this.headerAt(level, colIndex);
    if (!h || !h.column) return -1;
    const kids = h.column.columns || [];
    if (!kids.length) return -1;
    const childId = kids[0].id;
    const hg = this.headerGroups() || [];
    const cg = hg[level + 1];
    if (!cg || !cg.headers) return -1;
    for (let i = 0; i < cg.headers.length; i++) {
      const ch = cg.headers[i];
      if (ch && ch.column && ch.column.id === childId) return i;
    }
    return -1;
  };
  moveCol = (delta: any) => {
    const max = this.visibleColCount() - 1;
    const nextCol = this.clamp(this.activeColIndex() + delta, 0, max < 0 ? 0 : max);
    this.activeColIndex.set(nextCol);
    return nextCol;
  };
  moveRow = (delta: any) => {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const leafLevel = this.headerLeafLevel();
    if (this.activeIsHeader()) {
      if (delta > 0) {
        // B12 — Down: from a PARENT header level, descend to its FIRST child leaf header (one
        // level down); from the LEAF header level, drop into the body (row 0).
        if (this.activeHeaderLevel() < leafLevel) {
          const childCol = this.firstChildHeaderColIndex(this.activeHeaderLevel(), this.activeColIndex());
          if (childCol >= 0) {
            const nextLevel = this.activeHeaderLevel() + 1;
            this.activeHeaderLevel.set(nextLevel);
            this.activeColIndex.set(childCol);
            return {
              row: this.activeRow(),
              isHeader: true,
              level: nextLevel
            };
          }
        }
        // At the leaf header: an empty grid has no body to drop into → stay put.
        if (this.bodyRowCount() === 0) return {
          row: this.activeRow(),
          isHeader: true,
          level: this.activeHeaderLevel()
        };
        this.activeIsHeader.set(false);
        this.activeRow.set(0);
        return {
          row: 0,
          isHeader: false,
          level: 0
        };
      }
      // B12 — Up: from the leaf (or any non-top) header level, ascend to the PARENT header that
      // spans the active column; at the top level (or no real parent) stay put.
      const parentCol = this.parentHeaderColIndex(this.activeHeaderLevel(), this.activeColIndex());
      if (parentCol >= 0) {
        const nextLevel = this.activeHeaderLevel() - 1;
        this.activeHeaderLevel.set(nextLevel);
        this.activeColIndex.set(parentCol);
        return {
          row: this.activeRow(),
          isHeader: true,
          level: nextLevel
        };
      }
      return {
        row: this.activeRow(),
        isHeader: true,
        level: this.activeHeaderLevel()
      };
    }
    // In the body: an upward move from row 0 crosses into the LEAF header level (the header row
    // adjacent to the body). The body col index aligns 1:1 with the leaf header col index, so
    // activeColIndex carries over unchanged.
    if (delta < 0 && this.activeRow() === 0) {
      this.activeIsHeader.set(true);
      this.activeHeaderLevel.set(leafLevel);
      return {
        row: this.activeRow(),
        isHeader: true,
        level: leafLevel
      };
    }
    const nextRow = this.clamp(this.activeRow() + delta, 0, maxRow);
    this.activeRow.set(nextRow);
    this.activeIsHeader.set(false);
    return {
      row: nextRow,
      isHeader: false,
      level: 0
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
    const __activeIsHeader = this.activeIsHeader();
    const rowKey = __activeIsHeader ? '__header' : String(this.activeRow());
    return this.resolveCellEl(rowKey, this.activeColIndex(), __activeIsHeader ? this.activeHeaderLevel() : null);
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
    const __activeIsHeader = this.activeIsHeader();
    if (!this.isGrid() || !e) return;
    const key = e.key;
    // Editing mode (phase 51, Pitfall 5): an OPEN editor owns Tab/Enter/Escape (+ caret keys)
    // via its local onEditorKeyDown handler. This top check (BEFORE activeInControl) returns
    // early so the grid nav keymap never hijacks an arrow/Tab/Enter while editing — the three
    // modes (editing / in-control / navigation) stay mutually exclusive and ordered.
    if (this.editingRow() >= 0) return;
    // Full-row edit (phase 51 req-6): an OPEN row editor owns Enter/Escape/Tab via the cell
    // editors' local onEditorKeyDown. Return early (before activeInControl) so the grid nav
    // keymap never hijacks while a row is in edit — the three modes stay mutually exclusive.
    if (this.editingRowIndex() != null) return;
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
    const prevIsHeader = __activeIsHeader;
    const prevLevel = this.activeHeaderLevel();
    let nextRow = prevRow;
    let nextCol = prevCol;
    let nextIsHeader = prevIsHeader;
    // B12: the fresh post-write header LEVEL (the grouped-header analog of nextIsHeader) is
    // threaded into the focus seam so a leaf↔parent header move lands focus at the correct
    // level. moveRow returns it; the non-vertical branches keep the pre-move level.
    let nextLevel = prevLevel;
    // ── Cell-range extend (phase 51 req-7 / D-07) — Shift+Arrow extends the rectangle from
    // the active cell's leading edge. Tested BEFORE the plain arrows (a Shift+Arrow must NOT
    // fall through to a plain navigation move). Body cells only (no range from a header). The
    // extendRange call owns focus + the range-change emit, so return immediately. ──────────
    if (key === 'ArrowRight' && e.shiftKey && !__activeIsHeader) {
      e.preventDefault();
      this.extendRange(0, 1);
      return;
    } else if (key === 'ArrowLeft' && e.shiftKey && !__activeIsHeader) {
      e.preventDefault();
      this.extendRange(0, -1);
      return;
    } else if (key === 'ArrowDown' && e.shiftKey && !__activeIsHeader) {
      e.preventDefault();
      this.extendRange(1, 0);
      return;
    } else if (key === 'ArrowUp' && e.shiftKey && !__activeIsHeader) {
      e.preventDefault();
      this.extendRange(-1, 0);
      return;
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      this.clearRange();
      nextCol = this.moveCol(1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      this.clearRange();
      nextCol = this.moveCol(-1);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      this.clearRange();
      const m = this.moveRow(1);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      this.clearRange();
      const m = this.moveRow(-1);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'PageDown') {
      e.preventDefault();
      const m = this.moveRow(this.GRID_PAGE_STEP);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
    } else if (key === 'PageUp') {
      e.preventDefault();
      const m = this.moveRow(-this.GRID_PAGE_STEP);
      nextRow = m.row;
      nextIsHeader = m.isHeader;
      nextLevel = m.level;
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
    // ── Clipboard (phase 51 req-8 / D-03) — Ctrl/Cmd+C copies the range as TSV; Ctrl/Cmd+V
    // pastes TSV into the range under the D-03 skip rule. Placed BEFORE the printable-key
    // edit-entry branch (which excludes ctrl/meta) so the shortcuts are never swallowed as a
    // type-to-edit char. Copy/paste act on the whole range (or the single active cell). B11:
    // gated by clipboardActiveAllowed() (== !activeIsHeader) so a header-active Ctrl+C/Ctrl+V
    // falls through to NATIVE behavior — never preventDefault'd, never a silent body mutation
    // (copyRange/pasteRange also self-guard; the verb guard is what plan 63-09's Cut reuses). ──
    else if ((key === 'c' || key === 'C') && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed()) {
      e.preventDefault();
      this.copyRange();
      return;
    } else if ((key === 'v' || key === 'V') && (e.ctrlKey || e.metaKey) && this.clipboardActiveAllowed()) {
      e.preventDefault();
      this.pasteRange();
      return;
    }
    // ── Full-row edit entry (phase 51 req-6 / D-06) — Shift+F2 on an editable active cell puts
    // EVERY editable cell in the active row into edit at once. Tested BEFORE the plain F2 branch
    // (a Shift+F2 must NOT fall through to single-cell F2). Shift+F2 was chosen for the lowest
    // collision risk against the Phase-49 keymap. Gated by isActiveCellEditable() (the row has
    // at least the active editable column); a non-editable active cell falls through unchanged.
    else if (key === 'F2' && e.shiftKey && this.isActiveCellEditable()) {
      e.preventDefault();
      this.beginRowEdit((this.rows() || [])[__activeRow]);
      return;
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
      // B24: a printable key only SEEDS a draft on a free-text editor (text/number). A
      // checkbox/select/date editor must NOT take the typed char as its value (it would
      // force-check the checkbox, seed a garbage select option, or corrupt the date) — open
      // those with the EXISTING value (seed=null), identical to the F2/Enter in-place entry.
      e.preventDefault();
      const editType = this.editorTypeOf(this.activeCellColumnId());
      const seed = editType === 'text' || editType === 'number' ? key : null;
      this.beginEdit(__activeRow, __activeColIndex, seed);
      return;
    } else if (key === 'Enter' || key === 'F2') {
      e.preventDefault();
      this.enterControl();
      return;
    } else return;
    // THE seam — built from the SAME fresh post-write locals (Pitfall 2). Always re-assert
    // focus on the resolved cell (harmless on a no-op clamp; corrects any drift otherwise).
    this.focusActiveCell(nextRow, nextCol, nextIsHeader, nextLevel);
    // WR-06: the D-02 activecell-change event fires ONLY when the resolved cell actually
    // changed. A clamped no-op edge move (ArrowLeft at col 0, ArrowDown at the page-last
    // row, …) leaves the indices identical → no spurious emit (a no-op is not a navigation).
    // B12: a header-LEVEL move (leaf↔parent, same colIndex) is a real navigation too.
    if (nextRow !== prevRow || nextCol !== prevCol || nextIsHeader !== prevIsHeader || nextLevel !== prevLevel) {
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
    if (isHeader) {
      // B12: a click/focus onto a grouped header cell must capture its header LEVEL too, so the
      // roving model + a subsequent ArrowUp/ArrowDown resolve from the correct level (not a stale
      // one). data-header-level is an integer marker on the <th>; fall back to the leaf level.
      const lvlAttr = cellEl.getAttribute('data-header-level');
      const lvl = lvlAttr != null ? parseInt(lvlAttr, 10) : this.headerLeafLevel();
      this.activeHeaderLevel.set(Number.isFinite(lvl) ? lvl : this.headerLeafLevel());
    } else {
      const row = parseInt(rowAttr, 10);
      if (Number.isFinite(row)) this.activeRow.set(row);
    }
    this.activeColIndex.set(col);
    // A plain focus collapses any range back to the single active cell — EXCEPT (a) the
    // programmatic settle of an in-flight extendRange (rangeTransition): that focus move lands
    // ON the new range-focus corner and must NOT wipe the range we just set; and (b) the
    // focusin that follows a Shift+Click (rangeClickPending): @mousedown already set the range
    // BEFORE this focusin fires, and a focusin carries no reliable shiftKey, so the @mousedown
    // path owns the shift case and flags it here so the collapse is skipped.
    if (this.rangeTransition) {
      this.rangeTransition = false;
    } else if (this.rangeClickPending) {
      this.rangeClickPending = false;
    } else {
      this.clearRange();
    }
    // The cell box (not an inner control) receiving focus = navigation mode.
    if (tgt === cellEl) this.activeInControl.set(false);
  };
  onGridMouseDown = (e: any) => {
    if (!this.isGrid() || !e || !e.shiftKey) return;
    const tgt = e.target;
    if (!tgt || !tgt.closest) return;
    const cellEl = tgt.closest('[data-grid-cell]');
    if (!cellEl) return;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null || rowAttr === '__header') return;
    const row = parseInt(rowAttr, 10);
    const col = parseInt(colAttr, 10);
    if (!Number.isFinite(row) || !Number.isFinite(col)) return;
    this.setRangeFocus(row, col);
    this.activeIsHeader.set(false);
    this.activeRow.set(row);
    this.activeColIndex.set(col);
    this.rangeClickPending = true;
  };
  onGridFocusOut = (e: any) => {
    if (!this.isGrid() || !this.activeInControl()) return;
    const next = e ? e.relatedTarget : null;
    const cellEl = this.currentCellEl();
    if (!cellEl || !next || !cellEl.contains(next)) this.activeInControl.set(false);
  };
  clampActiveCell = (rowCount: any, colCount: any) => {
    if (!this.isGrid()) return;
    // B8/B23 React-stale guard: the bounds come from the FRESH model the caller (refreshRowModel)
    // just derived and passes in — NEVER re-read $data.rows here. `$data.rows = nextRows` is an
    // async useState on React, so bodyRowCount()/visibleColCount() would see the PRE-change model
    // and SKIP a legitimate shrink-clamp (a filter-to-fewer left the active cell / range corners
    // out of bounds on React only). Falls back to the live helpers when called without bounds.
    const colN = colCount != null ? colCount : this.visibleColCount();
    const rowN = rowCount != null ? rowCount : this.bodyRowCount();
    const maxCol = colN - 1;
    const col = this.clamp(this.activeColIndex(), 0, maxCol < 0 ? 0 : maxCol);
    if (col !== this.activeColIndex()) this.activeColIndex.set(col);
    // B6: an empty / all-filtered grid has NO body cell to hold the active cell. Park the active
    // cell on the leaf-header fallback (col 0) so the roving tab-stop stays on a REAL cell (never
    // an absent body cell → focus lost into <body>), and flag it so the next non-empty refresh
    // re-seats a body cell. The cellTabindex empty-fallback keeps exactly one header tab-stop.
    if (rowN <= 0) {
      this.activeIsHeader.set(true);
      this.activeHeaderLevel.set(this.headerLeafLevel());
      this.activeColIndex.set(0);
      this.gridEmptyFallback.set(true);
      this.clampRange(rowN - 1, colN - 1);
      return;
    }
    // B6 recovery: the body model returned. If we were parked on the empty-grid header fallback,
    // re-seat a valid BODY active cell (row 0) so the roving tab-stop lands back on a real body
    // cell. A user-driven header position (not the empty fallback) is left untouched.
    if (this.gridEmptyFallback()) {
      this.gridEmptyFallback.set(false);
      this.activeIsHeader.set(false);
      this.activeRow.set(0);
    }
    if (!this.activeIsHeader()) {
      const lastRow = rowN - 1;
      const maxRow = lastRow < 0 ? 0 : lastRow;
      const row = this.clamp(this.activeRow(), 0, maxRow);
      if (row !== this.activeRow()) this.activeRow.set(row);
    }
    // B8: clamp the range-selection corners to the same FRESH bounds (a sort/filter/paginate that
    // shrank the model would otherwise leave a stale rectangle → phantom copy rows + an
    // out-of-bounds getSelectedRange). Reconcile-only (no range-change emit here, B18/B19).
    this.clampRange(rowN - 1, colN - 1);
  };
  rangeTransition = false;
  rangeClickPending = false;
  inRange = (rIdx: any, cIdx: any) => {
    const a = this.rangeAnchor();
    const f = this.rangeFocus();
    if (!a || !f) return false;
    const r0 = a.rowIndex < f.rowIndex ? a.rowIndex : f.rowIndex;
    const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
    const c0 = a.colIndex < f.colIndex ? a.colIndex : f.colIndex;
    const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
    return rIdx >= r0 && rIdx <= r1 && cIdx >= c0 && cIdx <= c1;
  };
  getSelectedRange = () => {
    // B8: clamp the corners to the CURRENT bounds ON READ so the verb (and the range-change emit
    // payload) never reports a corner past a shrunken model — React-stale-safe (the eager
    // refreshRowModel clamp is async-defeated on React; this read-time clamp is the guarantee).
    const a = this.rangeAnchor();
    const f = this.rangeFocus();
    if (!a && !f) return {
      anchor: null,
      focus: null
    };
    const maxRow = this.bodyRowCount() - 1;
    const maxCol = this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return {
      anchor: null,
      focus: null
    };
    const clampCorner = (c: any) => c == null ? null : {
      rowIndex: this.clamp(c.rowIndex, 0, maxRow),
      colIndex: this.clamp(c.colIndex, 0, maxCol)
    };
    return {
      anchor: clampCorner(a),
      focus: clampCorner(f)
    };
  };
  isFillHandleCell = (rIdx: any, cIdx: any) => {
    const a = this.rangeAnchor();
    const f = this.rangeFocus();
    if (!a || !f) return false;
    const r1 = a.rowIndex > f.rowIndex ? a.rowIndex : f.rowIndex;
    const c1 = a.colIndex > f.colIndex ? a.colIndex : f.colIndex;
    return rIdx === r1 && cIdx === c1;
  };
  emitRangeChange = (anchor: any, focus: any) => {
    this.rangeChange.emit({
      anchor,
      focus
    });
  };
  extendRange = (dRow: any, dCol: any) => {
    if (this.activeIsHeader()) return;
    const maxRow = this.bodyRowCount() - 1;
    const maxCol = this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    // Seed the anchor + focus from the active cell on the FIRST extend (no range yet).
    let anchor = this.rangeAnchor();
    let focus = this.rangeFocus();
    if (!anchor || !focus) {
      anchor = {
        rowIndex: this.activeRow(),
        colIndex: this.activeColIndex()
      };
      focus = {
        rowIndex: this.activeRow(),
        colIndex: this.activeColIndex()
      };
    }
    const nextRow = this.clamp(focus.rowIndex + dRow, 0, maxRow);
    const nextCol = this.clamp(focus.colIndex + dCol, 0, maxCol);
    const nextFocus = {
      rowIndex: nextRow,
      colIndex: nextCol
    };
    this.rangeAnchor.set(anchor);
    this.rangeFocus.set(nextFocus);
    // Keep the active cell tracking the moving focus corner (so a follow-up F2 / arrow acts
    // from the range's leading edge, the spreadsheet convention).
    this.activeRow.set(nextRow);
    this.activeColIndex.set(nextCol);
    // Suppress the focus-move's @focusin clearRange (no shiftKey on a programmatic focus): the
    // settle on the new focus corner is part of THIS range extension, not a fresh navigation.
    this.rangeTransition = true;
    this.focusActiveCell(nextRow, nextCol, false);
    this.emitRangeChange(anchor, nextFocus);
  };
  setRangeFocus = (rIdx: any, cIdx: any) => {
    const maxRow = this.bodyRowCount() - 1;
    const maxCol = this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return;
    let anchor = this.rangeAnchor();
    if (!anchor) anchor = {
      rowIndex: this.activeRow(),
      colIndex: this.activeColIndex()
    };
    const r = this.clamp(Math.trunc(Number(rIdx)) || 0, 0, maxRow);
    const c = this.clamp(Math.trunc(Number(cIdx)) || 0, 0, maxCol);
    const nextFocus = {
      rowIndex: r,
      colIndex: c
    };
    this.rangeAnchor.set(anchor);
    this.rangeFocus.set(nextFocus);
    this.emitRangeChange(anchor, nextFocus);
  };
  clearRange = () => {
    if (this.rangeAnchor() == null && this.rangeFocus() == null) return;
    this.rangeAnchor.set(null);
    this.rangeFocus.set(null);
  };
  clampRange = (maxRowArg: any, maxColArg: any) => {
    const a = this.rangeAnchor();
    const f = this.rangeFocus();
    if (!a && !f) return;
    // Bounds passed from the FRESH model (clampActiveCell → refreshRowModel's nextRows) so the
    // shrink-clamp is React-stale-safe; fall back to the live helpers for a direct call.
    const maxRow = maxRowArg != null ? maxRowArg : this.bodyRowCount() - 1;
    const maxCol = maxColArg != null ? maxColArg : this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) {
      this.rangeAnchor.set(null);
      this.rangeFocus.set(null);
      return;
    }
    if (a) {
      const ar = this.clamp(a.rowIndex, 0, maxRow);
      const ac = this.clamp(a.colIndex, 0, maxCol);
      if (ar !== a.rowIndex || ac !== a.colIndex) this.rangeAnchor.set({
        rowIndex: ar,
        colIndex: ac
      });
    }
    if (f) {
      const fr = this.clamp(f.rowIndex, 0, maxRow);
      const fc = this.clamp(f.colIndex, 0, maxCol);
      if (fr !== f.rowIndex || fc !== f.colIndex) this.rangeFocus.set({
        rowIndex: fr,
        colIndex: fc
      });
    }
  };
  announce = (msg: any) => {
    this.pasteAnnounce.set(msg != null ? msg : '');
  };
  clipboardActiveAllowed = () => !this.activeIsHeader();
  fieldOfColId = (colId: any) => {
    const d = this.defFor(colId);
    return d ? d.accessorKey != null ? d.accessorKey : colId : colId;
  };
  normalizedRange = () => {
    const a = this.rangeAnchor();
    const f = this.rangeFocus();
    if (!a || !f) return null;
    const maxRow = this.bodyRowCount() - 1;
    const maxCol = this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return null;
    const ar = this.clamp(a.rowIndex, 0, maxRow);
    const ac = this.clamp(a.colIndex, 0, maxCol);
    const fr = this.clamp(f.rowIndex, 0, maxRow);
    const fc = this.clamp(f.colIndex, 0, maxCol);
    return {
      r0: ar < fr ? ar : fr,
      r1: ar > fr ? ar : fr,
      c0: ac < fc ? ac : fc,
      c1: ac > fc ? ac : fc
    };
  };
  escapeTsvField = (s: any) => {
    if (s.indexOf('\t') >= 0 || s.indexOf('\n') >= 0 || s.indexOf('\r') >= 0 || s.indexOf('"') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  rangeToTsv = () => {
    const __activeRow = this.activeRow();
    const __activeColIndex = this.activeColIndex();
    const box = this.normalizedRange();
    const r0 = box ? box.r0 : __activeRow;
    const r1 = box ? box.r1 : __activeRow;
    const c0 = box ? box.c0 : __activeColIndex;
    const c1 = box ? box.c1 : __activeColIndex;
    const lines = [];
    for (let r = r0; r <= r1; r++) {
      const cells = [];
      for (let c = c0; c <= c1; c++) {
        const v = this.cellValueAt(r, c);
        cells.push(this.escapeTsvField(v == null ? '' : String(v)));
      }
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  };
  parseTsv = (text: any) => {
    const str = text != null ? String(text) : '';
    // CR-03: length guard BEFORE the parse — an empty string is a no-op, and a pathologically
    // large clipboard payload (>2M chars) is rejected outright (DoS-shaped input) before the
    // single-pass scan allocates a cell-per-character grid.
    if (str === '' || str.length > 2000000) return [];
    // B10: a quote-aware single-pass state machine (replaces the naive split, which corrupted a
    // cell containing a tab/newline). A field that OPENS with a double-quote is "quoted": tabs,
    // newlines, and doubled quotes ("") inside it are literal content until the closing quote;
    // an unquoted field ends at the next tab/newline. CR/LF and CRLF all delimit a row.
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    let i = 0;
    const n = str.length;
    while (i < n) {
      const ch = str[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < n && str[i + 1] === '"') {
            field = field + '"';
            i = i + 2;
            continue;
          }
          inQuotes = false;
          i = i + 1;
          continue;
        }
        field = field + ch;
        i = i + 1;
        continue;
      }
      if (ch === '"' && field === '') {
        inQuotes = true;
        i = i + 1;
        continue;
      }
      if (ch === '\t') {
        row.push(field);
        field = '';
        i = i + 1;
        continue;
      }
      if (ch === '\r') {
        if (i + 1 < n && str[i + 1] === '\n') i = i + 1;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i = i + 1;
        continue;
      }
      if (ch === '\n') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
        i = i + 1;
        continue;
      }
      field = field + ch;
      i = i + 1;
    }
    // Flush the trailing field + row.
    row.push(field);
    rows.push(row);
    // Drop a single trailing empty row (a TSV that ends with a newline → a phantom [''] row).
    if (rows.length > 1) {
      const last = rows[rows.length - 1];
      if (last.length === 1 && last[0] === '') rows.pop();
    }
    return rows;
  };
  copyRange = () => {
    // B11: never copy from a header-active state (the reusable clipboard guard).
    if (!this.clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.writeText) return;
    try {
      const p = navigator.clipboard.writeText(this.rangeToTsv());
      if (p && p.catch) p.catch(() => {});
    } catch (err: any) {/* best-effort copy */}
  };
  applyGridToRange = (grid: any, originRow: any, originCol: any) => {
    const maxRow = this.bodyRowCount() - 1;
    const maxCol = this.visibleColCount() - 1;
    if (maxRow < 0 || maxCol < 0) return {
      wrote: 0,
      total: 0
    };
    let total = 0;
    let wrote = 0;
    const committed = [];
    // Build the fresh data array incrementally so the whole paste is ONE writeData.
    let next = this.currentData();
    for (let gr = 0; gr < grid.length; gr++) {
      const r = originRow + gr;
      if (r > maxRow) break;
      const cols = grid[gr] || [];
      for (let gc = 0; gc < cols.length; gc++) {
        const c = originCol + gc;
        if (c > maxCol) break;
        total = total + 1;
        const colId = this.columnIdAt(r, c);
        if (colId == null || !this.columnEditable(colId)) continue;
        const rowObj = this.rowOriginalAt(r);
        // B9: coerce the raw TSV string to the target column's type at commit (mirrors B3's
        // single-cell commit coercion) — a numeric column commits a real Number, an empty cell
        // commits null; every other editor type passes through verbatim. No mixed/garbage types
        // ever reach the model (T-63-03-01). Validation then runs on the COERCED value.
        const value = this.coerceCellValue(colId, cols[gc]);
        // T-51-01: validate the pasted value as plain DATA before any write.
        if (this.runValidator(colId, value, rowObj) !== true) continue;
        const field = this.fieldOfColId(colId);
        const srcIndex = this.sourceIndexOfRow(r);
        const oldValue = rowObj ? rowObj[field] : null;
        next = this.replaceRowValue(next, srcIndex, field, value);
        committed.push({
          rowId: this.rowIdAt(r),
          columnId: colId,
          oldValue,
          newValue: value
        });
        wrote = wrote + 1;
      }
    }
    if (wrote > 0) {
      this.editTransition = true;
      this.writeData(next);
      this.editTransition = false;
      // One cell-edit-commit per COMMITTED cell (the per-cell event contract, D-03).
      for (let i = 0; i < committed.length; i++) this.cellEditCommit.emit(committed[i]);
    }
    // WR-02: announce the N-of-M summary only when at least one cell was written. When the paste
    // targeted real cells but every one was skipped (validation-failed / non-editable), announce a
    // distinct validation-failed message instead of a misleading "0 of M cells pasted".
    if (wrote > 0) this.announce(wrote + ' of ' + total + ' cells pasted');else if (total > 0) this.announce('No cells pasted — ' + total + ' cells were invalid or read-only');
    return {
      wrote,
      total
    };
  };
  rowOriginalAt = (rowIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[rowIndex];
    return row ? row.original : null;
  };
  rowIdAt = (rowIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[rowIndex];
    return row ? row.id : null;
  };
  pasteRange = () => {
    // B11: never paste into a header-active state (the reusable clipboard guard) — a header
    // anchor would silently write body row 0 at the header's column.
    if (!this.clipboardActiveAllowed()) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard || !navigator.clipboard.readText) return;
    // CR-02 (ROZ138): SNAPSHOT the anchor cell SYNCHRONOUSLY, before the clipboard read resolves.
    // On React these are useState-backed; re-reading $data inside the async .then() returns the
    // mount-render stale value, so a cell move between Ctrl+V and the read resolving would anchor
    // the paste at the wrong cell. Capture the locals now and pass them into applyGridToRange.
    const anchorRow = this.activeRow();
    const anchorCol = this.activeColIndex();
    let p: any = null;
    try {
      p = navigator.clipboard.readText();
    } catch (err: any) {
      return;
    }
    if (!p || !p.then) return;
    p.then((text: any) => {
      const grid = this.parseTsv(text);
      if (!grid.length) return;
      this.applyGridToRange(grid, anchorRow, anchorCol);
    }).catch(() => {});
  };
  tileIndex = (i: any, lo: any, hi: any) => {
    const span = hi - lo + 1;
    if (span <= 1) return lo;
    let k = (i - lo) % span;
    if (k < 0) k = k + span;
    return lo + k;
  };
  fillRange = (sourceBox: any, endCell: any) => {
    // B7 (React-stale-safe): compute the EXTENDED rectangle from the gesture's FRESH endpoints —
    // the pre-drag sourceBox (∪) the drag's final end cell — NOT a $data.rangeFocus re-read. On
    // React the `up` closure captured at pointerdown reads the PRE-move range (the rectangle never
    // grows), so deriving the box from the threaded endpoints is what makes the fill cover the
    // dragged cells on React. Falls back to normalizedRange() for a no-gesture (programmatic) call.
    let box;
    if (sourceBox && sourceBox.r0 != null && endCell) {
      let r0 = sourceBox.r0;
      let r1 = sourceBox.r1;
      let c0 = sourceBox.c0;
      let c1 = sourceBox.c1;
      if (endCell.r < r0) r0 = endCell.r;
      if (endCell.r > r1) r1 = endCell.r;
      if (endCell.c < c0) c0 = endCell.c;
      if (endCell.c > c1) c1 = endCell.c;
      box = {
        r0,
        r1,
        c0,
        c1
      };
    } else {
      box = this.normalizedRange();
    }
    if (!box) return;
    const src = sourceBox && sourceBox.r0 != null ? sourceBox : {
      r0: box.r0,
      r1: box.r0,
      c0: box.c0,
      c1: box.c0
    };
    const grid = [];
    for (let r = box.r0; r <= box.r1; r++) {
      const cols = [];
      for (let c = box.c0; c <= box.c1; c++) {
        const sr = this.tileIndex(r, src.r0, src.r1);
        const sc = this.tileIndex(c, src.c0, src.c1);
        const v = this.cellValueAt(sr, sc);
        cols.push(v == null ? '' : String(v));
      }
      grid.push(cols);
    }
    this.applyGridToRange(grid, box.r0, box.c0);
  };
  fillDragging = false;
  fillDragMove: any = null;
  fillDragUp: any = null;
  teardownFillDrag = () => {
    if (typeof document !== 'undefined') {
      if (this.fillDragMove) document.removeEventListener('pointermove', this.fillDragMove);
      if (this.fillDragUp) document.removeEventListener('pointerup', this.fillDragUp);
    }
    this.fillDragMove = null;
    this.fillDragUp = null;
    this.fillDragging = false;
  };
  cellIndexFromPoint = (clientX: any, clientY: any) => {
    if (typeof document === 'undefined' || !document.elementFromPoint) return null;
    let el = document.elementFromPoint(clientX, clientY);
    // Pierce OPEN shadow roots (Lit): document.elementFromPoint retargets to the shadow HOST, so
    // a drag over the Lit data-table's shadow content would otherwise resolve the host (no cell)
    // and the fill never extends. Descend into each shadowRoot's own elementFromPoint until the
    // deepest element. No-op on the 5 light-DOM targets (el.shadowRoot is null).
    while (el && el.shadowRoot && el.shadowRoot.elementFromPoint) {
      const inner = el.shadowRoot.elementFromPoint(clientX, clientY);
      if (!inner || inner === el) break;
      el = inner;
    }
    if (!el || !el.closest) return null;
    const cellEl = el.closest('[data-grid-cell]');
    if (!cellEl) return null;
    const rowAttr = cellEl.getAttribute('data-row');
    const colAttr = cellEl.getAttribute('data-col-index');
    if (rowAttr == null || colAttr == null || rowAttr === '__header') return null;
    const r = parseInt(rowAttr, 10);
    const c = parseInt(colAttr, 10);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return {
      r,
      c
    };
  };
  onFillHandlePointerDown = (e: any) => {
    if (!e) return;
    if (e.preventDefault) e.preventDefault();
    if (e.stopPropagation) e.stopPropagation();
    this.fillDragging = true;
    // B7: snapshot the PRE-DRAG rectangle (the fill SOURCE) NOW, before pointermove grows the
    // range via setRangeFocus. fillRange reads each source column's own value off THIS box, so an
    // up/left drag copies from the real origin (not the post-drag corner that would flip to a
    // target cell). Captured per-gesture in the closure (no module-let needed).
    const sourceBox = this.normalizedRange();
    // B7: track the LAST cell the drag reached so fillRange computes the extended rectangle from
    // the gesture's fresh endpoint (React's `up` closure can't re-read the grown $data range).
    let lastCell = sourceBox ? {
      r: sourceBox.r1,
      c: sourceBox.c1
    } : null;
    const move = (ev: any) => {
      if (!this.fillDragging) return;
      const cell = this.cellIndexFromPoint(ev.clientX, ev.clientY);
      if (cell) {
        lastCell = cell;
        this.setRangeFocus(cell.r, cell.c);
      }
    };
    const up = () => {
      // teardownFillDrag clears fillDragging + removes both listeners (CR-04 shared path).
      this.teardownFillDrag();
      this.fillRange(sourceBox, lastCell);
    };
    // Track the live handlers so $onUnmount can remove them on a mid-drag unmount (CR-04).
    this.fillDragMove = move;
    this.fillDragUp = up;
    if (typeof document !== 'undefined') {
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
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
  isEditing = (rowIndex: any, colIndex: any) => {
    const __editingRowIndex = this.editingRowIndex();
    if (this.editVer() < 0) return false;
    if (__editingRowIndex != null && __editingRowIndex === rowIndex) {
      const colId = this.columnIdAt(rowIndex, colIndex);
      return colId != null && this.columnEditable(colId);
    }
    return this.editingRow() === rowIndex && this.editingCol() === colIndex;
  };
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
        // WR-03: own-property spread, NOT `for (const k in orig)` which walks the prototype chain
        // and would copy inherited enumerable props of typed/class-instance row objects.
        out.push({
          ...(src[i] || {}),
          [field]: value
        });
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
  focusEditorWhenReady = (selectAll: any = true) => {
    if (!this.gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
      const el = this.gridRoot ? this.gridRoot.querySelector('[data-editing-cell]') : null;
      if (el) {
        el.focus();
        if (selectAll && el.select) {
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
    // Single-cell and full-row edit are mutually exclusive (D-06): entering a single-cell
    // editor clears any row-edit state so isEditing never resolves both modes for one cell.
    this.editingRowIndex.set(null);
    this.rowDraft.set({});
    this.editingRow.set(rowIndex);
    this.editingCol.set(colIndex);
    this.draftValue.set(seed != null ? seed : this.cellValueAt(rowIndex, colIndex));
    this.activeInControl.set(true);
    this.editVer.set(this.editVer() + 1);
    // B2: a seeded (type-to-edit) entry must NOT select-all — keep the caret after the
    // seeded char so subsequent typing appends instead of replacing it.
    this.focusEditorWhenReady(seed == null);
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
  indexOfRowIn = (rows: any, rowOriginal: any, rowId: any) => {
    const list = rows || [];
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (!r) continue;
      if (rowId != null && r.id === rowId) return i;
      if (rowOriginal != null && r.original === rowOriginal) return i;
    }
    return -1;
  };
  endEdit = () => {
    this.editingRow.set(-1);
    this.editingCol.set(-1);
    this.draftValue.set(null);
    this.invalidMsg.set('');
    this.activeInControl.set(false);
    this.editVer.set(this.editVer() + 1);
  };
  endRowEdit = () => {
    this.editingRowIndex.set(null);
    this.rowDraft.set({});
    this.invalidMsg.set('');
    this.activeInControl.set(false);
    this.editVer.set(this.editVer() + 1);
  };
  coerceCellValue = (colId: any, raw: any) => {
    if (this.editorTypeOf(colId) !== 'number') return raw;
    if (raw == null) return null;
    if (typeof raw === 'number') return Number.isNaN(raw) ? null : raw;
    const s = String(raw).trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isNaN(n) ? null : n;
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
    // B3: coerce by the column's editor type BEFORE validation + write so the validator
    // and the model both see the typed value (number/null), not the raw draft string.
    const rawValue = overrideValue !== undefined ? overrideValue : this.draftValue();
    const newValue = this.coerceCellValue(colId, rawValue);
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
    // B23: do NOT focus the FIXED old index here — under an active sort/filter the committed row
    // RELOCATES, and focusCellWhenReady(oldRow,col) would land on whatever row now sits at the old
    // index (or drop to <body>). Instead record a pending follow-request the refreshRowModel pass
    // consumes AFTER the row model re-derives: it resolves the row's NEW display index from the
    // fresh model (React-stale-safe) and focuses THAT cell; the @focusin sync then re-seats the
    // active-cell state so it and DOM focus stay coherent. With no sort/filter the row keeps its
    // index → byte-behaviorally identical to before.
    if (skipFocusReturn !== true) this.pendingEditFollow = {
      rowOriginal,
      rowId,
      col: focusCol
    };
    return true;
  };
  cancelEdit = () => {
    const __editingRow = this.editingRow();
    if (__editingRow < 0) return;
    // CR-01: capture from the EDITING pair (authoritative), NOT the active-cell indices — a
    // Tab-advance writes activeRow/activeColIndex to the NEXT cell BEFORE opening its editor, so
    // an Escape on the just-opened editor would otherwise return focus to the Tab-target cell
    // instead of the cell being cancelled. commitEdit already snapshots editingRow/editingCol.
    const focusRow = __editingRow;
    const focusCol = this.editingCol();
    this.editTransition = true;
    this.endEdit();
    this.editTransition = false;
    this.focusCellWhenReady(focusRow, focusCol);
  };
  editableColumnsForRow = (rowIndex: any) => {
    const rowList = this.rows() || [];
    const row = rowList[rowIndex];
    if (!row) return [];
    const cells = this.visibleCellsFor(row);
    const out = [];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const colId = cell && cell.column ? cell.column.id : null;
      if (colId == null || !this.columnEditable(colId)) continue;
      const d = this.defFor(colId);
      const field = d ? d.accessorKey != null ? d.accessorKey : colId : colId;
      // colIndex = the VISIBLE-cell index (the data-col-index the editor cell renders under).
      // Carried so the row-mode Tab containment (B21) + the validation-failure focus (B22)
      // can address a SPECIFIC editor by column, not just the first [data-editing-cell].
      out.push({
        colId,
        field,
        colIndex: c
      });
    }
    return out;
  };
  focusRowEditorAt = (rowIndex: any, colIndex: any) => {
    if (!this.gridRoot) return;
    let attempts = 0;
    const tryFocus = () => {
      const cellEl = this.resolveCellEl(String(rowIndex), colIndex);
      const ed = cellEl && cellEl.querySelector ? cellEl.querySelector('[data-editing-cell]') : null;
      if (ed) {
        ed.focus();
        if (ed.select) {
          try {
            ed.select();
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
  beginRowEdit = (row: any) => {
    const rowIndex = this.rowIndexOf(row);
    if (rowIndex < 0) return;
    const editable = this.editableColumnsForRow(rowIndex);
    if (editable.length === 0) return;
    // Clear any single-cell editor first (mutual exclusivity).
    this.editingRow.set(-1);
    this.editingCol.set(-1);
    this.draftValue.set(null);
    this.setInvalid('');
    // Seed each editable cell's draft from its current value.
    const draft = {};
    const rowList = this.rows() || [];
    const r = rowList[rowIndex];
    const orig = r ? r.original : null;
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      draft[ec.colId] = orig ? orig[ec.field] : null;
    }
    this.rowDraft.set(draft);
    this.editingRowIndex.set(rowIndex);
    this.activeInControl.set(true);
    this.editVer.set(this.editVer() + 1);
    this.focusEditorWhenReady();
  };
  commitRow = () => {
    const __editingRowIndex = this.editingRowIndex();
    if (__editingRowIndex == null) return false;
    const rowIndex = __editingRowIndex;
    const editable = this.editableColumnsForRow(rowIndex);
    if (editable.length === 0) {
      this.endRowEdit();
      return false;
    }
    const rowList = this.rows() || [];
    const r = rowList[rowIndex];
    const rowOriginal = r ? r.original : null;
    const rowId = r ? r.id : null;
    const draft = this.rowDraft() || {};
    // Validate every edited column FIRST (D-01: a single failure blocks the whole row commit).
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      const err = this.runValidator(ec.colId, draft[ec.colId], rowOriginal);
      if (err !== true) {
        this.setInvalid(err);
        // B22: focus the OFFENDING column's editor (the one whose validator rejected), NOT
        // unconditionally the first editor (focusEditorWhenReady resolves the first
        // [data-editing-cell] in DOM order). ec.colIndex is the offending cell's visible col.
        this.focusRowEditorAt(rowIndex, ec.colIndex);
        return false;
      }
    }
    this.setInvalid('');
    // Build the changes payload (only the columns whose value actually changed) + the field→
    // value map for the single row-object replace.
    const changes = [];
    const fieldValues = {};
    for (let i = 0; i < editable.length; i++) {
      const ec = editable[i];
      const newValue = draft[ec.colId];
      const oldValue = rowOriginal ? rowOriginal[ec.field] : null;
      fieldValues[ec.field] = newValue;
      if (oldValue !== newValue) changes.push({
        columnId: ec.colId,
        oldValue,
        newValue
      });
    }
    // ONE fresh-array replace of the SINGLE row object with all field values applied at once.
    const srcIndex = this.sourceIndexOfRow(rowIndex);
    const next = this.replaceRowValues(this.currentData(), srcIndex, fieldValues);
    const focusRow = rowIndex;
    const focusCol = this.activeColIndex();
    this.editTransition = true;
    this.writeData(next);
    // EXACTLY ONE emit per row commit, from THIS single call site (React multi-emit dedup, D-07).
    this.rowEditCommit.emit({
      rowId,
      changes
    });
    this.endRowEdit();
    this.editTransition = false;
    this.focusCellWhenReady(focusRow, focusCol);
    return true;
  };
  cancelRow = () => {
    if (this.editingRowIndex() == null) return;
    const focusRow = this.activeRow();
    const focusCol = this.activeColIndex();
    this.editTransition = true;
    this.endRowEdit();
    this.editTransition = false;
    this.focusCellWhenReady(focusRow, focusCol);
  };
  replaceRowValues = (rows: any, rowIndex: any, fieldValues: any) => {
    const src = rows || [];
    const fv = fieldValues || {};
    const out = [];
    for (let i = 0; i < src.length; i++) {
      if (i === rowIndex) {
        // WR-03: own-property spread (orig then the field→value map), NOT a `for..in`
        // prototype-walking copy. Spread copies own enumerable props only.
        out.push({
          ...(src[i] || {}),
          ...fv
        });
      } else {
        out.push(src[i]);
      }
    }
    return out;
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
  prevEditableCell = (fromRow: any, fromCol: any) => {
    const rowList = this.rows() || [];
    const rowCount = rowList.length;
    if (rowCount === 0) return null;
    let r = fromRow;
    let c = fromCol - 1;
    while (r >= 0) {
      const row = rowList[r];
      const cells = row ? this.visibleCellsFor(row) : [];
      while (c >= 0) {
        const cell = cells[c];
        const cid = cell && cell.column ? cell.column.id : null;
        if (cid != null && this.columnEditable(cid)) return {
          row: r,
          col: c
        };
        c = c - 1;
      }
      r = r - 1;
      if (r >= 0) {
        const prow = rowList[r];
        const pcells = prow ? this.visibleCellsFor(prow) : [];
        c = pcells.length - 1;
      }
    }
    return null;
  };
  editTransition = false;
  pendingEditFollow: any = null;
  inRowEdit = () => this.editingRowIndex() != null;
  editorValueFor = (colId: any) => this.inRowEdit() ? this.rowDraft() ? this.rowDraft()[colId] : null : this.draftValue();
  editorCheckedFor = (colId: any) => !!(this.inRowEdit() ? this.rowDraft() ? this.rowDraft()[colId] : null : this.draftValue());
  editorCommitFor = (colId: any) => (value: any) => {
    if (this.inRowEdit()) {
      this.setRowDraft(colId, value);
      return;
    }
    this.commitEdit(value);
  };
  editorCancelFor = () => () => {
    if (this.inRowEdit()) {
      this.cancelRow();
      return;
    }
    this.cancelEdit();
  };
  onCellEditorInput = (colId: any, evt: any) => {
    const v = evt && evt.target ? evt.target.value : '';
    if (this.inRowEdit()) {
      this.setRowDraft(colId, v);
      return;
    }
    this.draftValue.set(v);
  };
  onCellEditorCheckbox = (colId: any, evt: any) => {
    const v = !!(evt && evt.target && evt.target.checked);
    if (this.inRowEdit()) {
      this.setRowDraft(colId, v);
      return;
    }
    this.draftValue.set(v);
  };
  setRowDraft = (colId: any, value: any) => {
    const src = this.rowDraft() || {};
    const next = {};
    for (const k in src) next[k] = src[k];
    next[colId] = value;
    this.rowDraft.set(next);
  };
  rowEditTab = (target: any, backward: any) => {
    const rowIndex = this.editingRowIndex();
    if (rowIndex == null) return;
    const editable = this.editableColumnsForRow(rowIndex);
    if (editable.length === 0) return;
    const cols = editable.map((ec: any) => ec.colIndex);
    const cell = target && target.closest ? target.closest('[data-grid-cell]') : null;
    const curAttr = cell ? cell.getAttribute('data-col-index') : null;
    const cur = curAttr != null ? parseInt(curAttr, 10) : -1;
    let pos = cols.indexOf(cur);
    if (pos < 0) pos = 0;
    const len = cols.length;
    const nextPos = backward ? (pos - 1 + len) % len : (pos + 1) % len;
    this.focusRowEditorAt(rowIndex, cols[nextPos]);
  };
  onEditorKeyDown = (e: any) => {
    if (!e) return;
    const key = e.key;
    // Full-row mode (req-6): Enter from ANY cell editor commits the WHOLE row at once (ONE
    // model write + ONE row-edit-commit); Escape reverts the whole row. Tab moves between the
    // row's editors NATIVELY (no commit-per-cell) — let the browser advance focus, so we don't
    // preventDefault it here.
    if (this.inRowEdit()) {
      if (key === 'Enter') {
        e.preventDefault();
        this.commitRow();
      } else if (key === 'Escape') {
        e.preventDefault();
        this.cancelRow();
      }
      // B21: CONTAIN Tab within the editing row. Native Tab escapes the row at its first/last
      // editor (leaving editingRowIndex set so onGridKeyDown stays frozen → keyboard trap). Take
      // Tab over entirely and cycle between the row's editors WITH WRAP (forward off the last →
      // first; Shift+Tab off the first → last). Cross-target-safe (no reliance on the native DOM
      // tab order across a Lit shadow boundary).
      else if (key === 'Tab') {
        e.preventDefault();
        this.rowEditTab(e.target, e.shiftKey);
      }
      return;
    }
    if (key === 'Enter') {
      e.preventDefault();
      this.commitEdit(undefined);
    } else if (key === 'Tab') {
      e.preventDefault();
      // Resolve the advance target from the EDITING pair (the cell that is open), not the
      // active cell (they match here, but the editing pair is authoritative). B4: Shift+Tab
      // moves BACKWARD (prevEditableCell), a plain Tab FORWARD (nextEditableCell). Snapshot
      // the editing pair BEFORE commit (commitEdit resets it to -1).
      const fromRow = this.editingRow();
      const fromCol = this.editingCol();
      const target = e.shiftKey ? this.prevEditableCell(fromRow, fromCol) : this.nextEditableCell(fromRow, fromCol);
      // skipFocusReturn=true: don't bounce focus back to the committed cell — we advance
      // straight into the next editable cell's editor below. Use the RETURN value (not a
      // re-read of $data.editingRow — async-stale on React) to gate the advance: a validation
      // failure returns false and keeps the editor open (the user must fix the value first).
      const committed = this.commitEdit(undefined, true);
      if (committed && target) {
        this.activeRow.set(target.row);
        this.activeColIndex.set(target.col);
        this.beginEdit(target.row, target.col, null);
      } else if (committed) {
        // B5: no editable cell in the Tab direction (grid start/end) — keep focus INSIDE the
        // grid by returning it to the just-committed cell instead of letting it drop to <body>.
        this.focusCellWhenReady(fromRow, fromCol);
      }
    } else if (key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  };
  onEditorBlur = (e: any) => {
    const __editingRow = this.editingRow();
    // Full-row mode (req-6): blur NEVER commits — the row commits as a UNIT only on an
    // explicit Enter / save / editRow-driven flow (a per-cell blur-commit would split the row
    // into N writes + N events, violating the one-write/one-event contract). Tabbing between
    // the row's own editors is a normal focus move, not a commit.
    if (this.inRowEdit()) return;
    if (__editingRow < 0 || this.editTransition) return;
    const next = e ? e.relatedTarget : null;
    // A null relatedTarget is an unmount-blur (the editor left the DOM) or a focus drop the
    // keyboard path owns; committing here would double-count (WR-04: the OLD editor's blur on
    // a Tab-advance fires with a TRANSIENT null relatedTarget while it unmounts). Keep the
    // conservative null=skip behavior.
    if (next == null) return;
    // Focus moving OUTSIDE the grid (a click into another widget) → commit (D-01 reject keeps
    // the editor open on an invalid value).
    if (!(this.gridRoot && this.gridRoot.contains && this.gridRoot.contains(next))) {
      this.commitEdit(undefined);
      return;
    }
    // Focus stays INSIDE the grid. B1: distinguish a controlled keyboard transition (the
    // keyboard handler already committed) from a genuine click-away to ANOTHER grid cell
    // (which must commit + close so the grid is not wedged with an open editor).
    const nextCell = next.closest ? next.closest('[data-grid-cell]') : null;
    const fromCell = e && e.target && e.target.closest ? e.target.closest('[data-grid-cell]') : null;
    // Same cell (an inner control / the editing cell itself on an Enter focus-return) → a
    // controlled move; skip. Also skip when either cell can't be resolved (an unmounting
    // editor has no owning cell — the Tab-advance remount-blur path, never a click-away).
    if (!nextCell || !fromCell || nextCell === fromCell) return;
    // A Tab-advance already committed the old editor and opened the next one, so the live
    // editing pair has MOVED off the blurring editor's cell; only a click-away leaves the
    // editing pair still ON fromCell. Skip when they differ (the keyboard path owns it — no
    // double commit, WR-04).
    const fromRow = fromCell.getAttribute('data-row');
    const fromCol = fromCell.getAttribute('data-col-index');
    if (fromRow !== String(__editingRow) || fromCol !== String(this.editingCol())) return;
    // Genuine click-away to another grid cell → commit + close. skipFocusReturn=true so the
    // commit does NOT bounce focus back to the just-committed editing cell (which would fight
    // the click destination). The commit's writeData re-renders the table and can DROP DOM
    // focus on the fine-grained targets (Solid keyed-row replace). Re-seat focus on the CLICK
    // DESTINATION cell ONLY IF the re-render actually dropped it — a single deferred check
    // (not a 30-frame poll) so a target whose click-focus SURVIVED (Lit) is never re-focused
    // late, which would steal focus back from a subsequent navigation.
    const destRow = nextCell.getAttribute('data-row');
    const destCol = nextCell.getAttribute('data-col-index');
    this.commitEdit(undefined, true);
    const reseatDestFocus = () => {
      if (!this.gridRoot || destRow == null || destCol == null || destRow === '__header') return;
      const root = this.gridRoot.getRootNode ? this.gridRoot.getRootNode() : null;
      const act = root && root.activeElement ? root.activeElement : null;
      // Focus already landed inside the grid (the click-focus survived the re-render) — leave it.
      if (act && this.gridRoot.contains && this.gridRoot.contains(act)) return;
      const el = this.resolveCellEl(destRow, parseInt(destCol, 10));
      if (el) el.focus();
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reseatDestFocus);else setTimeout(reseatDestFocus, 0);
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
  editRow = (rowIndex: any) => {
    const lastRow = this.bodyRowCount() - 1;
    const maxRow = lastRow < 0 ? 0 : lastRow;
    const r = this.clamp(Math.trunc(Number(rowIndex)) || 0, 0, maxRow);
    const rowList = this.rows() || [];
    const row = rowList[r];
    if (!row) return;
    this.activeIsHeader.set(false);
    this.activeRow.set(r);
    this.beginRowEdit(row);
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
  toggleRowExpanded = (rowId: any) => {
    if (!this.table) return;
    const target = String(rowId);
    const flat = this.table.getCoreRowModel().flatRows;
    for (const r of flat as any) {
      if (r.id === target || r.original && String(r.original.id) === target) {
        r.toggleExpanded();
        return;
      }
    }
  };
  expandAll = () => {
    if (!this.table) return;
    this.table.toggleAllRowsExpanded(true);
  };
  collapseAll = () => {
    if (!this.table) return;
    this.table.resetExpanded(true);
  };
  getExpandedRows = () => {
    if (!this.table) return [];
    const out = [];
    const flat = this.table.getCoreRowModel().flatRows;
    for (const r of flat as any) if (r.getIsExpanded && r.getIsExpanded()) out.push(r.original);
    return out;
  };
  applyGrouping = (cols: any) => {
    if (this.table) this.table.setGrouping(cols);
  };
  clearGrouping = () => {
    if (this.table) this.table.setGrouping([]);
  };
  getFacetedUniqueValues = (colId: any) => {
    if (this.tick() < 0 || !this.table) return [];
    const col = this.table.getColumn(colId);
    if (!col || !col.getFacetedUniqueValues) return [];
    const map = col.getFacetedUniqueValues(); // Map<any, number>
    return map ? Array.from(map.keys()) : []; // KEYS only — counts deferred (D-03)
  };
  getFacetedMinMaxValues = (colId: any) => {
    if (this.tick() < 0 || !this.table) return null;
    const col = this.table.getColumn(colId);
    if (!col || !col.getFacetedMinMaxValues) return null;
    return col.getFacetedMinMaxValues() || null; // [number, number] | null
  };

  static ngTemplateContextGuard(
    _dir: DataTable,
    _ctx: unknown,
  ): _ctx is DefaultCtx | GroupBarCtx | SelectAllCtx | ColHeaderCtx | FilterCtx | SelectCellCtx | EditorCtx | CellCtx | DetailCtx {
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
