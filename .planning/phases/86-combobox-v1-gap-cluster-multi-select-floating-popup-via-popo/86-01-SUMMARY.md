---
phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo
plan: 01
subsystem: ui
tags: [rozie-compiler, floating-ui, popover, combobox, composition, published-leaf-chain]

requires:
  - phase: 75-popover-published-leaf-composition
    provides: Option A published-leaf composition mechanism (resolveManifestProducer, data-table→popover / command-palette→combobox precedent)
provides:
  - Popover `bare` / `disablePositioning` opt-in props and `'manual'` trigger, gated anchor ARIA
  - Combobox `<components>` block composing @rozie-ui/popover for the plain (non-grouped, non-virtual) popup
  - Proven TWO-level published-leaf chain (command-palette → combobox → popover), single instance per target
  - All six combobox leaves declaring the @rozie-ui/popover-<target> peer
affects: [86-02-combobox-keepMounted-anchor-width, 86-03-combobox-grouped-capped-virtual-composition, 86-comparison-doc-flip]

actuals:
  tokens: 53660
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Second Option A published-leaf composition instance (first: data-table→popover); resolveManifestProducer node_modules walk requires an ABSOLUTE fromFile path + a package-rooted ProducerResolver in every compile()/lowerToIR() call site touching a `<components>`-bearing source — a bare relative filename label silently breaks cross-package resolution (ROZ945)."
    - "tsdown leaves composing a published peer MUST externalize it explicitly (solid: unexternalized JSX in the dependency's dist crashes rolldown's parser; react/lit: unexternalized silently inlines a private copy, defeating the peerDependency and risking double custom-element registration on Lit)."
    - "CSS direct-child selector (`.parent > .shared-class`) to scope a positioning rule to only the DOM branches that still need it, when a shared class name spans both a newly-wrapped and several still-unwrapped render branches."

key-files:
  created: []
  modified:
    - packages/ui/popover/src/Popover.rozie
    - packages/ui/combobox/src/Combobox.rozie
    - packages/ui/combobox/package.json
    - packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/package.json
    - packages/ui/combobox/scripts/codegen.mjs
    - packages/ui/combobox/scripts/compile-combobox-check.mjs
    - packages/ui/popover/scripts/compile-popover-check.mjs
    - packages/ui/combobox/tests/surface.test.ts
    - packages/ui/popover/tests/surface.test.ts
    - packages/ui/combobox/__fixtures__/rozie-manifest.expected.json
    - packages/ui/popover/__fixtures__/rozie-manifest.expected.json
    - packages/ui/combobox/packages/{react,solid,lit}/tsdown.config.ts
    - docs/components/popover.md
    - docs/components/combobox.md

key-decisions:
  - "compile()/lowerToIR() call sites touching Combobox.rozie must pass an ABSOLUTE filename + a package-rooted ProducerResolver, mirroring data-table's and command-palette's established codegen.mjs pattern — the bare relative-label shortcut every prior no-cross-package-ref script used silently breaks the moment a `<components>` entry is added."
  - "@rozie-ui/popover-<target> must be added to combobox's react/solid/lit tsdown `external` lists (mirroring data-table's Phase 75 precedent) to avoid inlining a private copy of the composed peer."
  - "The absolute-positioning CSS (position/top/left/right/z-index) that `.rozie-combobox-list` used to carry unconditionally is now scoped to `.rozie-combobox > .rozie-combobox-list` (direct-child selector) so the still-unwrapped grouped/capped/virtual branches keep their exact prior geometry while the newly Popover-wrapped plain branch is positioned by Floating UI instead."

requirements-completed: [R4, R2]

