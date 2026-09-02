---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
fixed_at: 2026-09-01T18:20:00Z
review_path: .planning/phases/86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo/86-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 86: Code Review Fix Report

**Fixed at:** 2026-09-01T18:20:00Z
**Source review:** .planning/phases/86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo/86-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (CR-01, CR-02, WR-01, WR-02 — Info findings IN-01/IN-02 out of scope per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-02: Chip remove uses `@mousedown.prevent`, not `@click`, and no longer clobbers an in-progress query

**Files modified:** `packages/ui/combobox/src/Combobox.rozie`, all six regenerated leaves (`packages/react/src/Combobox.tsx`, `packages/vue/src/Combobox.vue`, `packages/svelte/src/Combobox.svelte`, `packages/angular/src/Combobox.ts`, `packages/solid/src/Combobox.tsx`, `packages/lit/src/Combobox.ts`), `packages/ui/combobox/tests/multiple.behavior.test.ts`
**Commit:** `d02a145ef`
**Applied fix:**
- Switched the chip-remove button from `@click="removeChipValue(row.value)"` to `@mousedown.prevent="removeChipValue(row.value)"`, matching the idiom every other interactive row in the file already uses (documented at `Combobox.rozie:1018`) — this stops native focus-follows-mousedown from blurring the input and collapsing the popup before the removal registers.
- Threaded an `isRemoval` flag from `removeChipValue()` into `selectOption()`'s `multiple` branch so the D-14 "clear query on pick" line (`$data.query = ''`) is skipped on a removal — removing a chip no longer discards whatever the user was mid-typing.
- Added RED-first test `(15)` in `multiple.behavior.test.ts` asserting on the actual mechanism (`mousedown` `preventDefault()` + query survival), since happy-dom cannot simulate focus-follows-mousedown and a synthetic `click` test would not have caught the original bug. Confirmed RED against pre-fix code (all 4 render branches failed), then GREEN after the fix.
- Updated the pre-existing test `(11)` from a synthetic `click` dispatch to `mousedown`, matching the corrected binding.
- Verification: `@rozie-ui/combobox` 197/197 (192 baseline + 5 new across this fix and CR-01's WR-01 sibling test), combobox leaf typechecks all green (6/6 targets), no other files changed besides the six regenerated leaves' mechanical mousedown/isRemoval diff.

### WR-01: Inline combobox no longer inherits Popover's document Escape/click-outside dismissal

**Files modified:** `packages/ui/combobox/src/Combobox.rozie`, all six regenerated leaves, `packages/ui/combobox/tests/floating-popover.behavior.test.ts`
**Commit:** `bc6afb6d2`
**Applied fix:**
- Forwarded `$props.inline` into the composed `<Popover>`'s `:disable-dismiss` binding (`:disable-dismiss="$props.inline || $data.pinned"`), so `inline` mode gets neither positioning (already correctly suppressed via `:disable-positioning`) nor dismissal from Popover — root-causing what 86-07's `pinned`/`disableDismiss` regression fix had only treated symptomatically for the pinned case.
- Added RED-first test `(6)` in `floating-popover.behavior.test.ts`: dispatches a `click` on `document.body` (never on the input, never inducing a synthetic blur) while an `inline` combobox is open, and asserts the popup stays open — isolating Popover's own document-level click-outside listener as the only possible closer, since combobox itself has no independent click-outside handling. Confirmed RED against pre-fix code, then GREEN after the fix.
- Verification: `@rozie-ui/combobox` 197/197, `@rozie-ui/command-palette` 210/210 (the real `inline` consumer), `@rozie-ui/popover` 33/33, combobox leaf typechecks all green. No VR baseline touched (not needed — the fix is behavioral, proven by the new unit test).

### WR-02: Document the removal trigger for the combobox `pnpm.overrides` stopgap

**Files modified:** `RELEASING.md`
**Commit:** `9e808b047`
**Applied fix:**
- Per the phase's own critical constraint, the `pnpm.overrides` block in root `package.json` was left untouched (it remains load-bearing until combobox `0.5.0` actually publishes — removing it now would break `pnpm install --frozen-lockfile`).
- Added a new bullet to `RELEASING.md`'s §7 Gotcha catalog (mirroring the existing `popover-lit` allowlist entry's shape) documenting: why the override exists, the exact removal trigger (confirm `@rozie-ui/combobox-*@0.5.0` live on npm via direct registry GET, delete all six override entries, reinstall, commit the lockfile diff), and the risk of leaving it in place indefinitely (silently bypassing the semver-range enforcement `pnpm install --frozen-lockfile` is meant to catch).
- No JSON comment was possible (root `package.json` must stay valid JSON); RELEASING.md is this repo's established convention for exactly this class of "release-process hygiene, removal-trigger" documentation (see the pre-existing `popover-lit` and stale-publish-reconciliation entries in the same section).

### CR-01: Dedupe `render<Slot>` fields in the shared public `.d.ts` renderer (emitter fix)

**Files modified:** `packages/core/src/codegen/renderPropsInterface.ts`, `packages/core/src/codegen/__tests__/renderPropsInterface.test.ts` (new), `packages/ui/combobox/packages/react/src/Combobox.d.ts`, `packages/ui/data-table/packages/react/src/DataTable.d.ts`, `packages/ui/listbox/packages/react/src/Listbox.d.ts`, `packages/ui/slider/packages/react/src/Slider.d.ts`
**Commits:** `592096a75` (fix), `723d09f0f` (follow-up: strict-typecheck fix in the new test file, caught by whole-workspace `turbo run typecheck --force`)
**Applied fix:**
- Root cause confirmed in `packages/core/src/codegen/renderPropsInterface.ts`: `ir.slots` holds one `SlotDecl` per `<slot>` **occurrence**, not one per distinct name (`lowerSlots.ts`'s `visit()` has no same-name top-level dedup — only a top-level-vs-nested dedup). The shared `.d.ts`/`.d.rozie.ts` renderer (used by all six targets' `emitTypes.ts`) looped over `ir.slots` and emitted a fresh `render<Slot>` (or `children`) field per occurrence, so any component repeating a named slot across mutually-exclusive `r-if` render branches minted a duplicate-identifier (TS2300) public `.d.ts`.
- Confirmed this was the ONE place in the pipeline missing the fix: every per-target **inline** interface emitter already carried the equivalent dedup — React's `emitSlotDecl.ts` (`seenPropFields` Set), Solid's `emitSlotDecl.ts` (`seenSlotNames` Set), Svelte's `refineSlotTypes.ts` (`distinctSlotsByName`/`slotIdentityKey`, which additionally handles the dynamic-name-vs-default sentinel collision). Ported the identical first-occurrence-wins pattern into the core renderer, keyed on the computed render-field name so both the named-slot case and the default-slot (`children`) repeat-occurrence case dedupe uniformly.
- RED-first: added `renderPropsInterface.test.ts`, a minimal fixture with a slot named `option` and an unnamed default slot each repeated across two `r-if` branches (mirroring Combobox's real plain/grouped/grouped+capped/windowed shape). Confirmed RED by temporarily reverting the fix via `git stash` (all 3 assertions failed, reproducing 2 duplicate fields), then GREEN after re-applying.
- **Blast radius determined by direct measurement, not blind regeneration**: wrote a one-off scan (parse + lowerToIR every `.rozie` source under `packages/ui/`, count `ir.slots` entries per distinct name) against the freshly-rebuilt `@rozie/core`. Exactly 4 of 49 families were affected: `combobox` (`option`×4, `empty`×4, `create`×4, `groupHeading`×2 — matches the review's reproduction exactly), `data-table` (`selectAll`×2, `colHeader`×4, `filter`×2, `selectCell`×2, `cell`×4, `editor`×2, `detail`×2), `listbox` (`option`×2, `empty`×2), `slider` (`bubble`×3).
- Regenerated codegen for all 4 affected families (after rebuilding the toolchain via `turbo run build --force --filter=@rozie/core --filter=@rozie/cli --filter=@rozie/unplugin --filter=@rozie/babel-plugin`, per the core-is-inlined-into-plugins constraint). Only each family's **React** `.d.ts` changed (5 files total across 4 families) — the other five leaves per family were already correct, confirming the fix's scope matches the defect's scope exactly. Every diff individually reviewed: pure removal of duplicate lines, first occurrence kept verbatim, byte-identical param shapes preserved, nothing else in any file changed (no README/manifest/theme/other-leaf drift).
- Directly re-ran the reviewer's own repro command (`tsc --noEmit --strict --jsx react-jsx --module es2020 --moduleResolution node <file>.d.ts`) against all 4 regenerated `.d.ts` files: zero `TS2300` errors (was 14 for combobox), and zero errors of any kind for all 4 files.
- **Full verification sweep** (this is the emitter-change checklist from the constraints):
  - `@rozie/core`: 2420/2420 (baseline 2417 + 3 new, confirmed both standalone and via isolated `turbo run test --filter=@rozie/core --force`)
  - `@rozie-ui/combobox`: 197/197 typecheck + tests, all 6 leaves clean
  - 4-family typecheck (`turbo run typecheck --filter` on all combobox/data-table/listbox/slider leaves, `--force`): 41/41 tasks green
  - `@rozie/target-{react,angular,lit,svelte,solid,vue}` snapshot suites (`turbo run test --filter='@rozie/target-*' --force`): 12/12 tasks green (2118+ individual assertions across the six target packages) — **no snapshot needed reblessing**; the emitter change only affects the shared `.d.ts` renderer, which none of the target-* snapshot suites assert against directly
  - `tests/dist-parity` (`vitest run`): 1049/1049 — the core compiler's 4-distribution-leg (core/cli/babel-plugin/unplugin) byte-identity gate, unaffected
  - Whole-workspace `turbo run typecheck --force`: 324/324 tasks (exact baseline match)
  - Whole-workspace `turbo run test --force --concurrency=2`: 149/149 tasks (exact baseline match) — confirmed via `--concurrency=2` after a full-parallel `--force` run showed two DIFFERENT, non-reproducing phantom failures (`@rozie/tests-cli-smoke`'s watch-mode timing test, then separately `@rozie/core`'s own suite) that both passed cleanly in isolation on retry; this matches a documented pre-existing flakiness pattern in this repo's own memory (`project_turbo_full_concurrency_untrustworthy` — "phantom failures; classify each with `--filter`, trust `--concurrency=2`") and is unrelated to this change
  - `@rozie-ui/popover`: 33/33, `@rozie-ui/command-palette`: 210/210, `docs`: 29/29 — all exact baseline matches

No VR baseline was touched or reblessed for this finding — the fix is purely a type-level `.d.ts` correction with zero runtime/rendered-output effect.

## Skipped Issues

None — all 4 in-scope findings were fixed. (IN-01 and IN-02 were out of scope for this run per `fix_scope: critical_warning`.)

---

_Fixed: 2026-09-01T18:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
