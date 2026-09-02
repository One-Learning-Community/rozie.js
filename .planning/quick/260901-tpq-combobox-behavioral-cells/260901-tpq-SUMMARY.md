---
phase: quick-260901-tpq
plan: 01
subsystem: testing
tags: [playwright, visual-regression, combobox, floating-ui, behavioral-testing]

# Dependency graph
requires:
  - phase: 86-combobox
    provides: "Combobox family (chip remove CR-02 fix d02a145ef, flip-on-overflow R2 criterion, Popover size/offset middleware)"
provides:
  - "combobox-chip-remove behavioral cell (6 targets) — real-browser proof of the CR-02 fix's browser-only half"
  - "combobox-flip-exact-fit behavioral cell (6 targets) — real-browser proof of Phase 86 UAT item 1's zero-slack boundary"
affects: [visual-regression, combobox-maintenance, popover-maintenance]

actuals:
  tokens: 3235
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Baseline-free behavioral Playwright cells: reuse the file's TARGETS/built/runner gate shape with no baselineExists() gate when a cell asserts DOM/geometry only, no toHaveScreenshot"
    - "Shadow-root-piercing activeElement walk for focus assertions under Lit (document.activeElement resolves to the custom-element host, not the inner input)"
    - "Measure-don't-hardcode geometry derivation: read a middleware default (Popover offset) from live layout rather than pinning its numeric value, so the cell stays honest if the default drifts"
    - "Negative-control passes as an explicit vacuity guard for geometry assertions (Pass C proves the cell can distinguish above/below, not just assert a tautology)"

key-files:
  created: []
  modified:
    - tests/visual-regression/specs/combobox.spec.ts

key-decisions:
  - "Located the chip remove control by ARIA role + accessible name (`Remove Banana`), never by coordinate — a coordinate approach was measured during scoping to land ~30px off target (1713 CSS px viewport vs 1456 px screenshot space, scale 0.85, DPR 2)"
  - "Derived the flip-exact-fit viewport height from a live Pass-A measurement (input bottom + measured offset + panel height) instead of hardcoding the Combobox `offset: 4` default"
  - "Re-navigated (page.goto) between the three flip-exact-fit passes instead of resizing an already-open popup and trusting autoUpdate's resize-observer timing"
  - "Scoped Task 3's regression gate to the three behavioral blocks only (regex `combobox \\[|combobox-chip-remove|combobox-flip-exact-fit`), deliberately excluding the three pixel blocks (combobox-floating/-multi/-creatable) which are expected to diverge on Apple Silicon per feedback_vr_macos_text_node_kerning"

requirements-completed: [QUICK-260901-tpq]

coverage:
  - id: D1
    description: "combobox-chip-remove: a real trusted mousedown on a chip's remove control removes the chip, keeps the popup open, keeps focus on the input, and preserves an in-progress query — across all 6 targets"
    requirement: "QUICK-260901-tpq"
    verification:
      - kind: automated_ui
        ref: "tests/visual-regression/specs/combobox.spec.ts#combobox-chip-remove [target] (x6)"
        status: pass
    human_judgment: false
  - id: D2
    description: "combobox-flip-exact-fit: at a viewport height where the popup fits below the input by exactly 0px it stays below; at 8px less it flips above — measured geometry, not hardcoded numbers — across all 6 targets"
    requirement: "QUICK-260901-tpq"
    verification:
      - kind: automated_ui
        ref: "tests/visual-regression/specs/combobox.spec.ts#combobox-flip-exact-fit [target] (x6)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither new cell writes a pixel snapshot; no new PNG baseline appears under __screenshots__/; all 18 behavioral combobox cells (existing smoke x6 + two new blocks x6 each) pass locally on macOS"
    requirement: "QUICK-260901-tpq"
    verification:
      - kind: automated_ui
        ref: "pnpm --filter @rozie/visual-regression test:visual -g 'combobox \\[|combobox-chip-remove|combobox-flip-exact-fit' (18 passed)"
        status: pass
      - kind: other
        ref: "git status --porcelain tests/visual-regression/__screenshots__/ (empty)"
        status: pass
    human_judgment: false

duration: 24min
completed: 2026-09-02
status: complete
---

# Quick Task 260901-tpq: Combobox Behavioral Cells Summary

**Two new baseline-free Playwright behavioral blocks (12 cells across 6 targets) closing the last two "manual only" / "happy-dom cannot reach this" gaps on the Phase 86 combobox surface: real trusted chip-removal via mousedown, and a measured zero-slack popover flip boundary.**

## Performance