coverage:
  - id: D1
    description: "The command-palette → combobox → popover chain resolves through <components>, compiles to all six targets, and typechecks green on all six command-palette, combobox, and popover leaves"
    requirement: "R4"
    verification:
      - kind: other
        ref: "pnpm turbo run build --force --concurrency=2 (whole workspace, 243/243 successful)"
        status: pass
      - kind: other
        ref: "pnpm turbo run typecheck --force --continue --concurrency=2 (whole workspace, 324/324 successful)"
        status: pass
      - kind: unit
        ref: "node packages/ui/popover/scripts/compile-popover-check.mjs"
        status: pass
      - kind: unit
        ref: "node packages/ui/combobox/scripts/compile-combobox-check.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The chain resolves to a SINGLE popover instance per target — no pnpm peer-keyed nominal split across combobox, command-palette, and data-table"
    requirement: "R4"
    verification:
      - kind: other
        ref: "single-instance real-path loop over combobox/command-palette/data-table × 6 targets — prints 'single-instance OK'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The plain (non-grouped, non-virtual) combobox popup is positioned by the composed @rozie-ui/popover leaf via Floating UI, not static CSS"
    requirement: "R2"
    verification:
      - kind: other
        ref: "grep -c 'popover-<target>' on each of the six emitted Combobox.<ext> leaves — 1 match each"
        status: pass
      - kind: unit
        ref: "packages/ui/combobox/tests/surface.test.ts (8 files / 47 tests, incl. compile()×6 zero-error)"
        status: pass
    human_judgment: false
  - id: D4
    description: "value remains the sole model:true prop on Combobox; no ROZ125 diagnostic; the Angular leaf still emits a ControlValueAccessor"
    requirement: "R2"
    verification:
      - kind: other
        ref: "node packages/ui/combobox/scripts/compile-combobox-check.mjs (asserts models=['value'], zero-error compile ×6, explicitly checks for no ROZ125/ROZ123)"
        status: pass
      - kind: other
        ref: "grep -c 'ControlValueAccessor' packages/ui/combobox/packages/angular/src/Combobox.ts -> 2"
        status: pass
    human_judgment: false
  - id: D5
    description: "Popover's anchor aria-haspopup/aria-expanded are gated behind a real gesture trigger via hasGestureTrigger(); trigger='manual' claims no popup"
    requirement: "R2"
    verification:
      - kind: other
        ref: "grep -vE comment-lines packages/ui/popover/src/Popover.rozie | grep -c 'aria-haspopup=\"dialog\"' -> 0"
        status: pass
      - kind: unit
        ref: "packages/ui/popover/tests/surface.test.ts (3 files / 30 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each of the six emitted combobox leaf package.json files declares its matching @rozie-ui/popover-<target> peer dependency"
    requirement: "R2, R4"
    verification:
      - kind: other
        ref: "manual read of all six packages/ui/combobox/packages/<target>/package.json + single-instance loop (which requires the peer symlink to exist)"
        status: pass
      - kind: other
        ref: "pnpm install --frozen-lockfile succeeds at the final commit"
        status: pass
    human_judgment: false
  - id: D7
    description: "An inline consumer (command-palette) that never floats still compiles ×6 with combobox now composing popover"
    requirement: "R4"
    verification:
      - kind: other
        ref: "pnpm turbo run build --force --concurrency=2 --filter '@rozie-ui/command-palette-*' (30/30 successful)"
        status: pass
      - kind: other
        ref: "pnpm turbo run typecheck --force --continue --concurrency=2 --filter '@rozie-ui/command-palette-*' (30/30 successful)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-01
status: complete
---

# Phase 86 Plan 01: Command-palette → Combobox → Popover Composition Chain Summary

**Proved the first two-level Rozie published-leaf composition chain by wiring the plain combobox popup through three new opt-in `@rozie-ui/popover` props (`bare`, `disablePositioning`, `trigger="manual"`), and fixed a latent cross-package-resolution + tsdown-externalization gap that the chain's first real exercise exposed.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-01T14:02:00Z (approx.)
- **Completed:** 2026-09-01T14:57:28Z
- **Tasks:** 3
- **Files modified:** 62 (across all three task commits)

## Accomplishments

