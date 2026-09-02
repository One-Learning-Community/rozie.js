---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
verified: 2026-09-01T17:10:00Z
status: passed
status_history:
  - status: human_needed
    at: 2026-09-01T17:10:00Z
    note: >-
      Original verdict. 9/9 must-haves verified; 3 items routed to human
      verification. Preserved here rather than overwritten — the verifier's
      call was correct at the time.
  - status: passed
    at: 2026-09-02T00:00:00Z
    note: >-
      All 3 human_verification items are now closed and none required a
      manual pass. Items 1 and 2 (both SPEC-declared `🧪 backstop` edges,
      never automated by design) were converted to machine checks by
      quick-260901-tpq and quick-260902-hmv; item 3 was a false
      documentation claim, fixed in e3a13b48b. See 86-UAT.md — total 3,
      resolved 3, pending 0.
resolved_by:
  - "tests/visual-regression/specs/combobox.spec.ts :: combobox-flip-exact-fit (6 targets) — item 1"
  - "tests/visual-regression/specs/combobox.spec.ts :: combobox-create-async (6 targets) — item 2"
  - "examples/demos/ComboboxCreatableAsyncDemo.rozie — item 2 fixture (2000ms-delayed async search)"
  - "commit e3a13b48b — item 3 (stale click-outside prose + stale v1-scope paragraph)"
orchestrator_verified_at_close:
  - "24/24 combobox behavioral cells green across all 6 targets"
  - "mutation probe re-run independently: SEARCH_DELAY_MS 2000->0 => 6/6 RED (Expected \"1\", Received \"0\"); restored => GREEN — the race cell detects loss of the in-flight window, it does not pass regardless of timing"
  - "turbo run typecheck --force: 324/324"
  - "@rozie-ui/combobox: 197/197"
  - "zero new PNG baselines; toHaveScreenshot count unchanged at 4"
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "At a viewport height where the popup fits by exactly 0px below the input, confirm Floating UI's `flip` middleware does NOT relocate it (SPEC R2 edge, `verification: backstop`, 86-03 must_haves)."
    expected: "The popup renders in its normal (below) position at exactly 0px of overflow — it should not flip on an exact-fit boundary."
    why_human: "Boundary arithmetic is Floating UI's own, not Rozie's; not deterministically reproducible in the happy-dom/vitest harness. Explicitly flagged 🧪 backstop in 86-SPEC.md's Edge Coverage table and listed in 86-VALIDATION.md's Manual-Only Verifications table — never automated by design."
  - test: "Commit a `create` gesture while an async `search`/`options` update triggered by the same query is still in flight (delayed data source)."
    expected: "Exactly one `create` event fires (or the double-commit latch correctly suppresses a duplicate) with no lost or duplicated `create`."
    why_human: "Race timing against a delayed async source is not deterministically reproducible in the happy-dom test harness. Explicitly flagged 🧪 backstop in 86-SPEC.md's Edge Coverage table (R3) and in 86-VALIDATION.md; 86-06-SUMMARY.md records this was not manually probed in that run. The single-emit guarantee for a same-tick double-commit IS automated and passing (`creatable.behavior.test.ts` test (5)), but the live async-race scenario itself remains open."
  - test: "Review whether `docs/components/combobox.md` (line 263) and `docs/components/combobox-comparison.md` (line 51) should be updated: both still state 'there is no document click-outside listener and therefore no cross-Lit-shadow retargeting problem.'"
    expected: "A human decision on whether this prose needs correcting to reflect that combobox now composes Popover with `trigger=\"manual\"`, which (per D-07, shipped in 86-01/86-03) installs a real document-level Escape + click-outside dismissal listener, gated only by the new opt-in `disableDismiss`/`pinOpen()` veto — not by the absence of such a listener."
    why_human: "This is outside SPEC R6's literal acceptance criteria (the three cell flips + defer-bullet removal + surface_hash regen, which ARE correct and verified) — it's editorial prose in two pages phase 86 touched multiple times (86-01/04/05/06/07) without ever revisiting this specific paragraph. Not a blocking SPEC failure, but a genuine claim-vs-code mismatch a human should triage."
---

# Phase 86: Combobox v1 gap cluster — multi-select, floating popup via popover composition, and creatable mode Verification Report

