---
quick_id: 260921-tsu
slug: close-data-table-2e-remainder-and-2f
date: 2026-09-21
status: in-progress (22 findings closed + committed; 12 open; 2 emitter findings escalated)
---

# Close the data-table 2E remainder + all of 2F

**38 open — not the 24 I first estimated.** Correcting my own count: waves 2C and 2D were
never finished either. 2C left B-01 + B-02; 2D left A-02, A-03, E-03(src), E-06(src) (only
A-01 was closed). Enumerated the whole 54-ID inventory against the closed set rather than
trusting the wave headings.

**Count re-derived against the 54-ID inventory at the start of THIS session (2026-09-21, second
pass): 19 closed, 1 false, 34 open.** The wave headings still imply 2C/2D are finished; they are
not. Not inherited from the previous section — enumerated again.

**Closed entering this session (19):** A-01 B-05 B-09 B-10 C-01 C-02 C-03 C-06 C-11 C-14 E-05
F-01 F-03 F-04 F-05 F-06 F-07 F-08 N-01
**FALSE (1):** A-07
**Open entering this session (34):**
- A: A-02 A-03 A-04 A-05 A-06 A-08
- B: B-01 B-02 B-03 B-04 B-06 B-07 B-08 B-11 B-12 B-13 B-14 B-15 B-16
- C: C-04 C-05 C-07 C-08 C-09 C-10 C-12 C-13 C-15 C-16
- D/E/N: D-19a D-19b E-03(src) E-06(src) N-02

**Closed THIS session (12):** N-02 A-04 C-16 B-01 B-02 B-11 B-16 A-02 A-03 E-03(src) E-06(src)
+ B-12 (FALSE). **New this session (1):** N-03, measured and escalated (see below).
**Still open (2):** D-19a D-19b — Solid `onFilterChange` typing and the `style={{…}}` examples
in the generated docs. Not reached.

**REVERTED, still OPEN (10):** B-15 C-10 C-05 B-04 B-06 B-03 B-13 C-04 A-06 A-05.
Each has a measured cause (see its row below) and a written fix, and the full patch set is
preserved at `<scratchpad>/cluster8/` (9 files). None of them landed.

## Why the cluster did not land — read this before re-applying any of it

**None of the ten had a red-first case.** That is the whole story. Two real defects were
introduced along with them, and because no case pointed at a finding, localising each one cost a
full sweep and a bisect:

1. **A-06's filter-row insertion used the wrong loop variable.** The two `class="rdt-filter-cell"`
   sites iterate DIFFERENT names — non-windowed `r-for="header in …headers"`, windowed
   `r-for="wh in windowedHeadersFor(…)"` — and I replaced the same static string at both, so the
   windowed row called `columnPinSide(header.column.id)` against an undefined `header` and threw
   on every cell, on every target, killing the windowed table outright. **221 of 269 failures.**
   Fixed (`wh.header.column.id`); the two affected specs then ran 236/236.
2. **A second React `useCallback` dep-array TDZ** (`ReferenceError: Cannot access 'g' before
   initialization`), on top of the `onEditorDropinKeyDown`/`ze` one already fixed. Still
   unlocalised: reverting `gridKeydownHandlers.rzts` did not clear it, nor did reverting
   `DataTable.rozie`, and the inter-file dependencies make a file-at-a-time bisect unreliable
   (reverting one partial leaves its importer referencing a symbol that no longer exists). 12
   react-only cells in `data-table-header-menu` / `super` / `dropins`.
3. **`D-13 fill drag near the top edge` x6** — a genuine cross-target regression, unattributed.
   Most likely B-06 (`pinnedEditIndex` now forces the ACTIVE row into the window, changing the
   rendered row set every grid table renders with).

Final state after the fix in (1): **1151 passed / 19 failed**, down from 269 — but 19 red is not
a tree to hand on, so the cluster was reverted whole and the tree returned to HEAD.

