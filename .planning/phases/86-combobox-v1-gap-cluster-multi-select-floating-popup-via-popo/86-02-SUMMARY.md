---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 02
subsystem: ui
tags: [rozie-compiler, floating-ui, popover, combobox, dist-parity, visual-regression]

requires:
  - phase: 86-01
    provides: Proven command-palette→combobox→popover two-level composition chain; popover's bare/disablePositioning/manual-trigger props
provides:
  - Popover `keepMounted` prop — hide-not-unmount floating panel, one-shot mount position, autoUpdate stays strictly open-gated
  - Popover `matchWidth` prop — exact anchor-width matching via Floating UI's `size` middleware, width-only (never height)
  - `size` middleware factory + `matchWidth` config field in internal/middleware.ts, red-first unit-tested
  - Recorded D-08 byte-identity verdict (types/styles/pixels) — HOLDS — unblocking plan 86-07's additive-patch release decision
affects: [86-03-combobox-grouped-capped-virtual-composition, 86-07-release-wave]

actuals:
  tokens: 21972
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "keepMounted mirrors combobox's own CR-01 hide-not-unmount contract (display:none class toggle, never r-if unmount) so a composed virtualizer's scroll container survives close/open — same pattern, now proven on the popover side of the composition too."
    - "size middleware apply() callback types its args parameter as `unknown` (matching the MiddlewareFactories interface signature) and casts internally, rather than narrowing the factory interface's parameter type — sidesteps a TS parameter-variance mismatch that a narrower declared signature would hit."
    - "Root-package `@rozie-ui/popover#build` (codegen.mjs) is NOT reachable via a `--filter '@rozie-ui/popover-*'` turbo filter (glob requires a `-` suffix, doesn't match the exact un-suffixed package name) and is not wired into the leaf packages' `^build` dependsOn graph when filtered — codegen must be run explicitly (`pnpm --filter @rozie-ui/popover build`) before a filtered leaf build/typecheck will reflect a `.rozie` source change."

key-files:
  created: []
  modified:
    - packages/ui/popover/src/Popover.rozie
    - packages/ui/popover/src/internal/middleware.ts
    - packages/ui/popover/src/internal/middleware.test.ts
    - docs/components/popover.md
    - packages/ui/popover/tests/surface.test.ts
    - packages/ui/popover/scripts/compile-popover-check.mjs
    - packages/ui/popover/__fixtures__/rozie-manifest.expected.json
    - packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/src/Popover.* (codegen-regenerated)
    - packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/src/internal/middleware.ts (codegen-vendored)
    - packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/{README.md,rozie-manifest.json}

key-decisions:
  - "Followed the plan's D-03/D-11 ruling verbatim: keepMounted's one-shot mount position calls position() directly (never startTracking()/autoUpdate), keeping autoUpdate strictly open-gated with zero new subscription call sites."
  - "Followed the plan's D-04/D-12/A1 ruling verbatim: size middleware writes exact width (not minWidth), inserted immediately after offset and before flip/shift, writing elements.floating.style.width ONLY — the apply callback never reads or writes any height-family field, machine-checked by a zero-match grep."
  - "Substituted the plan's `git merge-base HEAD main` verify command with the actual phase-86 base commit — this repo has no branch/worktree workflow (commits land directly on main), so `merge-base HEAD main` always resolves to HEAD itself and diffs against nothing."
  - "Corrected the plan's `-g 'Popover|DataTableHeaderMenu'` VR grep to `-g 'Popover|header . menu'` — the literal pattern from the plan does not match data-table-header-menu.spec.ts's actual test titles (`data-table header ⋯ menu + filter row [target]`), so it silently ran zero DataTableHeaderMenu cells while still exiting 0."

requirements-completed: [R2]