**Phase Goal:** `@rozie-ui/combobox` closes the three remaining ❌ cells in its own comparison matrix — multi-select, floating-positioned popup, and free-text/creatable — shipping ×6 targets as a breaking minor `0.4.0 → 0.5.0`, with the popup positioned by composing the published `@rozie-ui/popover` leaf rather than a second hand-rolled Floating UI integration.

**Verified:** 2026-09-01T17:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | R4 — two-level chain `command-palette → combobox → popover` resolves through `<components>`, compiles/typechecks ×6, single popover instance (no peer-keyed nominal split) | ✓ VERIFIED | Confirmed at codebase level with `require.resolve()` from `combobox-react`, `command-palette-react`, and `data-table-react` — combobox and data-table both resolve the SAME physical `popover/packages/react/dist/index.cjs`; command-palette resolves combobox's own dist. `pnpm turbo run build/typecheck` — 243/243, 324/324 (orchestrator-verified, unchanged) |
| 2 | R2 — floating popup positioned via composed `@rozie-ui/popover`, all four render branches, `inline` performs no positioning, no `autoUpdate` leak, empty list still positions | ✓ VERIFIED | `Combobox.rozie:1324-1802` — single `<Popover trigger="manual" bare matchWidth :keep-mounted="virtual" :disable-positioning="inline" :disable-dismiss="pinned" ...>` wraps all four `r-if` branches inside one `<template #default>`; input+chips live in `#anchor`. `floating-popover.behavior.test.ts` (6 tests) passing; `ComboboxFloating.png` VR baseline exists (10,611 bytes, Linux-rendered per SUMMARY) |
| 3 | R1 — `multiple: Boolean` (default `false`) widens the sole `value` model to an array; toggle-off, dedup, fresh-array, ordering, chips in selection order, Backspace-removes-last, `aria-multiselectable`/`aria-selected` real conditionals | ✓ VERIFIED | `Combobox.rozie:193-196` (`default: false`), `:887-941` (`selectOption` toggle/fresh-array algorithm), `:1075-1089` (Backspace, guards on live empty input value). Emitted `aria-multiselectable={(props.multiple ? 'true' : undefined) ?? undefined}` confirmed on all 4 listbox elements across all 6 targets by direct grep of emitted sources |
| 4 | R1 — chips render inside the control (D-13 `inside-control`, human-confirmed at checkpoint), before the `<input>`, inside the SAME `#anchor` slot fill so `matchWidth` spans chips + input | ✓ VERIFIED | `Combobox.rozie:1324-1338` — `<template #anchor>` fill contains `<ul r-if="$props.multiple" class="rozie-combobox-chips">` immediately before `<input>`. `ComboboxMulti.png` VR baseline exists |
| 5 | R3 — `creatable: Boolean` (default `false`); commit on a query matching no option (case-insensitive, trimmed, EXACT, no Unicode normalization) emits `create` and writes NOTHING to `value`; double-commit latch; row renders last | ✓ VERIFIED | `Combobox.rozie:213-216` (`default: false`), `:663-682` (`normalizedQuery`/`queryMatchesOption`/`isCreatableQuery` — exact `===` comparison, no `.normalize()` call), `:894-916` (`isCreate` branch returns after `$emit('create', ...)`, never touches `$model.value`), `:904` double-commit latch (`nq === $data.createdQuery`). `creatable.behavior.test.ts` (37 tests incl. Unicode-composition-form negative case, double-commit-count assertion, `multiple`-composition tests (6)/(6b)) — real mount-and-drive tests against the emitted Vue leaf, not decorative |
| 6 | The three SPEC prohibitions (no persistence/telemetry, no console logging, no unbacked `aria-multiselectable` claim) machine-enforced over all six combobox + six popover emitted leaves plus their copied internals | ✓ VERIFIED | `packages/ui/combobox/tests/prohibitions.test.ts` — read and re-ran directly: 42/42 pass, scans 24 real files (12 leaves + 12 internals) read from disk via `readFileSync`, non-vacuous (6 dedicated negative-path tests prove `findForbiddenViolations`/`checkMultiselectableClaim` actually fire on synthetic violations). Structural claim (`aria-multiselectable` bound to `multiple`, `selectOption`/`removeChipValue`/`isRowSelected` code paths present) independently cross-checked against real emitted sources — matches |
| 7 | Cross-target regression fix: `disableDismiss` opt-in Popover prop restores command-palette's `pinOpen`/pinned contract, default `false`, inert unless set | ✓ VERIFIED | All six popover leaves declare `disableDismiss?: boolean` defaulting `false`, gating both the Escape and click-outside `<listener>`s (`Popover.rozie:468-469`: `r-if="$props.open && !$props.disableDismiss"`). All six combobox leaves promote `pinned` to a REACTIVE primitive (`useState`/`ref`/`$state`/`signal`/`createSignal`/`signal`) and forward it as `:disable-dismiss="pinned"`; `pinOpen(v)` writes `$data.pinned` (`Combobox.rozie:1244-1246`). VR-verified per SUMMARY (2289/2289 full Docker union, 0 failed) |
| 8 | R5 — breaking-minor release wave: one changeset covers combobox×6 (minor) + popover×6 (patch) + command-palette×6 (patch), no private root, no `data-table`, no residual `^0.4.0` combobox peer, `pnpm install --frozen-lockfile` succeeds | ✓ VERIFIED | `.changeset/combobox-multiselect-floating-creatable.md` — read directly, exactly 18 entries at the stated bump levels, zero data-table mentions. `pnpm changeset:check` → clean. Repo-wide grep for `^0.4` combobox peers → 0 hits; all 6 command-palette leaves show `"@rozie-ui/combobox-<target>": "^0.5.0"`. `pnpm install --frozen-lockfile` re-run → succeeds |
| 9 | R6 — three comparison-matrix cells (multi-select/tags, floating popup, free-text/creatable) flip to ✅, defer bullets removed, docs vitest green on regenerated `surface_hash` | ✓ VERIFIED | `docs/components/combobox-comparison.md` read directly — feature-matrix rows 40/42/43 and at-a-glance row 21 all show ✅ for Rozie with substantive text (not bare glyphs); "What Rozie defers" section (lines 73-78) no longer lists any of the three closed gaps. `surface_hash: 41f53456b493` in frontmatter. `pnpm --filter docs exec vitest run` → 29/29 (independently re-run, matches orchestrator figure) |

