---
"@rozie-ui/data-table-react": patch
"@rozie-ui/data-table-vue": patch
"@rozie-ui/data-table-svelte": patch
"@rozie-ui/data-table-angular": patch
"@rozie-ui/data-table-solid": patch
"@rozie-ui/data-table-lit": patch
---

Fixes a grouped-header rendering defect: under `table-layout: fixed` (which every windowed/virtualized data-table already opts into), a multi-level group header's `<th>` reported table-core's flat single-column default size (150px) instead of the sum of its spanned leaf columns' sizes, so the browser divided that single declared width across every leaf column the group spans — a 5-column group rendered each leaf at 30px (150 / 5) instead of its real declared width. This was a pre-existing gap (tracked since Phase 87 as "Gap 1" in that phase's deferred-items ledger) that surfaced whenever a grouped-header table's rendered column window happened to include the grouped columns; it is now fixed at the source — the header-width chrome helper reads table-core's own `Header.getSize()` (which already sums descendant leaf-column sizes correctly for a group header, and is behavior-identical to the old code path for an ordinary leaf header) instead of the ungrouped `Column.getSize()` accessor. No prop or markup changes; any consumer using multi-level grouped headers will simply see the grouped columns render at their correct, intended width.

Also hardens the fill-drag edge-auto-scroll gesture's cell hit-test (`fillDrag.rzts`, shared by the drag-select gesture too): the single-exact-pixel `elementFromPoint` probe used to resolve which cell sits under a stationary pointer while content auto-scrolls beneath it now falls back to a small nearest-cell horizontal search when the exact point misses, making the gesture robust against a narrow column transiting past the fixed probe point within a single animation frame. This is defense-in-depth alongside the width fix above (which was the actual root cause of the one observed user-facing symptom, a fill-drag range that failed to extend past a grouped-header column region during auto-scroll) — behavior is unchanged on every ordinary (non-edge-case) frame.