- `@rozie-ui/popover` gained three additive, opt-in capabilities: `bare` (suppress the panel's own chrome), `disablePositioning` (static pass-through — never calls `computePosition`/`autoUpdate`), and `'manual'` as a documented fourth `trigger` value. The anchor's `aria-haspopup`/`aria-expanded` are now gated behind a real gesture trigger (`hasGestureTrigger()`) instead of unconditional.
- `@rozie-ui/combobox` gained a `<components>` block resolving `@rozie-ui/popover/Popover.rozie` (Option A) plus four forwarded positioning props (`placement`, `offset`, `disableFlip`, `disableShift`). The plain (non-grouped, non-virtual) popup branch is now wrapped in `<Popover trigger="manual" r-model:open="$data.isOpen" bare :disable-positioning="$props.inline">`.
- Proved the chain resolves to exactly one popover instance per target across combobox, command-palette, and data-table (no pnpm peer-keyed nominal split) — the `single-instance OK` loop passed.
- Proved the `inline` command-palette consumer that never floats still builds and typechecks green ×6 with combobox now composing popover.
- All six combobox leaf `package.json` files declare `@rozie-ui/popover-<target>` as a runtime peer (`^0.1.0`, `optional: false`).
- Re-blessed both families' surface gates (`tests/surface.test.ts`) and manifest fixtures (`__fixtures__/rozie-manifest.expected.json`) for the new prop surface; both fixture deltas confined to exactly the new prop entries.

**Exact emitted import (React leaf, `packages/ui/combobox/packages/react/src/Combobox.tsx:5`):**
```
import Popover from '@rozie-ui/popover-react';
```
The same shape (own target suffix) is present in all six emitted leaves.

**Single-instance loop output:**
```
single-instance OK
```

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "plain combobox popup positioned by the composed popover leaf"** - `a33de1743` (feat)
2. **Task 2: Re-bless the two surface gates and both manifest fixtures** - `9856cc1b8` (test)
3. **Task 3: Declare the popover peer on all six combobox leaves + prove single-instance chain** - `e07b531d0` (feat)

_No separate plan-metadata commit — `.planning/` is gitignored on this project and `commit_docs: false`, so only this SUMMARY.md is force-added below._

## Files Created/Modified

- `packages/ui/popover/src/Popover.rozie` - `bare`/`disablePositioning` props, `hasGestureTrigger()` gate, `.rozie-popover-floating--static`/`--bare` CSS
- `packages/ui/combobox/src/Combobox.rozie` - `<components>` block, four forwarded positioning props, plain-branch `<Popover>` wrap, CSS direct-child positioning selector
- `packages/ui/combobox/package.json` - seven popover devDependencies mirroring data-table's Phase 75 shape
- `packages/ui/combobox/packages/{react,vue,svelte,solid,angular,lit}/package.json` - `@rozie-ui/popover-<target>` peer + peerDependenciesMeta
- `packages/ui/combobox/packages/{react,solid,lit}/tsdown.config.ts` - added `@rozie-ui/popover-<target>` to `external` (deviation, see below)
- `packages/ui/combobox/scripts/codegen.mjs`, `packages/ui/combobox/scripts/compile-combobox-check.mjs` - absolute filename + rooted `ProducerResolver` (deviation, see below)
- `packages/ui/popover/scripts/compile-popover-check.mjs` - synced `EXPECT.props` to the real 12-prop IR surface (deviation, see below)
- `packages/ui/{popover,combobox}/tests/surface.test.ts`, `__fixtures__/rozie-manifest.expected.json` - re-blessed for the new prop surface
- `docs/components/popover.md`, `docs/components/combobox.md` - new prop rows + accuracy updates to prose (trigger gating, v1-scope floating note)

## Decisions Made

- Followed the plan's three planner rulings verbatim: `disablePositioning` (never `static`, an ES strict-mode reserved word), the D-09 "inline is a popover static pass-through" restatement, and the `width` (not `minWidth`) `size`-middleware choice deferred to plan 86-02.
- Scoped the dropped absolute-positioning CSS to a `.rozie-combobox > .rozie-combobox-list` direct-child selector rather than stripping it from the shared `.rozie-combobox-list` class outright, since that class is still used unwrapped by the grouped/capped/virtual branches this plan explicitly does not touch — a literal reading of the plan's CSS instruction would have silently broken those three branches' positioning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `combobox`'s `codegen.mjs` / `compile-combobox-check.mjs` / `tests/surface.test.ts` couldn't resolve the composed popover peer (ROZ945)**
- **Found during:** Task 1, first `compile-combobox-check.mjs` run
- **Issue:** All three scripts call `compile()`/`lowerToIR()` with a bare relative `filename: 'Combobox.rozie'` label and no `resolver`/`resolverRoot`. `resolveManifestProducer`'s node_modules walk starts from `dirname(fromFile)`; with no absolute path and no resolver, `compile()` defaults to `resolverRoot: process.cwd()`, so the walk started from the repo root instead of `packages/ui/combobox/src`, and never found the symlinked `@rozie-ui/popover-<target>` packages — every `compile(target)` call failed with `ROZ945`. This was invisible before because combobox had zero `<components>` references until this plan.
- **Fix:** Added an import of `ProducerResolver` from `@rozie/core`, constructed `new ProducerResolver({ root: ROOT })`, and changed every `filename` argument to the absolute `SRC` path (`resolve(ROOT, 'src/Combobox.rozie')`), passing `resolverRoot: ROOT, resolver` to every `compile()` call and `resolver` to `lowerToIR()` — mirroring the exact established pattern already proven in `data-table/scripts/codegen.mjs` and `command-palette/scripts/codegen.mjs`.
- **Files modified:** `packages/ui/combobox/scripts/codegen.mjs`, `packages/ui/combobox/scripts/compile-combobox-check.mjs`, `packages/ui/combobox/tests/surface.test.ts`
- **Verification:** `node packages/ui/combobox/scripts/compile-combobox-check.mjs` exits 0; `pnpm --filter @rozie-ui/combobox test` 47/47 passing; whole-workspace build 243/243.
- **Committed in:** `a33de1743` (codegen.mjs, compile-combobox-check.mjs), `9856cc1b8` (surface.test.ts)

**2. [Rule 1 - Bug] combobox's react/solid/lit tsdown configs did not externalize the composed popover peer**
- **Found during:** Task 1, first `pnpm turbo run build --force` run
- **Issue:** `combobox-solid`'s tsdown/rolldown build failed outright — `[PARSE_ERROR] Unexpected token` on `return <>` inside `popover-solid`'s own compiled `dist/index.mjs`, because Solid libraries deliberately ship un-transformed JSX for the *consuming app's* own Babel/vite-plugin-solid to compile, and rolldown cannot parse it. `combobox-react` and `combobox-lit` did NOT error (their dependency's dist has no raw JSX), but silently BUNDLED (inlined) a private copy of `@rozie-ui/popover-react`/`-lit` into their own leaf — defeating the peerDependency contract and, for Lit specifically, risking a `customElements.define()` `DOMException` if a consumer app also imports `@rozie-ui/popover-lit` directly (the exact failure mode `data-table`'s own tsdown config comments already warn about).
- **Fix:** Added `@rozie-ui/popover-<target>` to the `external` array in `packages/ui/combobox/packages/{react,solid,lit}/tsdown.config.ts`, mirroring `data-table`'s identical, already-proven configuration (including adapted explanatory comments).
- **Files modified:** `packages/ui/combobox/packages/react/tsdown.config.ts`, `packages/ui/combobox/packages/solid/tsdown.config.ts`, `packages/ui/combobox/packages/lit/tsdown.config.ts`
- **Verification:** `pnpm turbo run build --force --concurrency=2` — 243/243 successful (previously failed on `combobox-solid`).
- **Committed in:** `a33de1743`

**3. [Rule 3 - Blocking] `compile-popover-check.mjs` / `compile-combobox-check.mjs` `EXPECT.props` arrays were stale/incomplete**
- **Found during:** Task 1
- **Issue:** These standalone (non-vitest) surface-check scripts hardcode their own `EXPECT.props` arrays independent of `tests/surface.test.ts`. `compile-popover-check.mjs`'s array was already missing `modal`/`strategy` (added in a prior phase) BEFORE this plan's changes — a pre-existing drift the plan's own acceptance criteria required this script to pass. Both scripts also needed the new props from this plan added.
- **Fix:** Synced both `EXPECT.props` arrays to the current + new IR surface (popover: +`modal`, +`strategy`, +`bare`, +`disablePositioning`; combobox: +`placement`, +`offset`, +`disableFlip`, +`disableShift`).
- **Files modified:** `packages/ui/popover/scripts/compile-popover-check.mjs`, `packages/ui/combobox/scripts/compile-combobox-check.mjs`
- **Verification:** Both scripts exit 0 with `Popover surface OK: 12 props...` / `Combobox surface OK: 21 props...`.
- **Committed in:** `a33de1743`

---

**Total deviations:** 3 auto-fixed (1 Rule 1 - bug, 2 Rule 3 - blocking) plus 1 not-fixed and explicitly logged (below).
**Impact:** All three auto-fixes were necessary for correctness — the tracer's stated purpose is proving this exact resolution chain works, and none of the three latent gaps could have been discovered any other way than exercising it end to end. No scope creep — every fix mirrors an already-established, already-proven pattern from `data-table` or `command-palette`.

### Not fixed — logged to `.planning/WINDOWS.md`

**docs comparison-page `surface_hash` staleness (2 entries, kind: deviation).** Adding props to `Popover.rozie`/`Combobox.rozie` changed both families' compiled public surface, which `docs/tests/comparison-surface.test.ts` detects and fails on (by design — Phase 62 shipped a feature while the comparison page silently kept claiming otherwise until a human noticed). Both `docs/components/combobox-comparison.md` and `docs/components/popover-comparison.md` currently still make ACCURATE claims (combobox's "Floating-positioned popup: ❌" row is still true for the grouped/capped/virtual majority of branches; only the plain branch composes popover in this plan), but re-reading + confirming + bumping `surface_hash` is explicitly SPEC R6's job — a separate, later requirement/plan in this phase, per the plan's own "Boundaries" section which does not list either comparison page in this plan's scope. Bumping the hash now, without R6's full doc-review pass, would risk silently accepting a claim that's only partially true. `pnpm --filter docs test` (2 of 29 comparison-page tests) currently fails as a result; every other task in the whole-repo `turbo run test` battery passes (148/149 tasks green, only `@rozie/docs#test` red).

