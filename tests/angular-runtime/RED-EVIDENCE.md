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