**Re-apply ONE finding at a time. Write its red-first case FIRST.** Run
`node scripts/build-cells.mjs > /tmp/bc.log 2>&1` and check `grep -c 'sub-build FAILED' /tmp/bc.log`
is 0 and `6/6 target sub-builds complete`, then `npx playwright test data-table --workers=1`
between each. Start with the four that touch no windowing geometry (B-15, C-10/C-05, B-13, C-04),
then A-06, then B-06/B-03/A-05 last — those three change the rendered window set that
`data-table-grid-column-virtual` and `data-table-auto-measure` assert directly.

## Two harness traps that cost most of the debugging time

**1. `build-cells.mjs` EXITS 0 WHEN A TARGET SUB-BUILD FAILS.** It prints
`[visual-regression] sub-build FAILED for target: <t>` and returns success, so
`node scripts/build-cells.mjs >/dev/null 2>&1 && npx playwright test …` passes its `&&` guard and
runs against a STALE OR MISSING `dist/<target>/`. Mid-bisect this produced a convincing false
signal and three good fixes were reverted on it.

**2. `--workers=9` contention.** `playwright.config.ts` sets no `workers`, so Playwright takes
half the CPUs. On a loaded machine this alone produced 52 failures on a tree that was green an
hour earlier; the same cells pass in 1.7s isolated. Use `--workers=1` — what the Docker gate does.

