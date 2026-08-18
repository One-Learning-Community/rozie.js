# RED-EVIDENCE.md

Phase 80 Plan 03 (Task 3) — SPEC R7 fail-first proof, recorded before any emitter change lands
(Plans 04/05). Per D-07/D-07b: "a test never observed red does not satisfy this requirement." This
file records the machine-observed pre-fix state; Plan 08 appends the matching GREEN observation to
this same artifact once the fix lands, giving one file the full red-to-green record.

## Pre-fix emitter commit

```
2f9444f51c8cf0d6655cdb7c659c2d8059b19e09
```

(the HEAD commit immediately before this plan's Task 3 RED-state commit — Task 2, "author the six
`.rozie` fixtures and prove each routes down the record path.") No file under `packages/targets/angular`
has changed anywhere in this plan; the Angular emitter at this commit is identical to the emitter at
the start of Phase 80.

## Observed at 2f9444f5

Command: `pnpm exec vitest run angular-runtime.test.ts`

```
Test Files  1 failed (1)
     Tests  5 failed | 1 passed (6)
```

| # | Test | Status | Observed failure |
|---|------|--------|-------------------|
| 1 | top-level fill (baseline) | **PASSED** | — |
| 2 | fill inside `r-if` | **FAILED** | `expected ' [DYN-FALLBACK]  [DEFAULT-FALLBACK] ' to contain 'IF-FILL'` |
| 3 | fill inside `r-for` | **FAILED** | `ReferenceError: col is not defined` |
| 4 | two sibling producers | **FAILED** | `expected +0 to be 1` (SIB-B count) |
| 5 | late-arriving fill (`r-if` false→true) | **FAILED** | `expected ' [DYN-FALLBACK]  [DEFAULT-FALLBACK] ' to contain 'IF-FILL'` |
| 6 | empty-string key → default slot (D-06) | **FAILED** | `expected ' [DYN-FALLBACK]  [DEFAULT-FALLBACK] ' to contain 'EMPTY-FILL'` |

**5 of 6 failed, baseline passed** — satisfies R7's "≥4 failed AND the top-level baseline passed" gate
with margin (four bug-exposing tests were specified; five are observed red here because test 5 shares
test 2's underlying defect and independently fails at its second assertion, as the plan anticipated).

## Failure-mode notes (observed vs. plan-prose hypothesis)

The plan's action text described *expected* pre-fix failure shapes as a planning aid. Two of the five
observed failures took a different, harder shape than hypothesized — recorded here per 80-CONTEXT.md's
standing instruction that a researcher/executor finding contrary evidence should say so rather than
silently comply with prose written before the fixtures existed. Neither changes whether R7 is satisfied
(all five are unambiguous test failures); both are documented in inline comments in
`angular-runtime.test.ts` next to the affected test.

- **Test 3 (`fill inside r-for`).** Plan prose: "a single view query returns iteration zero at best."
  Observed: a hard `ReferenceError: col is not defined`. The pre-fix emitter's `templates` getter is
  `{ [col.key]: this.__dynSlot_0! }` — it references `col`, the `@for` loop's own template-local
  variable, from CLASS-LEVEL scope, where it does not exist. `detectChanges()` throws synchronously.
  This is a *stronger* demonstration of the same underlying defect (the current class-level `templates`
  getter mechanism cannot express a loop-scoped dynamic-fill key at all — not even incorrectly), not a
  different one. The test's assertions are left as the desired POST-fix behavior (content checks,
  unreachable pre-fix because the exception propagates first) so no rewrite is needed once Plans 04/05
  land — this same file becomes the GREEN observation Plan 08 records.

- **Test 4 (two sibling producers).** Plan prose: "the known pre-fix failure renders the first
  producer's body twice." Observed: `SIB-A` renders exactly once (correctly) and `SIB-B` renders zero
  times — the second producer's fill is silently DROPPED, not duplicated. Root cause confirmed in the
  compiled output: `dynIdx` resets per producer tag, so both producers' synthetic fill templates share
  the identical Angular template-reference-variable name `__dynSlot_0`; separately, the `templates`
  getter itself only ever emits one entry — `{ [this.keyA()]: this.__dynSlot_0! }` — permanently missing
  `keyB`. The COUNT-based assertion (not presence-only, per the plan's own instruction) still correctly
  catches this: `sibACount` is 1 as expected, but `sibBCount` is 0 where 1 is required, failing the test.

## Design premise (Task 1, same commit range)

`rozieSlotDesign.probe.test.ts` — the signal `contentChildren(RozieSlot, { descendants: true })` form
was proven under REAL ngtsc AOT compilation (not JIT, not assumed): a hand-authored producer/host pair
mounted through `TestBed` (AOT testing platform) correctly collects keyed `<ng-template>` fills declared
at top level, inside `@if`, and inside `@for`. **PASSED.** The emitter fix in Plans 04/05 is being built
on a proven API, not an assumed one.

## Frozen-lockfile constraint

`pnpm install --frozen-lockfile` succeeds at the commit this file is committed in (verified before
committing) — the RED state trades away test-greenness, not lockfile installability.

## GREEN — Phase 80 Plan 08 (Task 1), OPEN RISK R-80-NG0203 closed

**Pre-fix (RED) commit, for reference:** `2f9444f5`
**Post-fix (GREEN) commit:** this commit (Phase 80 Plan 08, Task 1) — `git log -1 -- tests/angular-runtime/RED-EVIDENCE.md` resolves it precisely; recorded as prose rather than a hash literal to avoid the self-referential-hash problem of a commit naming its own SHA inside its own diff.

Command: `pnpm exec vitest run --root tests/angular-runtime`

```
Test Files  5 passed (5)
     Tests  165 passed (165)
```

All 165 tests pass, including the six R7 record-path tests from Plan 03 and every Plan 07 addition
(precedence, key-domain, prototype-pollution guard, dev/prod warning, prohibitions, misapplication).
Every test mounts REAL emitted output importing `{ RozieSlot } from '@rozie/runtime-angular'` — no
local copy of the directive, per the standing instruction in 80-CONTEXT.md's OPEN RISK
R-80-NG0203 note that a green proof against a copy would prove nothing about the shipped package.

| # | Test | Status |
|---|------|--------|
| 1 | top-level fill (baseline) | **PASSED** (unchanged — passed pre-fix too) |
| 2 | fill inside `r-if` | **PASSED** |
| 3 | fill inside `r-for` | **PASSED** |
| 4 | two sibling producers | **PASSED** |
| 5 | late-arriving fill (`r-if` false→true) | **PASSED** |
| 6 | empty-string key → default slot (D-06) | **PASSED** |

Plus the 17 tests Plan 07 landed RED against the SAME NG0203 crash (precedence tiers 1–3,
nullish/duplicate/`__proto__`/`constructor`/`prototype` key-domain edges, dev-vs-production
console-output silence, and the bare-`rozieSlot`-attribute case) — all now GREEN, and the
`prohibitions.test.ts` behavioral sub-case of prohibition 1. **17 failed → 0 failed.**

### Root cause (two compounding issues, both closed in `tests/angular-runtime/vitest.config.ts`
### and the new `angularPartialIvyLinker.ts`)

1. **Unlinked partial-Ivy.** `@rozie/runtime-angular` ships partial-Ivy declarations
   (`ɵɵngDeclareFactory` / `ɵɵngDeclareDirective`, correct per D-03/SPEC R1). A real Angular
   CLI/esbuild build links every dependency automatically via `@angular/build`'s own linker
   invocation; `@analogjs/vite-plugin-angular` (this harness's compiler) does not run that linker
   at all. Fixed with `angularPartialIvyLinkerPlugin()`, a Vite `transform` hook that runs
   `@angular/compiler-cli/linker/babel`'s own `createEs2015LinkerPlugin` — the exact recipe
   `@angular/build`'s `javascript-transformer-worker.js` uses — over any module whose source
   contains an unlinked `ɵɵngDeclare*` call.
2. **Dual-package hazard (the actual proximate cause of the NG0203 crash — linking alone did NOT
   fix it).** pnpm's peer-dependency-aware store gives `@angular/core@19.2.22` a DIFFERENT physical
   copy per distinct `zone.js` peer-resolution context. `packages/runtime/angular` and
   `tests/angular-runtime` resolved to two separate `@angular/core` instances on disk (confirmed via
   `require.resolve` from each package's own root: one under
   `@angular+core@19.2.22_..._zone.js@0.15.1`, the other under `..._zone.js@0.14.10`). `@angular/core`'s
   DI internals (`getCurrentInjector`/`enterDI`) are module-scoped closures — an injection context
   entered by ONE copy during `getNodeInjectable`'s directive instantiation is invisible to
   `inject()`/`input.required()` calls running inside the OTHER copy, which is exactly what
   `assertInInjectionContext` reports as NG0203, even though the directive was genuinely linked and
   genuinely instantiated inside Angular's own directive-instantiation flow. Fixed with
   `resolve.dedupe` in `vitest.config.ts`, forcing Vite to resolve every `@angular/*`/`rxjs`/`zone.js`
   import to a single canonical instance — reproducing the single-`@angular/core`-per-app guarantee
   a real npm-installed consumer already has by construction.

Diagnosed empirically: applying fix (1) alone left the SAME NG0203 crash (confirmed by inspecting
the actually-executed transformed code, which showed real linked `ɵɵdefineDirective` output, not the
unlinked declare form); only adding fix (2) resolved it. Both fixes are necessary; neither is
sufficient alone.

### Two Plan 07 test-authoring bugs surfaced once NG0203 stopped masking them

NG0203 fired unconditionally on `RozieSlot` construction, so two assertions Plan 07 authored against
an incorrect assumption were never actually reached pre-fix. Both are corrected in this plan's
commit, per 80-CONTEXT.md's standing instruction that contrary evidence be documented rather than
silently complied with — see the inline comments at each site for the full account:

- **The `__proto__` case of the prototype-pollution guard test** compared `({})['__proto__']` to
  `Object.prototype['__proto__']` — but bracket access on the literal name `'__proto__'` invokes
  `Object.prototype`'s own legacy accessor (Annex B), which always returns the prototype-chain link
  regardless of the guard's real behavior, making the original assertion compare `Object.prototype`
  to `null` unconditionally. Fixed by snapshotting `Object.getOwnPropertyDescriptor(Object.prototype,
  dangerKey)` before and after mounting — a reflective, key-agnostic check immune to the accessor
  special-case.
- **The bare-`rozieSlot`-attribute test** assumed (per SPEC.md's edge-probe table, written before any
  fixture existed) that `<ng-template rozieSlot>` with no bound value throws Angular's NG0950
  required-input error. Empirically false: Angular's template binder treats a value-less attribute
  matching a directive input name as a STATIC binding of the empty string (`rozieSlot=""`), which
  fully satisfies `input.required<string>()`. The directive's own selector
  (`ng-template[rozieSlot]`) requires the attribute to be present at all, so "present but genuinely
  unset" is not reachable through this syntax. The real, correct, and now-asserted behavior is the
  D-06 fold: the empty-string key normalizes to `'defaultSlot'`, and the bare-attribute fill renders
  in the producer's default slot — the same outcome as test 6 (`ConsumerEmptyKeyFill`), reached
  through a different syntactic path.

### CI wiring (already in place, verified still green)

`tests/angular-runtime` was already added to `.github/workflows/angular-matrix.yml`'s hand-maintained
unit-test `--root` list in Plan 06 (commit `9bd43c2f`). No new CI wiring was needed in this plan;
confirmed still present and correct.
