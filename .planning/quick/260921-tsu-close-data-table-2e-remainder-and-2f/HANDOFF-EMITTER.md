# Handoff — the two emitter findings (N-03, N-04), decisions taken

**Written 2026-09-22.** Supersedes nothing; `HANDOFF.md` in this directory is the *previous*
session's and is now history. The authoritative record of the data-table program's state is the
verdict table in `PLAN.md` (committed), and `.planning/STATE.md`.

**Tree at time of writing:** `main` @ `a3238e4a7`, clean, **10 commits unpushed**. Verify branch
and `git status` before touching anything — this checkout is shared.

---

## The two decisions (owner, 2026-09-22)

| Finding | Decision |
|---|---|
| **N-03** — `inherit-attrs="false"` / `inherit-listeners="false"` are inert on Vue | **FIX THE EMITTER NOW.** |
| **N-04** — Angular setup-once statements read the input DEFAULT | **DIAGNOSTIC ONLY.** No codegen change. |

Both findings were re-measured immediately before the decision, not quoted from earlier notes.

---

## N-03 — fix the Vue emitter

### The measurement (re-verified 2026-09-22, do not re-derive)

A four-combination probe compiled through `@rozie/core`:

| Flags | Vue output |
|---|---|
| none (default) | `v-bind="$attrs"` on the root **+** Vue's own implicit fallthrough (double-applied to the same element, so harmless) |
| `inherit-listeners="false"` | `v-bind="$attrs"` still emitted — and on Vue `$attrs` **carries listeners**, so the flag does nothing |
| `inherit-attrs="false"` | spread omitted, **no `defineOptions`** — Vue's default `inheritAttrs: true` still applies everything |
| both `false` | same as above — **inert** |

Omitting the spread is *not* opting out. `grep -rn 'inheritAttrs' packages/targets/vue/src` returns
**zero**. The other five targets honour both flags.

**Corpus:** 6 families / ~28 components carry the flags —
data-table 12, chartjs 9 (8 variants + 1), rete 2, tiptap 1, fullcalendar 1, codemirror 1.
Plus `examples/ThemedButton*.rozie`, which re-apply `$attrs` manually and are the dist-parity
fixtures for this behaviour.

### The change

`packages/targets/vue/src/emit/emitScript.ts`. `ir` is already in scope there (it reads
`ir.props`, `ir.name`, `ir.emits`, `ir.slots`), so `ir.inheritAttrs` needs no threading.

Emit `defineOptions({ inheritAttrs: false })` when `ir.inheritAttrs === false`. Place it in the
documented output order at the top of that file — it belongs with the other compiler macros,
**before** `defineProps` (Vue requires `defineOptions` at the top level of `<script setup>`; it is
a macro, not a statement, so ordering relative to `defineProps` is a style choice, but the file's
header comment documents the order and must be updated to match whatever you pick).

### The part that needs a judgement call, not just code

**Vue has ONE flag where Rozie has two, and Vue's `$attrs` carries listeners.** So:

- `inherit-attrs="false" inherit-listeners="false"` → `inheritAttrs: false`. Exact.
- `inherit-attrs="false"` alone (listeners still inherited) → **not expressible.** `inheritAttrs:
  false` suppresses listeners too.
- `inherit-listeners="false"` alone (attrs still inherited) → **not expressible** in the other
  direction.

The corpus today only ever sets **both together**, so the exact case covers 28/28 components. The
owner declined the "add a diagnostic for the split-flag gap" option, so: implement the exact case,
and decide deliberately what the two mixed cases do. The conservative reading is that a mixed
setting keeps today's behaviour (emit nothing) rather than silently over-applying — but say so in a
comment at the emit site, because a future reader will otherwise assume it was an oversight, which
is exactly the shape of bug this whole program has been unpicking.

### Blast radius and the gate list (the F-03 precedent)

This is the same class of change as F-03 (the Solid slot-getter fix), which the owner approved on
2026-09-13. Its outcome section in
`docs/superpowers/plans/2026-09-11-data-table-source-defects-PROGRAM.md` is the template for what
this costs:

- A **toolchain release** — this is no longer "six data-table leaves". Release scope becomes
  `@rozie/core` + the Vue leaf of every affected family.
