---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 05
subsystem: ui
tags: [rozie-compiler, combobox, multi-select, chips, theming, visual-regression]

requires:
  - phase: 86-04
    provides: The `multiple: Boolean` prop widening the sole `value` model to an array, `selectedValues()`/`isRowSelected()`/`effectiveCloseOnSelect()` helpers, and the ported toggle/dedup/fresh-array `selectOption()` algorithm the chip rail renders and the chip-remove closure reuses
  - phase: 86-03
    provides: The input living inside the composed `@rozie-ui/popover` leaf's `#anchor` slot, so the chip rail can join it there and become part of the same `matchWidth`-measured anchor
provides:
  - "The chip rail: a `<ul class=\"rozie-combobox-chips\">` rendered inside popover's `#anchor` slot fill, before the `<input>`, guarded solely on `multiple` (D-13) — chips + input together become the popover anchor, so the width-matched popup spans both"
  - "chipRows()/removeChipValue()/chipRemoveLabel() helpers; removeChipValue() routes through the SAME selectOption() toggle path a re-select uses"
  - "The `#chip` scoped slot (`{ option, remove, index }`, D-18) mirroring Tags.rozie's chip markup; a focusable, aria-labelled remove `<button>`"
  - "Backspace-removes-last-chip on an empty live input value (reads `e.target.value` directly, never `$data.query`)"
  - "Ten `--rozie-combobox-chip*` theming tokens, propagated to all six leaves, documented on a regenerated theming page"
  - "One Linux-rendered VR cell (`ComboboxMultiDemo.rozie` + `combobox-multi` spec case) proving the chip rail's appearance and the anchor-width-match claim with DOM evidence"
affects: [86-06-combobox-creatable, 86-comparison-doc-flip, 86-07-prohibition-gate]

actuals:
  tokens: 33414
  tasks: 4
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A helper that calls another const-declared helper defined LATER in the same script must be declared textually AFTER it, not just logically nearby — React's emitter derives each `useCallback`'s static dependency array from every helper its body calls, so a forward reference puts the not-yet-initialized identifier in a useCallback deps array evaluated at that exact call site: a genuine same-render TDZ (ReferenceError at runtime, TS2448 'used before its declaration' at typecheck), not merely a lint nit. Source order is emission order for these plain top-level consts on React."
    - "A chip/token rail composed into a Popover's `#anchor` slot fill (alongside the existing anchor content) becomes part of what `anchorEl` measures for Floating UI's `matchWidth` — placing new content BEFORE the existing anchor fill inside the SAME slot, not as a sibling of the `<Popover>` element, is what makes the width-matched popup span the new content plus the old, not just the old alone."
    - "A demo fixture that opens a popover-composed popup at mount, when the popup renders belowthe control (normal, non-flipped placement), still needs an EXPLICIT height on the demo's root box — `position: absolute` content does not grow an ancestor's auto height, so without headroom reserved below the input, the open popup renders outside `[data-testid=\"rozie-mount\"]`'s captured bounding box and is silently cropped from the VR screenshot (the same principle ComboboxFloatingDemo.rozie already documents for the flipped-UP case, applying here to the normal downward case)."

