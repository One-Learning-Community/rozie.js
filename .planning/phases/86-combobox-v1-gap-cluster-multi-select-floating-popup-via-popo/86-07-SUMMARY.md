---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 07
subsystem: ui
tags: [rozie-compiler, combobox, popover, command-palette, changeset, release-prep, floating-ui]

requires:
  - phase: 86-01
    provides: Proven command-palette->combobox->popover two-level composition chain
  - phase: 86-02
    provides: Popover keepMounted/matchWidth + the D-08 byte-identity verdict (HOLDS)
  - phase: 86-04
    provides: Multi-select value-array widening (R1)
  - phase: 86-05
    provides: Chip rail, D-13 inside-control (R1)
  - phase: 86-06
    provides: Creatable mode (R3)
provides:
  - The three SPEC prohibitions machine-enforced by a self-proving node test over all twelve emitted combobox+popover leaf sources
  - Comparison-matrix flip (multi-select, floating popup, creatable all read as supported) with a regenerated docs surface_hash
  - All six command-palette leaves' combobox peer bumped ^0.4.0 -> ^0.5.0, with a scoped pnpm.overrides bridge so `pnpm install` resolves against the not-yet-published minor
  - A genuine cross-target regression found by this plan's own full VR gate (command-palette's pinOpen contract silently broken by Popover's independent outside-click/Escape dismissal) diagnosed to root cause and fixed with a new opt-in `disableDismiss` popover prop
  - One changeset covering the phase-86 release wave at the human-confirmed D-08 bump levels (combobox minor x6, popover patch x6, command-palette patch x6) — 18 published leaves, no private root, data-table deliberately excluded
affects: []

actuals:
  tokens: 46000
  tasks: 5
  commits: 6

tech-stack:
  added: []
  patterns:
    - "A composing component using Popover's `trigger=\"manual\"` gets Popover's document-level Escape/click-outside dismissal for free (D-07), but that dismissal writes the two-way `open` model DIRECTLY and bypasses any local guard (like combobox's own `pinned`/`onBlur`) the composing component maintains — a host sub-surface anchored to, but not nested inside, Popover's own anchorEl/floatingEl is judged \"outside\" and silently closes the panel. The fix pattern: an opt-in `disableDismiss` prop on the composed primitive, forwarded from a REACTIVE (not plain-`let`) mirror of the composing component's own pin state."
    - "A caret range bumped ahead of the referenced package's own (not-yet-bumped) `version` field breaks `pnpm install` outright (`ERR_PNPM_NO_MATCHING_VERSION`, since `auto-install-peers=true` tries to satisfy the new range from the npm registry). Bridge with a temporary, narrowly-scoped root `pnpm.overrides` entry pinning the bumped package(s) to `workspace:*` — this only affects THIS repo's own install resolution, never the published peerDependencies contract in the leaf manifests, and is safe pre-publish scaffolding."
    - "Running the family's full VR union locally on macOS produces expected, cosmetic-only pixel diffs (font-kerning/anti-aliasing at glyph edges) against Linux-rendered baselines — confirmed via the diff PNG showing only highlighted text-edge pixels with otherwise-identical structure. Use the local run for BEHAVIORAL confirmation only; the Docker (Linux) run is the only one that can bless or fail a pixel baseline."

