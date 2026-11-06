import { describe, expect, it, vi } from 'vitest'
import {
  createTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  filterFns,
  sortingFns,
} from '@tanstack/table-core'
import {
  FILTER_FN_NAMES,
  SORTING_FN_NAMES,
  resolveFilterFn,
  resolveSortingFn,
  columnRuleKeys,
} from '../src/helpers/columnRuleUtils'

const data = [
  { id: 1, grades: [40, 41], t: 'b' },
  { id: 2, grades: [] as number[], t: 'a' },
  { id: 3, grades: [41], t: 'c' },
]

function build(columns: any[], state: any = {}) {
  return createTable<any>({
    data,
    columns,
    state,
    onStateChange: () => {},
    renderFallbackValue: null,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  } as any)
}

const filteredIds = (columns: any[], columnFilters: any[]) =>
  build(columns, { columnFilters }).getFilteredRowModel().rows.map((r) => r.id)

const sortedRows = (columns: any[], sorting: any[]) =>
  build(columns, { sorting }).getSortedRowModel().rows

describe('columnRuleUtils', () => {
  it('name lists match table-core', () => {
    expect([...FILTER_FN_NAMES].sort()).toEqual(Object.keys(filterFns).sort())
    expect([...SORTING_FN_NAMES].sort()).toEqual(Object.keys(sortingFns).sort())
  })

  it('null leaves no key', () => {
    expect(columnRuleKeys({ filterFn: null, sortingFn: null }, 'g')).toEqual({})
    expect('filterFn' in columnRuleKeys({}, 'g')).toBe(false)
  })

  it('column without filterFn still filters', () => {
    const cols = [{ id: 't', accessorKey: 't', ...columnRuleKeys({}, 't') }]
    expect(filteredIds(cols, [{ id: 't', value: 'a' }])).toEqual(['1'])
  })

  it('column without sortingFn still sorts', () => {
    const cols = [{ id: 't', accessorKey: 't', ...columnRuleKeys({}, 't') }]
    const rows = sortedRows(cols, [{ id: 't', desc: false }])
    expect(rows.map((r) => r.original.t)).toEqual(['a', 'b', 'c'])
  })

  it('built-in name', () => {
    const cols = [
      { id: 'grades', accessorKey: 'grades', ...columnRuleKeys({ filterFn: 'arrIncludesSome' }, 'grades') },
    ]
    expect(filteredIds(cols, [{ id: 'grades', value: [40] }])).toEqual(['0'])
  })

  it('unknown name falls back to auto and warns once', () => {
    const warn = vi.fn()
    expect(resolveFilterFn('nope', 'g', warn)).toBe('auto')
    expect(resolveFilterFn('nope', 'g', warn)).toBe('auto')
    expect(warn).toHaveBeenCalledTimes(1)
    const warnS = vi.fn()
    expect(resolveSortingFn('nope', 'g', warnS)).toBe('auto')
    expect(warnS).toHaveBeenCalledTimes(1)
  })

  it('custom filter gets value, filterValue, original', () => {
    const fn = (v: any, f: any) => (f === '__empty' ? !v?.length : v?.some((id: number) => f.includes(id)))
    const cols = [{ id: 'grades', accessorKey: 'grades', ...columnRuleKeys({ filterFn: fn }, 'grades') }]
    expect(filteredIds(cols, [{ id: 'grades', value: '__empty' }])).toEqual(['1'])
    const seen = vi.fn(() => true)
    const cols2 = [{ id: 't', accessorKey: 't', ...columnRuleKeys({ filterFn: seen }, 't') }]
    filteredIds(cols2, [{ id: 't', value: 'zz' }])
    expect(seen).toHaveBeenCalledWith('b', 'zz', data[0])
  })

  it('throwing filter passes', () => {
    const cols = [
      {
        id: 't',
        accessorKey: 't',
        ...columnRuleKeys({ filterFn: () => { throw new Error('x') } }, 't'),
      },
    ]
    expect(filteredIds(cols, [{ id: 't', value: 'a' }])).toHaveLength(3)
  })

  it('custom sort and throwing sort', () => {
    const cols = [
      {
        id: 'grades',
        accessorKey: 'grades',
        ...columnRuleKeys({ sortingFn: (a: any, b: any) => a.length - b.length }, 'grades'),
      },
    ]
    const rows = sortedRows(cols, [{ id: 'grades', desc: false }])
    expect(rows.map((r) => r.original.grades.length)).toEqual([0, 1, 2])

    const bad = [
      {
        id: 'grades',
        accessorKey: 'grades',
        ...columnRuleKeys({ sortingFn: () => { throw new Error('x') } }, 'grades'),
      },
    ]
    expect(() => sortedRows(bad, [{ id: 'grades', desc: false }])).not.toThrow()
    expect(sortedRows(bad, [{ id: 'grades', desc: false }])).toHaveLength(3)
  })

  it('autoRemove and resolveFilterValue survive', () => {
    const fn: any = () => true
    fn.autoRemove = () => false
    fn.resolveFilterValue = (v: any) => v
    const adapter: any = resolveFilterFn(fn, 'g')
    expect(adapter.autoRemove).toBe(fn.autoRemove)
    expect(adapter.resolveFilterValue).toBe(fn.resolveFilterValue)
  })
})
