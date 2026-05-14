# Deferred Items — Phase 07.1

Out-of-scope discoveries logged during execution (not fixed — pre-existing, unrelated to plan scope).

## DEF-07.1-01: biome.json uses Biome v1 `files.ignore` schema; installed Biome is v2.4.13

- **Found during:** Plan 07.1-02 Task 1 acceptance check (`biome lint` on target src dirs).
- **Issue:** `biome.json` has `"files": { "ignore": [...] }` — the v1 key. Biome 2.4.13 (the pinned/installed version per CLAUDE.md tech stack) renamed this to `"files": { "includes": [...] }` and rejects `ignore` as an unknown key, so ANY `biome lint` / `biome check` invocation exits with a configuration error before linting runs.
- **Why out of scope:** `biome.json` is on `main`, untouched by this plan. The breakage predates Plan 07.1 and affects the whole repo's lint task, not just the redirected files. Fixing it is a repo-wide config migration unrelated to the type-identity fix.
- **Mitigation in-plan:** The Task 1 acceptance criterion that `biome lint` report no "import is only used as a type" errors was a proxy for `verbatimModuleSyntax: true` correctness. That correctness is fully validated by the green `tsc --noEmit` typecheck gate (tsc enforces `verbatimModuleSyntax` directly and would error on a mixed value/type import). All 5 Task-1 packages typecheck green.
- **Suggested fix (future quick task):** Migrate `biome.json` `files.ignore` → `files.includes` with negated globs per the Biome v2 migration guide, or pin Biome back to v1 if intentional.

## DEF-07.1-02: dist-parity + regressions angular fixtures stale vs already-merged angular emitter source

- **Found during:** Plan 07.1-02 Task 4 full-suite regression check.
- **Issue:** `tests/dist-parity` fails 28/192 (all `angular target`) and `tests/regressions` fails REG-05-001 (`05-04b-todolist-slot-context-arrow` angular). The committed `*.angular.ts` / `expected.angular.ts` fixtures still show the pre-`58b7370` angular emitter output. Commits `58b7370` ("fix(target-angular): emit type-valid Angular code under strict + exactOptionalPropertyTypes") and `bd90f5c` ("fix(types): ...") — **both already merged and ancestors of this worktree's base `f1c8172`** — changed the angular emitter to produce type-valid output (`this.foo()!.nativeElement` null-assertion instead of `(this.foo()?.nativeElement)`; `input<((...) => unknown) | null>(null)`; `output<void>()`; `model<any[]>`; `(id: any) =>`; `Record<string, any>`; `(this.fn as (...a: any[]) => any)(...args)`) but those PRs never regenerated the dist-parity / regressions fixtures.
- **Proof it is pre-existing:** Verified by checking out base `f1c8172` into a clean scratch worktree, `pnpm install` + rebuild core+targets, and running the suites: base shows `dist-parity` failing and `regressions` `1 failed | 37 passed` — identical failures, with NONE of Plan 07.1-02's changes applied. Plan 07.1-02's angular emitter diff is import-line-only (`ModifierRegistry` redirect), so angular emitter *behavior* at this branch HEAD == at base.
- **Why out of scope:** Plan 07.1-02 touches angular only via the mechanical `@rozie/core` import redirect (Task 1). The fixture staleness is owned by `58b7370` / `bd90f5c`. Regenerating the angular fixtures here would silently fold an unrelated PR's missing fixture-refresh into the type-identity-fix commit — a scope violation. (Plan 07.1-01's SUMMARY claim of "dist-parity 192/192" was unverified — Plan 01 ran sandboxed, touched only `@rozie/core`, and never re-ran dist-parity against the post-`58b7370` emitter source.)
- **In-plan scope handled:** The **lit** dist-parity fixtures (`Dropdown.lit.ts`, `Modal.lit.ts`) and the lit regressions fixture (`D-SH-02-lit-connected-rearm/expected.lit.ts`) WERE legitimately regenerated in this plan — that drift (`(e: Event)` + `(e as KeyboardEvent)` cast → `(e: KeyboardEvent)`) is caused by Plan 07.1-02 Task 3's registry-dispatch rewrite and is documented + justified in the SUMMARY. The angular fixtures were explicitly reverted so this plan's commits contain only plan-caused drift.
- **Suggested fix (future quick task):** `pnpm --filter dist-parity bootstrap` + `pnpm --filter @rozie/regressions test -u`, review the angular-only diff against `58b7370`/`bd90f5c`, commit as a fixture-refresh.

## DEF-07.1-03: @rozie/runtime-lit createLitControllableProperty ROZ840 parent-flip warn not firing

- **Found during:** Plan 07.1-02 Task 4 full-suite regression check.
- **Issue:** `packages/runtime/lit` fails 2/15 — `createLitControllableProperty — parent-flip detection (ROZ840)` expects exactly one `console.warn` on a controlled↔uncontrolled flip but gets 0.
- **Proof it is pre-existing:** Verified on the clean base `f1c8172` scratch worktree — `runtime-lit` shows `2 failed | 13 passed`, identical, with none of Plan 07.1-02's changes applied. Plan 07.1-02 touches **nothing** under `packages/runtime/lit` (`git diff base..HEAD -- packages/runtime/lit` is empty).
- **Why out of scope:** Zero Plan 07.1-02 surface. Likely fallout from a prior `06.4` / `fix(types)` change to the controllable-property signal wiring; owned by the runtime-lit package.
- **Suggested fix (future debug task):** Investigate `createLitControllableProperty`'s parent-flip detection path — the ROZ840 `console.warn` branch is not reached on mode flip.
