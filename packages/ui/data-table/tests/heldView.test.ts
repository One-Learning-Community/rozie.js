import { describe, expect, it } from 'vitest'
import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
} from '@tanstack/table-core'
import { columnRuleKeys } from '../src/helpers/columnRuleUtils'
import {
  CLEAN_VIEW_STATE,
  changedIndices,
  createHoldController,
  viewStatesEqual,
} from '../src/helpers/heldView'

const isEmptyRule = (v: any, f: any) => (f === '__empty' ? !v?.length : v?.some((x: any) => f.includes(x)))

const baseData = () => [
  { t: 'a', g: [] as number[] },
  { t: 'b', g: [] as number[] },
  { t: 'c', g: [1] },
]

function mk(data: any[], state: any = {}) {
  const ctrl = createHoldController()
  const table = createTable<any>({
    data,
    columns: [
      { id: 't', accessorKey: 't' },
      { id: 'g', accessorKey: 'g', ...columnRuleKeys({ filterFn: isEmptyRule }, 'g') },
    ],
    state: {
      columnFilters: [{ id: 'g', value: '__empty' }],
      sorting: [{ id: 't', desc: false }],
      pagination: { pageIndex: 0, pageSize: 10 },
      ...state,
    },
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: ctrl.wrapFiltered(getFilteredRowModel()),
    getSortedRowModel: ctrl.wrapSorted(getSortedRowModel()),
    getPaginationRowModel: getPaginationRowModel(),
  })
  const write = (next: any[]) => {
    const prev = table.options.data
    ctrl.capture(table)
    ctrl.noteWrite(prev, next)
    table.setOptions((p: any) => ({ ...p, data: next }))
  }
  const ids = () => table.getRowModel().rows.map((r: any) => r.id)
  return { ctrl, table, write, ids }
}

const withRow = (data: any[], i: number, patch: any) => data.map((r, j) => (j === i ? { ...r, ...patch } : r))

describe('heldView', () => {
  it('activating without writes changes nothing', () => {
    const { ctrl, table, ids } = mk(baseData())
    ctrl.setActive(true)
    expect(ids()).toEqual(['0', '1'])
    expect(ctrl.viewState(table)).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 })
  })

  it('edited row stays and is counted', () => {
    const { ctrl, table, write, ids } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(table.options.data, 0, { g: [5] }))
    expect(ids()).toEqual(['0', '1'])
    expect(ctrl.viewState(table).filterMismatches).toBe(1)
    ctrl.release()
    expect(ids()).toEqual(['1'])
    expect(ctrl.viewState(table)).toEqual({ held: true, filterMismatches: 0, sortMismatches: 0 })
  })

  it('sort hold', () => {
    const { ctrl, table, write, ids } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(table.options.data, 0, { t: 'z' }))
    expect(ids()).toEqual(['0', '1'])
    expect(ctrl.viewState(table).sortMismatches).toBe(1)
    ctrl.release()
    expect(ids()).toEqual(['1', '0'])
  })

  it('undo reverts count', () => {
    const { ctrl, table, write, ids } = mk(baseData())
    ctrl.setActive(true)
    const original = table.options.data
    write(withRow(original, 0, { g: [5] }))
    expect(ctrl.viewState(table).filterMismatches).toBe(1)
    write(original)
    expect(ctrl.viewState(table).filterMismatches).toBe(0)
    expect(ids()).toEqual(['0', '1'])
  })

  it('hidden row matching again is counted', () => {
    const { ctrl, table, write, ids } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(table.options.data, 2, { g: [] }))
    expect(ids()).toEqual(['0', '1'])
    expect(ctrl.viewState(table).filterMismatches).toBe(1)
    ctrl.release()
    expect(ids()).toEqual(['0', '1', '2'])
  })

  it('fill across rows counts each', () => {
    const { ctrl, table, write } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(withRow(table.options.data, 0, { g: [5] }), 1, { g: [5] }))
    expect(ctrl.viewState(table).filterMismatches).toBe(2)
  })

  it('pre-pagination model follows held order', () => {
    const { ctrl, table, write } = mk(baseData(), { pagination: { pageIndex: 0, pageSize: 1 } })
    ctrl.setActive(true)
    write(withRow(table.options.data, 0, { t: 'z' }))
    expect(table.getPrePaginationRowModel().rows.map((r: any) => r.id)).toEqual(['0', '1'])
    expect(table.getPageCount()).toBe(2)
    expect(table.getRowModel().rows.map((r: any) => r.id)).toEqual(['0'])
  })

  it('select-all sees held rows', () => {
    const { ctrl, table, write } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(table.options.data, 0, { g: [5] }))
    expect(table.getFilteredRowModel().flatRows.length).toBe(2)
  })

  it('held models keep a stable identity between reads', () => {
    const { ctrl, table, write } = mk(baseData())
    ctrl.setActive(true)
    write(withRow(table.options.data, 0, { t: 'z' }))
    expect(table.getFilteredRowModel()).toBe(table.getFilteredRowModel())
    expect(table.getSortedRowModel()).toBe(table.getSortedRowModel())
  })

  it('inactive is transparent', () => {
    const ctrl = createHoldController()
    const model = { rows: [], flatRows: [], rowsById: {} }
    const base = () => () => model
    const fakeTable: any = {}
    ctrl.setActive(true)
    ctrl.setActive(false)
    expect(ctrl.isActive()).toBe(false)
    expect(ctrl.wrapFiltered(base)(fakeTable)()).toBe(model)
    expect(ctrl.wrapSorted(base)(fakeTable)()).toBe(model)
    const { ctrl: c2, table, write } = mk(baseData())
    c2.setActive(true)
    write(withRow(table.options.data, 0, { g: [5] }))
    expect(c2.isHolding()).toBe(true)
    c2.setActive(false)
    expect(c2.isHolding()).toBe(false)
    expect(table.getRowModel().rows.map((r: any) => r.id)).toEqual(['1'])
    expect(viewStatesEqual(c2.viewState(table), CLEAN_VIEW_STATE)).toBe(true)
  })

  it('capture is a no-op when inactive', () => {
    const { ctrl, table, write } = mk(baseData())
    write(withRow(table.options.data, 0, { g: [5] }))
    expect(ctrl.isHolding()).toBe(false)
    expect(ctrl.viewState(table)).toEqual(CLEAN_VIEW_STATE)
  })

  it('changedIndices', () => {
    const a = { x: 1 }
    const b = { x: 2 }
    const c = { x: 3 }
    expect(changedIndices([a, b], [a, b])).toEqual([])
    expect(changedIndices([a, b], [a, c])).toEqual([1])
    expect(changedIndices([a], [a, b, c])).toEqual([0, 1, 2])
  })

  it('viewStatesEqual', () => {
    expect(viewStatesEqual(CLEAN_VIEW_STATE, { held: false, filterMismatches: 0, sortMismatches: 0 })).toBe(true)
    expect(viewStatesEqual(CLEAN_VIEW_STATE, { held: true, filterMismatches: 0, sortMismatches: 0 })).toBe(false)
  })
})