One genuine defect hid inside that noise and was found by reading a minified stack rather than
the failure list: `onEditorDropinKeyDown` (C-10/C-05) declared BEFORE the `onEditorKeyDown` it
delegates to; React evaluates a `useCallback` DEPENDENCY ARRAY eagerly, so every React cell in the
family died at mount. Silent on the other five. The preserved patch set already carries that fix
and a declaration-order comment.

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
| C-16 | **FIXED (docs)** | Measured: ALL TWELVE components in the package carry `inherit-attrs="false" inherit-listeners="false"`, and `$attrs`/`$listeners` appear ZERO times in any of their templates — so nothing is re-applied and an undeclared attribute or native listener is dropped outright. New "Attribute and listener fallthrough is OFF" section in `data-table-api.md`. No rationale invented: none is recorded in the source and all twelve templates are single-root, so the multi-root explanation (the one the language docs give) is NOT why. |
| **N-03** | **NEW — measured, NOT fixed (owner decision needed)** | Found while documenting C-16. `inherit-attrs="false"` and `inherit-listeners="false"` are **entirely inert on Vue**. Compiled a 4-combination probe through `@rozie/core`: with the flags set, the Vue emitter simply omits the `v-bind="$attrs"` spread — and omitting the spread is NOT opting out, because Vue's OWN default `inheritAttrs: true` still falls every undeclared attribute through onto the single root. No `defineOptions({ inheritAttrs: false })` is ever emitted (0 occurrences across `packages/targets/vue/src`). The listener flag is inert for the same reason: on Vue listeners ride in `$attrs`. The other five targets honour both flags. Blast radius: 6 families (data-table 12 components, chartjs 9, rete 2, tiptap 1, fullcalendar 1, codemirror 1) x the Vue leaf. This is an emitter-owned parity gap per the founding principle, and the fix is small — but it REMOVES behaviour a Vue consumer may be relying on today, and it changes the release scope from "six data-table leaves" to a toolchain release + every affected Vue leaf. Escalated rather than taken unilaterally (the F-03 precedent). The data-table docs carry an explicit Vue caveat in the meantime. |
| N-02 | **FIXED** | Deleted `--rdt-pin-btn-border` / `--rdt-pin-btn-radius` from BOTH `themes/base.css` and `DataTable.rozie`'s `:host` block; the codegen drift guard passed on the rebuild (26 -> 24, in sync). Re-checked the generated token prose as instructed: 18 public / 82 read / 58 unwired are all UNCHANGED, because the two deleted declarations were wiring that nothing read — the counts never included them. Re-measurement did find the prose scoped to `<DataTable>` alone while listing GroupBar-ish examples; `<GroupBar>` reads 9 further internal tokens (`--rdt-group-drop-zone-*`, `--rdt-group-drop-marker`, `--rdt-focus-ring`), none public, all inline-defaulted. Stated explicitly rather than folded into the number. |
| A-04 | **FIXED** | `totalRowCount()` prefers `$props.rowCount`, else `$props.pageCount * pageSize()`, under `manual`. RED-FIRST PROVEN: 18/18 red -> 18/18 green on six targets (`aria-rowcount` measured `"11"` pre-fix against an expected `"138"`). New fixture + spec, because `rowCount`/`pageCount`/the whole `manual` contract had ZERO exercise repo-wide — the audit's own zero-coverage list, re-measured. 137 rows at pageSize 10 makes `pageCount * pageSize` (140) a strict over-count, so the two count sources assert DIFFERENT numbers and neither can shadow the other. |
| B-01 | **FIXED** | `setRangeFocus` takes an EXPLICIT anchor and `beginRangeDrag` passes the mousedown cell, so no target reads `$data.activeRow` inside the drag closure. RED-FIRST PROVEN: red on **react only**, green on the other five — exactly the audit's prediction (they read the state live inside `move`, after focusin; React's document-pointermove closure is frozen at the pre-mousedown render). The pre-existing §6 case drags (0,0)->(1,1), where the stale read is accidentally correct — it cemented the bug. |
| B-02 | **FIXED** | Not by committing on a null `relatedTarget`: measured that an editor RECYCLED out of the virtual window blurs identically, `closest()` resolves an owning `<td>` even in a detached subtree, and deferring a frame does not separate them either (the node is reattached, focus is on `<body>`) — it closed the pinned editor on solid, caught by `data-table-edit`'s virtualization-recycle case. A click-away is a CLICK, so a document-level `pointerdown` listener (capture, `composedPath()` for Lit's shadow root) sets a module-let flag and the template-bound blur handler consumes it. The listener cannot commit for itself: on React a once-attached document listener closes over the attaching render and would write the draft as of editor-OPEN. |
| B-11 | **FIXED** | `rangeClickPending` now carries `{ isHeader, r, c }` instead of a boolean. RED-FIRST PROVEN: red on all six. Shift+Click on the already-focused cell fires no focusin, so the boolean stayed armed and the next ordinary click consumed it and skipped its own `clearRange()`, stranding the rectangle. |
| B-12 | **FALSE** | The twin claim does not hold. `rangeDragMoved` is consumed only in `onGridClick`, which returns early when `singleClickEdit` is off — but `beginRangeDrag` resets it to false at the START of every gesture, and a `click` can only follow a `mousedown`, so it is fresh at every consume site. No reachable staleness; nothing to fix. |
| B-16 | **FIXED** | `onGridMouseDown` returns when `isEditing(row, col)` — a mousedown inside the cell being edited is the user placing a caret or drag-selecting TEXT, and it was starting a grid drag-select over the very cell being typed into. |
| A-02 | **FIXED** | Verified the stated cause in the installed virtual-core rather than inheriting it: `getMeasurements` memoizes on `[getMeasurementOptions(), itemSizeCacheVersion]`, and `getMeasurementOptions` keys on count/paddingStart/scrollMargin/getItemKey/enabled/lanes/laneAssignmentMode — `estimateSize` is genuinely absent, and `measure()` (line 1085) is the only thing that bumps the version. New `remeasureColumnSizes()` calls it when an order-sensitive hash of the leaf widths changes; driven from `$onUpdate` as well as the re-feed, because an interactive resize runs under `columnResizeMode: 'onChange'` and never reaches the `$props.columnSizing` watch on the uncontrolled path. The hash also stops `measure()`'s own `notify` from feeding itself. |
| A-03 | **FIXED** | `windowedHeadersFor()` now sums the widths of the same in-window leaves it already counts for the clamped colspan, and `thStyle(header, widthPx)` prefers it over `Header.getSize()` (every descendant leaf, in-window or not). Same `getSize()`-vs-colspan mismatch as the earlier `Column.getSize()` -> `Header.getSize()` fix, inverted from a 5x collapse into a 5x expansion for the straddling case. |
| E-03(src) | **FIXED** | `editor="date"` (and any typo) silently fell through `editorTypeOf`'s `r-else` to a plain text input. Now warned at column-BUILD time — not in `editorTypeOf`, which runs per cell per render — latched per `id:value`, naming the real union and pointing at `editor="custom"` + `<EditorDate>`. Unguarded `console.warn`, matching the D-07/D-08 virtual-misconfig warns already in this component. |
| E-06(src) | **FIXED** | `data-depth` was written on the `<tr>` on both body paths and selected by NOTHING — no rule in the component `<style>`, in any `themes/*.css`, or in any compiled leaf. Eight explicit depth levels indent the first DATA cell (`.rdt-expander-td + .rdt-td`, addressable without a template change because chrome columns are injected first and tree mode always injects the expander) via a `::before` inline-block spacer, so the consumer's `--rdt-cell-padding` is preserved and the indent leads correctly under `dir="rtl"`. NOT the expander cell: it is a fixed-width chrome rail and a padding indent there eats the chevron under `box-sizing: border-box`. Depth 9+ keeps the level-8 indent — a real, documented cap. The false claim "Deep tree indentation is applied as padding-left WITHIN the cell" is corrected in place. |
| B-09 (regression found) | **SPEC CORRECTED** | The full local sweep — never run on `ba9b73f20` — caught `data-table-grouped-defs.spec.ts:494` and `:511` still asserting `'cells pasted'` for two Delete-clear operations. B-09's fix is right and the assertions predated it; both now assert `'cells cleared'`. 42/42. |
| VR flake (recurred) | **TEST HARDENED** | `data-table-grid-column-virtual [angular] D-08/D-09 col55` failed again under parallel load (recorded once before, 2026-09-14). Same signature: full 15s timeout under load, 1-2s pass in isolation. Its retry re-focused but did NOT re-issue the scroll reset, so when the column window had not settled back over col2 the `.focus()` no-op'd and the loop retried a call that could never succeed. The scroll is now inside the poll. 176/176. |

