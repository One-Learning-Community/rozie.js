---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 03
subsystem: ui
tags: [rozie-compiler, floating-ui, popover, combobox, composition, visual-regression, solid-slot-reactivity]

requires:
  - phase: 86-01
    provides: Command-palette → combobox → popover composition chain; popover's bare/disablePositioning/manual-trigger props; the plain combobox branch wrapped in a composed Popover
  - phase: 86-02
    provides: Popover keepMounted (hide-not-unmount) and matchWidth (size middleware) props, both open-gated/width-only
provides:
  - All four combobox render branches (plain/grouped/grouped+capped/windowed) positioned through a single composed @rozie-ui/popover leaf
  - The combobox `<input>` living inside popover's `#anchor` slot — the real fix that makes Floating UI positioning and matchWidth actually correct (the previous anchor was an empty, zero-size div) and gives popover's click-outside dismissal correct containment of the input
  - A Solid-specific reentrancy guard (`openingInProgress`) protecting focus/open state across a scoped-named-slot re-render that recreates the anchor's DOM
  - floating-popover.behavior.test.ts — red-first proof of the four non-pixel R2 criteria + D-07/D-10
  - The flipped-popup pixel VR cell (ComboboxFloatingDemo.rozie + combobox.spec.ts + Linux baseline)
affects: [86-04-combobox-multiselect, 86-05-combobox-chips, 86-06-combobox-creatable, 86-comparison-doc-flip]

actuals:
  tokens: 16700
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Several bare (unwrapped) r-if template elements passed as a component's loose default-slot children crash @rozie/core's extractSlotFillers (an astChild/loweredChildren index-alignment bug) — wrap them in an explicit <template #default> fill to sidestep the loose-children code path entirely."
    - "A named scoped slot's reactive params (Popover's `#anchor` passes `open`/`toggle`/`show`/`hide`) are, on Solid specifically, a plain closure re-invoked whenever ANY param changes — no virtual-DOM diffing preserves node identity across the re-invocation. Any focus-critical element placed inside such a slot needs a non-reactive reentrancy flag protecting its own open-triggering handler from the recreation's own synchronous blur, plus a deferred re-focus recovering onto whichever node is current afterward. The other 5 targets diff their scoped-slot re-render and never hit this."
    - "A percentage width on an element wrapped by an `inline-block`, shrink-to-fit-width ancestor is circular (CSS 2.1 §10.3.3) and silently degrades to the element's intrinsic size — give the wrapped element an EXPLICIT width (reading the same design-token custom property the ancestor uses) instead."

key-files:
  created:
    - packages/ui/combobox/tests/floating-popover.behavior.test.ts
    - examples/demos/ComboboxFloatingDemo.rozie
    - tests/visual-regression/__screenshots__/ComboboxFloating.png
  modified:
    - packages/ui/combobox/src/Combobox.rozie
    - packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/src/Combobox.* (codegen-regenerated)
    - packages/ui/combobox/package.json (+@floating-ui/dom test-scoped devDependency)
    - pnpm-lock.yaml
    - tests/visual-regression/host/main.ts
    - tests/visual-regression/specs/combobox.spec.ts
    - tests/visual-regression/specs/combobox-virtual.spec.ts

key-decisions:
  - "r-if=\"$data.isOpen || $props.virtual\" removed from the wrapping <Popover> element entirely (always mounted); Popover's OWN internal floating-panel r-if (open || keepMounted) is what continues to unmount the list on close for the three non-virtual branches — this was required once the input moved into the always-visible #anchor slot (the input cannot be conditionally unmounted with the popup)."
  - "The four r-if render branches are wrapped in an explicit <template #default> fill inside <Popover>, not passed as loose children — required to avoid a real @rozie/core compiler crash (extractSlotFillers) on multiple bare r-if slot children, discovered while implementing task 1."
  - "matchWidth's reference (Popover's anchorEl) had to become the real input box, not popover's own decoy anchor div, for R2's positioning criterion to be true at all — solved entirely combobox-side (moving the input into #anchor + one CSS width fix), no Popover.rozie or core-emitter change."

requirements-completed: [R2]

