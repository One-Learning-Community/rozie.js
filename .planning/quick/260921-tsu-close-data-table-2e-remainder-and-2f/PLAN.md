---
quick_id: 260921-tsu
slug: close-data-table-2e-remainder-and-2f
date: 2026-09-21
status: in-progress (cluster 1 landed; 33 open)
---

# Close the data-table 2E remainder + all of 2F

**38 open — not the 24 I first estimated.** Correcting my own count: waves 2C and 2D were
never finished either. 2C left B-01 + B-02; 2D left A-02, A-03, E-03(src), E-06(src) (only
A-01 was closed). Enumerated the whole 54-ID inventory against the closed set rather than
trusting the wave headings.

**Closed to date (15):** A-01 B-05 C-01 C-02 C-03 C-06 C-11 F-01 F-03 F-04 F-05 F-06 F-07
F-08 N-01
**FALSE (1):** A-07
**Open (38):**
- A: A-02 A-03 A-04 A-05 A-06 A-08
- B: B-01 B-02 B-03 B-04 B-06 B-07 B-08 B-09 B-10 B-11 B-12 B-13 B-14 B-15 B-16
- C: C-04 C-05 C-07 C-08 C-09 C-10 C-12 C-13 C-14 C-15 C-16
- D/E/N: D-19a D-19b E-03(src) E-05 E-06(src) N-02

## Standing constraint that shapes the method

**Measure every stated cause before fixing it.** This program's record: 3-of-3 deferred
causes wrong, then 4-of-4 "harness limitation" framings falsified, then 3 vacuous
assertions found in 260915-wqj. A finding's one-liner is a hypothesis, not a spec.
Verdicts go in the table below as FIXED / FALSE / SUPERSEDED / WONTFUX-with-reason —
every ID must reach a terminal state.

## Method

Work in clusters sharing a seam so each build/regen is amortised; ONE whole-repo build,
ONE gate sweep, ONE Docker VR union run at the end.

1. a11y/ARIA — E-05 B-09 B-10 C-14
2. keyboard — B-15 C-10 B-03 B-04 C-05
3. pointer/selection — B-14 B-16
4. clipboard — B-07 B-08 A-08
5. editors/filters — C-07 C-08 C-13
6. geometry/windowing — A-05 A-06 B-06
7. small + docs — A-04 A-07 C-09 C-12 C-15 C-16 N-02 B-11/B-12 B-13 D-19a/b
8. GroupBar — C-04

## Verdicts

| ID | Verdict | Evidence |
|---|---|---|
| A-07 | **FALSE** | `helpers/rowValueUtils.ts:56` matches `rowId` FIRST, then `r.original` identity; the sole call site (`DataTable.rozie:1152`) passes both, populated at `editCellLifecycle.rzts:455`/`:509`. Resolution is identity-based and id-first exactly as documented — never positional. |
| E-05 | **FIXED** | Was 0 hits across all `.rozie`/`.rzts` (row-axis twin present 22×). `gridAriaColCount()` on both table roots + `aria-colindex` on all 4 header/body paths, via new window-independent `headerLeafStart()`. 6/6. |
| B-09 | **FIXED** | `applyGridToRange` is the single funnel for paste/cut/delete/fill and hardcoded `'cells pasted'` — a Cut announced "pasted". Now takes a `verb`; the 4 callers pass pasted/cut/cleared/filled. |
| B-10 | **FIXED** | Confirmed both `aria-selected` hits were `rowIsSelected` on the `<tr>`, and `rangeSelection.rzts` had 0 announce calls. Cells now carry `aria-selected`; `emitRangeChange` (the single mutation funnel) announces into its own region. 6/6. |
| C-14 | **FIXED** | The `<td>` had `aria-invalid`, the focused control did not, and it is not inherited from an ancestor. All 10 built-in editor controls now bind it. |
| N-02 | **CONFIRMED, not yet fixed** | `--rdt-pin-btn-border`/`--rdt-pin-btn-radius` declared at `themes/base.css:118-119` AND `DataTable.rozie:3086-3087`, but `var(--rdt-pin-btn-border|radius)` is read **0×** (only `--rdt-pin-btn-active-bg` is, at `:3450`). Died when the always-visible pin-controls became the header ⋯ menu (see comment at `:3400`). **Fix must delete from BOTH places** — codegen fails the build if they drift (F-01's guard) — and re-check the token-count prose the docs pages generate from. |
| A-04 | **CONFIRMED (mechanism)** | `totalRowCount()` reads `getFilteredRowModel().rows.length`; under `manual` table-core only holds the consumer-supplied page, so `gridAriaRowCount` understates the server-side total while `$props.rowCount`/`pageCount` carry it. Fix: prefer `$props.rowCount` when set. Not yet implemented. |
| C-16 | **CONFIRMED** | `inherit-attrs="false" inherit-listeners="false"` on Column/DataTable/DetailPanel (and others) — real and undocumented. Docs-only fix. |

## Non-goals

- No changeset / version / push — owner-reserved.
- D-14 (angular leaf READMEs) stays out — Plan 3, repo-wide.