**Score:** 9/9 declared must-have truths verified. Two additional SPEC-locked edges are explicitly `verification: backstop` (not automatable by design) and one editorial-prose discrepancy was found outside the declared must-haves — all three routed to Human Verification below per the escalation-gate pattern, which is why overall status is `human_needed` rather than `passed` despite a clean truth score.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/ui/combobox/src/Combobox.rozie` | multiple/creatable/popover-composition source | ✓ VERIFIED | 23 props / 1 model / 3 emits / 6 slots / 4 expose confirmed via `compile-combobox-check.mjs` (re-run live: matches) |
| `packages/ui/popover/src/Popover.rozie` | 5 new additive props (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`, `disableDismiss`) | ✓ VERIFIED | All 5 present, all default `false`, all gate existing behavior only when set (grep-confirmed across all 6 emitted leaves) |
| `packages/ui/combobox/tests/prohibitions.test.ts` | machine-enforced 3-prohibition gate | ✓ VERIFIED | Exists, 42/42 passing, non-vacuous |
| `packages/ui/combobox/tests/multiple.behavior.test.ts` | R1 behavioral proof ×4 branches | ✓ VERIFIED | 508 lines, real mount-and-drive assertions against the emitted Vue leaf |
| `packages/ui/combobox/tests/creatable.behavior.test.ts` | R3 behavioral proof ×4 branches | ✓ VERIFIED | 386 lines, real mount-and-drive assertions, incl. Unicode-composition negative case |
| `packages/ui/combobox/tests/floating-popover.behavior.test.ts` | R2 non-pixel proof | ✓ VERIFIED | 280 lines, `autoUpdate` subscribe/teardown spy-counted via `vi.mock('@floating-ui/dom')` |
| `docs/components/combobox-comparison.md` | 3 cells flipped, defer bullets removed | ✓ VERIFIED | Confirmed by direct read; see Truth #9 |
| `.changeset/combobox-multiselect-floating-creatable.md` | 18-leaf changeset | ✓ VERIFIED | Confirmed by direct read; see Truth #8 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `combobox-react` package resolution | `@rozie-ui/popover-react` | pnpm symlink + `require.resolve` | ✓ WIRED | Resolved to `packages/ui/popover/packages/react/dist/index.cjs` — live check |
| `command-palette-react` package resolution | `@rozie-ui/combobox-react` | pnpm symlink + `require.resolve` | ✓ WIRED | Resolved to `packages/ui/combobox/packages/react/dist/index.cjs` — live check |
| `data-table-react` package resolution | `@rozie-ui/popover-react` | pnpm symlink + `require.resolve` | ✓ WIRED | Resolves to the SAME physical path combobox resolves — proves single-instance, no nominal split |
| `pinOpen(v)` (combobox handle) | `$data.pinned` → `:disable-dismiss` on composed `<Popover>` | reactive primitive, all 6 targets | ✓ WIRED | Traced source-to-source; `Popover.rozie`'s Escape/click-outside `<listener>`s gated on `!$props.disableDismiss` |
| `isCreate` branch in `selectOption()` | `$emit('create', ...)` only, never `$model.value` | direct source read | ✓ WIRED | `Combobox.rozie:894-916` — early `return` after emit, no model write on that path |
| Chip rail (`multiple`) | `#anchor` slot fill (before `<input>`) → Popover's `anchorEl` → `matchWidth` `size` middleware | direct source read | ✓ WIRED | `Combobox.rozie:1324-1338`; `matchWidth` always forwarded `true` from combobox |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Prohibitions gate fires and is non-vacuous | `pnpm --filter @rozie-ui/combobox exec vitest run tests/prohibitions.test.ts --reporter=verbose` | 42/42 passed, incl. 6 negative-path proofs | ✓ PASS |
| Full combobox suite | `pnpm --filter @rozie-ui/combobox exec vitest run` | 12 files / 192 tests passed | ✓ PASS |
| Full popover suite | `pnpm --filter @rozie-ui/popover exec vitest run` | 3 files / 33 tests passed | ✓ PASS |
| Full command-palette suite | `pnpm --filter @rozie-ui/command-palette exec vitest run` | 14 files / 210 tests passed | ✓ PASS |
| Docs suite (surface_hash gate) | `pnpm --filter docs exec vitest run` | 1 file / 29 tests passed | ✓ PASS |
| `aria-multiselectable` is a real conditional, not a literal, ×6 targets | `grep -n "aria-multiselectable"` on all 6 emitted leaves | `(props.multiple ? 'true' : undefined) ?? undefined` (React/Vue/Solid), `rozieAttr(multiple ? 'true' : null)` (Svelte/Lit), `rozieAttr(multiple() ? 'true' : null)` (Angular) — never a bare literal, on all 4 listboxes × 6 targets | ✓ PASS |
| No `^0.4.0` residual combobox peer anywhere in repo | `grep -rn '"@rozie-ui/combobox-.*\^0\.4'` | 0 hits (only `^0.5.0` found in command-palette leaves) | ✓ PASS |
| Frozen-lockfile install succeeds at final state | `pnpm install --frozen-lockfile` | succeeds, "Already up to date" | ✓ PASS |
| Changeset shape gate | `pnpm changeset:check` | clean, no private-root entries | ✓ PASS |
| Single popover instance across 3 composers | `node -e "require.resolve(...)"` from combobox/command-palette/data-table react leaves | combobox and data-table resolve the identical physical popover dist path | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| R1 | 86-04, 86-05, 86-07 | Multi-select via widened sole model | ✓ SATISFIED | Truths 3, 4, 6 |
| R2 | 86-01, 86-02, 86-03 | Floating popup via composed popover | ✓ SATISFIED | Truth 2 (one edge routed to human — see Human Verification) |
| R3 | 86-06, 86-07 | Creatable via consumer-owned `create` event | ✓ SATISFIED | Truth 5 (one edge routed to human — see Human Verification) |
| R4 | 86-01 | Two-level composition chain proven first (blocking tracer) | ✓ SATISFIED | Truth 1 |
| R5 | 86-07 | Breaking minor release wave wired end to end | ✓ SATISFIED | Truth 8 |
| R6 | 86-07 | Comparison-doc matrix reflects new reality | ✓ SATISFIED (with an adjacent finding — see Human Verification item 3) | Truth 9 |

