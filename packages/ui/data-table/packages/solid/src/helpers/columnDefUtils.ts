// columnDefUtils.ts — pure column-def helpers extracted from columnBuilders.rzts
// (D-22, Phase 87 plan 87-01). Sigil-free, self-contained: no $props/$data/$emit/
// $computed/$onMount/$refs/$el/$expose/$watch, and no cross-partial host-symbol
// calls. Moved verbatim (bodies + explanatory comments intact) — behavior-neutral
// extraction, proven by dist-parity zero drift + the data-table VR gate.

// Prototype-safe id-keyed column resolution (T-48-PP): the `:columns` config array is
// applied FIRST (lower precedence), then the <Column> registry OVERRIDES by id (LWW).
// byId is a null-prototype object so a consumer column id of "__proto__"/"constructor"
// cannot pollute Object.prototype. Returns the table-core ColumnDef[]. (No per-column
// render callbacks — cells render via the single #cell/#header scoped slot on this
// component, dispatched by columnId; <Column> carries metadata only.)
const isSafeKey = (k: any) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'

// wrapAggregationFn (phase 50 req-5, D-05, threat T-50-04): resolve a per-column
// aggregationFn straight onto the ColumnDef (no component-side switch — RESEARCH
// anti-pattern). A built-in NAME string ('sum'/'min'/'max'/'extent'/'mean'/'median'/
// 'unique'/'uniqueCount'/'count') passes through verbatim — table-core resolves it from its
// built-in `aggregationFns` map. A CUSTOM function `(columnId, leafRows, childRows) => any`
// is DEFENSIVELY WRAPPED (the runValidator precedent): a consumer fn runs per group, so a
// throw is coerced to `undefined` and can never crash getGroupedRowModel (DoS guard).
// Anything else → undefined (no aggregation; the cell renders as a placeholder).
const wrapAggregationFn = (fn: any) => {
  if (typeof fn === 'string') return fn
  if (typeof fn !== 'function') return undefined
  return (columnId: any, leafRows: any, childRows: any) => {
    try {
      return fn(columnId, leafRows, childRows)
    } catch (err) {
      return undefined
    }
  }
}

// ── B1 (quick 260906-afh) — nested group leaf def index ─────────────────────────────
// LOOKUP-ONLY. This map is never fed to table-core (it does not replace/reshape the
// columnDefs() array table-core consumes for createTable/setOptions — that stays
// byte-identical); it exists purely so `defFor(colId)` (columnChrome.rzts) can resolve
// a NESTED leaf's def (a `columns:` group child) in O(1), the same as a top-level leaf.
//
// collectNestedDefs: depth-first walk of a `columns` array (each entry may itself carry
// a nested `columns` array — 3+ levels deep is supported). Writes `out[String(d.id)] = d`
// ONLY when the id is ABSENT from `out` — first-write-wins so a caller can pre-seed `out`
// with the higher-precedence top-level defs and this pass only ever fills GAPS.
const collectNestedDefs = (list: any, out: any) => {
  if (!Array.isArray(list)) return
  for (const d of list) {
    if (!d || d.id == null) continue
    const id = String(d.id)
    if (!(id in out)) out[id] = d
    if (Array.isArray(d.columns)) collectNestedDefs(d.columns, out)
  }
}

// indexDefsById: builds a null-prototype `{ id: def }` map from a `columnDefs()`-shaped
// array in TWO passes. Pass 1 registers every TOP-LEVEL def unconditionally — so any id
// that already resolves at HEAD (a top-level leaf OR a top-level group's OWN id) keeps
// resolving to the EXACT SAME def, the byte-identical-lookup guarantee for every
// pre-existing caller. Pass 2 walks each top-level entry's `columns` (if any) via
// collectNestedDefs, so a nested leaf only fills a GAP — it can never shadow a
// same-named top-level id (top-level wins regardless of array order). Object.create(null)
// (T-AFH-01): a consumer column id of "__proto__"/"constructor" cannot pollute
// Object.prototype through this map — mirrors the existing `byId` T-48-PP guard in
// columnBuilders.rzts.
const indexDefsById = (defs: any): any => {
  const out = Object.create(null)
  if (!Array.isArray(defs)) return out
  for (const d of defs) {
    if (!d || d.id == null) continue
    out[String(d.id)] = d
  }
  for (const d of defs) {
    if (d && Array.isArray(d.columns)) collectNestedDefs(d.columns, out)
  }
  return out
}

export { isSafeKey, wrapAggregationFn, collectNestedDefs, indexDefsById }