- **Duration:** 24 min (commit-to-commit; investigation/reading preceded first commit)
- **Started:** 2026-09-02T04:34:27Z (Task 1 commit)
- **Completed:** 2026-09-02T04:37:22Z (Task 2 commit; Task 3 was verification-only, no code change)
- **Tasks:** 3 (2 code tasks + 1 whole-file verification gate)
- **Files modified:** 1 (`tests/visual-regression/specs/combobox.spec.ts`)

## Accomplishments

- **`combobox-chip-remove [target]`** (6 cells, one per target): drives `ComboboxMultiDemo`, types an in-progress query (`ch`), performs a genuinely trusted click on the `Remove Banana` role locator, and asserts in one cell — chip count drops 3→2, `Remove Banana` disappears while `Remove Apple`/`Remove Cherry` each remain exactly-one, the popup stays open (panel visible + option count still 1), the query survives (`toHaveValue('ch')`), and focus is still on the input (proven via a shadow-root-piercing `activeElement` walk, since `document.activeElement` resolves to the Lit custom-element host under shadow DOM, not the inner input).
- **`combobox-flip-exact-fit [target]`** (6 cells, one per target): drives `ComboboxFloatingDemo` through three passes — Pass A measures the resolved offset and panel height at a generously tall viewport; Pass B sets the viewport to the exact-fit height (`Math.ceil` of the measured sum) and asserts the popup stays BELOW the input with zero slack; Pass C (negative control, 8px short of the same sum) asserts the popup flips ENTIRELY above. All three re-navigate rather than resize-and-trust-autoUpdate.
- **Task 3 whole-file gate**: ran the 18-cell behavioral surface (existing `combobox [target]` smoke ×6 + the two new blocks ×6 each), scoped deliberately away from the three Linux-baseline pixel cells, confirmed zero baseline drift and zero pixel assertions in the new region, and confirmed the working tree holds only the one spec-file change.
- Both new blocks write no image and add no PNG baseline — safe to author and verify on macOS per `feedback_vr_linux_baselines`.

## Task Commits

Each code task was committed atomically:

1. **Task 1: combobox-chip-remove behavioral cell** — `81f43f981` (test)
2. **Task 2: combobox-flip-exact-fit boundary cell** — `18331fa73` (test)
3. **Task 3: whole-file regression gate** — verification-only, no new code; no separate commit (the spec file was already fully committed by Tasks 1–2, matching the atomic per-task commit protocol)

_No plan-metadata commit was made separately — `.planning/` is gitignored and `commit_docs` is false on this repo (per `project_planning_artifacts_gitignored`); this SUMMARY.md is written to disk only, not committed._

## Files Created/Modified

- `tests/visual-regression/specs/combobox.spec.ts` — added two new per-target Playwright blocks (12 cells total) at the end of the file, both reusing the file's existing `TARGETS`/`built`/`runner` gate shape with no `baselineExists()` gate (neither block produces an image).

## Decisions Made

- **Role-based locators only, no coordinates.** The `Remove Banana` control is located by `page.getByRole('button', { name: 'Remove Banana' })`. A coordinate-based approach was explicitly forbidden per the plan (measured during scoping to land ~30px off target due to a 1713 CSS px viewport vs 1456 px screenshot-space scale mismatch, 0.85 scale × DPR 2).
- **Shadow-root-piercing focus check.** Focus retention is proven via `page.evaluate` walking `while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement`, not `toBeFocused()` or a direct `document.activeElement` read — both would misreport the Lit host as focused instead of the inner input.
- **Measured, not hardcoded, offset.** The flip-exact-fit cell derives the Combobox `offset` prop's resolved value (`gap = panelTop - inputBottom`) from a live Pass-A measurement rather than hardcoding the documented default of `4`, so the cell stays honest if that default or the popover's middleware order ever changes.
- **Re-navigate between passes, don't resize-in-place.** Popover.rozie installs `autoUpdate`, but the plan explicitly calls for re-navigating (fresh mount, deterministic recompute) rather than resizing an open popup and depending on resize-observer timing.
- **Negative control (Pass C) as the vacuity guard.** Without an explicit 8px-overflow pass proving the popup DOES flip, a 50px measurement error could let the zero-slack pass (Pass B) succeed for the wrong reason.
- **Task 3's regression gate deliberately excludes the three pixel blocks** (`combobox-floating`, `combobox-multi`, `combobox-creatable`) — those diff against Linux-Docker-rendered baselines and are expected to diverge on Apple Silicon (`feedback_vr_macos_text_node_kerning`); reblessing them would have been the wrong response to an environment artifact, not a regression from this task.

## Vacuity Proofs (RED-then-GREEN)

Per the plan's critical constraint, each new cell was proven capable of failing before being declared done.