- **Regenerate every Vue leaf** in the 6 families.
- **Re-bless** what encoded the old shape. F-03 re-blessed 2 target-emitter snapshots, 1
  regressions fixture, 1 slot-matrix fixture, 3 dist-parity fixtures. Expect the analogous set
  here: `packages/targets/vue/src/emit/__tests__/__snapshots__`, `tests/dist-parity/fixtures`
  (the `ThemedButton*` family especially — they are the attrs-fallthrough fixtures), and
  `tests/regressions`.
- **`tests/vue-typecheck`** — `family-children.test.ts` holds a recorded per-family baseline. Read
  the delta before re-recording; an ADDED error is a regression, not a bless.

**Before re-blessing any dist-parity fixture, check whether all four entrypoints disagree with the
stored bytes while agreeing with each other.** F-03 recorded that distinction: four-way agreement
means a stale fixture; one leg differing means a real entrypoint-parity bug.

### It is a behaviour change, and that is the actual risk

A Vue consumer writing `<DataTable class="my-table">` gets the class on the wrapper today and will
not after this lands. Nothing in the repo depends on it (the components declare the opt-out
precisely because they do not want it), but published Vue consumers might. It belongs in the
changeset prose as a behaviour change, not a bugfix line.

`docs/components/data-table-api.md` carries a `::: warning Vue does not honour this yet` block
under "Attribute and listener fallthrough is OFF". **Delete that block when this lands** — it is
the only place the divergence is documented and it will become false.

---

## N-04 — diagnostic only

### The measurement (re-verified 2026-09-22)

A top-level `$data.x = <read of $props.y>` is setup-once, and the Angular emitter places it in the
**constructor**:

```ts
value = input<string>('');
constructor() {
  this.draft.set(this.value() != null ? String(this.value()) : '');
}
```

Angular sets inputs *after* construction, so `this.value()` returns the **default**. Measured on
the real component: `EditorDate` opened EMPTY on angular for every row — including one whose value
was already `YYYY-MM-DD` — while vue and lit seeded correctly. Isolated red proof: with the ISO
coercion correct and the seed still setup-once, the C-07 case was red on **angular alone**.

### I overstated this, and the correction is why it is only a diagnostic

Earlier in the session I called it "library-wide". It is not. Scanning the authored corpus at
`52d279314^` (the commit before the drop-in conversion) for top-level `$data.… = …$props.…`:

```
  1  packages/ui/data-table/src/EditorDate.rozie
  1  packages/ui/data-table/src/EditorNumber.rozie
  1  packages/ui/data-table/src/EditorSelect.rozie
  1  packages/ui/data-table/src/EditorText.rozie
  2  packages/ui/data-table/src/FilterNumberRange.rozie
  1  packages/ui/data-table/src/FilterText.rozie
  TOTAL: 7
```

**Seven, all data-table drop-ins, all already converted** to derived reads with a `touched` latch
in `52d279314`. Today the count is **zero**. So this is a latent trap for the next author, not
active breakage — which is why moving setup-once statements to `ngOnInit` (correct by construction,
but it changes *when* every setup-once statement runs on Angular for every component in the
library, for a pattern nothing currently uses) is the wrong trade.

### The change

A new suppressible **warning**. Next free code is **ROZ150** (`ROZ149` is the highest in the 100
cluster; `ROZ199` also appears — check `packages/core/src/diagnostics/codes.ts` and take the next
genuinely free one).

Fire when a **top-level statement in `<script>`** reads `$props` — i.e. setup-once code, not code
inside a function body, `$onMount`, or `$watch`. The message should name the fix, not just the
problem:

> Setup-once code reads `$props.<x>`. On Angular this runs in the constructor, where `input()`
> still returns its default — the value the consumer bound is not available yet. Read the prop
> through a derived function instead (`const xValue = () => $props.x`), which is correct on all six
> targets with no flash on the fine-grained ones.

**The reference implementation already exists in the corpus** and should be cited in the docs:
`FilterSelect.rozie`'s `selectValue()`. FilterSelect was the one drop-in of the eight *unaffected*
by this bug, precisely because it read the prop live instead of seeding. The seven converted
drop-ins now follow the same shape (`draftValue()` + a `touched` latch so the live read does not
overwrite the user mid-type).

Scope fence worth stating in the code comment: a setup-once read is only *wrong* on Angular. It is
fine on the other five. The diagnostic is therefore about cross-target parity, not about the
statement being invalid — word it so an author does not think their Vue-only component is broken.

---

## Two harness traps — read before running any VR sweep

