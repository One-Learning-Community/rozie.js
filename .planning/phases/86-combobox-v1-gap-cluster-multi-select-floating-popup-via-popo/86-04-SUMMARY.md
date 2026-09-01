---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 04
subsystem: ui
tags: [rozie-compiler, combobox, multi-select, aria, angular-cva, vue-defineModel]

requires:
  - phase: 86-03
    provides: All four combobox render branches (plain/grouped/grouped+capped/windowed) positioned through a single composed @rozie-ui/popover leaf; the input living inside popover's `#anchor` slot
provides:
  - "`multiple: Boolean` prop widening the sole `value` model to an array — `value` remains the ONLY `model: true` prop (no ROZ125; Angular ControlValueAccessor preserved)"
  - "Ported toggle/dedup/fresh-array select() algorithm (from listCore.rzts's Listbox precedent) inline into selectOption(), never mutating the model array in place"
  - "`selectedValues()` / `isRowSelected(row)` / `effectiveCloseOnSelect()` helpers, collision-safe against Angular CVA method names and prop names"
  - "`change` gains a `selected` boolean (D-15); `clear()` writes `[]` under `multiple`, `null` otherwise"
  - "`aria-multiselectable` (nullish-dropped when unset, never `\"false\"`) and per-option `aria-selected` across all four render branches"
  - "multiple.behavior.test.ts — 36 mount-and-drive tests (8 R1 edges × 4 render branches), red-first for toggle-off and freshness"
affects: [86-05-combobox-chips, 86-06-combobox-creatable, 86-comparison-doc-flip, 86-07-prohibition-gate]

actuals:
  tokens: 48608
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "A prop needing a per-mode flipped default (single-select true / multiple false) cannot read \"was this explicitly passed\" from `$props.X` post-merge — every target resolves an unset prop via `?? default` before script code runs. The fix is changing the PROP'S OWN default from a literal to the sentinel `null` (mirrors the already-shipped `ariaLabel: { default: null }` -> `(T) | null` shape) so a resolver helper can distinguish `null` (unset) from an explicit `true`/`false`."
    - "A template attribute binding wrapped through `rozieAttr()` widens a boolean CallExpression's return to `string` (TS2322 against React/Solid's `Booleanish` DOM types) — `annotateDisplayWrap`'s `provablyPrimitive()` predicate only recognizes a UnaryExpression `!` (any count) as provably boolean, not a bare function call. Wrap a boolean-returning helper call with `!!(...)` at the template call site to keep the RAW (non-`rozieAttr`-wrapped) emission path."
    - "TanStack's virtualizer has no real layout to measure under happy-dom (`getBoundingClientRect` reports 0) — a combobox mounted with `virtual: true` FROM THE START never settles a non-empty `windowedRows()` slice, no matter how long a test waits. Mount non-virtual, open, THEN flip `virtual` true and await only `nextTick()` (no real macrotask) — this lands in `windowedView()`'s documented fallback (`$props.virtual && !virtualizer && didMount` -> the un-windowed full render), which stays engaged for the whole test because nothing ever yields to the rAF-deferred `buildVirtualizer()`."
    - "Vue 3.4+'s `defineModel('value', { default: null })` auto-emits an `update:value` sync of the declared default the instant a genuinely `undefined` prop resolves to it — a parent ref seeded with `undefined` observes `null` after mount with zero component-script involvement. Framework-level, not a Rozie emission detail; a behavioral test asserting on an `undefined` initial value must expect the framework's own default-sync, not the raw `undefined`."

key-files:
  created:
    - packages/ui/combobox/tests/multiple.behavior.test.ts
  modified:
    - packages/ui/combobox/src/Combobox.rozie
    - docs/components/combobox.md
    - packages/ui/combobox/scripts/event-manifest.mjs
    - packages/ui/combobox/scripts/compile-combobox-check.mjs
    - packages/ui/combobox/tests/surface.test.ts
    - packages/ui/combobox/__fixtures__/rozie-manifest.expected.json
    - packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/src/Combobox.* (codegen-regenerated)
    - packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/README.md (codegen-regenerated, task 1 only — task 2 changed no public surface, only markup)
    - packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/rozie-manifest.json (codegen-regenerated, task 1 only)
    - packages/ui/combobox/packages/react/src/Combobox.d.ts

