# Phase 48 Wave-0 De-Risk Probe (throwaway)

Proves the TWO load-bearing unknowns of the `@rozie-ui/data-table` phase BEFORE the
bulk build (D-08 hard gate), on the SMALLEST possible bridge — not the full Rich-v1
surface. Gates the core wave (Plan 03).

1. **(a) The single-bridge reactivity marriage ×6.** ONE colocated `<script>` bridge
   marries `@tanstack/table-core`'s pull-based `createTable()` + `getRowModel()` +
   per-slice `on<Slice>Change` callbacks to all six reactivity systems. table-core
   owns NO DOM, so this is the controlled-state HALF of the rete FlowCanvas bridge
   with none of the DOM-mutation half (48-RESEARCH Pattern 1).
2. **(b) Per-cell rendering is performant.** Measures portal-per-cell cost AND the
   plain-scoped-slot-in-keyed-r-for alternative (48-RESEARCH Open-Q2: the `<td>` host
   is framework-owned here, unlike rete's engine-created host, so a plain slot may
   sidestep the per-cell portal cost). Records the smooth row-count ceiling for both.

## Files

- `DataTableProbe.rozie` — the minimal table-core bridge. Three `model:true` slices
  (`sorting`, `globalFilter`, `pagination`) with uncontrolled `$data.<slice>Default`
  fallback; per-slice `onSortingChange`/`onGlobalFilterChange`/`onPaginationChange`
  funnels write a FRESH echo-guarded slice; `getRowModel`-reading closures defined
  inside `$onMount`; cell render TWO ways behind `:cellMode` (`"portal"` = one
  reactive-portal handle per cell via a Set; `"slot"` = a plain scoped slot). Loop var
  `cellCtx` (never `cell` → Svelte mount throw). Prototype-safe id-keyed column
  registry (T-48-PP).
- `ColumnProbe.rozie` — renderless `$inject('data-table:columns')` child (the
  `<NodeType>`/`<Port>` analog), with the Lit-async `$onUpdate` late-context fallback.
- `../probe-48-00.mjs` — the driver: compile-all-6 gate + table-core engine-pull cost
  per tick (target-agnostic) + per-cell DOM render cost (portal vs slot, happy-dom) +
  per-cell disposal-correctness assertion. Writes `48-PROBE-REPORT.md`.

## Run

```sh
node packages/ui/data-table/scripts/probe-48-00.mjs
```

Exit 0 = gate green: single bridge compiles 6/6, latencies printed for portal AND
slot across 50/100/200/500 rows × 6 cols (paginated + unpaginated), per-cell disposal
correct. Writes the gating report to
`.planning/phases/48-.../48-PROBE-REPORT.md`.

## Result (2026-06-17)

GATE GREEN. Single bridge compiles 6/6 clean (zero warnings). Engine pull is
sub-millisecond even at 500 rows. Per-cell disposal correct on every size/mode (one
live handle per cell, siblings preserved — not count-only-VR-masking). **Decision:
`plain-scoped-slot-in-keyed-r-for`** (the `<td>` is framework-owned; slot is simpler
and at/below portal cost — portal grows to 2–3× at large unpaginated sizes). Smooth
row-count ceiling ≥ 500 rows paginated — far above realistic page sizes. New finding:
a dynamic-key write funnel (`$data[k]`/`$model[k]`) is ROZ106 on all six → the
nine-slice bridge needs per-slice static-key funnels. See `48-PROBE-REPORT.md`.