Both are new, both cost most of a session, both are saved as memories.

**1. `tests/visual-regression/scripts/build-cells.mjs` EXITS 0 WHEN A TARGET SUB-BUILD FAILS.** It
prints `[visual-regression] sub-build FAILED for target: <t>` and returns success. So
`node scripts/build-cells.mjs >/dev/null 2>&1 && npx playwright test …` passes its `&&` guard and
runs against a **stale or missing `dist/<target>/`**. Always:

```bash
node scripts/build-cells.mjs > /tmp/bc.log 2>&1
grep -c 'sub-build FAILED' /tmp/bc.log        # must be 0
grep 'target sub-builds complete' /tmp/bc.log # must say 6/6
npx playwright test <filter> --workers=1
```

**2. `playwright.config.ts` sets no `workers`,** so Playwright defaults to half the CPUs. On a
loaded machine that alone produced 52 failures on a tree that was green an hour earlier; the same
cells pass in 1.7s isolated. **Use `--workers=1`** — what the Docker gate does. Budget ~10 min for
the data-table family on a quiet machine.

Between them these two fabricated roughly 600 failures across four sweeps and hid the one real
defect each run contained.

---

## Residual work this session did NOT finish

Do not treat any of this as done.

1. **`turbo run test` is 147/149.** Two recorded-baseline drifts, **uninvestigated**:
   - `@rozie/regressions` → `roz138-corpus-precision.test.ts`: still exactly **3** ROZ138 warnings,
     but the deep-equal on their SITES fails — this session's edits moved line numbers in
     `gridKeydownHandlers.rzts`. Almost certainly pure location drift (ROZ138 in this corpus is
     author-owned by decision, `.planning/notes/roz138-triage.md`), but **confirm the three sites
     are the same three** before re-recording.
   - `@rozie/vue-typecheck` → `family-children.test.ts`, "data-table: SFC-body errors match the
     recorded baseline (28 known)". The baseline moved. **Read the +/- delta** — an added error is
     a regression to fix, not to bless. Sibling listbox/sortable-list cases still pass, so the
     drift is data-table-local.
   - Note: an N-03 Vue emitter change will move the vue-typecheck baseline *again*. Investigate the
     current drift **first**, so you are not compounding two unexplained deltas.

2. **The Docker VR union has never run** — `bash tools/ci-repro/vr.sh`, **no `-g`** (the obvious
   `-g data-table` silently skips `header-menu` and `super`). Owed on this session's 10 commits
   **and** on `ba9b73f20`, which has never had one. Baseline: 2694 passed / 7 skipped / 0 flaky,
   exit 0. The 7 expected skips are `matrix.spec PartCardConsumer` ×5 + `waveform-coverage [lit]`
   ×2 — confirm **zero commits** to those two specs before accepting them.

3. **Ten data-table findings are OPEN with a written, preserved fix** — B-15 C-10 C-05 B-04 B-06
   B-03 B-13 C-04 A-06 A-05. Patch set at
   `.planning/quick/260921-tsu-close-data-table-2e-remainder-and-2f/cluster8-patchset/`
   (9 files, committed alongside this doc). Re-apply **one finding
   at a time, red-first case FIRST**, sweep between each. Start with the four that touch no
   windowing geometry (B-15, C-10/C-05, B-13, C-04), then A-06, then B-06/B-03/A-05 last. Full
   reasoning and the two defects that came in with them are in `PLAN.md`.

4. **D-19a / D-19b** were never reached.

5. **2G sign-off, human-only:** open `/components/data-table-demo`, double-click a Name cell,
   confirm the editor opens and commits.

---

## Standing rules that earned their keep this session

- **Measure every stated cause before fixing it.** Three framings fell this session: B-12 is FALSE;
  A-08's vehicle is a listener, not a validator (the first test used a validator and stayed GREEN
  against unfixed code on all six — it could not fail); C-13 is wider than filed.
- **No fix lands without a test that failed before it.** The ten reverted findings are the whole
  argument for this rule. A one-word typo cost two reverts of good work and four full sweeps to
  localise, because nothing pointed at a finding.
- **The gates see what VR cannot.** VR ran 1170/1170 green while `setRangeFocus`/`thStyle` were
  breaking the strict leaf typecheck and the angular/vue leaf builds — VR tests compiled JS and
  never looks at the leaf `.d.ts` surface.
- **Owner-reserved, untouched:** changeset, version, push, publish.
