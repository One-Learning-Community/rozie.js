// columnRuleUtils.ts — per-column filterFn / sortingFn rule resolution. Sigil-free,
// self-contained: no $props/$data/$emit/$computed/$onMount/$refs/$el/$expose/$watch, no
// host-symbol calls, and no @tanstack/table-core import (the name lists below mirror
// table-core's `filterFns` / `sortingFns` keys; a test pins them to the real maps).
//
// A rule is a built-in NAME, 'auto', or a consumer FUNCTION. `columnRuleKeys` returns an
// object with NO key for a rule that resolves to undefined: table-core builds columns as
// `{...defaultColumn, ...columnDef}`, so an explicit `filterFn: undefined` would override
// the default 'auto' (silently dropping filters; `sortingFn: undefined` throws in
// getSortedRowModel).

export const FILTER_FN_NAMES: readonly string[] = [
  'includesString',
  'includesStringSensitive',
  'equalsString',
  'arrIncludes',
  'arrIncludesAll',
  'arrIncludesSome',
  'equals',
  'weakEquals',
  'inNumberRange',
]

export const SORTING_FN_NAMES: readonly string[] = [
  'alphanumeric',
  'alphanumericCaseSensitive',
  'text',
  'textCaseSensitive',
  'datetime',
  'basic',
]

// Module-level dedupe: warn once per (columnId, name) pair.
const warned = new Set<string>()

const resolveName = (
  value: string,
  names: readonly string[],
  kind: string,
  columnId: string,
  warn: (msg: string) => void,
): string => {
  if (value === 'auto' || names.includes(value)) return value
  const key = kind + '\u0000' + columnId + '\u0000' + value
  if (!warned.has(key)) {
    warned.add(key)
    warn(`[data-table] column "${columnId}": unknown ${kind} "${value}"; falling back to "auto".`)
  }
  return 'auto'
}

export const resolveFilterFn = (
  value: unknown,
  columnId: string,
  warn: (msg: string) => void = console.warn,
): string | Function | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return resolveName(value, FILTER_FN_NAMES, 'filterFn', columnId, warn)
  if (typeof value !== 'function') return undefined
  const fn: any = value
  // A consumer fn runs per row, so a throw is coerced to "row passes" and can never
  // crash getFilteredRowModel.
  const adapter: any = (row: any, colId: string, filterValue: any) => {
    try {
      return fn(row.getValue(colId), filterValue, row.original)
    } catch (err) {
      return true
    }
  }
  if (fn.autoRemove !== undefined) adapter.autoRemove = fn.autoRemove
  if (fn.resolveFilterValue !== undefined) adapter.resolveFilterValue = fn.resolveFilterValue
  return adapter
}

export const resolveSortingFn = (
  value: unknown,
  columnId: string,
  warn: (msg: string) => void = console.warn,
): string | Function | undefined => {
  if (value == null) return undefined
  if (typeof value === 'string') return resolveName(value, SORTING_FN_NAMES, 'sortingFn', columnId, warn)
  if (typeof value !== 'function') return undefined
  const fn: any = value
  // A throw is coerced to 0 ("equal") so getSortedRowModel can never crash.
  return (rowA: any, rowB: any, colId: string) => {
    try {
      return fn(rowA.getValue(colId), rowB.getValue(colId), rowA.original, rowB.original)
    } catch (err) {
      return 0
    }
  }
}

export const columnRuleKeys = (
  spec: { filterFn?: unknown; sortingFn?: unknown },
  columnId: string,
  warn?: (msg: string) => void,
): { filterFn?: string | Function; sortingFn?: string | Function } => {
  const out: { filterFn?: string | Function; sortingFn?: string | Function } = {}
  const f = resolveFilterFn(spec?.filterFn, columnId, warn)
  if (f !== undefined) out.filterFn = f
  const s = resolveSortingFn(spec?.sortingFn, columnId, warn)
  if (s !== undefined) out.sortingFn = s
  return out
}