key-decisions:
  - "`closeOnSelect`'s own `<props>` default changed from a literal `true` to the sentinel `null` — the only way `effectiveCloseOnSelect()` can distinguish \"the consumer never set this\" from \"the consumer explicitly passed `true`\" given every target resolves an unset prop via `?? default` BEFORE script code runs. Single-select behavior is unchanged (`effectiveCloseOnSelect()` resolves the `null` sentinel to `true` there); this is a type-level breaking change (`closeOnSelect?: (boolean) | null` in the `.d.ts`, was `closeOnSelect?: boolean`), authorized under this phase's already-locked breaking minor."
  - "Task 1 and task 2 are committed as two separate, cleanly-isolated commits despite being implemented in the same working session — task 2's template-only diff (the `isRowSelected` replacements + `aria-multiselectable` additions) was temporarily reverted, task 1 alone verified + committed, then task 2's diff reapplied, verified, and committed. This preserves the plan's per-task atomicity and gives an honest, re-verifiable boundary between \"the model widens\" and \"the four branches mark selections\", rather than one combined commit."
  - "The chip rail, `#chip` slot, and Backspace-remove-last gesture are explicitly OUT of this plan's scope (plan 86-05) — this plan proves selection state and ARIA only, per the plan's own \"Artifacts this plan produces\" boundary."

requirements-completed: [R1]

coverage:
  - id: D1
    description: "`multiple: Boolean` prop widens the sole `value` model to an array via a ported toggle/dedup/fresh-array algorithm; `value` remains the ONLY `model: true` prop (no ROZ125), the Angular leaf still emits a ControlValueAccessor, and `change` carries `{ value, option, selected }` in both modes"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "node packages/ui/combobox/scripts/compile-combobox-check.mjs (22 props / 1 model / compile()×6 zero-error)"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/combobox test (89/89, incl. all 53 pre-existing suites unchanged)"
        status: pass
      - kind: other
        ref: "grep -c ControlValueAccessor packages/ui/combobox/packages/angular/src/Combobox.ts -> 3; grep -c 'multiple' packages/ui/combobox/packages/react/src/Combobox.d.ts -> optional boolean; value prop type unchanged (value?: (unknown) | null)"
        status: pass
      - kind: other
        ref: "pnpm turbo run build --force --concurrency=2 (243/243) + typecheck --force --continue (324/324, incl. combobox-react/-solid, the two leaves a TS2322 initially failed on)"
        status: pass
    human_judgment: false
  - id: D2
    description: "All four render branches (plain/grouped/grouped+capped/windowed) mark selections through the shared `isRowSelected` helper; `aria-multiselectable` is a bound conditional (present only when `multiple` is set, ABSENT — never `\"false\"` — otherwise) on all four `role=\"listbox\"` elements"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "node branch-parity check: 4 listbox elements, aria-multiselectable on 4/4, 0 remaining raw single-select comparisons"
        status: pass
      - kind: unit
        ref: "grep -c aria-multiselectable packages/ui/combobox/packages/react/src/Combobox.tsx -> 4"
        status: pass
      - kind: unit
        ref: "pnpm --filter @rozie-ui/combobox test (89/89)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Behavioral proof of every locked R1 edge (toggle-off, ordering, dedup, empty/null/undefined, freshness-by-identity, options-swap concurrency, ARIA present/absent, flipped effectiveCloseOnSelect default) in EACH of the four render branches, red-first for toggle-off and freshness"
    requirement: "R1"
    verification:
      - kind: unit
        ref: "packages/ui/combobox/tests/multiple.behavior.test.ts (36 tests: 8 behaviors × 4 branches + 1 extra ARIA-negative test × 4 = 36; all against the committed emitted Vue leaf)"
        status: pass
      - kind: other
        ref: "RED-run captured against a deliberately-reverted naive selectOption() (no toggle check, in-place .push) — 12/36 failed (toggle-off + dedup + freshness × 4 branches), restored + re-verified GREEN"
        status: pass
    human_judgment: false

