---
phase: quick/260502-i7x-spike-a-minimal-rozie-cli-with-rozie-bui
plan: spike
subsystem: cli
tags: [cli, commander, tsdown, vue, dx]

requires:
  - phase: 01-foundation
    provides: parse(), RozieAST, splitBlocks, diagnostics + renderDiagnostic
  - phase: 02-ir
    provides: lowerToIR(), IRComponent, ModifierRegistry, createDefaultRegistry
  - phase: 03-vue
    provides: emitVue(), EmitVueResult { code, map, diagnostics }
provides:
  - "@rozie/cli with `rozie build <input>` subcommand (vue target only)"
  - "Bin shebang + tsdown dual ESM/CJS dist with auto-set executable bit"
  - "Programmatic runBuild() API with BuildExit + RunBuildContext for in-process testing"
  - "Target-gating helper that errors with the right phase pointer for not-yet-shipped targets"
affects: [phase-04-react, phase-05-svelte-angular, phase-06-cli-polish]

tech-stack:
  added: [commander@14, vitest@4 (cli-package), tsdown@0.21 (cli-package)]
  patterns:
    - "Mirror @rozie/unplugin: relative-source imports of workspace TS siblings + tsdown inline so dist works without core/target-vue having built dist/"
    - "RunBuildContext sinks let tests drive runBuild() without spawning child node or hitting process.exit"

key-files:
  created:
    - packages/cli/src/bin.ts
    - packages/cli/src/commands/build.ts
    - packages/cli/src/__tests__/build.test.ts
    - packages/cli/tsdown.config.ts
    - packages/cli/vitest.config.ts
  modified:
    - packages/cli/package.json
    - packages/cli/src/index.ts
    - packages/cli/tsconfig.json
    - pnpm-lock.yaml

key-decisions:
  - "Inline workspace TS siblings via relative imports (mirrors @rozie/unplugin) — avoids needing @rozie/core to be pre-built before the CLI can install"
  - "Use commander 14 over citty/clipanion — RESEARCH.md recommended"
  - "Reuse @rozie/core's renderDiagnostic helper rather than re-implementing code-frame rendering"
  - "Target-gating returns exit code 2 (vs 1 for compile errors) so CI scripts can distinguish 'unshipped target' from 'broken source'"
  - "BuildExit + RunBuildContext exit='throw' lets vitest assert exit codes without process.exit killing the runner"

patterns-established:
  - "CLI subcommand layout: src/index.ts hosts commander wiring, src/commands/<name>.ts hosts the action handler — keeps bin.ts a 5-line shebang wrapper"
  - "Target-not-yet-shipped error format: `target '<name>' not yet shipped — see ROADMAP.md (Phase <N>)` with phase pulled from a TARGET_PHASE map (single source of truth, easy to update when each emitter ships)"

requirements-completed: []

duration: 5min
completed: 2026-05-02
---

# Quick Spike: Minimal `@rozie/cli` Summary

**`rozie build <input>.rozie` runs parse + lowerToIR + emitVue end-to-end and prints (or writes) a valid Vue 3 SFC; react/svelte/angular targets gated with a "not yet shipped" message.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-02T20:09:37Z
- **Completed:** 2026-05-02T20:14:35Z
- **Tasks:** 3
- **Files modified:** 4 (+ 5 created)

## Accomplishments
- `pnpm --filter @rozie/cli build` produces an executable `dist/bin.cjs` with a `#!/usr/bin/env node` shebang and the chmod+x bit set automatically by tsdown.
- `node packages/cli/dist/bin.cjs build examples/Counter.rozie` prints a real Vue 3 SFC with `<script setup lang="ts">`, `defineProps<{...}>()`, `defineModel<number>('value', ...)`, `computed(...)`, the original `<template>`, and the `<style scoped>` block.
- `--target react|svelte|angular` exits with code 2 and writes `target '<name>' not yet shipped — see ROADMAP.md (Phase X)` to stderr.
- `--out <path>` writes the SFC to disk, `--source-map` adds `<path>.map` (vue only). Tested for byte-identical equivalence with stdout.
- `pnpm --filter @rozie/cli test --run` exits 0 (5 tests covering happy path + target gating + --out + ROZ200 code-frame rendering).
- `@rozie/core` (391/391) and `@rozie/target-vue` (111/111) tests still pass — no regression.

## Task Commits

1. **Task 1: scaffold the CLI surface** — `fca1c3c` (feat)
2. **Task 2: implement `build` subcommand** — `5c44628` (feat)
3. **Task 3: vitest happy + error tests** — `dac5b29` (test)

## How to Invoke

```bash
# Build the CLI once
pnpm --filter @rozie/cli build

# Print a Vue SFC to stdout
node packages/cli/dist/bin.cjs build examples/Counter.rozie

# Or write to a file (with optional source map)
node packages/cli/dist/bin.cjs build examples/Counter.rozie --out Counter.vue --source-map

# Other targets are gated with the right phase pointer
node packages/cli/dist/bin.cjs build examples/Counter.rozie --target react
# -> exits 2: "target 'react' not yet shipped — see ROADMAP.md (Phase 4)"
```

After a `pnpm install` from the repo root, the bin is also reachable directly:

```bash
pnpm --filter @rozie/cli exec rozie build examples/Counter.rozie
```

