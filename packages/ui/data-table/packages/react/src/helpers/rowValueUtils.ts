// rowValueUtils.ts — pure row-value helpers extracted from editCellLifecycle.rzts /
// editRowLifecycle.rzts (D-22, Phase 87 plan 87-01). Sigil-free, self-contained: no
// $props/$data/$emit/$computed/$onMount/$refs/$el/$expose/$watch, and no cross-partial
// host-symbol calls. Moved verbatim (bodies + explanatory comments intact) —
// behavior-neutral extraction, proven by dist-parity zero drift + the data-table VR gate.

// replaceRowValue: build a FRESH array with ONE row object replaced (the column's field
// set to the new value); the rest share by reference (the family immutable whole-array
// replace — in-place mutation is silently dropped on React/Solid/Angular/Lit). rowIndex
// is over currentData() (== the visible model order for the non-virtual, unsorted/
// unfiltered single-cell case; the row id is carried for the commit payload).
const replaceRowValue = (rows, rowIndex, field, value) => {
  const src = rows || []
  const out = []
  for (let i = 0; i < src.length; i++) {
    if (i === rowIndex) {
      // WR-03: own-property spread, NOT `for (const k in orig)` which walks the prototype chain
      // and would copy inherited enumerable props of typed/class-instance row objects.
      out.push({ ...(src[i] || {}), [field]: value })
    } else {
      out.push(src[i])
    }
  }
  return out
}

// replaceRowValues: like replaceRowValue but applies a MAP of field→value to ONE row object
// in a single fresh-array replace (req-6 — the whole-row commit is ONE write, not per cell).
const replaceRowValues = (rows, rowIndex, fieldValues) => {
  const src = rows || []
  const fv = fieldValues || {}
  const out = []
  for (let i = 0; i < src.length; i++) {
    if (i === rowIndex) {
      // WR-03: own-property spread (orig then the field→value map), NOT a `for..in`
      // prototype-walking copy. Spread copies own enumerable props only.
      out.push({ ...(src[i] || {}), ...fv })
    } else {
      out.push(src[i])
    }
  }
  return out
}

// B23: the index of a committed row WITHIN a given (fresh) visible-model array, resolved by
// row IDENTITY. table-core's default getRowId is source-index-based, so a row's id is stable
// across a re-sort (only its VISIBLE position moves); a committed edit replaces the row object
// via a fresh spread (the `original` reference changes), so match by `id` FIRST, `original`
// only as a fallback. Returns -1 when the row filtered out of the view. PURE (the caller passes
// the FRESH row list — refreshRowModel's just-pulled `nextRows`, never the React-stale state).
const indexOfRowIn = (rows, rowOriginal, rowId) => {
  const list = rows || []
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (!r) continue
    if (rowId != null && r.id === rowId) return i
    if (rowOriginal != null && r.original === rowOriginal) return i
  }
  return -1
}

export { replaceRowValue, replaceRowValues, indexOfRowIn }