| B-07 | **FIXED** | `preventDefault` ran before the verb's own `navigator.clipboard` guard, so on an insecure origin / restrictive permissions policy the browser's OWN copy/cut/paste was suppressed and nothing replaced it. Availability is now part of the branch CONDITION. Cut is gated on WRITE availability deliberately — a cut that cannot copy is destruction with an empty clipboard. RED x6. |
| B-08 | **FIXED** | `applied` (announce numerator) and `committed` (write + emits + undo) split. An unchanged cell emitted `cell-edit-commit` and recorded an undo step: a 1->5 fill fired 5 commits, a Delete over an empty cell pushed a no-op undo. RED x6. |
| A-08 | **FIXED** | `pasteRange`'s bare `.catch(() => {})` swallowed a rejected clipboard READ (legitimately silent) and consumer throws alike; the per-cell emit loop was unguarded, so ONE throwing `cell-edit-commit` listener truncated the rest of a multi-cell paste after the model was fully written. TWO measurements corrected the case: a throwing VALIDATOR is not the vehicle (`runValidator` already catches and reports 'Invalid value' — the first version of the test used one and stayed GREEN against unfixed code on all six, i.e. it could not fail); and where our own message is observable is target-dependent (react/svelte/solid dispatch directly; vue/angular/lit absorb a listener throw before our frame). Asserted claim is the consumer-visible one on all six; message assertion scoped to the three. Red-proof matched exactly. |
| C-09 | **FIXED** | `<Column>`'s re-register watch keys on `editorOptions`/`aggregationFn`/`validate`, whose DOCUMENTED wiring is an inline literal (`data-table-usage.md:567` ships `editorOptions={[…]}`) — a new identity every render, so every render whole-object-replaced `$data.colReg` and the parent re-fed the whole table. Guarded at the registry seam with value equality; functions compare on identity then `toString()`, so an inline arrow re-created each render is equal while a different validator still re-registers. Depth-bounded. 8 unit cases. |
| C-12 | **WONTFIX (documented)** | The default really is the family's only true-defaulting boolean, and it stays: the flag only controls whether a column is OFFERED to the `#groupBar`, so a false default leaves the bar empty on every table and the feature looks broken until every column is opted in. Written down on the Columns page as the deliberate exception. |
| C-13 | **FIXED** | Measured wider than filed. `coerceCellValue` covered ONE of four built-in editor types, and every write path that does not open the built-in control arrives as a TSV string — so a `checkbox` column took `''` from a Delete and the text `'true'` from a paste into a boolean field. Recognised spellings both ways, everything else `false`. `select` deliberately uncoerced (its model type IS the option string). RED x6, asserted on `typeof` — `'false'` is a truthy string, so a truthiness check would pass against the wrong value. |
| C-15 | **WONTFIX (documented)** | Probed, not assumed: neither ROZ142 nor ROZ147 fires for a prop named `id`, because ROZ142's `LIT_DOM_PROP_FOOTGUNS` is a curated list that names `id` as an already-shipped safe name. The real consequence is narrower than "collision": `reflect: true` writes the column id onto the element's DOM `id`, so two tables sharing a column id produce duplicate DOM ids. Elements are renderless and `display:none`. Renaming the attribute would break the public Lit API for a cosmetic gain. Documented instead. |
| B-14 | **FIXED** | `user-select: none` scoped to `[role="grid"]`, with inputs/textarea/select/contenteditable exempt — the exemption is asserted too, because losing it breaks caret placement in an open editor, a worse bug than the one fixed. Table mode untouched. RED x6. |
| C-07 | **FIXED** | `String($props.value)` is not the ISO coercion the component's own `docs:` string promises; a native date input accepts only `YYYY-MM-DD` and renders BLANK for anything else. New pure `helpers/dateValue.ts` — the ISO-datetime branch takes the date part AS WRITTEN (re-deriving from local parts shows the previous day west of UTC) while a `Date` is read from local parts. RED x6. The fixture could not have caught it: every row held an already-ISO string. |
| C-08 | **FIXED** | Both drafts were setup-once and the components are not remounted when the filter changes, so an external reset left the inputs advertising a filter that was gone. `FilterSelect` was never affected (it reads `$props.value` live) — that pattern adopted for both. RED on 5 of 6: **Solid is accidentally correct**, because its slot-invocation reconcile REMOUNTS the drop-in and the seed re-runs. The fixture could not have caught it either — the demo forwarded `:value` to FilterSelect alone, behind a stale comment claiming the producer did not declare `value`. |
| **N-04** | **NEW — measured; data-table side FIXED, emitter gap open** | A top-level `$data.x = <read of $props.y>` is setup-once, and the ANGULAR emitter places setup-once statements in the CONSTRUCTOR, where an `input()` signal still returns its DEFAULT. Measured: `EditorDate` opened EMPTY on angular for EVERY row, including one already `YYYY-MM-DD`, while vue and lit seeded correctly. Isolated red proof: correct coercion + setup-once seed = red on angular ALONE. Seven of eight drop-ins used that seed; all converted to derived reads with a `touched` latch (FilterSelect's existing pattern, which is why it was the one unaffected) — correct on all six by construction, no flash, no per-target branch. The EMITTER gap is untouched and library-wide: every component that seeds from props at setup has it. |
| B-15 | **OPEN — fix written, REVERTED** | Shift+Space (row), Ctrl+Space (column, as a full-height cell range over the same corners Ctrl+A drives) and Escape-in-navigation-mode (collapse the range) were all absent. Placed before every bare `' '` branch, since the boolean in-place toggle matches `' '` without excluding modifiers. |
| C-10 + C-05 | **OPEN — fix written, REVERTED** | One seam. A drop-in binds none of the host's key handling, so Tab fell through to native tab order and walked focus out of the grid with the editor still open (C-10), and in row mode Enter only staged a draft — `editingRowIndex` stayed set and arrow nav stayed dead (C-05). A `@keydown` on the `display:contents` span wrapping the `#editor` slot catches the bubbled event from whatever the consumer rendered. Row mode ignores `defaultPrevented` for Enter/Escape on purpose (a drop-in preventDefaults Enter to mean "no newline"); single-cell honours it for Tab so a multi-field editor keeps its own. |
| B-04 | **OPEN — fix written, REVERTED** | `extendRange` applies its delta to the range FOCUS corner; the caller measured the distance from the ACTIVE cell. They agree for shift+arrow but not after a drag-select or Ctrl+A, which move the focus corner without syncing the active cell — so Ctrl+Shift+Arrow stopped short of the edge by exactly the gap. Measured from the focus corner now. |
| B-06 | **OPEN — fix written, REVERTED** | `pinnedEditIndex` widened from "the editing row" to "the row that must not recycle": the active cell is the grid's ONLY `tabindex="0"`, so a wheel-scroll that carried it out of the window left the grid with no tab stop and a roving model pointing at a cell with no DOM node. The row-axis twin of D-10's `forcedColumns`, which has forced the active COLUMN since phase 87. |
| B-03 | **OPEN — fix written, REVERTED** | Both halves. `focusActiveCell`'s scroll-then-focus was `!header && (rowOut \|\| colOut)`, so a header-active move to an off-window column never scrolled it in; and `forcedColumns` skipped the active column for header cells on the stated grounds that "a header-active cell has no column-axis rendering dependency" — false, since `windowedHeadersFor()` slices the header row from the very set that function feeds. The poll also now resolves with the header key. |
| B-13 | **OPEN — fix written, REVERTED** | Filed as PLAUSIBLE; now reproducible, and C-05 is why. `commitRow`'s only re-entry guard is `$data.editingRowIndex == null`, async-stale on React — and a drop-in's Enter now commits the row through the host wrapper, with the following focus change firing `onEditorBlur`, whose row branch commits again. `committedThisSession` added to `commitRow` only; `cancelRow` deliberately does NOT latch, matching `cancelEdit`, which does not either (a re-entrant cancel is idempotent and writes nothing). |
| C-04 | **OPEN — fix written, REVERTED** | Native HTML5 DnD was the sole input path, on elements with no tabindex, role or key handler; Remove and Clear were real buttons, so a keyboard user could only UNGROUP. Palette chips are now real `<button>`s (Enter/Space and focusability for free, `draggable` retained so the pointer path is unchanged); grouping tokens take `role="listitem"`, `tabindex="0"`, Alt+Arrow reorder and Delete/Backspace remove. Alt+Arrow, not bare arrows: the tokens sit in a toolbar users also arrow THROUGH. Both paths write through the same `applyGrouping` funnel the drop handler uses. |
| A-06 | **OPEN — fix written, REVERTED** | `pinStyle` takes the sticky offset from table-core's size model (`getStart('left')`) while outside `.rdt-col-windowed` the cells are content-box, so padding renders on top of the declared width: the select rail declares 44px and renders 58.2px, and the column pinned after it overlaps by 14px, compounding per pinned column. `box-sizing: border-box` on the PINNED cells only — declared == rendered for exactly the cells the sticky math depends on, with no change to any unpinned column. |
| A-05 | **OPEN — fix written, REVERTED** | Same root cause as A-02, on the other axis: `setOptions()` does not invalidate `getMeasurements()`, so `fresh.start - anchorStart` was structurally 0 and the D-16 anchor correction never ran. It was non-zero on React ONLY by accident — `getItemKey` IS in the memo key and React hands virtual-core a fresh identity each render. Fixed by bumping `itemSizeCacheVersion` directly rather than calling `measure()`, which also clears the size cache the fold sweep just filled. Feature-detected. |
| D-19a / D-19b | **OPEN** | Not reached this session. |

## Non-goals

- No changeset / version / push — owner-reserved.
- D-14 (angular leaf READMEs) stays out — Plan 3, repo-wide.