coverage:
  - id: D1
    description: "keepMounted ships as an opt-in hide-not-unmount mode with a one-shot mount position; autoUpdate remains strictly open-gated; all six popover leaves build and typecheck green"
    requirement: "R2"
    verification:
      - kind: unit
        ref: "node packages/ui/popover/scripts/compile-popover-check.mjs"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/popover test (30/30, later 33/33)"
        status: pass
      - kind: other
        ref: "pnpm turbo run build --force --concurrency=2 --filter '@rozie-ui/popover-*' (13/13)"
        status: pass
      - kind: other
        ref: "pnpm turbo run typecheck --force --continue --concurrency=2 --filter '@rozie-ui/popover-*' (13/13)"
        status: pass
    human_judgment: false
  - id: D2
    description: "matchWidth ships as an opt-in exact-width match via Floating UI's size middleware, unit-tested red-first, writing width and nothing else"
    requirement: "R2"
    verification:
      - kind: unit
        ref: "packages/ui/popover/src/internal/middleware.test.ts — 'drops size when matchWidth is false' / 'inserts size after offset, before flip/shift when matchWidth is true' (RED before implementation, GREEN after)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/popover test (33/33)"
        status: pass
      - kind: other
        ref: "grep -c 'availableHeight\\|style.height\\|maxHeight' packages/ui/popover/src/internal/middleware.ts -> 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-08's byte-identity premise is proven with recorded evidence (types, styles, pixels) and an explicit verdict for plan 86-07 to read"
    requirement: "R2"
    verification:
      - kind: other
        ref: "git diff --stat <phase-86-base> -- 'packages/ui/popover/packages/*/src/*.d.ts' (react only, additive-only diff)"
        status: pass
      - kind: other
        ref: "pnpm --filter dist-parity test (1049/1049)"
        status: pass
      - kind: e2e
        ref: "tools/ci-repro/vr.sh -g 'Popover|header . menu' (65/65 passed, zero baseline diffs)"
        status: pass
    human_judgment: false

duration: 37min
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 02: Popover keepMounted + matchWidth + D-08 byte-identity evidence Summary

**Popover gained `keepMounted` (hide-not-unmount + one-shot mount position, autoUpdate strictly open-gated) and `matchWidth` (exact anchor-width match via a red-first-tested `size` middleware, width-only), and D-08's "additive 0.1.x patch" premise is proven to HOLD with recorded type/style/pixel evidence across all 18 phase-86 leaves.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-09-01T15:00:00Z (approx.)
- **Completed:** 2026-09-01T15:37:18Z
- **Tasks:** 3
- **Files modified:** 33 (across the two task commits; task 3 produced no code changes, only recorded evidence)

## Accomplishments