key-files:
  created:
    - packages/ui/combobox/tests/prohibitions.test.ts
    - .changeset/combobox-multiselect-floating-creatable.md
  modified:
    - docs/components/combobox-comparison.md
    - docs/components/popover-comparison.md
    - packages/ui/popover/src/Popover.rozie
    - packages/ui/popover/scripts/compile-popover-check.mjs
    - packages/ui/popover/tests/surface.test.ts
    - packages/ui/popover/__fixtures__/rozie-manifest.expected.json
    - packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/* (codegen-regenerated)
    - docs/components/popover.md
    - packages/ui/combobox/src/Combobox.rozie
    - packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/src/Combobox.* (codegen-regenerated)
    - packages/ui/command-palette/packages/{react,vue,svelte,solid,angular,lit}/package.json
    - package.json (root — scoped pnpm.overrides bridge)
    - pnpm-lock.yaml

key-decisions:
  - "Checkpoint D-08 resolved by the human as `patch`: popover ships as an additive patch inside 0.1.x, NOT a 0.2.0 minor. Combobox = minor, command-palette = patch, data-table NOT in this wave and NOT named in the changeset. 18 published leaves total, relying on plan 86-02's recorded byte-identity verdict (HOLDS)."
  - "The stated 234/234 combobox baseline in the plan/checkpoint prompt does NOT match reality — the real, independently-verified-twice count is 192/192 (150 pre-existing from 86-06's own recorded baseline + 42 new from Task 1's prohibitions.test.ts). Reported the real, observed number rather than the stated one; see Verification Log."
  - "Rule 1 auto-fix, not Rule 4 architectural: the command-palette-sub-actions regression discovered by the full Docker VR union was fixed by adding a new OPT-IN, additive `disableDismiss` prop to Popover — the same shape as the four precedent props (`bare`/`disablePositioning`/`keepMounted`/`matchWidth`) already added this phase, default `false`, inert unless set. This does not change the D-08 patch-level decision or the changeset's 18-leaf shape; it is the same additive pattern the byte-identity evidence already covers, and the changeset's popover bullet was updated to describe it."
  - "Root package.json's `pnpm.overrides` gained a scoped bridge pinning the six `@rozie-ui/combobox-<target>` packages to `workspace:*` (not a general policy change) — necessary because combobox's own `version` field is deliberately NOT bumped in this plan (that happens later, via `changeset version`, outside this plan's scope), so nothing in the workspace or on npm satisfies the newly-declared `^0.5.0` peer range that command-palette's leaves now carry. Documented as safe-to-remove once combobox actually publishes at 0.5.0+."

requirements-completed: [R1, R3, R5, R6]

coverage:
  - id: D1
    description: "All three SPEC prohibitions are enforced by a collected, non-vacuous node test over every shipped combobox+popover leaf, self-proven via a negative-path fixture"
    requirement: "R1, R3"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/prohibitions.test.ts (42 tests, incl. 6 negative-path self-proof assertions)"
        status: pass
      - kind: unit
        ref: "grep -rEc 'localStorage|sessionStorage|document\\.cookie|indexedDB|navigator\\.sendBeacon|XMLHttpRequest|console\\.' across all twelve emitted leaf sources -> 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three comparison-matrix cells (multi-select/tags, floating-positioned popup, free-text/creatable) read as supported; defer bullets removed; docs drift gate green on a regenerated surface_hash"
    requirement: "R6"
    verification:
      - kind: unit
        ref: "pnpm --filter docs test (29/29, tests/comparison-surface.test.ts surface_hash gate)"
        status: pass
      - kind: other
        ref: "node -e residual-defer-prose check -> 'defer bullets removed OK'"
        status: pass
    human_judgment: false
  - id: D3
    description: "No leaf anywhere in the repo still declares a ^0.4.0 combobox peer; frozen-lockfile install succeeds at the final commit"
    requirement: "R5"
    verification:
      - kind: other
        ref: "repo-wide sweep grep -> 'no residual old-range combobox peers'"
        status: pass
      - kind: other
        ref: "pnpm install --frozen-lockfile (re-run at every subsequent commit through the final one)"
        status: pass
    human_judgment: false
  - id: D4
    description: "One changeset covers eighteen published leaves at combobox=minor/popover=patch/command-palette=patch, names no private root, and data-table is absent"
    requirement: "R5"
    verification:
      - kind: other
        ref: "pnpm changeset:check -> clean; node shape-check -> '18 published leaves, no private roots'; pnpm exec changeset status --verbose confirms the exact bump plan with zero data-table mentions"
        status: pass
    human_judgment: false
  - id: D5
    description: "A genuine cross-target regression (command-palette-sub-actions keepOpen contract silently broken by Popover's independent dismissal) discovered by this plan's own full VR gate is root-caused and fixed, with the fix itself verified not to regress anything else"
    requirement: "R2 (regression touches R2's composition surface)"
    verification:
      - kind: e2e
        ref: "tests/visual-regression/specs/command-palette.spec.ts:644 command-palette-sub-actions [vue/react/svelte/angular/solid/lit] — all 6 red before the fix, all 6 green after, both locally and in the Docker VR union"
        status: pass
      - kind: e2e
        ref: "tools/ci-repro/vr.sh full union, post-fix: 2289 passed, 0 failed (2 pre-existing unrelated data-table flaky retries), exit 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The full local CI mirror is green apart from the pre-existing, out-of-scope sidecar-staleness gate"
    requirement: "R5"
    verification:
      - kind: other
        ref: "bash scripts/ci-prepush.sh (twice, before and after the fix) — typecheck 324/324 both times; only failure both times is the pre-existing check-sidecar-staleness.mjs ORPHAN class, documented as not-this-plan's-job"
        status: pass
    human_judgment: false

duration: ~110min (continuation from the resolved checkpoint)
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 07: Release wave close-out — prohibition gate, comparison-doc flip, peer bump, regression fix, changeset Summary

**Closed phase 86 with a machine-enforced prohibition gate, a flipped comparison matrix, the command-palette peer bump, one 18-leaf changeset at the human-confirmed patch/minor/patch split — and, discovered by this plan's own full VR gate, a genuine cross-target regression in the combobox->popover composition (command-palette's `pinOpen` contract silently defeated by Popover's independent dismissal) that was root-caused and fixed with a new opt-in `disableDismiss` prop.**

## Performance

- **Duration:** ~110 min (continuation agent; Task 1 and the checkpoint were already resolved when this session started)
- **Started:** 2026-09-01T15:11:00Z (approx., first re-verification command)
- **Completed:** 2026-09-01T16:47:00Z (approx.)
- **Tasks:** 5 (checkpoint + 4 plan tasks), plus 1 unplanned deviation-fix task discovered during Task 4's own verification
- **Files modified:** ~50 across all commits (popover leaf regen x6, combobox leaf regen x6, command-palette manifests x6, docs, changeset, root package.json, lockfile)

## Checkpoint Resolution

**Checkpoint type:** decision (`gate="blocking-human"`), D-08.
**Human response:** `patch` — popover ships as an additive patch inside its current 0.1.x line, not a 0.2.0 minor. `minor` was explicitly considered and rejected.

Consequences encoded:
- `@rozie-ui/popover-*` -> patch
- `@rozie-ui/combobox-*` -> minor
- `@rozie-ui/command-palette-*` -> patch
- `@rozie-ui/data-table-*` -> NOT in this wave, NOT named
- Release wave total: 18 leaves

The decision relied on plan 86-02's recorded D-08 byte-identity verdict (`86-02-SUMMARY.md`): the popover `.d.ts` diff across all six leaves is additive-only, the existing `.rozie-popover-floating` style rule carries zero deletions/reordering, and a targeted 65-cell Docker VR run (Popover's own pixel baseline + data-table's popover-composing header-menu suite) passed with zero baseline diffs. This session did not re-litigate that verdict — it was treated as settled per the checkpoint resolution instructions.

## Task Commits

Each task was committed atomically:

1. **Task 1: The prohibition gate** — `a2efcce12` (test) *(already committed when this continuation session began)*
2. **Task 2: Flip the three comparison-matrix cells and regenerate the surface-hash guard** — `45b7b3466` (docs)
3. **Task 3: Bump the command-palette combobox peer on all six leaves** — `3149f305b` (feat)
4. **Unplanned deviation: popover `disableDismiss` regression fix** — `8d4b4305e` (fix), `c95ee2622` (docs — surface_hash regen the fix required)
5. **Task 4: Author the release changeset** — `f1fd8912c` (chore)

No separate plan-metadata commit — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below.

## Accomplishments

- **Task 1 — Prohibition gate.** `packages/ui/combobox/tests/prohibitions.test.ts` reads all twelve emitted leaf sources (combobox x6 + popover x6, since popover source changed this phase) from disk and asserts zero occurrences of the enumerated browser-storage/cookie/network-egress/console identifiers, structurally verifies `aria-multiselectable` is emitted only as a conditional bound to `multiple` (never a literal), and asserts the toggle/chip-removal/per-option-selected-state code paths are present alongside it. A negative-path fixture (6 of the 42 tests) proves the checking functions are not vacuous.
- **Task 2 — Comparison-doc flip.** The three ❌ cells (multi-select/tags, floating-positioned popup, free-text/creatable) flip to ✅ in both the at-a-glance table and the capability matrix. The three matching "Where Rozie defers today" bullets are removed; the "Single model" and "Where Rozie wins today" prose sections were rewritten to describe the widened array model, the composed-popover floating popup, the consumer-owned `create` event, and the new `#chip`/`#create` slots. `surface_hash` regenerated via the script's own `--write` path — both `combobox-comparison.md` (genuine drift, this plan's own scope) and `popover-comparison.md` (drift left open by plans 86-01/86-02, explicitly deferred to R6 per those plans' own WINDOWS.md entries) moved; both WINDOWS.md entries closed.
- **Task 3 — Command-palette peer bump.** All six `@rozie-ui/command-palette-<target>` leaves widen their `@rozie-ui/combobox-<target>` peer from `^0.4.0` to `^0.5.0`. Only the range string changed — no other key, no leaf's own version field. A repo-wide sweep confirms zero residual `^0.4.x` combobox peers (the one hit found was a stale, gitignored `command-palette-angular/dist/package.json` build artifact, resolved by a fresh build). Discovered mid-task that a bare `pnpm install` hard-fails (`ERR_PNPM_NO_MATCHING_VERSION`) once the peer range outruns combobox's own not-yet-bumped `version` field, since `auto-install-peers=true` tries to satisfy the new range from the npm registry — bridged with a scoped root `pnpm.overrides` entry pinning the six combobox packages to `workspace:*` (dev-time only; never reaches the published peerDependencies contract).
- **Unplanned deviation — the `disableDismiss` regression fix.** Running the plan's own mandated full Docker VR union (required by Task 4's `<verify>`) surfaced a real, deterministic, cross-target failure: `command-palette-sub-actions` failed identically on all six targets. Root-caused (see Deviations below) to Popover's document-level Escape/click-outside dismiss listeners firing unconditionally on `open`, independent of `trigger`, and writing the two-way `open` model directly — bypassing combobox's own `onBlur`-gated `pinned` flag entirely. Fixed with a new opt-in `disableDismiss: Boolean` prop on `@rozie-ui/popover` (default `false`, inert unless set, matching the `bare`/`disablePositioning`/`keepMounted`/`matchWidth` precedent exactly) that gates both dismiss listeners, forwarded from combobox via a newly-reactive `$data.pinned` (promoted from a plain, non-reactive `let`) bound to the composed `<Popover :disable-dismiss="$data.pinned">`. Re-verified with a second full Docker VR union: 2289 passed, 0 failed.
- **Task 4 — Changeset.** `.changeset/combobox-multiselect-floating-creatable.md` names exactly 18 published leaves at combobox=minor / popover=patch / command-palette=patch, no private root. `pnpm changeset:check`, the 18-leaf shape check, and `pnpm exec changeset status --verbose` (dry-run) all confirm the exact bump plan with zero mentions of any `data-table` package.

## Verification Log

Full commands run, real output, in the order performed:

**Task 1 (already done pre-continuation, re-verified):**
```
pnpm --filter @rozie-ui/combobox test -- --reporter=verbose
 Test Files  12 passed (12)
      Tests  192 passed (192)
```
Negative-path proof (isolated run of `prohibitions.test.ts`): 42/42 passed, including
`findForbiddenViolations reports a violation for a synthetic forbidden identifier`,
`findForbiddenViolations reports nothing for a clean synthetic source`,
`checkMultiselectableClaim reports a violation for a bare literal aria-multiselectable="true"`,
`checkMultiselectableClaim reports nothing for a genuine conditional bound to multiple`.

**IMPORTANT correction:** the plan/checkpoint prompt's stated baseline of "234/234" for `@rozie-ui/combobox` does not match reality. Independently re-verified TWICE (once immediately after confirming Task 1's commit, once again as the final baseline re-check) at **192/192** — 12 test files, matching the actual file inventory exactly (10 `tests/*.test.ts` + `src/internal/groupOptions.test.ts` + `scripts/manifest-snapshot.test.mjs`). This is internally consistent with 86-06-SUMMARY.md's own recorded post-86-06 baseline of 150/150 plus Task 1's 42 new prohibition tests (150 + 42 = 192). Reporting the real, verified number rather than the stated one.

**Task 2:**
```
node docs/scripts/surface-hash.mjs --write
  combobox  41f53456b493  DRIFT -> written
  popover   fd02b170fa10  DRIFT -> written  (deferred from 86-01/86-02, WINDOWS.md ids 1&2, now closed)
pnpm --filter docs test
 Test Files  1 passed (1)
      Tests  29 passed (29)
node -e residual defer-prose check -> "defer bullets removed OK"
```

**Task 3:**
```
bash -c 'sweep for "@rozie-ui/combobox-[a-z]*": "^0.4.' -> "no residual old-range combobox peers"
pnpm install --frozen-lockfile -> succeeds
pnpm turbo run build --force --concurrency=2 --filter '@rozie-ui/command-palette-*' -> 30/30 successful
pnpm turbo run build --force --concurrency=2 (whole workspace) -> success
```

**Unplanned deviation fix — local fast-iteration repro (macOS, non-Docker, behavioral only):**
```
npx playwright test -g "command-palette-sub-actions [vue]" --project=chromium
  1 failed — Error: expect(received).resolves.toBe(expected): Expected 1, Received 0, at line 784 (countOptions)
```
Manual mousedown/mouseup split isolated the exact moment of failure:
```
options AFTER mousedown, BEFORE mouseup: 1   (menu already opened: 3 menuitems)
options AFTER mouseup: 0                     (list gone)
```
Traced to `useOutsideClick` (`@rozie/runtime-vue`) using `capture: true` on a `click` listener, and Popover's `<listener :target="document" @click.outside(...)="dismiss" r-if="$props.open" />` being unconditional on `trigger`. Fixed; re-ran:
```
npx playwright test -g "command-palette-sub-actions" --project=chromium -> 6 passed (all 6 targets)
npx playwright test specs/command-palette.spec.ts specs/popover.spec.ts specs/combobox-virtual.spec.ts --project=chromium -> 139 passed
npx playwright test specs/combobox.spec.ts specs/combobox-group-cap.spec.ts specs/combobox-groups.spec.ts specs/data-table-header-menu.spec.ts --project=chromium
  -> 71 passed, 18 pixel-baseline (toHaveScreenshot) failures — confirmed cosmetic macOS-vs-Linux font-kerning diffs
     (diff PNG inspected: only glyph-edge pixels highlighted, full structural match) — NOT run against Linux baselines,
     not evidence of a regression; the authoritative check is the Docker run below.
```
Rebuilt popover + combobox (codegen), re-ran family tests:
```
pnpm --filter @rozie-ui/popover test  -> 33/33 (after regenerating __fixtures__/rozie-manifest.expected.json)
pnpm --filter @rozie-ui/combobox test -> 192/192 (unchanged — no public combobox prop/emit/slot surface changed)
pnpm --filter @rozie-ui/command-palette test -> 210/210
```
**Full Docker VR union, post-fix:**
```
tools/ci-repro/vr.sh
  ... 2289 passed (9.8m)
✓ VR repro passed (exit 0)
```
(2 tests marked "flaky" — `data-table-dropins editor [svelte]` and `data-table-edit [react] ... virtualization recycle` — both unrelated to combobox/popover/command-palette, both passed on retry, consistent with this repo's documented data-table virtualization timing flakes; not investigated further as out of scope.)

**Docs surface_hash re-drift after the fix (caught by the local turbo test battery, fixed same-session):**
```
pnpm --filter docs test  (before regenerating hash post-fix)
  FAIL tests/comparison-surface.test.ts — popover surface changed since its comparison page was last reviewed
node docs/scripts/surface-hash.mjs --write  -> only popover-comparison.md moved (fd02b170fa10 was ALREADY stale from Task 2's earlier bump; new hash a774bc38b672)
pnpm --filter docs test  -> 29/29 again
```

**Full local CI mirror (both before and after the fix):**
```
bash scripts/ci-prepush.sh
  turbo run typecheck --force --continue --concurrency=4 -> 324/324 successful, both runs
  ✗ stale sidecar(s) detected — ~24 ORPHAN entries under examples/consumers/*/fixtures/*.d.rozie.ts
    (KNOWN-RED, pre-existing, gitignored, no matching .rozie source, disconnected from packages/ui/{popover,combobox};
     confirmed by prior plans in this phase; not this plan's job — see project_specific_rules)
node scripts/check-dep-drift.mjs -> "dependency-drift OK — all 1623 resolved package name(s) are allowlisted"
```
Ran the remaining ci-prepush stage manually (as established precedent from 86-01/86-02):
```
pnpm turbo run test --force --continue --concurrency=4
  146/149 tasks successful, 3 failures: @rozie/cli#test, @rozie/docs#test, @rozie/language-server#test
```
All three isolated and re-verified individually:
```
pnpm --filter docs test -> 29/29 (real fix; the surface_hash re-drift above, now resolved)
pnpm --filter @rozie/language-server test -> 378/378 (isolated) — CPU-contention flake at --concurrency=4
pnpm --filter @rozie/cli test -> 48/48 (isolated, 177.51s) — CPU-contention flake at --concurrency=4
```
Consistent with this repo's documented "turbo full concurrency untrustworthy" pattern — isolated `--filter` reruns are the trust signal, not the full-concurrency battery.

**Task 4:**
```
pnpm changeset:check
✓ changeset private-package guard OK — 1 changeset file(s) scanned, no private-root entries.

node shape-check.js
changeset shape OK: 18 published leaves, no private roots

pnpm exec changeset status --verbose
🦋 Packages to be bumped at patch: popover-{react,vue,svelte,solid,angular,lit} + command-palette-{react,vue,svelte,solid,angular,lit} (12)
🦋 Packages to be bumped at minor: combobox-{react,vue,svelte,solid,angular,lit} (6) -> all align at 0.5.0
🦋 Running release would release NO packages as a major
(zero "data-table" mentions anywhere in the output)

pnpm install --frozen-lockfile -> succeeds
git log origin/main..HEAD --oneline -> non-empty (23 commits, all this phase's work, none pushed)
```

**Final re-verification (current committed state, all six commits landed):**
```
pnpm --filter @rozie-ui/combobox test      -> 192/192
pnpm --filter @rozie-ui/popover test       -> 33/33
pnpm --filter @rozie-ui/command-palette test -> 210/210
pnpm --filter docs test                    -> 29/29
pnpm install --frozen-lockfile             -> succeeds
pnpm changeset:check                        -> clean
```

## Consolidated VR Baseline Justifications (86-03, 86-05, 86-06 — one audit point per phase's "every rebless individually diff-reviewed" constraint)

- **86-03 (`ComboboxFloating.png`, NEW, 360x680):** the sole new baseline the floating-popup plan added. Visually confirmed Apple/Banana/Cherry/Date render in a rounded panel directly above the "Search fruit…" input, spanning its full width — proving the composed popover's `flip` middleware relocates the popup above the input at a viewport edge. `tools/ci-repro/vr.sh -u -b ComboboxFloating -g 'Combobox'` -> 73/73, then a bare re-run -> 73/73 zero diffs, byte-identical.
- **86-05 (`ComboboxMulti.png`, NEW, 360x380):** the sole new baseline the chip-rail plan added. Visually confirmed three chips (Apple x, Banana x, Cherry x) wrapping above a focused "Add more…" input, with the open popup below listing all five options at a width matching the chip rail + input row — proving D-13's `matchWidth` claim (popup spans chips + input). `tools/ci-repro/vr.sh -u -b ComboboxMulti -g 'Combobox'` -> 79/79; bare re-run -> 78 passed + 1 flaky-then-passed retry (unrelated `combobox-group-cap [vue]` browser crash, a documented infra flake), 79/79 total, zero diffs. **No pre-existing baseline moved** (`ComboboxFloating.png` and every other pre-existing Combobox/Popover cell stayed byte-identical), confirming the chip rail's `r-if="$props.multiple"` guard never touches the single-select rendered shape.
- **86-06 (`ComboboxCreatable.png`, NEW, 360x380):** the sole new baseline the creatable-mode plan added. Visually confirmed a focused "kiwi" input above a single "Create "kiwi"" row in the accent color. `tools/ci-repro/vr.sh -u -b ComboboxCreatable -g 'Combobox'` first pass 84/85 (one Solid-only flake, root-caused to a `select()`/`seedQuery()` ordering race and fixed in the demo, not Combobox.rozie); scoped rebless 6/6 green; 3 consecutive bare re-runs scoped to `combobox-creatable` -> 18/18 flake-free; full bare `Combobox` grep -> 85/85 zero diffs. **No pre-existing baseline moved.**
- **This plan (86-07):** added zero new pixel baselines. The full Docker VR union (unscoped, batched once as the phase's closing gate per the established practice) is the union of all prior plans' cells plus the regression-fix re-verification — 2289 passed, 0 failed, 2 unrelated pre-existing data-table flaky retries. No `Combobox*`/`Popover*`/`CommandPalette*` baseline moved across either Docker run in this session.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `pnpm install` hard-fails once command-palette's peer range outruns combobox's own unbumped version**
- **Found during:** Task 3, first `pnpm install` after the six peer-range edits
- **Issue:** `ERR_PNPM_NO_MATCHING_VERSION` — pnpm's `auto-install-peers=true` (`.npmrc`) tries to satisfy the newly-declared `^0.5.0` combobox peer from the npm registry, since no local workspace package's OWN `version` field (deliberately left unbumped per the plan's own instruction) satisfies that range, and `0.5.0` is not published.
- **Fix:** Added a scoped `pnpm.overrides` block in root `package.json` pinning the six `@rozie-ui/combobox-<target>` packages to `workspace:*`. This is a dev-time-only override (affects only how THIS repo's installer resolves the range; never touches the published `peerDependencies` string in the leaf manifests) and is documented as safe to remove once combobox actually publishes at 0.5.0+.
- **Verification:** `pnpm install` clean, `pnpm install --frozen-lockfile` succeeds at every subsequent commit.
- **Committed in:** `3149f305b`

**2. [Rule 1 - Bug] Command-palette's `pinOpen` contract silently defeated by Popover's independent dismissal (cross-target regression)**
- **Found during:** Task 4's own mandated `<verify>` step — the full Docker VR union — which is exactly the class of issue this gate exists to catch.
- **Issue:** See full root-cause trace in the Verification Log above. Popover's `<listener @click.outside(...)="dismiss" r-if="$props.open" />` is unconditional on `trigger` (by design, D-07 — real click-outside dismissal for `trigger="manual"` composers). Command-palette's action-menu flyout lives OUTSIDE Popover's `anchorEl`/`floatingEl` (it's a command-palette-owned overlay anchored to, not nested inside, the composed control), so a click landing there was judged "outside" and independently closed the list via a direct `$model.open = false` write that never consulted combobox's own `onBlur`-gated `pinned` flag.
- **Fix:** New opt-in `disableDismiss: Boolean` prop on `@rozie-ui/popover` (default `false`) gating both the Escape and click-outside `<listener>` elements. Combobox's `pinned` flag promoted from a plain non-reactive `let` to `<data>` so it can drive `:disable-dismiss="$data.pinned"` on the composed `<Popover>`, alongside its existing `onBlur()` read.
- **Files modified:** `packages/ui/popover/src/Popover.rozie`, `packages/ui/popover/scripts/compile-popover-check.mjs`, `packages/ui/popover/tests/surface.test.ts`, `packages/ui/popover/__fixtures__/rozie-manifest.expected.json`, `packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/*` (codegen), `docs/components/popover.md`, `packages/ui/combobox/src/Combobox.rozie`, `packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/src/Combobox.*` (codegen).
- **Verification:** all six `command-palette-sub-actions` VR cells green (were 6/6 red); 139 broader local Playwright tests green; popover 33/33, combobox 192/192, command-palette 210/210 unit tests green; full Docker VR union 2289 passed, 0 failed.
- **Committed in:** `8d4b4305e`
- **Why this stays Rule 1/patch-level, not Rule 4/architectural:** it is one more additive, opt-in, default-`false`, inert-unless-set boolean prop on Popover — the exact same shape as the four precedent props (`bare`/`disablePositioning`/`keepMounted`/`matchWidth`) already added this phase. It does not change the D-08 bump-level decision or the changeset's 18-leaf shape.

**3. [Rule 1 - Bug] Docs `surface_hash` re-drifted after the disableDismiss fix**
- **Found during:** the post-fix full `turbo run test` battery — `@rozie/docs#test` failed with the exact drift message the surface-hash gate is designed to produce.
- **Issue:** The `disableDismiss` fix added a new prop to Popover's IR after Task 2 had already regenerated the `surface_hash` markers, restaling `popover-comparison.md`'s hash a second time.
- **Fix:** Re-ran `node docs/scripts/surface-hash.mjs --write`; only `popover-comparison.md`'s hash moved (combobox's own public prop/emit/slot surface is unaffected — `pinned` is internal `<data>`, not a prop). No prose review needed: the page makes no capability claim tied to `disableDismiss`.
- **Verification:** `pnpm --filter docs test` -> 29/29.
- **Committed in:** `c95ee2622`

---

**Total deviations:** 3 auto-fixed (1 Rule 3 - blocking, 2 Rule 1 - bug). **Impact:** #1 was necessary for `pnpm install` to succeed at all given the plan's own "don't touch combobox's version" constraint — no scope change. #2 is the substantive one: a genuine, cross-target functional regression in phase 86's own composition work, caught only because this plan's own `<verify>` block mandates the full VR union rather than a scoped grep — exactly the gate doing its job. #3 is a direct, mechanical consequence of #2. None of the three change the release wave's shape, bump levels, or the D-08 checkpoint decision.

## Issues Encountered

None beyond the three deviations above — all resolved within this session, no unresolved blockers.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 86 is closed: all six SPEC requirements (R1-R6) satisfied, the three prohibitions machine-enforced, the comparison doc reflects reality, the release wave is wired end-to-end as one changeset, and — thanks to this plan's own full-VR gate — a genuine composition regression that would otherwise have shipped silently to every command-palette consumer using sub-actions was caught and fixed before any commit reached `origin`.
- **Nothing was pushed, nothing was published, no release workflow was dispatched** — commits sit on `main`, 23 ahead of `origin/main` for this phase alone, exactly per SPEC's stated boundary.
- **Before the next release wave runs `pnpm changeset version` + publishes:** the root `package.json` `pnpm.overrides` bridge for the six `@rozie-ui/combobox-<target>` packages becomes redundant once combobox is actually live at `0.5.0+` on npm — safe to leave (harmless no-op) or remove at that point; not urgent.
- The `disableDismiss` prop is a small, genuinely useful addition to Popover's public composition contract beyond this phase's original scope — worth a one-line mention in any future "what changed in Popover this year" retrospective, since it closes a real gap in the `trigger="manual"` composition story that any FUTURE composer (not just combobox) could hit.

## Self-Check: PASSED

- All key files confirmed present on disk: `packages/ui/combobox/tests/prohibitions.test.ts`, `docs/components/combobox-comparison.md`, `.changeset/combobox-multiselect-floating-creatable.md`, `packages/ui/popover/src/Popover.rozie`, `packages/ui/combobox/src/Combobox.rozie` — all `[ -f ]` confirmed.
- All six commit hashes (`a2efcce12`, `45b7b3466`, `3149f305b`, `8d4b4305e`, `c95ee2622`, `f1fd8912c`) confirmed present via `git log --oneline --all`.
- All acceptance criteria for the checkpoint and all four tasks re-verified with real, current command output (see Verification Log above) — including a full re-run of the four family/docs test suites in the final committed state.
- The plan's stated `234/234` combobox baseline was found not to match reality; the real, twice-independently-verified number (192/192) was reported instead of the stated one.

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
