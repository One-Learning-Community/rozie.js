// indexMath.ts — pure index-math + DOM-query helpers extracted from gridFocusNav.rzts /
// writeFunnels.rzts (D-22, Phase 87 plan 87-01). Sigil-free, self-contained: no
// $props/$data/$emit/$computed/$onMount/$refs/$el/$expose/$watch, and no cross-partial
// host-symbol calls. Moved verbatim (bodies + explanatory comments intact) —
// behavior-neutral extraction, proven by dist-parity zero drift + the data-table VR gate.
// `focusables(cellEl)` reads the DOM but receives its element as a parameter and touches
// no sigil and no component ref, so it is framework-agnostic and belongs here alongside
// `clamp` — its querySelectorAll selector string and its `!n.disabled` filter are kept
// byte-identical to the pre-extraction body.

const clamp = (v: any, lo: any, hi: any) => (v < lo ? lo : (v > hi ? hi : v))

// The focusable descendants of a cell (non-disabled), in DOM order. Pure DOM — uniform ×6.
const focusables = (cellEl: any) => {
  if (!cellEl || !cellEl.querySelectorAll) return []
  const list = Array.prototype.slice.call(
    cellEl.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
  )
  return list.filter((n) => !n.disabled)
}

const applyUpdater = (updater: any, current: any) =>
  (typeof updater === 'function' ? updater(current) : updater)

export { clamp, focusables, applyUpdater }
