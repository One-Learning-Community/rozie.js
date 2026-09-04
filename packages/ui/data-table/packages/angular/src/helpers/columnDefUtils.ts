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
const isSafeKey = (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype'

// wrapAggregationFn (phase 50 req-5, D-05, threat T-50-04): resolve a per-column
// aggregationFn straight onto the ColumnDef (no component-side switch — RESEARCH
// anti-pattern). A built-in NAME string ('sum'/'min'/'max'/'extent'/'mean'/'median'/
// 'unique'/'uniqueCount'/'count') passes through verbatim — table-core resolves it from its
// built-in `aggregationFns` map. A CUSTOM function `(columnId, leafRows, childRows) => any`
// is DEFENSIVELY WRAPPED (the runValidator precedent): a consumer fn runs per group, so a
// throw is coerced to `undefined` and can never crash getGroupedRowModel (DoS guard).
// Anything else → undefined (no aggregation; the cell renders as a placeholder).
const wrapAggregationFn = (fn) => {
  if (typeof fn === 'string') return fn
  if (typeof fn !== 'function') return undefined
  return (columnId, leafRows, childRows) => {
    try {
      return fn(columnId, leafRows, childRows)
    } catch (err) {
      return undefined
    }
  }
}

export { isSafeKey, wrapAggregationFn }