duration: 1h 5min
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 04: Multi-select via the widened sole `value` model Summary

**`multiple: Boolean` widens combobox's sole `value` model to an array using the same toggle/dedup/fresh-array algorithm `@rozie-ui/listbox` already ships — no second `model: true` prop, ARIA-marked selections in all four render branches, and 36 behavioral tests proving every locked R1 edge in each branch (not just the plain one).**

## Performance

- **Duration:** 1h 5min (approx.)
- **Started:** 2026-09-01T18:15:00Z (approx.)
- **Completed:** 2026-09-01T18:32:06Z
- **Tasks:** 3
- **Files modified:** 26 (across all three task commits)

## Accomplishments

- **Task 1 (source):** Added the `multiple: Boolean` prop (default `false`) — `value` widens to hold an array of selected values while remaining the sole `model: true` prop (no ROZ125; Angular still emits `ControlValueAccessor`). Ported `listCore.rzts`'s `select()`/`clear()`/`isSelected()` toggle/dedup/fresh-array algorithm inline into `selectOption()` (never imported — combobox's open/active/query state machine is deliberately host-local, and `listCore.rzts` is also consumed by the release-ignored `listbox` family). Three new collision-safe helpers: `selectedValues()` (de-duplicated array read, tolerant of a null/undefined model), `isRowSelected(row)` (array membership under `multiple`, strict equality otherwise), and `effectiveCloseOnSelect()` (resolves a sentinel: `closeOnSelect`'s own prop default changed from a literal `true` to `null` so the helper can tell "unset" from "explicit `true`" post-merge — see Decisions). `change` gains a `selected` boolean (D-15, always `true` in single-select); `clear()` writes `[]` under `multiple`, `null` otherwise. `syncQueryToValue()` no-ops under `multiple`; the query clears (not the label) on pick. A `.rozie-combobox--multiple` state-hook class on the control (chip styling lands in plan 86-05).
- **Task 2 (source, ARIA):** Replaced every raw `opt.value === $props.value` / `wr.row.value === $props.value` template comparison with the shared `isRowSelected` call — in all four render branches, in both the option's selected-state class binding and the `#option` slot's `selected` scope param. Added `aria-selected` (wrapped `!!(...)`, see Deviations) to every option element and `aria-multiselectable` (a nullish-dropped bound conditional, never a literal) to all four `role="listbox"` elements.
- **Task 3 (tests):** `multiple.behavior.test.ts` — 36 mount-and-drive tests against the committed emitted Vue leaf: toggle-off, pick-order, dedup (two options sharing a value toggle ONE shared entry), empty/null/undefined (zero selections + placeholder), freshness (array IDENTITY, not just deep-equality — plus proof the prior array is untouched), an options-swap concurrency edge, ARIA present/absent, and the flipped `effectiveCloseOnSelect` default (stays open by default under `multiple`, an explicit `true` still closes) — each exercised in EACH of plain/grouped/grouped+capped/windowed, not only the plain branch. RED-first captured for toggle-off, dedup, and freshness (see Verification Log). Full suite: 89/89 (53 pre-existing + 36 new).
- **Real deviation (typecheck-caught, task 2):** binding `aria-selected` to a bare `isRowSelected(opt)` CallExpression tripped a genuine `tsc` error on combobox-react and combobox-solid — fixed by wrapping the four `aria-selected` bindings in `!!(...)` (see Deviations).

## Task Commits

Each task was committed atomically. Task 1 and task 2 were implemented in the same working session but their commits were reconstructed to be cleanly isolated per the plan's task boundary (task 2's template-only diff was temporarily reverted, task 1 verified and committed alone, then task 2's diff reapplied, re-verified, and committed):

1. **Task 1: Widen the sole `value` model — the `multiple` prop and the ported toggle algorithm** - `f4112482d` (feat)
2. **Task 2: Selection marking and multiselect ARIA across all four render branches** - `41cae1f11` (feat)
3. **Task 3: Behavioral proof of every locked R1 edge that does not need chip markup** - `1c967ca27` (test)

_No separate plan-metadata commit — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below._

## Files Created/Modified

- `packages/ui/combobox/src/Combobox.rozie` - `multiple` prop, `closeOnSelect` sentinel default, `selectedValues()`/`isRowSelected()`/`effectiveCloseOnSelect()`, ported toggle algorithm in `selectOption()`/`clear()`, `syncQueryToValue()` no-op guard, `.rozie-combobox--multiple` class, `aria-selected`/`aria-multiselectable` across all four branches
- `packages/ui/combobox/tests/multiple.behavior.test.ts` - 36 new behavioral tests (8 R1 edges × 4 render branches)
- `packages/ui/combobox/scripts/event-manifest.mjs` - `change` prose updated for `{ value, option, selected }`
- `packages/ui/combobox/scripts/compile-combobox-check.mjs`, `packages/ui/combobox/tests/surface.test.ts` - `EXPECT.props` +`multiple` (22 props)
- `packages/ui/combobox/__fixtures__/rozie-manifest.expected.json` - regenerated manifest fixture (+`multiple` prop entry only)
- `docs/components/combobox.md` - `multiple`/`closeOnSelect` prop rows updated, `change` event description updated
- `packages/ui/combobox/packages/{react,vue,svelte,angular,solid,lit}/*` - codegen-regenerated emitted leaves (+READMEs/manifests, task 1 only; task 2 changed no public surface, only compiled markup)

## Decisions Made

- **`closeOnSelect`'s prop default: `true` -> `null` (sentinel).** Every target merges an unset prop via `?? default` at the emission boundary BEFORE any script code runs — a literal `true` default is indistinguishable from an explicit `true` once `effectiveCloseOnSelect()` sees it. Mirrors the already-shipped `ariaLabel: { default: null }` -> `(T) | null` shape. Single-select behavior is unchanged (the helper resolves the sentinel to `true` there); this is a documented type-level breaking change authorized under the phase's already-locked breaking minor.
- **Task 1 / task 2 commit reconstruction.** Rather than one combined commit for two tightly-coupled but separately-scoped tasks, task 2's template diff was temporarily reverted so task 1 could be independently verified (compile check, ROZ125, CVA, `push`/`splice` grep, 53/53 pre-existing tests) and committed alone, then task 2's diff was reapplied and independently verified (branch-parity check, `aria-multiselectable` count, react/solid typecheck, full 89/89 suite) before its own commit. Preserves honest per-task atomicity.
- **Chip rail explicitly deferred to plan 86-05.** This plan's `Artifacts this plan produces` section scopes `.rozie-combobox--multiple` as a state hook only — no chip markup, no `#chip` slot, no Backspace-remove-last. `isRowSelected`/`selectedValues` are written to be directly reusable by the chip rail without modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `aria-selected={rozieAttr(isRowSelected(opt))}` failed `tsc` on combobox-react and combobox-solid (TS2322)**
- **Found during:** Task 2, first whole-workspace `pnpm turbo run typecheck --force --continue` run
- **Issue:** `annotateDisplayWrap`'s `provablyPrimitive()` predicate (the shared pass that decides whether a template binding needs `rozieAttr()`-wrapping) recognizes a UnaryExpression `!` as provably boolean but NOT a bare CallExpression — `isRowSelected(opt)` therefore got routed through `rozieAttr()`, whose return type is `(T extends string ? T : string) | undefined` — widening the boolean return to `string`, which is not assignable to React/Solid's `Booleanish` (`boolean | "true" | "false" | undefined`) DOM type for `aria-selected`. The pre-existing raw `opt.value === $props.value` comparison never hit this path because a comparison BinaryExpression IS recognized as provably boolean.
- **Fix:** Wrapped all four `aria-selected` bindings (three non-windowed branches + windowed) in `!!isRowSelected(opt)` / `!!isRowSelected(wr.row)` — a UnaryExpression `!`, which `provablyPrimitive()` does recognize, keeping the binding on the RAW (non-`rozieAttr`) emission path with the correct `boolean` type. Functionally a no-op (`isRowSelected` already returns a plain boolean); purely a template-shape fix for the emitter's static-type heuristic.
- **Files modified:** `packages/ui/combobox/src/Combobox.rozie`
- **Verification:** `pnpm run typecheck` (`tsc --noEmit`) clean on both `combobox-react` and `combobox-solid`; whole-workspace `pnpm turbo run typecheck --force --continue` 324/324.
- **Committed in:** `41cae1f11`

**2. [Rule 1 - Bug, verification tooling only] The plan's own branch-parity verify script sliced the wrong `</template>` occurrence**
- **Found during:** Task 2, running the plan's literal `<verify>` command
- **Issue:** `s.slice(s.indexOf('<template>'), s.indexOf('</template>'))` finds the FIRST `</template>` in the file, which closes the nested `<template #anchor>` fill (the input's markup), not the outer template — the sliced substring never reaches the four render branches at all, so the check falsely reported `listbox count 0` instead of validating anything real.
- **Fix:** Used `s.lastIndexOf('</template>')` (the outer closing tag, which comes last in the file) for the actual verification run. Not a change to any project file — an ad hoc verification command run manually, corrected in-place.
- **Verification:** Corrected command printed `branch parity OK` (4 listboxes, 4 `aria-multiselectable`, 0 raw comparisons remaining).
- **Committed in:** n/a (verification-only; no file to commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - bugs; one in emitted TS typing, one in an ad hoc verify command). No scope creep — both fixes are scoped to the exact bindings/commands the plan's own tasks specify.

## Issues Encountered

- **Test-authoring gap, not a source bug:** the first draft of `multiple.behavior.test.ts` mounted the windowed branch with `virtual: true` from the start and asserted directly on rendered `[role="option"]` elements — this never renders any options under happy-dom (TanStack's virtualizer has no real layout to measure, so the real `windowedRows()` path never settles a non-empty slice, confirmed against this exact harness). Rewrote to mount non-virtual, open, then flip `virtual` true and assert within the single `nextTick()` frame before the rAF-deferred `buildVirtualizer()` can fire — landing in `windowedView()`'s documented un-windowed fallback, which still exercises the real windowed `<ul>` markup and every binding task 2 added to it. The pre-existing `virtual-flip.behavior.test.ts`'s own mount-time-virtual test case independently avoids asserting on option DOM for the identical reason, which is what led to this fix.
- **Test-authoring gap, not a source bug:** the empty-state test's `undefined` sub-case initially asserted `value()` stays `undefined` after mount; it observed `null` instead. Root cause: Vue 3.4+'s `defineModel('value', { default: null })` auto-emits an `update:value` sync of the declared default the instant a genuinely-`undefined` prop resolves to it — framework-level behavior, not a Combobox script write. Fixed the test's expectation (`initialValue === undefined ? null : initialValue`), documented inline.
- No unresolved blockers.

## User Setup Required

None - no external service configuration required.

## Verification Log

Full commands run, in the order the plan's `<verification>` section specifies:

1. `node packages/ui/combobox/scripts/compile-combobox-check.mjs` → `✓ Combobox surface OK: 22 props (1 model) / 2 emits / 4 slot / 4 expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).` — run repeatedly through the task-1/task-2 commit reconstruction, always green.
2. Branch-parity node check (corrected per deviation 2 above) → `branch parity OK` (4 listboxes, `aria-multiselectable` on 4/4, 0 raw single-select comparisons).
3. `pnpm turbo run build --force --concurrency=2` (whole workspace, run 3× across the implementation/reconstruction/final passes) → 243/243 successful every time.
4. `pnpm turbo run typecheck --force --continue --concurrency=2` (whole workspace, run 4× across the implementation/reconstruction/final passes) → first run caught deviation 1 above (`combobox-react`/`combobox-solid` TS2322); every subsequent run 324/324 successful.
5. `pnpm exec vitest run --reporter=verbose` (from `packages/ui/combobox`; `pnpm --filter ... test -- --reporter=verbose` does NOT forward the flag through the package's `test` script, per the 86-01 SUMMARY's documented recipe) → confirms `tests/multiple.behavior.test.ts` collected, all 36 of its tests individually named and passing; 89/89 total (10 test files).
6. RED-first evidence for task 3 (toggle-off + freshness, captured before the tests existed against a genuine, deliberately-broken source state): temporarily reverted `selectOption()`'s `multiple` branch to a naive always-append, in-place-`.push`-mutating implementation (no membership check), regenerated the leaves, and ran the new test file — **12/36 failed**: `(1) toggle` and `(3) dedup` in all four branches (`expected [ 'apple', 'apple' ] to deeply equal []` — never toggled off) and `(5) freshness` in all four branches (`expected [ 'apple', 'banana' ] not to be [ 'apple', 'banana' ] // Object.is equality` — literally the same mutated reference). Restored the real port-of-listCore algorithm immediately after, regenerated, and re-ran: 89/89 green.
7. `bash scripts/ci-prepush.sh` → failed at the same pre-existing, unrelated sidecar-staleness gate 86-01/86-03 already documented (~24 orphaned, gitignored `examples/consumers/*-ts/fixtures/*.d.rozie.ts` files, disconnected from `packages/ui/combobox`). Ran the remaining stages manually: `node scripts/check-dep-drift.mjs` → `✓ dependency-drift OK`; `pnpm turbo run test --force --continue --concurrency=4` (whole workspace) → 148/149 tasks successful, only `@rozie/docs#test` failed — the SAME 2 pre-existing `comparison-surface.test.ts` failures (combobox + popover comparison-page `surface_hash` staleness) already logged in `.planning/WINDOWS.md` (ids 1, 2) from 86-01, R6's job (a later plan in this phase). No new WINDOWS.md entry needed — the existing open entries already cover this exact class of finding, and this plan's `multiple` prop addition is squarely within their already-open scope.

**Turbo adjudication:** all whole-workspace runs used `--concurrency=2`/`4` per project convention; the one real failure (docs surface-hash) is pre-existing and unchanged in nature from 86-01/86-03's findings — not a regression introduced here.

## Next Phase Readiness

- R1's non-chip surface is fully proven: the widened sole `value` model, the ported toggle/dedup/fresh-array algorithm, the `selected` field on `change`, and the selection-marking ARIA all work correctly across all four render branches, with 89/89 tests green (36 new).
- Plan 86-05 (chip rail) can build directly on `selectedValues()`/`isRowSelected()` without modification — both were written with the chip rail's future consumption in mind (`selectedValues()` already returns the de-duplicated array the chip list will map over).
- `effectiveCloseOnSelect()`'s sentinel-default mechanism (`closeOnSelect: { default: null }`) is now the established pattern for any FUTURE flipped-default prop in this family — plan 86-06 (creatable) should read this SUMMARY's Decisions section before introducing any mode-dependent default.
- The R6 comparison-doc flip remains explicitly NOT blocked by anything in this plan — both open `WINDOWS.md` entries (1, 2) still describe the current state accurately (multi-select is now real, but the comparison page's ❌→✅ flip is still R6's job, a later plan).

## Self-Check: PASSED

- Both key files confirmed present on disk with `[ -f ]`: `packages/ui/combobox/src/Combobox.rozie`, `packages/ui/combobox/tests/multiple.behavior.test.ts`.
- All 3 commit hashes (`f4112482d`, `41cae1f11`, `1c967ca27`) confirmed present via `git log --oneline --all`.
- All acceptance criteria for tasks 1-3 re-verified with real command output (see Verification Log above).

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