## Files Created/Modified
- `packages/cli/src/bin.ts` — shebang wrapper, defers all logic to runCli().
- `packages/cli/src/index.ts` — commander 14 wiring; `runCli(argv)` exports for in-process tests.
- `packages/cli/src/commands/build.ts` — `runBuild(input, opts, ctx)` with target gating + parse/lower/emit pipeline + stdout/--out output + diagnostic rendering via @rozie/core's renderDiagnostic. Exposes `BuildExit` and `RunBuildContext` so tests can capture exits + sinks.
- `packages/cli/src/__tests__/build.test.ts` — 5 tests (happy path, --target react gate, unknown target, --out byte-identical, ROZ200 frame).
- `packages/cli/tsdown.config.ts` — dual ESM/CJS, two entries (index + bin), `dts.entry: ['src/index.ts']`, externals for commander/picocolors/babel/etc.
- `packages/cli/vitest.config.ts` — `root: __dirname`, includes `src/**/*.test.ts` + `src/**/__tests__/**/*.test.ts`.
- `packages/cli/package.json` — bin field, full deps (commander, picocolors, @babel/code-frame, @babel/generator, @rozie/core, @rozie/target-vue, …), tsdown build + vitest test scripts.
- `packages/cli/tsconfig.json` — added `src/**/__tests__` to `exclude` so vitest specs don't trip the package's strict rootDir constraint (lesson from 03-02 incident).
- `pnpm-lock.yaml` — regenerated to lock commander@14.

## Decisions Made
- **Inline workspace siblings, don't require pre-built dist.** @rozie/core publishes via `dist/` but isn't built in the dev tree; the unplugin solves this with relative `../core/src/...` imports + tsdown bundle inlining. The CLI follows the same pattern so a fresh `pnpm install && pnpm --filter @rozie/cli build` works without a pre-step to build core.
- **Commander 14, not citty.** RESEARCH.md picks commander explicitly; the dependency cost is identical and the API stability is better.
- **Reuse @rozie/core's renderDiagnostic.** Same code-frame look as the unplugin and the parser tests — single source of truth for ROZ-code rendering.
- **Distinct exit codes.** `1` = compile error (broken source), `2` = unshipped target (CLI invocation problem). CI scripts can branch.
- **`BuildExit` + `RunBuildContext`.** Lets vitest assert exit codes/stderr without process.exit killing the runner. Same trick as commander's `exitOverride`, applied at the action layer.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `@babel/generator` as a CLI dependency**
- **Found during:** Task 2 (smoke test of the built bin)
- **Issue:** `@babel/generator` is required transitively by emitVue (rewriteTemplateExpression imports it) and was listed as `external` in tsdown config but not declared as a dep on the CLI package. pnpm's isolated module store meant the bin couldn't resolve it at runtime → MODULE_NOT_FOUND.
- **Fix:** Added `"@babel/generator": "^7.29.1"` to `packages/cli/package.json` dependencies (matches the version other workspace packages use), reran `pnpm install`.
- **Files modified:** `packages/cli/package.json`, `pnpm-lock.yaml`
- **Verification:** `node packages/cli/dist/bin.cjs build examples/Counter.rozie` now emits the SFC cleanly, exits 0.
- **Committed in:** `5c44628` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Single missing dep, common pnpm isolation gotcha, fixed inline. No scope creep.

## Issues Encountered
- **Pre-existing target-vue typecheck error.** `pnpm --filter @rozie/cli typecheck` flags two `implicitly any` errors in `packages/targets/vue/src/rewrite/rewriteTemplateExpression.ts:111,142`. Reproduced on `main` *before* this spike's changes (verified via `git stash`). Out of scope per the deviation-rule scope boundary; logged in `.planning/quick/260502-i7x-spike-a-minimal-rozie-cli-with-rozie-bui/deferred-items.md`. CLI's own source typechecks clean — only the transitive walk through target-vue's source surfaces the errors.
- **`[rozie] Source map generated with empty mappings` on stderr.** Pre-existing `console.warn` in `@rozie/target-vue/src/sourcemap/compose.ts` (tracked there as `WR-01`). Lands on stderr, doesn't pollute the SFC on stdout. Also out of scope.

## User Setup Required
None — this is a workspace dev-tooling spike, no external services involved.

## Next Phase Readiness
- The CLI is dogfoodable: any `.rozie` file you can throw at it parses + lowers + emits. The user can iterate on Counter.rozie variants without the workaround they had before.
- Phase 4 (React target) and Phase 5 (Svelte+Angular) just need to (a) ship `emitReact`/`emitSvelte`/`emitAngular` and (b) drop the gate in `runBuild` (and update `TARGET_PHASE` map) — the rest of the CLI plumbing is already there.
- Phase 6 polish items deliberately deferred: `--pretty` (prettier integration), glob inputs (`fast-glob`), watch mode, multi-target emission in one invocation, and a proper `rozie check` subcommand for diagnostic-only runs.

## Self-Check: PASSED

- `packages/cli/src/bin.ts` — FOUND
- `packages/cli/src/index.ts` — FOUND
- `packages/cli/src/commands/build.ts` — FOUND
- `packages/cli/src/__tests__/build.test.ts` — FOUND
- `packages/cli/tsdown.config.ts` — FOUND
- `packages/cli/vitest.config.ts` — FOUND
- commit `fca1c3c` — FOUND
- commit `5c44628` — FOUND
- commit `dac5b29` — FOUND

---
*Quick spike completed: 2026-05-02*