coverage:
  - id: D1
    description: "All four combobox render branches (plain/grouped/grouped+capped/windowed) position through one composed <Popover>; the template contains four listboxes, not eight"
    requirement: "R2"
    verification:
      - kind: unit
        ref: "node packages/ui/combobox/scripts/compile-combobox-check.mjs (grep-verified: 1 <Popover>, 4 role=listbox, 1 keep-mounted bound to virtual)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/combobox test (53/53, incl. pre-existing group-cap/keep-open/scroll-active/seed-query/virtual-flip suites unchanged)"
        status: pass
      - kind: other
        ref: "pnpm turbo run build --force --concurrency=2 (243/243) + typecheck --force --continue (324/324)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The popup flips above the input at a viewport edge on all six targets, with a Linux-rendered VR baseline"
    requirement: "R2"
    verification:
      - kind: e2e
        ref: "tests/visual-regression/specs/combobox.spec.ts combobox-floating [vue/react/svelte/angular/solid/lit] — DOM-evidence assertion (panel bottom <= input top) + toHaveScreenshot('ComboboxFloating.png')"
        status: pass
      - kind: other
        ref: "tools/ci-repro/vr.sh -u -b ComboboxFloating -g 'Combobox' then a bare re-run — 73/73 both times, zero diffs (Linux Docker)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The inline path performs no positioning and mounts no autoUpdate listeners; open->close->open accumulates no additional autoUpdate listeners; an empty option list still positions and renders #empty; Escape closes exactly once without clearing the query twice"
    requirement: "R2"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/floating-popover.behavior.test.ts (6 tests, all against the committed emitted Vue leaf, autoUpdate spied via vi.mock('@floating-ui/dom'))"
        status: pass
    human_judgment: false
  - id: D4
    description: "The real click-to-open and positioning regressions discovered proving R2 with an actual browser are fixed: the popup previously rendered width:0 mispositioned to the right of the input (empty anchor), and a real click on the input to open it self-dismissed via the new click-outside listener"
    requirement: "R2"
    verification:
      - kind: e2e
        ref: "ad hoc Playwright probes (not committed as test files, findings folded into floating-popover.behavior.test.ts's assertions and the VR cell's DOM-evidence check) — panel box matched input box exactly (x/width) after the fix; real click() on the input opens 4 options on all 6 targets; click-elsewhere closes to 0"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/combobox test + pnpm --filter @rozie-ui/popover test (53/53 + 33/33) after the fix"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Solid-specific recreate/blur/refocus interaction discovered while fixing D4 does not regress into an infinite loop and settles focus correctly"
    requirement: "R2"
    verification:
      - kind: e2e
        ref: "MutationObserver probe against the emitted Solid leaf: exactly 1 anchor recreation per open, activeElement lands on the combobox input, aria-expanded=true, option count=4"
        status: pass
    human_judgment: false

duration: 1h 46min
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 03: Grouped, capped, and windowed branches onto the composed popover Summary

**Finished R2: all four combobox render branches now position through one composed `@rozie-ui/popover` leaf, proven by a red-first behavioral test suite and a Linux-Docker flipped-popup VR cell — and along the way, fixed two real, previously-undetected bugs (a zero-size positioning anchor, and a click-to-open self-dismissal) that only a real browser, not happy-dom, could expose.**

## Performance

- **Duration:** 1h 46min
- **Started:** 2026-09-01T15:55:58Z (approx., first task commit)
- **Completed:** 2026-09-01T17:41:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 21 (across all five commits)

## Accomplishments