- `@rozie-ui/popover` gained `keepMounted` (Boolean, default `false`): the floating `<div>`'s `r-if` guard becomes `($props.open || $props.keepMounted) && !$props.disabled`, and a new `.rozie-popover-floating--hidden { display: none; }` class (applied via `:class="{ ..., 'rozie-popover-floating--hidden': !$props.open }"`) hides — never unmounts — the panel while closed, mirroring combobox's own CR-01 hide-not-unmount contract. A one-shot `position()` call runs in `$onMount` when `keepMounted` is set and `open` is false, so the hidden panel already carries real coordinates before the first open; `autoUpdate` stays reachable ONLY from `startTracking()` (zero new call sites — confirmed by grep).
- `@rozie-ui/popover` gained `matchWidth` (Boolean, default `false`): `internal/middleware.ts`'s `buildMiddleware()` inserts a `size` middleware immediately after `offset`, before `flip`/`shift`, whose `apply` callback writes `elements.floating.style.width` from `rects.reference.width` and touches nothing else — no `availableHeight`, no `style.height`, no `maxHeight` (D-12, machine-checked by a zero-match grep). `Popover.rozie` imports `size` bare (no scope collision) and wires `matchWidth: !!$props.matchWidth` into the `position()` call site.
- Both new props are additive-only across all six emitted leaves: the only committed declaration surface (`packages/react/src/Popover.d.ts`, per D-84's hybrid macro-inline/React-sibling strategy) gained exactly two new optional fields; the other five leaves' inline `defineProps`/`@Input`/`input()` prop declarations gained the identical two entries with zero existing entry renamed, retyped, or removed.
- D-08's byte-identity premise — "existing click/hover/focus, non-keepMounted, non-bare, non-matchWidth consumers see no change" — is proven to **HOLD** with three independent checks (full detail below): the `.d.ts` diff is additive-only, the existing `.rozie-popover-floating` CSS declaration list has no deletion/reordering, and a targeted VR run of 65 cells (Popover's own pixel baseline + data-table's popover-composing header-menu behavioral suite) passed with zero baseline diffs.

## Task Commits

Each task was committed atomically:

1. **Task 1: Popover `keepMounted` — hide the floating panel instead of unmounting it** - `48a8d0184` (feat)
2. **Task 2: Anchor-width matching — the `size` middleware factory and the `matchWidth` prop** - `6d141c957` (feat)
3. **Task 3: Discharge D-08's byte-identity obligation with recorded evidence** - no code commit (evidence-only; recorded below and in this SUMMARY, committed as part of the plan-metadata commit)

_No separate plan-metadata commit for STATE/ROADMAP — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below._

## Files Created/Modified

- `packages/ui/popover/src/Popover.rozie` - `keepMounted`/`matchWidth` props, `$onMount` one-shot position branch, floating `<div>` `r-if`/`:class` change, `--hidden` CSS rule, `size` import + `buildMiddleware()` wiring
- `packages/ui/popover/src/internal/middleware.ts` - `size` factory on `MiddlewareFactories`, `matchWidth` on `MiddlewareConfig`, width-only `apply()` callback, extended ordering docblock (offset → size → flip → shift → arrow)
- `packages/ui/popover/src/internal/middleware.test.ts` - `size` stand-in factory, `matchWidth: false` default config, 3 new `it()` blocks (drops-when-false / inserts-at-index-1 / survives disableFlip+disableShift)
- `packages/ui/popover/tests/surface.test.ts`, `packages/ui/popover/scripts/compile-popover-check.mjs` - `EXPECT.props` synced to 14 props (deviation, see below)
- `packages/ui/popover/__fixtures__/rozie-manifest.expected.json` - regenerated via `buildManifest(lowerToIR(...))`, never hand-edited
- `docs/components/popover.md` - two new `### Props` rows
- `packages/ui/popover/packages/{react,vue,svelte,solid,angular,lit}/*` - codegen-regenerated per-target sources, manifests, READMEs, and vendored `internal/middleware.ts` copies

## Decisions Made

- Task 1's `keepMounted` runtime-behavior assertion (the "open→close→open accumulates no additional `autoUpdate` listeners" criterion, T-86-09) is deliberately deferred to plan 86-03's `floating-popover.behavior.test.ts` per the plan's own threat register — this plan proves the mechanism statically (grep-verified single `autoUpdate` call site) and via the existing surface/manifest fixture tests (RED before the prop existed, GREEN after), not via a new dedicated behavior test file, since none is named in this plan's `<files>`.
- Used `elements.floating.style.width` cast via `args as {...}` inside `apply()` rather than narrowing `MiddlewareFactories.size`'s declared parameter type, to avoid a TS function-parameter-variance mismatch between a narrow `apply` signature and the interface's declared `(args: unknown) => void`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `compile-popover-check.mjs`'s hardcoded `EXPECT.props` array needed syncing twice**
- **Found during:** Task 1, first `compile-popover-check.mjs` run after adding `keepMounted`
- **Issue:** This standalone script (not part of the plan's `<files>` list for either task) hardcodes its own `EXPECT.props` array independent of `tests/surface.test.ts` — the same drift class 86-01 already hit and fixed for the prior prop wave. The task's own `<verify>` command runs this script, so leaving it stale would fail the task's own gate.
- **Fix:** Added `keepMounted` (task 1) and `matchWidth` (task 2) to `EXPECT.props` in the same commit as each prop's source addition.
- **Files modified:** `packages/ui/popover/scripts/compile-popover-check.mjs`
- **Verification:** `node packages/ui/popover/scripts/compile-popover-check.mjs` exits 0 after each change (`13 props` then `14 props`).
- **Committed in:** `48a8d0184` (task 1), `6d141c957` (task 2)

**2. [Rule 3 - Blocking] The task `<verify>` filter (`--filter '@rozie-ui/popover-*'`) never reaches the codegen root package**
- **Found during:** Task 1, first `grep -c 'keepMounted' packages/ui/popover/packages/react/src/Popover.d.ts` acceptance check — returned 0 even after a green `turbo run build --force --filter '@rozie-ui/popover-*'`
- **Issue:** `@rozie-ui/popover`'s own `build` script (`node scripts/codegen.mjs`) regenerates the six leaves' emitted source from `Popover.rozie`. The turbo glob `@rozie-ui/popover-*` requires a `-` suffix and does NOT match the exact package name `@rozie-ui/popover`, and that root package is not a declared dependency the filtered leaves' `^build` graph pulls in (confirmed via `turbo run build --dry=json`, which listed only the six `-<target>` build/sync tasks plus their `@rozie/runtime-*` deps — no `@rozie-ui/popover#build`). Following the plan's literal `<verify>` command therefore builds STALE per-target sources and the `keepMounted`/`matchWidth` acceptance greps would fail even though the `.rozie` source was correct.
- **Fix:** Ran `pnpm --filter @rozie-ui/popover build` (codegen) explicitly before each task's filtered `turbo run build`/`typecheck` invocation.
- **Files modified:** none (build-order fix, not a source change) — this regenerated the same 6-leaf codegen output already counted as "modified" per task.
- **Verification:** After codegen, `grep -c 'keepMounted'`/`grep -c 'matchWidth'` on `packages/react/src/Popover.d.ts` both return 1; leaf build/typecheck stayed 13/13 green.
- **Committed in:** `48a8d0184` (task 1), `6d141c957` (task 2)

**3. [Rule 1 - Bug] Task 3's `git diff --stat "$(git merge-base HEAD main)"` verify command is a no-op in this repo**
- **Found during:** Task 3, first attempt at the `.d.ts` diff-stat check
- **Issue:** This project has `git.branching_strategy: "none"` and `use_worktrees: false` — every plan's commits land directly on `main`. `git merge-base HEAD main` therefore always resolves to `HEAD` itself (confirmed: both commands printed the identical SHA), so the diff is always against nothing and the check trivially "passes" without proving anything about the phase's actual accumulated change.
- **Fix:** Substituted the real phase-86 base commit — the parent of `a33de1743` (86-01's first task commit), `45634d81c` — and diffed against that instead.
- **Files modified:** none (verification-only)
- **Verification:** `git diff --stat 45634d81c -- 'packages/ui/popover/packages/*/src/*.d.ts'` shows exactly the expected additive `react/src/Popover.d.ts` change (17 insertions, 1 deletion — a JSDoc-comment-only touch on `trigger` from 86-01's D-02, no type/name/optionality change).
- **Committed in:** n/a (verification-only, recorded here)

**4. [Rule 1 - Bug] Task 3's literal VR grep (`-g 'Popover|DataTableHeaderMenu'`) silently ran zero data-table cells**
- **Found during:** Task 3, first VR run — exited 0 with "12 passed", all Popover cells, none from `data-table-header-menu.spec.ts`
- **Issue:** The plan's own `<read_first>` names `tests/visual-regression/specs/data-table-header-menu.spec.ts`, but that file's actual `test.describe` title is `` `data-table header ⋯ menu + filter row [${target}]` `` — it never contains the literal substring `DataTableHeaderMenu`. The plan's own action text warns "a `-g` grep does not reach `matrix.spec` cells" and instructs confirming which cells actually ran rather than trusting the exit code — that warning's underlying failure mode (a grep silently matching nothing while the run still exits 0) applies here too, on a non-matrix spec.
- **Fix:** Corrected the grep to `-g 'Popover|header . menu'` (the `.` matches the em-dash-like `⋯` character in the shell-quoted regex) and re-ran.
- **Files modified:** none (verification-only)
- **Verification:** Second run: 65 passed (12 Popover cells + 53 `data-table-header-menu.spec.ts` cells across all 6 targets), zero baseline diffs, exit 0.
- **Committed in:** n/a (verification-only, recorded here)

---

**Total deviations:** 4 auto-fixed (2 Rule 3 - blocking, 2 Rule 1 - bug in the plan's own verify commands).
**Impact:** All four were necessary to make the task's own stated acceptance criteria actually provable — none changed scope or behavior. #2 and #3/#4 are worth flagging upstream (a `--filter` pattern that silently skips the codegen root, and two verify commands that trivially "pass" without proving what they claim) since they'd recur on the next plan touching a `@rozie-ui/*` published-leaf source or running this repo's targeted VR pattern.

## D-08 Byte-Identity Verdict (for plan 86-07)

**D-08's byte-identity premise HOLDS.** Recorded evidence, three ways:

### 1. Type surface (all six popover leaves)

Only one committed `.d.ts` file exists across the six leaves — `packages/react/src/Popover.d.ts` (D-84's hybrid strategy: React gets a sibling `.d.ts`; Vue/Svelte/Solid/Angular/Lit macro-inline their prop types directly in the emitted component source). Diffed against the phase-86 base commit (`45634d81c`, the parent of 86-01's first task commit):

```
packages/ui/popover/packages/react/src/Popover.d.ts | 18 +++++++++++++++++-
1 file changed, 17 insertions(+), 1 deletion(-)
```

```diff
   trigger?: string;
-   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur. Drives both the gesture handlers and the ARIA role (`'hover'`/`'focus'` → tooltip, `'click'` → popover dialog).
+   * How the anchor opens the content: `'click'` toggles on click, `'hover'` opens on pointer-enter and closes on pointer-leave (tooltip-style), `'focus'` opens on focus and closes on blur, or `'manual'` for a composing component that drives `open` itself — ... `'manual'` → no anchor ARIA claim).
    */
   strategy?: string;
+  bare?: boolean;
+  disablePositioning?: boolean;
+  keepMounted?: boolean;
+  matchWidth?: boolean;
```

The single non-additive-looking hunk is a **JSDoc comment update** on the pre-existing `trigger?: string` field (86-01's D-02, documenting `'manual'`) — the field's name, type, and optionality are byte-identical; only its doc comment changed. Every other change is a new optional field (`bare`, `disablePositioning`, `keepMounted`, `matchWidth`). No existing property was renamed, retyped, made required, or removed.

Spot-checked the other five leaves' inline prop declarations (Vue `defineProps<{...}>()`, Angular `input<boolean>(false)`) against the same base commit: each gained the identical set of new optional entries with the same shape (e.g. Vue: `bare?: boolean; disablePositioning?: boolean; keepMounted?: boolean; matchWidth?: boolean;` appended to the object-type literal; Angular: `bare = input<boolean>(false); disablePositioning = input<boolean>(false); keepMounted = input<boolean>(false); matchWidth = input<boolean>(false);`). All six leaves are IR-driven from the same `buildManifest(lowerToIR(...))` source of truth (confirmed via the manifest-fixture round-trip test), so additivity at the IR level (props array strictly grew, no existing entry's `isModel`/`required`/`type` changed) guarantees additivity at every per-target renderer.

`pnpm --filter dist-parity test`: **1049/1049 passed**, zero drift.

### 2. Rendered chrome (existing style declarations)

`git diff 45634d81c -- packages/ui/popover/src/Popover.rozie`, isolated to the `<style>` block: the pre-existing `.rozie-popover-floating` rule (`position`, `left`, `top`, `z-index`, `width`, `max-width`, `background`, `color`, `border`, `border-radius`, `box-shadow`, `padding`) has **zero deletions and zero reordering**. Three new rules were appended after it — `.rozie-popover-floating--static` (86-01, D-06/D-09), `.rozie-popover-floating--bare` (86-01, D-05), and `.rozie-popover-floating--hidden` (this plan, D-03) — each an additive override class, exactly the pattern the CONTEXT.md decisions describe: "the bare and static behaviors are expressed as additional override rules." The one non-style-block change in the floating `<div>` itself is the `r-if` guard widening to `($props.open || $props.keepMounted) && !$props.disabled` and the `:class` binding growing a third conditional key — both are template-level, both are inert (evaluate to their pre-existing behavior) when `keepMounted` is unset, which is the default.

### 3. Pixels (targeted VR — corrected grep, see Deviation #4)

`tools/ci-repro/vr.sh -g 'Popover|header . menu'` (no `-u`), run twice (first with the plan's literal grep, which silently ran only 12 Popover cells; second with the corrected grep after discovering the gap):

- **6 `PopoverScreenshot` cells** (`overlay-screenshot.spec.ts`, one genuine pixel-baseline `toHaveScreenshot` per target) — passed, zero diff.
- **6 `popover [target]: anchor-click opens, Escape + outside-click dismiss, set-open writes` cells** (`popover.spec.ts`, behavioral) — passed.
- **53 `data-table header ⋯ menu + filter row [target]` cells** (`data-table-header-menu.spec.ts`, all 6 targets × 8-9 assertions each: mount, ⋯ menu open+position, pin/unpin, hide+colvis re-show, filter row alignment, menu-stays-open-across-pin, filter-row-absence, Escape dismiss+focus-return, click-outside dismiss, `strategy=fixed` overflow escape) — passed.

**Total: 65/65 passed, zero baseline diffs, exit 0.**

`data-table-header-menu.spec.ts`'s own header comment states it is "NOT a snapshot-only [spec] — no pixel baselines land here"; confirmed no separate pixel-baseline spec exists for data-table's popover-composing header menu (`data-table-grid-battery.spec.ts` explicitly asserts, in its own test body, that every data-table feature-set file must NOT contain `toHaveScreenshot`). The 53-cell behavioral suite is therefore the available and complete proof for that consumer — its exact-position, pin/hide/filter, and dismissal assertions would have failed had `keepMounted`'s widened `r-if` guard or `matchWidth`'s new middleware slot changed anything on data-table's default (unset) path.

Per the plan's own warning that `-g` grep does not reach `matrix.spec.ts` cells: confirmed `matrix.spec.ts` carries no `DataTable*` screenshot cell at all (it does carry `ComboboxScreenshot`, out of this plan's scope — combobox's standalone floating-positioning composition is 86-03+ work, not yet wired to `keepMounted`/`matchWidth`).

## Issues Encountered

None beyond the four deviations above — all four were plan-verification-command corrections, not implementation blockers.

## User Setup Required

None - no external service configuration required.

## Verification Log

Full commands run, task-by-task plus the plan-level `<verification>` section:

**Task 1:**
1. `node packages/ui/popover/scripts/compile-popover-check.mjs` → `✓ Popover surface OK: 13 props (1 model) / 1 emit / 2 slots / 4 expose; compile()×6 zero-error.`
2. `pnpm --filter @rozie-ui/popover test` → 3 files / 30 tests passed.
3. `pnpm --filter @rozie-ui/popover build` (codegen, deviation #2) → 6 targets emitted, docs props-table validation PASS (13 rows match `ir.props`).
4. `pnpm turbo run build --force --concurrency=2 --filter '@rozie-ui/popover-*'` → 13/13 successful.
5. `pnpm turbo run typecheck --force --continue --concurrency=2 --filter '@rozie-ui/popover-*'` → 13/13 successful.
6. `grep -c 'keepMounted' packages/ui/popover/packages/react/src/Popover.d.ts` → 1.
7. `grep -vE '^\s*(//|/\*|\*|<!--)' Popover.rozie | grep -c 'rozie-popover-floating--hidden'` → 2.
8. `grep -n 'autoUpdate' Popover.rozie` → single subscription call site inside `startTracking`, no new site.

**Task 2 (RED then GREEN, recorded verbatim):**
1. RED: `pnpm --filter @rozie-ui/popover exec vitest run src/internal/middleware.test.ts` → `2 failed | 9 passed (11)` — `inserts size after offset...` expected `['offset','size','flip','shift']` got `['offset','flip','shift']`; `keeps size at index 1...` expected `['offset','size']` got `['offset']`.
2. Implemented `size` factory + `matchWidth` config field in `middleware.ts`.
3. GREEN: same command → `11 passed (11)`.
4. `grep -c 'availableHeight\|style.height\|maxHeight' middleware.ts` → 0.
5. `node packages/ui/popover/scripts/compile-popover-check.mjs` → `✓ Popover surface OK: 14 props...`.
6. `pnpm --filter @rozie-ui/popover build` (codegen) → 14 rows match `ir.props`.
7. `pnpm turbo run build --force --concurrency=2 --filter '@rozie-ui/popover-*'` → 13/13.
8. `pnpm turbo run typecheck --force --continue --concurrency=2 --filter '@rozie-ui/popover-*'` → 13/13.
9. `pnpm --filter @rozie-ui/popover test` → 3 files / 33 tests passed.
10. `grep -c 'matchWidth' packages/react/src/Popover.d.ts` → 1.

**Task 3:**
1. `git diff --stat 45634d81c -- 'packages/ui/popover/packages/*/src/*.d.ts'` (corrected base, deviation #3) → 1 file, +17/-1, additive-only.
2. `pnpm --filter dist-parity test` → 2 files / 1049 tests passed.
3. `tools/ci-repro/vr.sh -g 'Popover|header . menu'` (corrected grep, deviation #4) → 65/65 passed, zero baseline diffs, "Host checkout untouched."

**Plan-level `<verification>` (whole workspace, since popover source changed and combobox composes it):**
4. `pnpm turbo run build --force --concurrency=2` (whole workspace) → 243/243 successful.
5. `pnpm turbo run typecheck --force --continue --concurrency=2` (whole workspace) → 324/324 successful.
6. `bash scripts/ci-prepush.sh` → failed at the same pre-existing, unrelated sidecar-staleness gate 86-01 already documented (~24 orphaned, gitignored `examples/consumers/*-ts/fixtures/*.d.rozie.ts` files, disconnected from `packages/ui/{popover,combobox}`). Ran the remaining stages manually: `node scripts/check-dep-drift.mjs` → `✓ dependency-drift OK`; `turbo run test --force --continue --concurrency=4` → 148/149 tasks successful, only `@rozie/docs#test` failed — the same 2 pre-existing `comparison-surface.test.ts` failures (combobox + popover comparison-page `surface_hash` staleness) already logged in `.planning/WINDOWS.md` from 86-01, explicitly R6's job (a later requirement/plan in this phase), unchanged in scope or count by this plan's additions.

**Turbo adjudication:** all whole-workspace runs used `--concurrency=2`/`4` per project convention; the one real failure (docs surface-hash) is pre-existing and unchanged from 86-01's finding — not a regression introduced here.

## Next Phase Readiness

- Popover now ships all five phase-86 additive capabilities (`bare`, `disablePositioning`, `'manual'` trigger from 86-01; `keepMounted`, `matchWidth` from this plan) with a proven-additive type surface, unchanged existing style declarations, and zero pixel/behavioral regression on its two known default-path consumers (its own demos, data-table's header menu).
- D-08's "additive `0.1.x` patch, not `0.2.0` minor" decision is now backed by recorded evidence rather than an assumption — plan 86-07's release-wave checkpoint can proceed on the `0.1.x` patch path for popover without re-litigating this risk.
- `keepMounted`'s runtime `autoUpdate`-no-leak behavior (T-86-09) is asserted only statically here (single call site) — plan 86-03's `floating-popover.behavior.test.ts` is where the dynamic open→close→open assertion belongs, per this plan's own threat register.
- Combobox has not yet wired `keepMounted`/`matchWidth` into its own composition of Popover — that is 86-03's job (the grouped/capped/virtual branches, where `:keep-mounted="$props.virtual"` and `matchWidth` become load-bearing per D-10).

## Self-Check: PASSED

- All key files confirmed present on disk: `packages/ui/popover/src/Popover.rozie`, `packages/ui/popover/src/internal/middleware.ts`, `packages/ui/popover/src/internal/middleware.test.ts`, `docs/components/popover.md`, `packages/ui/popover/tests/surface.test.ts`, `packages/ui/popover/__fixtures__/rozie-manifest.expected.json` — all `[ -f ]` confirmed.
- Both commit hashes (`48a8d0184`, `6d141c957`) confirmed present via `git log --oneline --all`.
- All acceptance criteria for tasks 1-3 re-verified with real command output (see Verification Log above); the D-08 verdict is HOLDS per the three independent checks recorded above.

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
