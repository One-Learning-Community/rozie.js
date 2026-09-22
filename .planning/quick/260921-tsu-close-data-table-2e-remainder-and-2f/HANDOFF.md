# Handoff — data-table source-defect program, 2026-09-21

## State of the tree

- Branch **`main`**, working tree **clean**, **12 commits unpushed** (`07d1af7ac..3c58a470e`).
- This checkout is shared with other sessions. **Verify branch + `git status` before touching
  anything** — and do not assume this handoff still describes the tree.
- **0.5.1 is NOT released.** No changeset, no version bump, nothing published. Owner-reserved.

## Program arithmetic (re-derive, don't inherit)

Inventory is **54** IDs. **19 closed · 1 false · 34 open.**

My first estimate of the remaining work was wrong twice, so recount rather than trust a
heading: the wave titles in the program index imply 2C/2D are finished and they are not.

**Closed (19):** A-01 B-05 B-09 B-10 C-01 C-02 C-03 C-06 C-11 C-14 E-05 F-01 F-03 F-04 F-05
F-06 F-07 F-08 N-01
**False (1):** A-07
**Open (34):**
- A-02 A-03 A-04 A-05 A-06 A-08
- B-01 B-02 B-03 B-04 B-06 B-07 B-08 B-11 B-12 B-13 B-14 B-15 B-16
- C-04 C-05 C-07 C-08 C-09 C-10 C-12 C-13 C-15 C-16
- D-19a D-19b · E-03(src) E-06(src) · N-02

Note B-01 + B-02 are wave **2C** and A-02 A-03 E-03 E-06 are wave **2D** — both waves were
left part-done, which is why the "2E remainder + 2F" framing undercounts.

## The one methodological rule that matters here

**Measure every stated cause before fixing it.** This program's record on inherited causes:

- 3 of 3 deferred-item causes re-measured **wrong** (two hiding real breakage)
- 4 "harness limitation / framework characteristic" framings **falsified** (F-01, F-03, F-07, plus the monkey-patched-`focus` evidence that could never have been probative)
- A-07 **falsified** 2026-09-21 — `helpers/rowValueUtils.ts:56` matches `rowId` first, then
  `r.original` identity; the sole caller passes both. Id-first exactly as documented.

**And the sharper version of the same lesson: three assertions that looked like coverage could
not fail.** Found in 260915-wqj:
- the select-editor seed asserted row 0's `'active'`, which is *also* `statusOptions[0]` — the
  exact value the browser falls back to at `selectedIndex` 0
- the editor-focus test opened only column 0, whose drop-in was the one already working
- `width` had no demo using it at all

So when a finding says "X is broken" and a test covering X is green, **suspect the test**.
Each trap is now documented at its assertion; don't undo those comments.

## Ready to pick up — already measured, fix prescribed

| ID | Measured evidence | Fix |
|---|---|---|
| **N-02** | `--rdt-pin-btn-border`/`--rdt-pin-btn-radius` declared at `themes/base.css:118-119` **and** `DataTable.rozie:3086-3087`; `var(--rdt-pin-btn-border\|radius)` read **0×** (only `--rdt-pin-btn-active-bg`, at `:3450`). Died when always-visible pin-controls became the header ⋯ menu — see the comment at `:3400`. | Delete from **both** places (codegen fails the build if they drift — F-01's guard), then re-check the token-count prose the docs pages generate from. |
| **A-04** | `totalRowCount()` reads `getFilteredRowModel().rows.length`. Under `manual`, table-core only holds the consumer-supplied page, so `gridAriaRowCount` understates the server-side total that `$props.rowCount`/`pageCount` carry. | Prefer `$props.rowCount` when set; derive from `pageCount × pageSize` as fallback. |
| **C-16** | `inherit-attrs="false" inherit-listeners="false"` on Column / DataTable / DetailPanel and others — real, undocumented. | Docs-only. |

## Gates (the real ones)

Targeted runs justify a commit; they are **not** the CI-equivalent gate. The a11y commit
(`ba9b73f20`) has had only the family build + its one affected case. Still owed on it:

```bash
npx turbo run build --force --continue --concurrency=4     # expect 243/243
npx turbo run test  --force --continue --concurrency=2     # expect 149/149
npx turbo run typecheck --force --continue --concurrency=2 # expect 324/324; run from REPO ROOT
cd tests/visual-regression && node scripts/build-cells.mjs && npx playwright test data-table
bash tools/ci-repro/vr.sh        # NO -g. Baseline: 2694 passed / 7 skipped / 0 flaky, exit 0
```

Landmines that cost me time:

- `turbo run typecheck` from a subdirectory silently scopes to that subtree (30 tasks, not 324).
- `vr.sh -g data-table` **skips** `header-menu` and `super`. Run the union, no `-g`.
- The 7 expected VR skips are `matrix.spec PartCardConsumer` ×5 + `waveform-coverage [lit]` ×2.
  Confirm **zero commits** to those two specs before accepting them.
- Docs surface-hash gate will fire on any public-surface change: re-read
  `docs/components/data-table-comparison.md`, confirm it's still accurate, *then* update the hash.
  It exists to force the read — don't just paste the new hash.
- `.rozie` files trip grep's binary heuristic (em-dashes). Always `grep -a`.
- Naming: `ariaColCount`/`ariaColIndex`/`ariaRowCount` collide with inherited ARIA-reflected
  `Element` properties → a same-named method becomes a Lit class field that shadows them, TS2416
  cascading to every `@property`. Hence `gridAriaColCount`, `headerLeafStart`, `totalRowCount`.
- Drop-ins must **not** introspect table-core: `column` is `type: null` → `unknown`, so
  `column.columnDef.header` fails leaf strict tsc. The host forwards `columnLabel` instead.

## Owner-reserved / human-only

- Changeset, version bump, push, publish.
- **2G sign-off no gate can replace:** open `/components/data-table-demo`, double-click a Name
  cell, confirm the editor opens and commits.

## Release scope if you ship what's landed

`@rozie/core` + the six `@rozie-ui/data-table-*` leaves. Measured on a cold `build --force`:
data-table only, zero other families.

## Pointers

- Program index: `docs/superpowers/plans/2026-09-11-data-table-source-defects-PROGRAM.md`
- This task: `.planning/quick/260921-tsu-close-data-table-2e-remainder-and-2f/PLAN.md` (verdicts table)
- Prior session: `.planning/quick/260915-wqj-.../SUMMARY.md`
- ROZ138 decision record: `.planning/notes/roz138-triage.md` — React `$data` read-after-write
  staleness is **deliberately author-owned**; 0 real bugs in 24/24 triaged warnings. Only the
  emitter-*synthesised* variant is emitter-owned. Do not relitigate this.