**Note on requirement traceability:** `86-SPEC.md`'s R1-R6 are SPEC-local IDs (per `/gsd-spec-phase` convention on this project — confirmed via project memory `project_spec_ids_vs_requirements_registry`); they are not registered in the global `.planning/REQUIREMENTS.md`, which tracks a separate domain-ID namespace (`PARSE-*`, `MOD-*`, etc.) unrelated to this phase. This is expected, not a gap. All 6 SPEC requirement IDs are cross-referenced across the 7 plans' `requirements:` frontmatter and fully accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `docs/components/combobox.md` | 263 | Stale claim: "there is no document click-outside listener and therefore no cross-Lit-shadow retargeting problem" | ⚠️ Warning | This phase's own D-07 (shipped 86-01/86-03) composes Popover's `trigger="manual"` mode, which installs a real document-level Escape + click-outside `<listener>` (gated by the new `disableDismiss`/`pinOpen()` veto, not by its absence). The claim predates the phase and was never revisited despite this exact file being touched by 4 of the 7 plans in this phase. See Human Verification item 3. |
| `docs/components/combobox-comparison.md` | 51 | Same stale claim, same root cause | ⚠️ Warning | Same as above; this file WAS touched by 86-07's own docs-flip task, but this specific paragraph (outside the 3 flipped cells / defer bullets) was not revisited. |
| `.changeset/combobox-multiselect-floating-creatable.md` | 30 | "The `inline` prop still renders the list statically with **no popover involvement**, unchanged." | ℹ️ Info | Technically imprecise under D-09 (popover IS composed in the `inline` tree via `disablePositioning`, it simply performs no positioning/mounts no `autoUpdate`) — the exact SPEC-wording tension CONTEXT.md itself flagged and every plan's own `must_haves` correctly restated ("performs no positioning, mounts no `autoUpdate` listeners"). The changeset (public-facing prose) reverted to the looser SPEC phrasing. Not misleading about behavior in practice, but worth a wording tweak before publish. Not blocking. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any phase-86-modified source, test, or docs file.