## Issues Encountered

None beyond the three deviations above — no unresolved blockers.

## User Setup Required

None - no external service configuration required.

## Verification Log

Full commands run, in the order the plan's `<verification>` section specifies:

1. `pnpm install` → succeeds; `pnpm install --frozen-lockfile` also succeeds at the final (Task 3) commit.
2. `node packages/ui/popover/scripts/compile-popover-check.mjs` → `✓ Popover surface OK: 12 props (1 model) / 1 emit / 2 slots / 4 expose; compile()×6 zero-error.`
3. `node packages/ui/combobox/scripts/compile-combobox-check.mjs` → `✓ Combobox surface OK: 21 props (1 model) / 2 emits / 4 slot / 4 expose; compile()×6 zero-error (focus = accepted warn-only ROZ137).`
4. `pnpm turbo run build --force --concurrency=2` (whole workspace) → 243/243 successful.
5. `pnpm turbo run typecheck --force --continue --concurrency=2` (whole workspace) → 324/324 successful.
6. `pnpm --filter @rozie-ui/popover test` → 3 files / 30 tests passed. `pnpm --filter @rozie-ui/combobox test` → 8 files / 47 tests passed.
7. Single-instance loop (task 3) → `single-instance OK`.
8. `bash scripts/ci-prepush.sh` → failed at the (pre-existing, unrelated) sidecar-staleness gate on ~24 orphaned `examples/consumers/*-ts/fixtures/*.d.rozie.ts` files dated 2026-08-19 — gitignored generated artifacts from a directory whose `.rozie` sources no longer exist, entirely disconnected from `packages/ui/{popover,combobox}`. Ran the remaining two ci-prepush stages manually instead: `node scripts/check-dep-drift.mjs` → `✓ dependency-drift OK`; `turbo run test --force --continue --concurrency=4` (whole workspace) → 148/149 tasks successful, only `@rozie/docs#test` failed (the surface_hash staleness described above, `2` of its `29` tests).

**Turbo adjudication:** all runs above used `--concurrency=2`/`4` per the plan's own instruction; no task needed re-isolation via `--filter` to resolve a phantom full-concurrency failure — the one real failure (docs surface-hash) reproduced identically in isolation too (`pnpm --filter docs test`).

## Next Phase Readiness

- The two-level composition chain (command-palette → combobox → popover) is proven end-to-end: resolution, compilation, typechecking, single-instance, and the inline no-float path all green.
- Plan 86-02 can proceed to `keepMounted` + anchor-width matching (`size` middleware) without re-litigating the chain risk.
- Plan 86-03 (grouped/capped/virtual branch composition) has a working direct-child CSS selector precedent to build from, and an explicit note in this SUMMARY that those three branches are still on the pre-Phase-86 static CSS path.
- The R6 comparison-doc flip is explicitly NOT blocked by anything in this plan — both open `WINDOWS.md` entries note the current prose is still accurate and only needs a review + hash bump once the full feature set (multi-select, full floating, creatable) ships.

---
*Phase: 86-combobox-v1-gap-cluster-multi-select-floating-popup-via-popo*
*Completed: 2026-09-01*
