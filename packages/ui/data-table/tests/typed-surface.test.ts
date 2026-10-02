/**
 * typed-surface.test.ts — oinbox 0.8.0 feedback F9: DataTable's 17 events, its
 * `$expose` handle and its scoped-slot params must carry real types on every
 * target instead of `(...args: any[]) => void` / `(...args: any[]) => any` /
 * `any`. Row data has no generic (generic components are out of scope), so the
 * row-data positions stay `any`; everything structural around them is typed.
 *
 * Asserts the COMPILED output of DataTable.rozie (the emitters own the lowering).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, createDefaultRegistry, lowerToIR, ProducerResolver, parse } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const FILENAME = resolve(ROOT, 'src', 'DataTable.rozie');
const source = readFileSync(FILENAME, 'utf8');
const resolver = new ProducerResolver({ root: ROOT });

type Target = 'react' | 'vue' | 'svelte' | 'angular' | 'solid' | 'lit';
const compiled: Partial<Record<Target, ReturnType<typeof compile>>> = {};
const build = (target: Target) =>
  (compiled[target] ??= compile(source, { target, filename: FILENAME, resolverRoot: ROOT, resolver }));
const emit = (target: Target) => build(target).code;

/** event name -> [React/Solid prop, Svelte prop, payload type or null] */
const EVENTS: Array<[string, string, string, string | null]> = [
  ['activecell-change', 'onActivecellChange', 'onactivecellchange', 'DataTableActiveCellChangePayload'],
  ['cell-edit-commit', 'onCellEditCommit', 'oncelleditcommit', 'DataTableCellEditCommitPayload'],
  ['expand-change', 'onExpandChange', 'onexpandchange', 'ExpandedState'],
  ['filter-change', 'onFilterChange', 'onfilterchange', 'DataTableFilterChangePayload'],
  ['group-change', 'onGroupChange', 'ongroupchange', 'GroupingState'],
  ['history-change', 'onHistoryChange', 'onhistorychange', 'DataTableHistoryChangePayload'],
  ['page-change', 'onPageChange', 'onpagechange', 'PaginationState'],
  ['pin-change', 'onPinChange', 'onpinchange', 'ColumnPinningState'],
  ['range-change', 'onRangeChange', 'onrangechange', 'DataTableRangeChangePayload'],
  ['reorder-change', 'onReorderChange', 'onreorderchange', 'ColumnOrderState'],
  ['resize-change', 'onResizeChange', 'onresizechange', 'ColumnSizingState'],
  ['row-activate', 'onRowActivate', 'onrowactivate', 'DataTableRowActivatePayload'],
  ['row-edit-commit', 'onRowEditCommit', 'onroweditcommit', 'DataTableRowEditCommitPayload'],
  ['selection-change', 'onSelectionChange', 'onselectionchange', 'RowSelectionState'],
  ['sort-change', 'onSortChange', 'onsortchange', 'SortingState'],
  ['visibility-change', 'onVisibilityChange', 'onvisibilitychange', 'VisibilityState'],
  ['visible-range-change', 'onVisibleRangeChange', 'onvisiblerangechange', 'DataTableVisibleRangeChangePayload'],
];

const VERBS = [
  'sortColumn', 'clearSorting', 'toggleRowExpanded', 'expandAll', 'collapseAll', 'getExpandedRows',
  'applyGrouping', 'clearGrouping', 'getFacetedUniqueValues', 'getFacetedMinMaxValues', 'getColumnDefs',
  'toggleAllRows', 'clearSelection', 'getSelectedRows', 'setPage', 'setRowsPerPage',
  'toggleColumnVisibility', 'applyColumnOrder', 'resetColumnSizing', 'pinColumn', 'focusCell',
  'getActiveCell', 'clearActiveCell', 'getScrollElement', 'getRowIndexRelativeToPage', 'editCell',
  'commitEditing', 'editRow', 'getSelectedRange', 'cut', 'undo', 'redo', 'canUndo', 'canRedo', 'clearHistory',
];