### Human Verification Required

### 1. Exact 0px viewport-fit boundary (R2 backstop)

**Test:** At a viewport height where the popup fits by exactly 0px below the input, open the combobox.
**Expected:** The popup renders in its normal below-position, without flipping.
**Why human:** Explicitly flagged `🧪 backstop` in `86-SPEC.md`'s Edge Coverage table ("the boundary arithmetic is Floating UI's") and listed in `86-VALIDATION.md`'s Manual-Only Verifications table. Not deterministically reproducible in the vitest/happy-dom harness by design.

### 2. `create` committed during an in-flight async `search` (R3 backstop)

**Test:** Type a query, trigger a delayed/async `options` update via `search`, and commit a `create` gesture on the same query before the async update resolves.
**Expected:** Exactly one `create` fires (or is correctly suppressed by the double-commit latch); no lost or duplicated event.
**Why human:** Explicitly flagged `🧪 backstop` in `86-SPEC.md` and `86-VALIDATION.md`; `86-06-SUMMARY.md` itself records this was not manually probed in that execution run. The same-tick double-commit guarantee IS automated and passing; the live async-race scenario is not.

### 3. Stale dismissal-behavior claim in two docs pages

**Test:** Review `docs/components/combobox.md:263` and `docs/components/combobox-comparison.md:51` — both state "there is no document click-outside listener and therefore no cross-Lit-shadow retargeting problem."
**Expected:** A human decision on whether to correct this prose. As of this phase, combobox composes Popover with `trigger="manual"`, which installs real document-level Escape + click-outside dismissal (mediated by the new opt-in `disableDismiss`/`pinOpen()` veto). The claim is not currently true of the shipped behavior.
**Why human:** Outside SPEC R6's literal, already-satisfied acceptance criteria (the three cell flips + defer-bullet removal + `surface_hash` regen). A discretionary doc-accuracy call, not a locked truth failure — flagged per the phase's own "deep audit" standing rule (`feedback_deep_audit_before_release`) rather than blocking the phase.

### Gaps Summary

No blocking gaps. All 6 SPEC requirements (R1-R6), the 3 machine-enforced prohibitions, and the disableDismiss regression fix are genuinely implemented, wired, and tested — verified by direct source reads and independent re-execution of every relevant test suite (192/192 combobox, 33/33 popover, 210/210 command-palette, 29/29 docs, 42/42 prohibitions), not by trusting SUMMARY.md narrative. Two SPEC-declared backstop edges and one adjacent documentation-accuracy finding are routed to human verification per the escalation-gate pattern; none of the three represents a failure of a declared must-have.

---

*Verified: 2026-09-01T17:10:00Z*
*Verifier: Claude (gsd-verifier)*
