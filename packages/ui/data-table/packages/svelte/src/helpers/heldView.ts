// heldView.ts — the hold controller behind `holdView` (held filter membership + sort
// order through the table's own writes). Sigil-free, self-contained: no $props/$data/
// $emit/$computed/$onMount/$refs/$el/$expose/$watch, no host-symbol calls, and no
// @tanstack/table-core import (the tests drive it against the real table-core).
//
// Seam: the hold lives INSIDE table-core's row pipeline. `wrapFiltered` / `wrapSorted`
// wrap the built-in row-model factories (shape `(table) => () => RowModel`). While not
// holding they return the base model unchanged (same identity). While holding:
//   - filtered stage: the current core rows whose id is in the held membership, in core
//     order (fresh rows, so new values render in place). The base (live) filtered id set
//     is kept for counting.
//   - sorted stage: the base output is the live sort of the held set (its upstream is the
//     held filtered model); its id order is kept for counting, and the rows are returned
//     reordered to the held order. Mapped by id — getSortedRowModel shallow-copies rows.
// Each wrapper memoizes on [base result identity, controller version], so downstream
// table-core memos (keyed on upstream model identity) see a stable model.
//
// Limits worth knowing:
//   - The held filtered stage returns the CORE rows (not the rows table-core's filtered stage
//     produced), so they do not carry table-core's per-row `columnFilters` / `columnFiltersMeta`
//     bookkeeping. Nothing in DataTable reads those; a future reader would have to take them
//     from the base (live) model instead.
//   - One controller per table: it holds a single membership / order / written-row set, so
//     never share one controller (or its wrapped factories) between two table instances.

export interface ViewState {
  held: boolean
  filterMismatches: number
  sortMismatches: number
}

export const CLEAN_VIEW_STATE: ViewState = Object.freeze({
  held: false,
  filterMismatches: 0,
  sortMismatches: 0,
}) as ViewState

export const viewStatesEqual = (a: ViewState, b: ViewState): boolean =>
  a.held === b.held && a.filterMismatches === b.filterMismatches && a.sortMismatches === b.sortMismatches

// Index-aligned reference comparison. Differing lengths → every index of the longer
// (the shape changed, so every position is suspect).
export const changedIndices = (prev: readonly unknown[], next: readonly unknown[]): number[] => {
  const out: number[] = []
  if (prev.length !== next.length) {
    const n = Math.max(prev.length, next.length)
    for (let i = 0; i < n; i++) out.push(i)
    return out
  }
  for (let i = 0; i < next.length; i++) if (prev[i] !== next[i]) out.push(i)
  return out
}

export interface HoldController {
  setActive(active: boolean): void
  isActive(): boolean
  isHolding(): boolean
  capture(table: any): void
  release(): void
  noteWrite(prev: readonly unknown[], next: readonly unknown[]): void
  wrapFiltered(base: (table: any) => () => any): (table: any) => () => any
  wrapSorted(base: (table: any) => () => any): (table: any) => () => any
  viewState(table: any): ViewState
}

const rowIds = (model: any): string[] => (model?.rows ?? []).map((r: any) => r.id)

export const createHoldController = (): HoldController => {
  let active = false
  // Snapshot — null when not holding.
  let heldMembership: Set<string> | null = null
  let heldOrder: string[] | null = null
  const written = new Set<number>()
  let version = 0
  // Live (unheld) results observed by the wrappers while holding, for counting.
  let liveFilteredIds: Set<string> = new Set()
  let liveSortedIds: string[] = []

  const release = () => {
    heldMembership = null
    heldOrder = null
    written.clear()
    version++
  }

  const wrapFiltered = (base: (table: any) => () => any) => (table: any) => {
    const getBase = base(table)
    let lastBase: any = undefined
    let lastVersion = -1
    let lastOut: any = undefined
    return () => {
      const baseModel = getBase()
      if (!heldMembership) return baseModel
      if (baseModel === lastBase && version === lastVersion) return lastOut
      liveFilteredIds = new Set(rowIds(baseModel))
      const held = heldMembership
      const coreRows: any[] = table.getCoreRowModel().rows
      const rows = coreRows.filter((r: any) => held.has(r.id))
      const rowsById: Record<string, any> = {}
      for (const r of rows) rowsById[r.id] = r
      lastBase = baseModel
      lastVersion = version
      lastOut = { rows, flatRows: rows, rowsById }
      return lastOut
    }
  }

  const wrapSorted = (base: (table: any) => () => any) => (table: any) => {
    const getBase = base(table)
    let lastBase: any = undefined
    let lastVersion = -1
    let lastOut: any = undefined
    return () => {
      const baseModel = getBase()
      if (!heldOrder) return baseModel
      if (baseModel === lastBase && version === lastVersion) return lastOut
      const baseRows: any[] = baseModel?.rows ?? []
      liveSortedIds = baseRows.map((r: any) => r.id)
      const byId = new Map<string, any>()
      for (const r of baseRows) byId.set(r.id, r)
      const rows: any[] = []
      for (const id of heldOrder) {
        const r = byId.get(id)
        if (r) {
          rows.push(r)
          byId.delete(id)
        }
      }
      // Defensive: anything the held order does not know keeps its live position at the end.
      for (const r of baseRows) if (byId.has(r.id)) rows.push(r)
      lastBase = baseModel
      lastVersion = version
      lastOut = { rows, flatRows: rows, rowsById: baseModel?.rowsById ?? {} }
      return lastOut
    }
  }

  return {
    setActive(next: boolean) {
      const was = active
      active = !!next
      if (!active && was) release()
    },
    isActive: () => active,
    isHolding: () => heldMembership !== null,
    capture(table: any) {
      if (!active || heldMembership) return
      const filtered = table.getFilteredRowModel()
      const sorted = typeof table.getSortedRowModel === 'function' ? table.getSortedRowModel() : filtered
      heldMembership = new Set(rowIds(filtered))
      heldOrder = rowIds(sorted)
      written.clear()
      version++
    },
    release,
    noteWrite(prev: readonly unknown[], next: readonly unknown[]) {
      if (!heldMembership) return
      for (const i of changedIndices(prev, next)) written.add(i)
    },
    wrapFiltered,
    wrapSorted,
    viewState(table: any): ViewState {
      if (!active) return CLEAN_VIEW_STATE
      if (!heldMembership || !heldOrder) return { held: true, filterMismatches: 0, sortMismatches: 0 }
      // Pull the models so the wrappers have observed the current live results.
      table.getSortedRowModel()
      const held = heldMembership
      let filterMismatches = 0
      for (const id of held) if (!liveFilteredIds.has(id)) filterMismatches++
      const coreRows: any[] = table.getCoreRowModel().rows
      for (const r of coreRows) if (!held.has(r.id) && liveFilteredIds.has(r.id)) filterMismatches++
      const heldPos = new Map<string, number>()
      heldOrder.forEach((id, i) => heldPos.set(id, i))
      const livePos = new Map<string, number>()
      liveSortedIds.forEach((id, i) => livePos.set(id, i))
      let sortMismatches = 0
      for (const i of written) {
        const id = coreRows[i]?.id
        if (id === undefined || !heldPos.has(id)) continue
        if (heldPos.get(id) !== livePos.get(id)) sortMismatches++
      }
      return { held: true, filterMismatches, sortMismatches }
    },
  }
}