describe('DataTable typed events (F9)', () => {
  it('declares <emits> for all 17 events and exports the payload types', () => {
    const { ast } = parse(source, { filename: FILENAME });
    const { ir } = lowerToIR(ast, {
      modifierRegistry: createDefaultRegistry(),
      filename: FILENAME,
      resolver,
    });
    expect(ir.emitDecls?.map((d: { name: string }) => d.name).sort()).toEqual(
      EVENTS.map((e) => e[0]).sort(),
    );
    expect(ir.types?.exportedNames).toEqual(
      expect.arrayContaining([
        'DataTableActiveCell',
        'DataTableCellPosition',
        'DataTableCellEditCommitPayload',
        'DataTableRowEditCommitPayload',
        'DataTableRowActivatePayload',
        'DataTableFilterChangePayload',
        'DataTableRangeChangePayload',
      ]),
    );
  });

  it.each(['react', 'solid'] as const)('%s: no event handler is (...args: any[]) => void', (target) => {
    const code = emit(target);
    for (const [name, prop, , payload] of EVENTS) {
      expect(code, `${name} must not be untyped`).not.toMatch(
        new RegExp(`${prop}\\?: \\(\\.\\.\\.args: any\\[\\]\\) => void`),
      );
      expect(code, `${name} payload`).toContain(`${prop}?: (payload: ${payload}) => void`);
    }
  });

  it('svelte: no event handler is (...args: any[]) => void', () => {
    const code = emit('svelte');
    for (const [name, , prop, payload] of EVENTS) {
      expect(code, `${name} must not be untyped`).not.toMatch(
        new RegExp(`${prop}\\?: \\(\\.\\.\\.args: any\\[\\]\\) => void`),
      );
      expect(code, `${name} payload`).toContain(`${prop}?: (payload: ${payload}) => void`);
    }
  });

  it('vue: defineEmits carries the payloads', () => {
    const code = emit('vue');
    for (const [name, , , payload] of EVENTS) {
      expect(code, name).toMatch(new RegExp(`'?${name}'?: \\[payload: ${payload}\\]`));
    }
  });

  it('angular: typed outputs', () => {
    const code = emit('angular');
    for (const [name, , , payload] of EVENTS) {
      expect(code, name).toContain(`output<${payload}>(`);
    }
  });

  it('lit: CustomEvent payloads in the event map', () => {
    const code = emit('lit');
    for (const [name, , , payload] of EVENTS) {
      expect(code, name).toContain(`CustomEvent<${payload}>`);
    }
  });
});

describe('DataTable typed handle (F9)', () => {
  it('react: the 35 untyped verbs are gone from DataTableHandle', () => {
    const code = emit('react');
    const handle = code.slice(code.indexOf('export interface DataTableHandle'));
    const body = handle.slice(0, handle.indexOf('\n}\n'));
    for (const verb of VERBS) {
      expect(body, `${verb} must not be (...args: any[]) => any`).not.toMatch(
        new RegExp(`\\b${verb}: \\(\\.\\.\\.args: any\\[\\]\\) => any`),
      );
    }
    expect(body).toMatch(/sortColumn[^\n]*colId: string/);
    expect(body).toMatch(/getActiveCell[^\n]*DataTableActiveCell/);
    expect(body).toMatch(/getSelectedRange[^\n]*DataTableRange/);
    expect(body).toMatch(/pinColumn[^\n]*'left' \| 'right' \| false/);
    expect(body).toMatch(/getColumnDefs[^\n]*ColumnDef/);
  });

  it('solid: DataTableHandle is typed too', () => {
    const code = emit('solid');
    const handle = code.slice(code.indexOf('export interface DataTableHandle'));
    const body = handle.slice(0, handle.indexOf('\n}\n'));
    expect(body).not.toMatch(/\(\.\.\.args: any\[\]\) => any/);
    expect(body).toMatch(/getActiveCell[^\n]*DataTableActiveCell/);
  });
});

describe('DataTable typed slot params (F9)', () => {
  it('react: slot contexts carry real param types', () => {
    const code = emit('react');
    const ctx = (name: string) => {
      const m = code.match(new RegExp(`interface ${name} \\{([^}]*)\\}`));
      expect(m, `${name} interface`).not.toBeNull();
      return m![1];
    };
    expect(ctx('CellCtx')).toMatch(/columnId: string/);
    expect(ctx('CellCtx')).toMatch(/column: TableColumn</);
    expect(ctx('ColHeaderCtx')).toMatch(/label: string/);
    expect(ctx('SelectAllCtx')).toMatch(/checked: boolean/);
    expect(ctx('PlaceholderCtx')).toMatch(/index: number/);
    expect(ctx('EditorCtx')).toMatch(/commit: \(value: any\) => void/);
    expect(ctx('EditorCtx')).toMatch(/cancel: \(\) => void/);
    expect(ctx('FilterCtx')).toMatch(/setFilter: \(columnId: string, value: any\) => void/);
    expect(ctx('GroupBarCtx')).toMatch(/grouping: string\[\]/);
  });
});