- **Task 1 (source):** Moved the grouped, grouped+capped, and windowed `<ul>` branches inside the SAME `<Popover>` the plain branch already used (from plan 86-01) — one `<Popover>`, four mutually-exclusive `r-if` branches wrapped in `<template #default>` (required to dodge a real `@rozie/core` compiler crash on multiple bare `r-if` slot children — `extractSlotFillers`'s astChild/loweredChildren index-alignment bug). `keepMounted` forwards only when `virtual` (D-10); `matchWidth` is always on (D-04/D-12); `disablePositioning` still forwards `inline` (D-09). Removed the now-orphaned `.rozie-combobox > .rozie-combobox-list` direct-child absolute-positioning CSS rule (no branch is a direct child of `.rozie-combobox` anymore).
- **Task 2 (tests):** `floating-popover.behavior.test.ts` — 6 tests against the committed emitted Vue leaf, `autoUpdate` subscribe/teardown counted via a `vi.mock('@floating-ui/dom', ...)` spy wrapper. RED-first: the first run failed 2/6 because combobox has no direct `@floating-ui/dom` dependency (by design — combobox composes popover, never a second Floating UI integration), so the spy's bare-specifier resolution from combobox's own package never intercepted the emitted `@rozie-ui/popover-vue` leaf's identical import. Fixed by adding `@floating-ui/dom` as a test-scoped devDependency, pinned to the exact version popover already carries (pnpm's content-addressable store then resolves both to the same physical package). GREEN after: 6/6 new, 53/53 total.
- **Real-browser deviation (the big one):** Proving R2's viewport-edge flip with an actual browser — the ONE thing happy-dom cannot show — surfaced two genuine, previously-undetected bugs: (1) Popover's own internal anchor div was EMPTY (combobox never filled `#anchor`), so Floating UI measured a zero-size point instead of the control — the popup rendered `width: 0px` positioned to the RIGHT of the input instead of below it; (2) the input, living outside both `anchorEl`/`floatingEl`, was never recognized as "inside" by popover's document-level click-outside dismissal (D-07's new capability) — a REAL click on the input to open it immediately self-dismissed. Fixed entirely combobox-side: moved the `<input>` into `<Popover>`'s `#anchor` slot fill, and changed `.rozie-combobox-input`'s width from `100%` (circular against the anchor's shrink-to-fit sizing) to the explicit `--rozie-combobox-width` token (with an `.rozie-combobox--inline` override restoring `100%` for the embedded path). No `Popover.rozie` or core-emitter change.
- **Solid-only follow-up:** moving the input into a scoped named slot (Popover's `#anchor` passes `open`/`toggle`/`show`/`hide`) meant every open/close now SYNCHRONOUSLY recreates the anchor's DOM subtree on Solid specifically (a documented, intentional characteristic of Solid's named-slot lowering — a plain closure re-invocation, no virtual-DOM diffing) — removing the just-focused input mid-focus fired a native blur that immediately re-closed the popup, and an early attempted fix (an unconditional deferred re-focus) caused a genuine infinite recreate/blur/close/refocus loop. Fixed with a non-reactive `openingInProgress` reentrancy flag, true only for the exact synchronous duration of an `onFocus`-triggered write, letting `onBlur` distinguish "blur caused by our own open transition" from a real user-initiated blur — plus a deferred (microtask) re-focus recovering onto whichever node is current after Solid's cascade settles. No-op on the other 5 targets.
- **Task 3 (VR cell):** `examples/demos/ComboboxFloatingDemo.rozie` — a deterministic, self-opening fixture (composes `Combobox.rozie`) with the control pushed near the pinned 1280×720 viewport's bottom edge, forcing the composed popover's `flip` middleware to relocate the popup above the input. Registered at all 3 `main.ts` points; a new `combobox-floating` pixel cell appended to `combobox.spec.ts` asserting DOM evidence of the flip (panel bottom edge at/above the input's top edge) in addition to `toHaveScreenshot`. Linux-Docker baseline generated and confirmed byte-identical on a bare re-run.
- **Pre-existing-bug fix, unrelated to this plan's own new work:** `combobox-virtual.spec.ts`'s `combobox-virtual-flip` cell — passing before this plan (it never exercised a Popover-wrapped virtual branch) — broke on all 6 targets once the plain branch (already Popover-wrapped since 86-01) picked up real click-outside dismissal for the first time this VR run exercised it. Its "flip virtual" debug button lives outside the control by design; fixed by driving it via a raw `mousedown` dispatch (the exact event its own `@mousedown.prevent` handler listens for) instead of Playwright's `.click()`, which synthesizes a genuine click the new dismissal correctly treats as "outside."

## Task Commits

Each task was committed atomically, plus two deviation-fix commits discovered while proving the plan's own acceptance criteria:

1. **Task 1: Move the grouped, capped, and windowed branches onto the composed popover path** - `b0d235fcc` (feat)
2. **Task 2: Behavioral proof of the four non-pixel R2 criteria** - `92b54663f` (test)
3. **Deviation fix: real anchor sizing + click-outside containment + Solid focus safety** - `b2e3ef8e1` (fix)
4. **Deviation fix: drive the virtual-flip demo toggle via mousedown, not click** - `b2f05ec44` (fix)
5. **Task 3: One representative VR cell — the popup flipping above the input** - `90bcf5641` (feat)

_No separate plan-metadata commit — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below._

## Files Created/Modified

- `packages/ui/combobox/src/Combobox.rozie` - single composed `<Popover>` wrapping all four branches + the input (now in `#anchor`); `openingInProgress` Solid reentrancy guard; CSS width/positioning fixes
- `packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/*` - codegen-regenerated emitted leaves
- `packages/ui/combobox/package.json`, `pnpm-lock.yaml` - test-scoped `@floating-ui/dom` devDependency (spy resolution fix)
- `packages/ui/combobox/tests/floating-popover.behavior.test.ts` - 6 new behavioral tests (R2 non-pixel criteria)
- `examples/demos/ComboboxFloatingDemo.rozie` - deterministic flipped-popup VR fixture
- `tests/visual-regression/host/main.ts` - `ComboboxFloating` registered at all 3 points
- `tests/visual-regression/specs/combobox.spec.ts` - new `combobox-floating` pixel cell
- `tests/visual-regression/specs/combobox-virtual.spec.ts` - `flip-virtual` interaction fixed (mousedown, not click)
- `tests/visual-regression/__screenshots__/ComboboxFloating.png` - new Linux-Docker baseline (360×680)

## Decisions Made

- Removed the `<Popover>` element's own `r-if="$data.isOpen || $props.virtual"` gate entirely (always mounted) once the input moved into its `#anchor` slot — the input cannot be conditionally unmounted along with the popup. Popover's OWN internal floating-panel `r-if` (`open || keepMounted`) is what continues to own the list's mount/unmount, unchanged from the plan's original intent.
- Wrapped the four render branches in an explicit `<template #default>` fill rather than passing them as loose `r-if` children — required to avoid a genuine `@rozie/core` compiler crash discovered during task 1 (not a design preference).
- Fixed the anchor-sizing and click-outside-containment bugs entirely on the combobox side (input relocation + one CSS rule), explicitly avoiding any `Popover.rozie` or core-emitter change — kept the fix inside this plan's authorized file scope and avoided re-litigating D-08's already-proven byte-identity obligation for popover's other consumers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Multiple bare `r-if` slot children crash `@rozie/core`'s `extractSlotFillers`**
- **Found during:** Task 1, first `compile-combobox-check.mjs` run after combining all four branches under one `<Popover>`
- **Issue:** `TypeError: Cannot read properties of undefined (reading 'type')` inside `extractSlotFillers` — an astChild/loweredChildren index-alignment bug when several loose (unwrapped) `r-if` elements are passed straight as a component's default-slot children.
- **Fix:** Wrapped the four branches in an explicit `<template #default>` fill, sidestepping the loose-children code path entirely.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie`
- **Verification:** `compile-combobox-check.mjs` exits 0.
- **Committed in:** `b0d235fcc`

**2. [Rule 3 - Blocking] `vi.mock('@floating-ui/dom', ...)` never intercepted the emitted leaf's identical import**
- **Found during:** Task 2, first run of the new behavioral test file — 2/6 tests failed (subscription counts read 0)
- **Issue:** Combobox has no direct `@floating-ui/dom` dependency (by design, D-01), so the mock's bare-specifier resolution from the test file's own package resolved nothing, silently never applying.
- **Fix:** Added `@floating-ui/dom` as a test-scoped devDependency to `packages/ui/combobox/package.json`, pinned to the exact version popover already carries.
- **Files modified:** `packages/ui/combobox/package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm --filter @rozie-ui/combobox test` 53/53.
- **Committed in:** `92b54663f`

**3. [Rule 1 - Bug] Floating UI positioned the popup relative to an empty, zero-size anchor**
- **Found during:** Task 3, first real-browser probe of the plain branch (already Popover-wrapped since 86-01) — the popup rendered `width: 0px` positioned to the right of the input instead of below it
- **Issue:** Popover's own internal `.rozie-popover-anchor` div was empty — combobox never filled the `#anchor` slot — so `computePosition`/`matchWidth` measured a zero-size point instead of the control's real box.
- **Fix:** Moved the `<input>` into `<Popover>`'s `#anchor` slot fill; changed `.rozie-combobox-input`'s width from `100%` (circular against the anchor's now-shrink-to-fit sizing) to the explicit `--rozie-combobox-width` token, with an `.rozie-combobox--inline` override restoring `100%` for the embedded path.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie` + emitted leaves
- **Verification:** Playwright probe — panel box `{x, width}` matches input box exactly; `pnpm --filter @rozie-ui/combobox test` 53/53.
- **Committed in:** `b2e3ef8e1`

**4. [Rule 1 - Bug] A real click on the input to open the combobox self-dismissed via the new click-outside listener**
- **Found during:** Task 3, same real-browser probe
- **Issue:** The input, living outside both `anchorEl`/`floatingEl`, was never recognized as "inside" by popover's document-level click-outside dismissal (D-07) — the SAME click that opened the popup (via focus) also bubbled to `document` and was treated as a dismissal.
- **Fix:** Fixed by the same input-relocation as deviation 3 above — `anchorEl.contains(target)` is now true for clicks on the input.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie` + emitted leaves
- **Verification:** Playwright probe — real `click()` on the input opens 4 options on all 6 targets; click-elsewhere correctly closes to 0.
- **Committed in:** `b2e3ef8e1`

**5. [Rule 1 - Bug] Solid-only infinite recreate/blur/close/refocus loop after fixing deviations 3-4**
- **Found during:** Task 3, immediately after applying the input relocation — Solid's `combobox.spec.ts` basic behavioral cell and several `combobox-virtual.spec.ts` cells hung indefinitely
- **Issue:** On Solid, a named slot invocation with reactive scope params (Popover's `#anchor` passes `open`/`toggle`/`show`/`hide`) is a plain closure re-invoked whenever any param changes — moving the input there meant every open SYNCHRONOUSLY recreated the anchor's DOM, firing a native blur on the just-focused input before `onFocus` even returned; an unguarded `onBlur` immediately re-closed the popup, and an initial (unconditional) re-focus fix looped forever.
- **Fix:** Added a non-reactive `openingInProgress` flag, true only for the exact synchronous duration of the `onFocus`-triggered `isOpen` write (cleared synchronously, not via microtask, to avoid a stale-true window spanning an `await` boundary), letting `onBlur` skip closing when the blur is a side effect of our own open transition — plus a deferred microtask re-focus recovering onto whichever node is current afterward.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie` + emitted leaves
- **Verification:** MutationObserver probe — exactly 1 anchor recreation per open (not infinite), `activeElement` lands on the input, `aria-expanded=true`; `pnpm --filter @rozie-ui/combobox test` 53/53; Docker VR 73/73 on both the rebless and bare passes.
- **Committed in:** `b2e3ef8e1`

**6. [Rule 1 - Bug] Pre-existing `combobox-virtual-flip` VR cell broke on all 6 targets (not introduced by this plan's own new work)**
- **Found during:** Task 3, first Docker VR run
- **Issue:** `ComboboxVirtualFlipDemo.rozie`'s "flip virtual" button lives outside the combobox control by design; Playwright's `.click()` synthesizes a real click that the plain branch's now-active click-outside dismissal (D-07, live since 86-01 but never exercised by a VR run of this spec until now) correctly treats as "outside" and closes the popup — the fixture's own `@mousedown.prevent` handler never listens for `click` at all.
- **Fix:** Changed the spec to dispatch a raw `mousedown` instead of `.click()` — the exact event the demo's own handler listens for.
- **Files modified:** `tests/visual-regression/specs/combobox-virtual.spec.ts`
- **Verification:** Docker VR — `combobox-virtual-flip` passes on all 6 targets, both the rebless and bare passes.
- **Committed in:** `b2f05ec44`

---

**Total deviations:** 6 auto-fixed (2 Rule 3 - blocking compiler/test-resolution issues, 4 Rule 1 - real bugs surfaced only by a real browser).
**Impact:** All six were necessary for correctness — deviations 3-5 in particular are the plan's OWN stated purpose (proving R2's positioning claim with something happy-dom cannot show) working exactly as designed: it caught real, previously-shipped gaps in 86-01's plain-branch composition that no earlier test could see. No scope creep — every fix is scoped to `Combobox.rozie` and its emitted leaves, or to test-file interaction methods; no `Popover.rozie` or `@rozie/core` change was made.

## Issues Encountered

None beyond the six deviations above — no unresolved blockers.

## User Setup Required

None - no external service configuration required.

## Verification Log

Full commands run, in the order the plan's `<verification>` section specifies:

1. `node packages/ui/combobox/scripts/compile-combobox-check.mjs` → `✓ Combobox surface OK: 21 props (1 model) / 2 emits / 4 slot / 4 expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`
2. `pnpm turbo run build --force --concurrency=2` (whole workspace) → 243/243 successful.
3. `pnpm turbo run typecheck --force --continue --concurrency=2` (whole workspace) → 324/324 successful.
4. `pnpm --filter @rozie-ui/combobox test -- --reporter=verbose` (via `pnpm exec vitest run --reporter=verbose` to correctly forward the flag) → confirms `tests/floating-popover.behavior.test.ts` collected, all 6 of its tests named and passing; 53/53 total.
5. `tools/ci-repro/vr.sh -u -b ComboboxFloating -g 'Combobox'` → 73/73 passed (first run caught deviations 3-6 above; final run green). Then a bare `tools/ci-repro/vr.sh -g 'Combobox'` (no `-u`) → 73/73 passed again, zero diffs, "no baseline PNGs changed" confirmed byte-identical.
   - **Cells that actually ran** (from real run output, not just exit code): `combobox-floating` ×6 targets (this plan's new cell), `combobox` ×6 (behavioral smoke), `combobox-virtual` ×24 (4 sub-tests ×6 targets), `combobox-virtual-flip` ×6, `combobox-groups` ×6, `combobox-group-cap` ×6, `keynav-behavior` (combobox) ×6, `matrix.spec.ts` `ComboboxScreenshot` ×6, `matrix.spec.ts` `KeynavCombobox` ×6.
   - **Baseline PNGs — every new/changed one individually justified:** `__screenshots__/ComboboxFloating.png` (NEW, 360×680) — the sole new baseline this task adds; visually confirmed Apple/Banana/Cherry/Date render in a rounded panel directly above the "Search fruit…" input, spanning its full width. No other baseline changed across either pass.
6. `bash scripts/ci-prepush.sh` → failed at the same pre-existing, unrelated sidecar-staleness gate 86-01/86-02 already documented (~24 orphaned, gitignored `examples/consumers/*-ts/fixtures/*.d.rozie.ts` files, disconnected from `packages/ui/combobox`/`packages/ui/popover`). Ran the remaining stages manually: `node scripts/check-dep-drift.mjs` → `✓ dependency-drift OK`; `turbo run test --force --continue --concurrency=4` (whole workspace) → 148/149 tasks successful, only `@rozie/docs#test` failed — the SAME 2 pre-existing `comparison-surface.test.ts` failures (combobox + popover comparison-page `surface_hash` staleness) already logged in `.planning/WINDOWS.md` (ids 1, 2) from 86-01, explicitly R6's job (a later plan in this phase). No new WINDOWS.md entry needed — the existing open entries already cover this exact class of finding and remain accurate.

**Turbo adjudication:** all whole-workspace runs used `--concurrency=2`/`4` per project convention; the one real failure (docs surface-hash) is pre-existing and unchanged in nature from 86-01/86-02's findings — not a regression introduced here.

## Next Phase Readiness

- R2 is now fully proven: all four combobox render branches position through the composed popover, the viewport-edge flip is proven on all six targets with a Linux baseline, and the non-pixel criteria (inline no-positioning, no `autoUpdate` leak, empty-list positioning, idempotent Escape) are behaviorally proven.
- The anchor-sizing fix (input inside `#anchor`) and the Solid reentrancy guard are now load-bearing for EVERY future plan that touches combobox's open/focus/blur machinery — plans 86-04 (multi-select) and 86-06 (creatable) both add commit paths through `selectOption()`/`onKeydown` and should read this plan's `onFocus`/`onBlur` comments before touching them.
- D-13 (a future plan's chip-rail-becomes-the-anchor redesign) will need to re-verify the anchor-slot approach this plan establishes still holds once chips are added before the input inside the same `#anchor` fill.
- The R6 comparison-doc flip remains explicitly NOT blocked by anything in this plan — both open `WINDOWS.md` entries (1, 2) still describe the current state accurately (combobox's floating-positioned-popup cell is now MORE true than before — all four branches compose popover — but still not a full ✅ until multi-select/creatable also ship).

## Self-Check: PASSED

- All 3 created files confirmed present on disk with `[ -f ]`: `packages/ui/combobox/tests/floating-popover.behavior.test.ts`, `examples/demos/ComboboxFloatingDemo.rozie`, `tests/visual-regression/__screenshots__/ComboboxFloating.png`.
- All 5 commit hashes (`b0d235fcc`, `92b54663f`, `b2e3ef8e1`, `b2f05ec44`, `90bcf5641`) confirmed present via `git log --oneline --all`.
- All acceptance criteria for tasks 1-3 re-verified with real command output (see Verification Log above).

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