key-files:
  created:
    - examples/demos/ComboboxMultiDemo.rozie
    - tests/visual-regression/__screenshots__/ComboboxMulti.png
  modified:
    - packages/ui/combobox/src/Combobox.rozie
    - packages/ui/combobox/src/themes/base.css
    - packages/ui/combobox/tests/multiple.behavior.test.ts
    - packages/ui/combobox/tests/surface.test.ts
    - packages/ui/combobox/scripts/compile-combobox-check.mjs
    - packages/ui/combobox/__fixtures__/rozie-manifest.expected.json
    - packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/* (codegen-regenerated: source + themes/base.css + README + rozie-manifest.json)
    - docs/components/combobox.md
    - docs/components/combobox-theming.md
    - tests/visual-regression/host/main.ts
    - tests/visual-regression/specs/combobox.spec.ts

key-decisions:
  - "D-13 checkpoint RESOLVED: `inside-control` (chips before the input, inside the same #anchor slot fill Popover measures for matchWidth) — confirmed by the human, `sibling-rail` rejected. See the Checkpoint Resolution section below."
  - "Chips + input are BOTH placed inside `<template #anchor>` (Popover's own slot, which Popover wraps in its `.rozie-popover-anchor` anchorEl div), not as a sibling of `<Popover>` at the top of `.rozie-combobox`. This is the one structural choice this plan had to make beyond what D-13's prose literally states, and it is load-bearing: only content INSIDE the `#anchor` slot fill is measured by Floating UI's `matchWidth` — a sibling placement would leave the popup matched to the input's width alone, defeating D-13/D-04's stated purpose. No wrapping div was added around chips+input (which would have required an r-if branch duplicating the input markup for the non-multiple case) — CSS alone (via the `.rozie-combobox--multiple` scoped class, already added in 86-04) is sufficient for the chip rail to render as a coherent block above the input inside Popover's shrink-to-fit anchor wrapper."
  - "removeChipValue() is declared textually AFTER selectOption(), not alongside chipRows()/chipRemoveLabel() where it would read more naturally — a real TDZ ordering bug (see Deviations) forced this."
  - "No wrapping div added around the chip rail + input; chips render as a direct sibling `<ul>` before `<input>` inside the anchor slot. Kept the diff minimal and avoided a second DOM shape to maintain for the non-multiple path."

requirements-completed: [R1]

coverage:
  - id: D1
    description: "Selected values render as chips inside the control (before the input, inside the composed popover's anchor), in selection order, deduplicated; `[]`/`null`/`undefined` render zero chips; a chip whose option has disappeared from `options` persists labelled by its raw value"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/multiple.behavior.test.ts — tests (9)/(10)/(14), ×4 render branches"
        status: pass
      - kind: unit
        ref: "node packages/ui/combobox/scripts/compile-combobox-check.mjs (22 props / 5 slots / compile()×6 zero-error)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every chip carries a focusable, aria-labelled remove control routed through the same toggle path a re-select uses; Backspace on an empty query removes the last chip, with text present it does not"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/multiple.behavior.test.ts — tests (11)/(12)/(13), ×4 render branches"
        status: pass
    human_judgment: false
  - id: D3
    description: "The `#chip` scoped slot (`{ option, remove, index }`) is a documented part of the surface, with a tokenised default, and does not collide with any prop (ROZ127)"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/surface.test.ts (slots include 'chip'; no slot==prop collision)"
        status: pass
      - kind: other
        ref: "docs/components/combobox.md `chip` slot row + Multi-select section"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ten chip theming tokens declared in base.css, propagated to all six leaves, and documented on a regenerated theming page"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "node token-propagation check (all 6 leaves) → 'token propagation OK'"
        status: pass
      - kind: unit
        ref: "node theming-page check → 'theming page OK'"
        status: pass
    human_judgment: false
  - id: D5
    description: "One Linux-rendered VR cell proves the chip rail's appearance and the anchor-width-match claim (popup spans chips + input), with DOM evidence, and no unexplained baseline movement on the single-select path"
    requirement: "R1"
    verification:
      - kind: e2e
        ref: "tests/visual-regression/specs/combobox.spec.ts combobox-multi [vue/react/svelte/angular/solid/lit] — DOM evidence (3 chips, panel width == control width within 1px) + toHaveScreenshot('ComboboxMulti.png')"
        status: pass
      - kind: other
        ref: "tools/ci-repro/vr.sh -u -b ComboboxMulti -g 'Combobox' (79/79) then a bare re-run (78 passed + 1 flaky-then-passed retry, 79/79 total) — zero diffs, exactly one new baseline PNG"
        status: pass
    human_judgment: false

duration: 58 min (approx.)
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 05: Multi-select chip rail Summary

**The chip rail: chips render inside the control's composed-popover anchor slot before the input — so the whole control becomes the popover anchor and the width-matched popup spans chips plus input — with a `#chip` scoped slot, Backspace-removes-last, ten propagated theming tokens, and one Linux-rendered VR cell proving it.**

## Performance

- **Duration:** 58 min (approx.)
- **Started:** 2026-09-01T18:56:00Z (approx. — continuation from 86-04's completion at 18:32:06Z, after the human resolved the D-13 checkpoint)
- **Completed:** 2026-09-01T19:54:13Z
- **Tasks:** 4 (1 checkpoint + 3 `type="auto"`)
- **Files modified:** 38

## Checkpoint Resolution

Task 1 was `type="checkpoint:decision" gate="blocking-human"` — confirm D-13 (the chip rail's DOM placement) before restructuring the control. A prior executor session reached this checkpoint and correctly halted, returning it to the human.

**Human response: `inside-control`.** Chips render INSIDE `.rozie-combobox` (specifically, inside the composed `<Popover>`'s `#anchor` slot fill, before the `<input>`), exactly as D-13 was already locked in `86-CONTEXT.md`. `sibling-rail` was explicitly rejected. The human accepted the known costs going in: breaking DOM restructuring of the control (authorized, sub-1.0 minor), consumer CSS targeting the control's direct children changing shape, and every VR baseline on the `multiple` path needing a Linux rebless (in the event, only ONE new baseline was needed — no pre-existing baseline moved, since the chip rail is entirely behind the `multiple` guard; see Task 3 below).

This plan proceeded exactly as D-13 specifies. No re-litigation.

## Accomplishments

- **Task 2 (source, tests — commit `c985414d5`):** Added the chip rail — a `<ul class="rozie-combobox-chips">` rendered inside `<Popover>`'s `#anchor` slot fill, before the `<input>`, guarded solely on `$props.multiple`. Placing it INSIDE the anchor slot fill (not as a sibling of `<Popover>`) is what makes chips + input together become the measured `anchorEl`, so Floating UI's `matchWidth` spans both — a placement choice this plan had to resolve beyond D-13's literal prose (see Decisions). `chipRows()` maps the de-duplicated `selectedValues()` (from 86-04) to display rows carrying the raw source option, or a raw-value fallback label when the option has disappeared from an async `options` swap (the R1 orphan-chip edge). The `#chip` scoped slot (`{ option, remove, index }`, D-18) mirrors `Tags.rozie`'s chip markup exactly: a label span + a focusable, aria-labelled `<button type="button">` remove control. `removeChipValue(v)` routes removal through the SAME `selectOption()` toggle path a re-select uses (via a synthetic wrapper row), so removal and toggle-off can never emit divergent payloads. Backspace on an empty LIVE input value (`e.target.value`, never `$data.query`) removes the last chip; any text in the input falls through to normal editing. Four token-driven chip CSS classes added. `multiple.behavior.test.ts` extended with 6 new behaviors (chip render order/dedup, orphan persistence, remove-routes-through-toggle, focusable+aria-labelled, Backspace-empty-vs-text, no-rail-when-unset) × 4 render branches = 24 new tests (113 total, up from 89). RED-first: 20/60 of the new chip-shaped assertions failed against the un-reverted 86-04 source before this change (orphan-chip and Backspace-with-text cases both captured — see Verification Log); all pass after.
- **Task 3 (theming — commit `f5221f203`):** Declared the ten chip tokens (`--rozie-combobox-chips-padding`, `-chip-gap`, `-chip-bg`, `-chip-color`, `-chip-radius`, `-chip-padding`, `-chip-size`, `-chip-remove-color`, `-chip-remove-hover-color`, `-chip-remove-size`) as one documented group in `base.css`, with real explanatory prose (not a label) mirroring `@rozie-ui/tags`' own chip theme where a token has a direct analog. Task 2's CSS fallbacks already matched these defaults exactly (chosen together), so no `Combobox.rozie` change was needed here. Regenerated `docs/components/combobox-theming.md` via `pnpm --filter docs gen:theming` (40 → 50 tokens); propagated to all six leaves' copied theme stylesheet via `pnpm turbo run build --force`.
- **Task 4 (VR cell — commit `5399386a7`):** `examples/demos/ComboboxMultiDemo.rozie` — a `multiple` combobox seeded with three chips (apple/banana/cherry) against a five-option list, self-opening its popup at mount (deferred one macrotask past `$onMount`, mirroring `ComboboxFloatingDemo.rozie`'s identical child-ref-readiness workaround), with an explicit root-box height reserving room for the open popup (mirroring `ComboboxFloatingDemo`'s point 2 — absolutely-positioned content doesn't grow an ancestor's auto height). Registered `ComboboxMulti` at all three `main.ts` points. New `combobox-multi` spec case in `combobox.spec.ts` asserting DOM evidence (exactly 3 chips; popup width equals control width within 1px) before the screenshot. Linux-Docker baselines generated and confirmed byte-identical on a bare re-run.

## Task Commits

Each task was committed atomically (the checkpoint itself produced no commit — it is recorded above as the Checkpoint Resolution):

1. **Task 1 (checkpoint:decision):** RESOLVED — no commit (decision only; recorded above)
2. **Task 2: The chip rail, the `#chip` slot, and Backspace-removes-last** - `c985414d5` (feat)
3. **Task 3: Chip theming tokens and the regenerated theming page** - `f5221f203` (feat)
4. **Task 4: One representative VR cell — the chip rail inside the control** - `5399386a7` (feat)

_No separate plan-metadata commit — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below._

## Files Created/Modified

- `packages/ui/combobox/src/Combobox.rozie` - chip rail markup inside `#anchor`, `chipRows()`/`removeChipValue()`/`chipRemoveLabel()` helpers, Backspace branch in `onKeydown`, four chip CSS classes
- `packages/ui/combobox/src/themes/base.css` - ten chip tokens, one documented group
- `packages/ui/combobox/tests/multiple.behavior.test.ts` - 24 new chip-shaped behavioral tests (6 behaviors × 4 branches)
- `packages/ui/combobox/tests/surface.test.ts`, `packages/ui/combobox/scripts/compile-combobox-check.mjs` - `EXPECT.slots` +`chip`
- `packages/ui/combobox/__fixtures__/rozie-manifest.expected.json` - regenerated manifest fixture (+`chip` slot entry)
- `packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/*` - codegen-regenerated (source, `themes/base.css`, README, manifest)
- `docs/components/combobox.md` - `chip` slot row + a new Multi-select section
- `docs/components/combobox-theming.md` - regenerated (40 → 50 tokens)
- `examples/demos/ComboboxMultiDemo.rozie` - new chip-rail VR fixture
- `tests/visual-regression/host/main.ts` - `ComboboxMulti` registered at all 3 points
- `tests/visual-regression/specs/combobox.spec.ts` - new `combobox-multi` pixel cell
- `tests/visual-regression/__screenshots__/ComboboxMulti.png` - new Linux-Docker baseline (360×380)

## Decisions Made

- **D-13 confirmed `inside-control`** by the human at the checkpoint; `sibling-rail` rejected. See Checkpoint Resolution above.
- **Chips + input BOTH inside `<template #anchor>`**, not chips as a sibling of `<Popover>`. Only content inside the `#anchor` slot fill is measured by Floating UI's `matchWidth` (the fill is wrapped by Popover's own `.rozie-popover-anchor` anchorEl div) — a sibling placement would leave the popup matched to the input's width alone, defeating D-13/D-04's stated purpose ("the width-matched popup spans chips plus input"). No extra wrapping div was introduced; chips render as a direct `<ul>` sibling before `<input>`, relying on the `.rozie-combobox--multiple` scoped class (already present from 86-04) for any chip-specific CSS hooks, keeping the non-`multiple` DOM path completely untouched.
- **`removeChipValue()` declared after `selectOption()`, not beside `chipRows()`/`chipRemoveLabel()`.** Forced by a real ordering bug — see Deviations.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `removeChipValue`'s `useCallback` deps array referenced `selectOption` before its own initializer (TDZ) on React**
- **Found during:** Task 2, first whole-workspace `pnpm turbo run typecheck --force --continue` run
- **Issue:** `removeChipValue` was originally declared alongside `chipRows()`/`chipRemoveLabel()`, textually BEFORE `selectOption()`. React's emitter derives each `useCallback`'s static dependency array from every helper its body calls; since `removeChipValue` calls `selectOption`, the emitted `useCallback(..., [props.options, selectOption, valueOf])` referenced `selectOption` at a point in module scope before `const selectOption = useCallback(...)` was declared — a genuine same-render TDZ, not just a lint nit (`ReferenceError` at runtime; `TS2448 "used before its declaration"` at typecheck, caught on `combobox-react`).
- **Fix:** Moved `removeChipValue`'s declaration to directly after `selectOption()`'s closing brace (source order is emission order for these plain top-level consts on React). `chipRows()`/`chipRemoveLabel()` — which do not call `selectOption` — stayed in their original position.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie`
- **Verification:** `pnpm turbo run typecheck --force --continue --concurrency=2` 324/324; `pnpm --filter @rozie-ui/combobox test` 113/113.
- **Committed in:** `c985414d5`

**2. [Rule 1 - Bug, doc-generation only] A hyphen-wrapped token name mid-line in the base.css comment rendered as `chip- remove-size` (broken) on the theming page**
- **Found during:** Task 3, first `pnpm --filter docs gen:theming` run after declaring the ten tokens
- **Issue:** `gen-theming-pages.mjs` collapses a multi-line comment into one line via `\s+` → single space; the source comment wrapped `--rozie-combobox-chip-remove-size` across two lines at the hyphen, producing `` `--rozie-combobox-chip- remove-size` `` (a stray space inside the token name) in the rendered prose.
- **Fix:** Re-wrapped the comment so the token name is never split across a line break.
- **Files modified:** `packages/ui/combobox/src/themes/base.css`
- **Verification:** Regenerated `docs/components/combobox-theming.md`; confirmed the token name renders correctly as `` `--rozie-combobox-chip-remove-size` ``.
- **Committed in:** `f5221f203`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — one a real cross-target TDZ bug caught by typecheck, one a doc-generation formatting glitch). No scope creep — both fixes are scoped to the exact code the plan's own tasks specify.

## Issues Encountered

- **Pre-existing, unrelated, KNOWN-RED (not introduced by this plan):** `scripts/check-sidecar-staleness.mjs` (run as part of `scripts/ci-prepush.sh`) fails with ~24 `ORPHAN:` entries under `examples/consumers/*/fixtures/*.d.rozie.ts` — gitignored local build detritus with no matching `.rozie` source, disconnected from `packages/ui/combobox`, unchanged in nature since 86-01/86-03/86-04.
- **Pre-existing, unrelated, already logged in `.planning/WINDOWS.md` (ids 1, 2):** `pnpm --filter docs test` fails 2/29 on `tests/comparison-surface.test.ts`'s `surface_hash` drift gate for `combobox-comparison.md` and `popover-comparison.md`. This is the SAME class of finding 86-01/86-03/86-04 already recorded — the comparison-doc matrix flip is explicitly SPEC R6, a later plan (86-07 per the phase's own sequencing). This plan's `chip` slot addition (a further surface change beyond 86-04's `multiple` prop) is squarely within that already-open scope; no new WINDOWS.md entry needed. `27/29` docs tests pass.
- **One infra flake (not a regression), captured on the bare byte-identity VR re-run:** `combobox-group-cap [vue]` hit a Chromium `SIGSEGV` / "Target page, context or browser has been closed" mid-launch inside the Docker container (unrelated `dbus` socket error), auto-retried by Playwright and passed on retry (reported "1 flaky", overall exit 0, 79/79 across both passes). Not a `combobox-multi` cell, not a regression from this plan's changes.
- No unresolved blockers.

## User Setup Required

None - no external service configuration required.

## Verification Log

Full commands run, in the order the plan's `<verification>` section specifies:

1. `node packages/ui/combobox/scripts/compile-combobox-check.mjs` → `✓ Combobox surface OK: 22 props (1 model) / 2 emits / 5 slot / 4 expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`
2. `pnpm turbo run build --force --concurrency=2` (whole workspace, run 3× across task 2/3/4) → 243/243 successful every time.
3. `pnpm turbo run typecheck --force --continue --concurrency=2` (whole workspace) → first run caught deviation 1 above (`combobox-react` TS2448); every subsequent run 324/324 successful.
4. `pnpm --filter @rozie-ui/combobox test -- --reporter=verbose` (via `pnpm exec vitest run --reporter=verbose`) → 113/113 (10 test files; `multiple.behavior.test.ts` now 60 tests, up from 36).
5. `pnpm --filter docs test` → 27/29 (the 2 pre-existing, already-logged `WINDOWS.md` failures; see Issues Encountered).
6. **RED-first evidence (task 2, captured against the un-reverted 86-04 source — no chip code — before implementing):**
   ```
   git checkout -- packages/ui/combobox/src/Combobox.rozie   # revert to 86-04 HEAD
   node packages/ui/combobox/scripts/codegen.mjs              # regenerate leaves from reverted source
   pnpm --filter @rozie-ui/combobox exec vitest run tests/multiple.behavior.test.ts --reporter=verbose
   ```
   Result: **20 failed / 40 passed** (60 total: the 36 pre-existing 86-04 tests all passed unchanged; the 24 new chip-shaped tests split 20 failed / 4 passed — test (14) "no chip rail when multiple unset" trivially passed × 4 branches since there was correctly nothing to render). Orphan-chip case: `expected [] to deeply equal [ 'Apple', 'ghost-value' ]` (×4 branches). Backspace-with-text case (test 13, asserting text-present Backspace does NOT remove): `expected [ 'apple', 'banana' ] to deeply equal [ 'apple' ]` (×4 branches — the assertion failed because nothing removed anything at all, both chip-remove paths not yet existing). Restored via `git apply` of the saved patch, regenerated leaves, re-ran: 113/113 green.
7. **Task 3 checks:** token-propagation node check → `token propagation OK`; theming-page node check → `theming page OK`.
8. **Task 4 VR checks:** `tools/ci-repro/vr.sh -u -b ComboboxMulti -g 'Combobox'` → 79/79 passed. **Cells that actually ran** (from real run output): `combobox-groups`/`combobox-group-cap`/`combobox-virtual` (×6 each) behavioral smoke, `keynav-behavior` (combobox) ×6, `matrix.spec.ts` `ComboboxScreenshot`/`KeynavCombobox` ×6 each, `combobox` (behavioral) ×6, `combobox-floating` ×6, **`combobox-multi` ×6 (this plan's new cell)**, `combobox-virtual-flip` ×6. Then a bare `tools/ci-repro/vr.sh -g 'Combobox'` (no `-u`) → 78 passed + 1 flaky-then-passed retry (unrelated `combobox-group-cap [vue]` browser crash, see Issues Encountered), 79/79 total, zero baseline diffs reported.
   - **Baseline PNGs — every new/changed one individually justified:** `__screenshots__/ComboboxMulti.png` (NEW, 360×380) — the sole new baseline this task adds; visually confirmed three chips (Apple ×, Banana ×, Cherry ×) wrapping across two rows above a focused "Add more…" input, with the open popup below listing all five options (Apple/Banana/Cherry in the selected/accent color, Date/Elderberry plain) at a width visually matching the chip rail + input row. **No other baseline changed** across either the rebless or the bare pass — `ComboboxFloating.png`, `ComboboxScreenshot` (matrix.spec.ts), and every other pre-existing Combobox/Popover cell in the grep stayed byte-identical, confirming the chip rail's `r-if="$props.multiple"` guard truly never touches the single-select rendered shape (the "red flag if a single-select baseline moves" check in the plan's own acceptance criteria — nothing moved).
9. `bash scripts/ci-prepush.sh` → failed only at the same pre-existing, unrelated sidecar-staleness gate (see Issues Encountered). Ran the remaining stages manually: `node scripts/check-dep-drift.mjs` → `✓ dependency-drift OK — all 1623 resolved package name(s) are allowlisted`; `pnpm turbo run test --force --continue --concurrency=4` (whole workspace) → 148/149 tasks successful, only `@rozie/docs#test` failed — the SAME 2 pre-existing `comparison-surface.test.ts` failures already logged in `.planning/WINDOWS.md` (ids 1, 2).

**Turbo adjudication:** all whole-workspace runs used `--concurrency=2`/`4` per project convention; the two real failures (docs surface-hash, sidecar staleness) are pre-existing, unchanged in nature from prior plans in this phase — not regressions introduced here.

## Next Phase Readiness

- R1 is now FULLY proven end to end: the widened sole `value` model (86-04) plus the chip rail, `#chip` slot, Backspace-removes-last, and ten propagated theming tokens (this plan). All eight R1-locked behaviors (toggle, ordering, dedup, empty, freshness, concurrency, ARIA, close-behavior, plus the chip-specific render/remove/orphan/Backspace behaviors) are proven across all four render branches.
- Plan 86-06 (creatable) can proceed independently — it does not depend on the chip rail's specific markup, only on `selectOption()`'s existing `opt.isMore`-style short-circuit shape (already documented in 86-RESEARCH.md Pattern 4) to add its own `opt.isCreate` branch.
- The R6 comparison-doc flip remains explicitly NOT blocked by anything in this plan — both open `WINDOWS.md` entries (1, 2) still describe the current state accurately (multi-select, including chips, is now fully real; the comparison page's ❌→✅ flip is still R6's job).
- The chip rail's placement inside Popover's `#anchor` slot fill (this plan's one non-literal structural decision beyond D-13's prose) is now the established pattern any FUTURE combobox surface that needs to participate in `matchWidth` measurement should follow — read this SUMMARY's Decisions section before adding another anchor-adjacent surface.

## Self-Check: PASSED

- Both created files confirmed present on disk with `[ -f ]`: `examples/demos/ComboboxMultiDemo.rozie`, `tests/visual-regression/__screenshots__/ComboboxMulti.png`.
- All 3 commit hashes (`c985414d5`, `f5221f203`, `5399386a7`) confirmed present via `git log --oneline --all`.
- All acceptance criteria for tasks 2-4 re-verified with real command output (see Verification Log above).

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