**Cell 1 (`combobox-chip-remove`):** temporarily changed the post-removal chip-count assertion from the correct value (`2`) to a deliberately wrong one (`999`).
- RED: `pnpm --filter @rozie/visual-regression test:visual -g 'combobox-chip-remove' --reporter=list` → **6 failed** (`Expected: 999 / Received: 2` on every target — proving the real chip count was correctly measured as 2, not vacuously matched).
- Restored the assertion; `diff` against the pre-mutation backup confirmed byte-identical restoration.
- GREEN: re-ran → **6 passed**.

**Cell 2 (`combobox-flip-exact-fit`):** temporarily inverted Pass C's negative-control assertion from "panel entirely above the input" to "panel entirely below" (Pass B's condition).
- RED: `pnpm --filter @rozie/visual-regression test:visual -g 'combobox-flip-exact-fit' --reporter=list` → **6 failed** (e.g. `Expected: >= 635 / Received: 462.875` on `lit` — proving the panel really was measured above the input at 462.875, not a coincidental pass).
- Restored the assertion; `diff` against the pre-mutation backup confirmed byte-identical restoration.
- GREEN: re-ran → **6 passed**.

## Verification Output

```
$ pnpm --filter @rozie/visual-regression test:visual -g 'combobox-chip-remove' --reporter=list
Running 6 tests using 1 worker
  ✓ 1 …[vue]…  ✓ 2 …[react]…  ✓ 3 …[svelte]…  ✓ 4 …[angular]…  ✓ 5 …[solid]…  ✓ 6 …[lit]…
  6 passed (3.9s)

$ pnpm --filter @rozie/visual-regression test:visual -g 'combobox-flip-exact-fit' --reporter=list
Running 6 tests using 1 worker
  ✓ 1 …[vue]…  ✓ 2 …[react]…  ✓ 3 …[svelte]…  ✓ 4 …[angular]…  ✓ 5 …[solid]…  ✓ 6 …[lit]…
  6 passed (2.6s)

$ pnpm --filter @rozie/visual-regression test:visual -g 'combobox \[|combobox-chip-remove|combobox-flip-exact-fit' --reporter=list
Running 18 tests using 1 worker
  ✓ 1 combobox [vue] … ✓ 6 combobox [lit] …
  ✓ 7 combobox-chip-remove [vue] … ✓ 12 combobox-chip-remove [lit] …
  ✓ 13 combobox-flip-exact-fit [vue] … ✓ 18 combobox-flip-exact-fit [lit] …
  18 passed (4.6s)

$ git status --porcelain tests/visual-regression/__screenshots__/
(empty)

$ git diff --stat 8b81e2a13..HEAD
 tests/visual-regression/specs/combobox.spec.ts | 228 +++++++++++++++++++++++++
 1 file changed, 228 insertions(+)
```

## Scope Boundary — Green Baselines Not Regressed

The full diff across both commits touches exactly one file (`tests/visual-regression/specs/combobox.spec.ts`), purely additive (228 insertions, 0 deletions, 0 deletions elsewhere). No `packages/ui/combobox`, `packages/ui/popover`, or `packages/ui/command-palette` source, no `.rozie` file, and no TypeScript source affecting the workspace typecheck was touched. Given that structural containment, `@rozie-ui/combobox` (197/197), `@rozie-ui/popover` (33/33), `@rozie-ui/command-palette` (210/210), and the whole-workspace typecheck (324/324) baselines could not have been regressed by this task, and were not re-run in full — the git-diff scope proof above is the evidence for that claim rather than a redundant multi-minute re-run of unrelated suites.

## Deviations from Plan

None — plan executed exactly as written. Both blocks match the file's established `TARGETS`/`built`/`runner` shape with no `baselineExists()` gate, banner comments include the required rationale and the `quick-260901-tpq` tag, locators and assertion techniques follow the plan's explicit prescriptions (role-based location, shadow-root-piercing focus walk, measured offset, re-navigation between passes), and `ComboboxFloatingDemo.rozie` was left untouched.

## Known Stubs

None.

## Threat Flags

None — this task added test-only Playwright cells against a locally served static `dist/`; no new network endpoints, auth paths, or trust-boundary-relevant surface. The plan's own `<threat_model>` register (T-tpq-01/02/03) was closed by the gates already run above (no baseline drift, exact-count gates on every run, no package installs).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The Phase 86 combobox surface's two remaining "manual only" gaps (CR-02's browser-only half, UAT item 1's flip boundary) are now covered by deterministic, cross-target automation. No further action needed on this surface.
- `86-UAT.md` / `86-SPEC.md`'s Edge Coverage table entry for the R2 flip boundary can be marked automated in a future documentation pass (not part of this quick task's scope).

## Self-Check: PASSED

- FOUND: `tests/visual-regression/specs/combobox.spec.ts`
- FOUND: commit `81f43f981` (Task 1)
- FOUND: commit `18331fa73` (Task 2)

---
*Phase: quick-260901-tpq*
*Completed: 2026-09-02*
