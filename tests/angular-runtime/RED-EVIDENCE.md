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

## RED — Phase 80 Plan 09 (Task 2), D-09's Bug C reproduced (NOT the same defect as above)

**This section is a SECOND, distinct fail-first record.** Everything above this heading proved and
then closed OPEN RISK R-80-NG0203 (a test-harness integration gap). This section proves a real
**emitter** bug the phase itself introduced — deferred-items.md item #3, formalized as decision D-09
in `80-CONTEXT.md`: *"Phase 80 does NOT close until the Bug-C regression is fixed inside this
phase."* Do not confuse this RED state with the one above — that one is closed and green; this one
is deliberately still open and will stay red until Plan 10 lands.

**Pre-fix (this plan's) emitter commit:** `7ec36c962716aad39611fdb354ca4e7a13ebf18d` (this plan's
Task 1 commit — the four new consumer fixtures, zero emitter files touched). No file under
`packages/targets/angular/src/emit` has changed anywhere in Plan 09; the Angular emitter at this
commit is byte-identical to the emitter Plan 08 left behind.

### The bug being reproduced

`emitScript.ts:1322`'s `hasRecordOnlySlot = ir.slots.some(isRecordOnlySlotDecl)` gate decides whether
a PRODUCER emits `contentChildren(RozieSlot)` + `__rozieFillMap` — keyed ENTIRELY on the producer's
OWN slot declarations. `emitSlotFiller.ts:215` emits a `[rozieSlot]="expr"` marker for ANY consumer
`#[expr]` fill unconditionally, regardless of what the target producer's own slots look like. A
producer whose slots are ALL static identifier names (like `tests/angular-runtime/fixtures/
ProducerIdentifierOnly.rozie`, declaring only `header`/`footer`) never satisfies `hasRecordOnlySlot`,
so it never collects `[rozieSlot]` fills at all — a dynamic consumer fill targeting it has no path to
the producer whatsoever. The plan's own `staticSlotProducerFillMap.test.ts` file docstring and
`80-CONTEXT.md`'s D-09 both give the full root-cause narrative.

### Observed at commit `7ec36c96`

**Command:** `pnpm exec vitest run --root packages/targets/angular staticSlotProducerFillMap`

```
Test Files  1 failed (1)
     Tests  6 failed (6)
```

| # | Test | Status | Observed failure |
|---|------|--------|-------------------|
| 1 | emits `__rozieFills` content query | **FAILED** | `expected 'import { Component, ContentChild, Des…' to contain '__rozieFills = contentChildren(RozieS…'` |
| 2 | emits `__rozieFillMap` computed member | **FAILED** | `expected 'import { Component, ContentChild, Des…' to contain '__rozieFillMap = computed(() => {'` |
| 3 | emits `RozieSlot` runtime import | **FAILED** | `expected 'import { Component, ContentChild, Des…' to contain 'import { RozieSlot } from \'@rozie/ru…'` |
| 4 | `header` slot resolution carries the fill-map tier | **FAILED** | `expected '...' to contain '*ngTemplateOutlet="(headerTpl ?? __ro…'` — actual emitted expression is `(headerTpl ?? templates()?.['header'])`, no fill-map tier at all |
| 5 | `footer` slot resolution carries the fill-map tier | **FAILED** | same shape as #4, for `footerTpl` |
| 6 | keyed-fill gate is the same width as the `templates` gate | **FAILED** | `hasTemplatesInput` is `true` (the producer DOES emit `templates()`) but `expect(code).toContain('__rozieFillMap')` fails — proves the two gates are NOT the same width today, which is the precise shape of the bug |

**Command:** `pnpm exec vitest run --root tests/angular-runtime staticProducerKeyedFill`

```
Test Files  1 failed (1)
     Tests  5 failed (5)
```

| # | Test | Status | Observed failure |
|---|------|--------|-------------------|
| 1 | top-level fill (ModalConsumer shape) | **FAILED** | `expected ' [HEADER-FALLBACK]  [FOOTER-FALLBACK] ' to contain 'TOPLEVEL-STATIC-FILL'` — the fill never renders, both slots show their own fallback |
| 2 | toggle fill (dynamic-slot-name / TableDemo-footer shape) | **FAILED** | `expected 'Toggle slotName (now: header) [HEADER…' to contain 'TOGGLE-STATIC-FILL'` — the fill never renders in EITHER slot, before or after the toggle click |
| 3 | fill inside `r-if` (true at mount) | **FAILED** | `expected ' [HEADER-FALLBACK]  [FOOTER-FALLBACK] ' to contain 'IF-STATIC-FILL'` |
| 4 | fill inside `r-if` (false→true after mount) | **FAILED** | same shape as #3 — the fill never arrives even after the conditional flips true and `detectChanges()` runs again |
| 5 | two sibling static-only producers, each with its own fill | **FAILED** | `expected +0 to be 1` — BOTH siblings' fill counts are zero (unlike the record-path sibling bug RED-EVIDENCE recorded earlier in this file, where one sibling rendered and the other silently dropped; here NEITHER static-only producer ever collects anything, so both markers are simply absent) |

Both suites fail exactly as this plan requires: the runtime DOM proof shows the content is genuinely
missing (not a screenshot artifact — verified the same way deferred-items.md #3 verified it, via
direct text-content assertions), and the source-level proof pins the precise emitter gate that causes
it, including the explicit gate-width relationship (test 6) that Plan 10's fix must satisfy.

### Additivity check — the previously-green suites are untouched

`pnpm exec vitest run --root tests/angular-runtime` (full package):

```
Test Files  1 failed | 5 passed (6)
     Tests  5 failed | 165 passed (170)
```

The 165 tests this file's earlier GREEN section recorded are still 165 green — the new 5 red tests
are purely additive (170 = 165 + 5), not a regression of any existing coverage.

`pnpm exec vitest run --root packages/targets/angular` (full package):

```
Test Files  1 failed | 58 passed (59)
     Tests  6 failed | 641 passed | 1 todo (648)
```

Same additivity shape: 641 previously-passing tests (plus 1 pre-existing `todo`) are unaffected; only
the 6 new `staticSlotProducerFillMap.test.ts` cases are red.

### Scope check — nothing outside the new files changed

`git show --stat` for this plan's two task commits lists only the four new fixtures (Task 1) and the
two new test files plus this evidence file (Task 2) — no file under `packages/targets/angular/src/emit`,
no existing test file, no fixture snapshot, no `.png` visual-regression baseline.

### Frozen-lockfile constraint

`pnpm install --frozen-lockfile` succeeds at the commit this section is committed in (verified before
committing, no `package.json`/lockfile changes in this plan at all) — the RED state trades away
test-greenness for these two new suites only, not lockfile installability, and not the greenness of
any suite that was already passing.

### What happens next

This red state stays in git history unresolved by this plan, by design. Plan 10 is the emitter fix
(`emitScript.ts` / `emitSlotFiller.ts`); once it lands, these same two files — unmodified — become the
GREEN observation for D-09's Bug C, mirroring the convention the Plan 03 → Plan 08 pair already
established above in this same file. **Do not "fix" these tests by loosening or removing an
assertion; the fix belongs in the emitter, not the test.**

## GREEN — Phase 80 Plan 13 (Task 1), D-09's Bug C closed

**This section is the second red-to-green pair in this file.** It closes the RED section immediately
above (Plan 09), mirroring the convention the Plan 03 → Plan 08 pair already established higher up.
Do not confuse this GREEN with the one above it — that one closed OPEN RISK R-80-NG0203 (a harness
integration gap); this one closes D-09's Bug C (a real emitter bug the phase itself introduced).

**Pre-fix (RED) commit, for reference:** `7ec36c96` (Plan 09's fixture-only commit; the RED
observations above were recorded against `7ec36c96`, one commit before the two RED test files
themselves landed at `bb776004`).
**Fix commits:** `4246f7a3` / `6792c7cb` / `fc34a592` (Plan 10 — `hasKeyedFillIntake`, the widened
keyed-fill intake predicate).
**Post-fix (GREEN) commit:** this commit (Phase 80 Plan 13, Task 1) — `git log -1 -- tests/angular-runtime/RED-EVIDENCE.md`
resolves it precisely, recorded as prose rather than a hash literal for the same self-referential-hash
reason the section above states.

### What changed in the emitter, and why it fixes each case

`refineSlotTypes.ts` gained one new exported predicate, `hasKeyedFillIntake(slots) = slots.length > 0`
— exactly as wide as the gate that already governed the producer's `templates` input. `emitScript.ts`
now gates the `__rozieFills` content query, the `__rozieFillMap` computed fold, and the `RozieSlot`
runtime import on this wide predicate (diagnostics stay on the original narrow
`ir.slots.some(isRecordOnlySlotDecl)` gate, deliberately, so the pre-existing mixed-producer
false-positive warning class is not worsened). `emitSlotInvocation.ts`'s resolution-chain splice moved
onto the same wide predicate. The result: **every Angular producer that declares at least one slot —
identifier-named or record-path — now collects `[rozieSlot]` marker-directive fills by content query**,
closing the exact gap D-09 named: a producer whose own slots are all static identifier names used to
never collect anything, so a consumer's dynamic `#[expr]` fill had no path to it at all. Widening the
intake gate to match the `templates`-input gate's width gives that path back, for every producer shape,
without reintroducing the two behaviors Plans 04/05 deliberately removed (the `[templates]="templates"`
consumer binding, the class-body `templates` getter).

### Command: `pnpm exec vitest run --root tests/angular-runtime staticProducerKeyedFill`

```
Test Files  1 passed (1)
     Tests  5 passed (5)
```

### Case-by-case: Plan 09's RED mapped to this plan's GREEN

| # | Test | Plan 09 (RED, commit `7ec36c96`) | Plan 13 (GREEN, this commit) |
|---|------|-----------------------------------|-------------------------------|
| 1 | top-level fill (ModalConsumer shape) | FAILED — fill never rendered, both slots showed their own fallback | **PASSED** — the marker renders in the filled slot; the other slot keeps its own fallback |
| 2 | toggle fill (dynamic-slot-name / TableDemo-footer shape) | FAILED — fill never rendered in either slot, before or after toggle | **PASSED** — the same fill moves between the producer's two static-named slots at runtime |
| 3 | fill inside `r-if` (true at mount) | FAILED — fill never arrived | **PASSED** — fill inside an embedded view (r-if true at mount), the marquee table-demo shape |
| 4 | fill inside `r-if` (false→true after mount) | FAILED — fill never arrived even after the conditional flipped true | **PASSED** — fill inside an embedded view that flips false→true after mount |
| 5 | two sibling static-only producers | FAILED — both siblings' fill counts were zero | **PASSED** — neither sibling leaks into the other |

### Command: `pnpm exec vitest run --root packages/targets/angular staticSlotProducerFillMap`

```
Test Files  1 passed (1)
     Tests  6 passed (6)
```

| # | Test | Plan 09 (RED) | Plan 13 (GREEN) |
|---|------|----------------|-------------------|
| 1 | emits `__rozieFills` content query | FAILED — no content query at all | **PASSED** |
| 2 | emits `__rozieFillMap` computed member | FAILED — no fill-map fold at all | **PASSED** |
| 3 | emits `RozieSlot` runtime import | FAILED — no runtime import at all | **PASSED** |
| 4 | `header` slot resolution carries the fill-map tier | FAILED — emitted `(headerTpl ?? templates()?.['header'])`, no fill-map tier | **PASSED** |
| 5 | `footer` slot resolution carries the fill-map tier | FAILED — same shape as #4 | **PASSED** |
| 6 | keyed-fill gate is the same width as the `templates` gate | FAILED — producer emitted `templates()` but not `__rozieFillMap()` | **PASSED** — the two gates are now provably the same width |

### No assertion weakened

`git diff bb776004 -- tests/angular-runtime/staticProducerKeyedFill.test.ts` and
`git diff bb776004 -- packages/targets/angular/src/__tests__/staticSlotProducerFillMap.test.ts` are
**both empty** — neither Plan 09 test file has been touched by any commit since it landed RED. The
fix that turned all 11 of these cases green lived entirely in the emitter (`refineSlotTypes.ts`,
`emitScript.ts`, `emitSlotInvocation.ts`, `collectAngularImports.ts`), never in the tests that prove it.

### Additivity and full-suite confirmation

`pnpm exec vitest run --root tests/angular-runtime` (full package, this commit):

```
Test Files  6 passed (6)
     Tests  177 passed (177)
```

`pnpm exec vitest run --root packages/targets/angular` (full package, this commit):

```
Test Files  59 passed (59)
     Tests  652 passed | 1 todo (653)
```

No previously-passing test regressed. The growth beyond Plan 09's own recorded totals (170 in
`tests/angular-runtime`, 648 in `packages/targets/angular`) is accounted for entirely by Plan 12's own
additive changes to `prohibitions.test.ts` (the two amended-prohibition standing tests, with their
non-vacuity and no-deletion counter-cases) landing on top of Plan 09's fixtures in the same window —
not by any weakening of Plan 09's own two test files, confirmed empty-diff above.

### CI coverage confirmation

Both new test files are covered by `.github/workflows/angular-matrix.yml`'s existing hand-maintained
unit-test `--root` list, added in this same file's Plan 08 GREEN section:
`pnpm exec vitest run --root tests/angular-runtime` covers `staticProducerKeyedFill.test.ts`;
`pnpm exec vitest run --root packages/targets/angular` covers `staticSlotProducerFillMap.test.ts`
(that root entry pre-dates Phase 80 — it is the existing Angular target unit-test line). No new CI
line was needed.

### Frozen-lockfile constraint

`pnpm install --frozen-lockfile` exits zero at this commit (verified before committing).

### Closing the loop

D-09's Bug C — the regression Plan 08's Docker VR run found and this file has now tracked from RED
(Plan 09) through fix (Plan 10) to GREEN (this section) — is closed at the runtime-harness and
source-emission levels. Task 2 of this plan is the independent Docker visual-regression check against
the four cells that were left honestly red since Plan 08, on baselines that predate the regression and
were never touched.

## RED — Phase 80 Plan 14 (Task 1), D-10's SECOND incomplete-widening bug reproduced (NOT the same defect as either section above)

**This section is a THIRD, distinct fail-first record.** The two sections above proved and closed, in
order: OPEN RISK R-80-NG0203 (a test-harness integration gap) and D-09's Bug C (the OUTLET resolution
chain in `emitSlotInvocation.ts`, fixed by Plan 10's `hasKeyedFillIntake` widening). This section proves
a SECOND, DISTINCT real emitter bug that Plan 13's own Docker VR union run surfaced and D-10 formalized:
Plan 10 widened the chain that supplies the `TemplateRef` once a wrapper element has already decided to
render. It did NOT widen the STRUCTURAL PRESENCE check that decides whether the wrapper renders AT ALL.
Do not confuse this RED state with either section above — those are closed and green; this one is
deliberately still open and will stay red until this plan's Task 2 lands.

### The bug being reproduced

Three near-verbatim two-tier presence-chain builders — `buildSlotsMerge` (`rewriteTemplateExpression.ts:72`,
call sites `:475`/`:520`), `buildScriptSlotsMerge` (`rewriteScript.ts:180`, call site `:1353`), and
`buildListenerSlotsMerge` (`rewriteListenerExpression.ts:136`, call site `:432`) — all carry the same
Phase 07.3.2 Plan 10 doc comment and all lower `$slots.X` to `(fooTpl ?? templates()?.['foo'])`, with
zero `__rozieFillMap` references anywhere in any of the three files. A producer that gates a WRAPPER
ELEMENT on `$slots.foo` (Modal's `<header r-if="$props.title || $slots.header">`, Table's `<tfoot
r-if="$slots.footerSummary || $slots.footerPagination">`) never renders the wrapper for a consumer's
dynamic `#[expr]` fill — the fill has nowhere to land, even though the OUTLET chain immediately inside
that same wrapper already resolves through three tiers (Plan 10's fix). `80-CONTEXT.md`'s D-10 gives
the full root-cause narrative, including the correction that the defect has three copies, not one.

### Observed at commit `64180635` (pre-Task-1, HEAD before this plan's fixtures/tests landed)

**Command:** `pnpm exec vitest run --root packages/targets/angular gatedSlotPresenceFillMap`

```
Test Files  1 failed (1)
     Tests  7 failed | 1 passed (8)
```

| # | Test | Status | Observed failure |
|---|------|--------|-------------------|
| 1 | prop-OR-slot gate (Modal shape) carries the fill-map tier for `header` | **FAILED** | actual outer gate is `@if (title() \|\| (headerTpl ?? templates()?.['header']))` — no fill-map tier |
| 2 | slot-OR-slot gate (Table shape) carries the fill-map tier for both slots | **FAILED** | actual outer gate is `@if ((footerSummaryTpl ?? templates()?.['footerSummary']) \|\| (footerPaginationTpl ?? templates()?.['footerPagination']))` — no fill-map tier on either operand |
| 3 | cross-chain agreement (gate vs. outlet) for `header` | **FAILED** | the gate-chain regex never matches (no fill-map term to find) |
| 4 | template-context unit: `$slots.header` → three-tier chain | **FAILED** | `expected '(headerTpl ?? templates()?.[\'header\'])' to be '(headerTpl ?? __rozieFillMap()[\'header\'] ?? templates()?.[\'header\'])'` |
| 5 | template-context unit: `prefixThis: true` → class-scoped three-tier chain | **FAILED** | same shape as #4, `this.`-qualified |
| 6 | script-context unit: `rewriteRozieIdentifiers` → class-scoped three-tier chain | **FAILED** | emitted `if ((this.headerTpl ?? this.templates()?.['header'])) { foo(); }` — no fill-map tier |
| 7 | listener-context unit: `rewriteListenerExpression` → class-scoped three-tier chain | **FAILED** | same shape as #4/#5, `this.`-qualified |
| 8 | optional-member branch produces the SAME chain as the plain-member branch | **PASSED** | both branches agree with each other (both still two-tier pre-fix) — an internal-consistency check, not a fill-map-presence check, so passing here is correct and expected, not a wrong-reason pass |

**Command:** `pnpm exec vitest run --root tests/angular-runtime gatedProducerKeyedFill`

```
Test Files  1 failed (1)
     Tests  2 failed (2)
```

| # | Test | Status | Observed failure |
|---|------|--------|-------------------|
| 1 | prop-OR-slot gate (Modal shape) — gated header wrapper renders with the fill inside it | **FAILED** | `expected null not to be null` — `document.querySelector('[data-testid="gated-header-wrapper"]')` returns `null`; the wrapper ELEMENT itself never mounts, not merely missing text |
| 2 | slot-OR-slot gate (Table shape) — gated footer wrapper renders, filled + unfilled slots both correct | **FAILED** | same shape as #1 — `[data-testid="gated-footer-wrapper"]` is `null` |

Both suites fail exactly as this plan requires: the source-level proof pins the precise two-tier text
at all four call sites (three rewrite contexts, both real-world gate shapes), and the runtime proof
shows the wrapper ELEMENT is absent from the DOM — not merely its text — matching the D-10 confirmed
symptom exactly (Modal 2 emits no `<header>` element at all; Table's `<tfoot>` never appears).

**Command:** `pnpm exec vitest run --root tests/angular-runtime fixtures.compile`

```
Test Files  1 passed (1)
     Tests  8 passed (8)
```

The two new consumer fixtures (`ConsumerGatedProducerHeader`, `ConsumerGatedProducerTableFooter`) were
added to the hand-maintained consumer list and compile cleanly with no `ContentChild` capture for the
dynamic fill name — this suite does not assert fill-map-tier presence, so its pass here is expected and
does not weaken the RED proof above.

### Additivity check — the previously-green suites are untouched

`pnpm exec vitest run --root tests/angular-runtime` (full package, this commit):

```
Test Files  2 failed | 5 passed (7)
     Tests  2 failed | 177 passed (179)
```

The 177 tests the Plan 13 GREEN section recorded are still 177 green — the 2 new red tests
(`gatedProducerKeyedFill.test.ts`) are purely additive; `fixtures.compile.test.ts`'s 2 new cases (8
total, was 6) are green and additive too (179 = 177 + 2).

`pnpm exec vitest run --root packages/targets/angular` (full package, this commit):

```
Test Files  1 failed | 59 passed (60)
     Tests  7 failed | 653 passed | 1 todo (661)
```

Same additivity shape: 653 previously-passing tests (plus 1 pre-existing `todo`) are unaffected; only
the 7 new red `gatedSlotPresenceFillMap.test.ts` cases (of 8 total — 1 passes correctly, see table
above) are red.

### Scope check — nothing outside the new files changed

This plan's Task 1 commit contains only the three new fixtures
(`ProducerGatedStaticSlots.rozie`, `ConsumerGatedProducerHeader.rozie`,
`ConsumerGatedProducerTableFooter.rozie`), the two new test files
(`gatedSlotPresenceFillMap.test.ts`, `gatedProducerKeyedFill.test.ts`), the two-line addition to
`fixtures.compile.test.ts`'s hand-maintained consumer list, and this evidence section — no file under
`packages/targets/angular/src/rewrite`, no existing test file's assertions, no fixture snapshot, no
`.png` visual-regression baseline.

### Frozen-lockfile constraint

`pnpm install --frozen-lockfile` exits zero at this commit (verified before committing, no
`package.json`/lockfile changes in this plan at all) — the RED state trades away test-greenness for
these two new suites (plus the 2 additive cases in `fixtures.compile.test.ts`, which are green), not
lockfile installability, and not the greenness of any suite that was already passing.

### What happens next

This red state stays in git history unresolved by this task, by design. Task 2 is the emitter fix (a
new shared module, `packages/targets/angular/src/rewrite/buildSlotsMerge.ts`, replacing the three
duplicate builders); once it lands, these same two new files — unmodified — become the GREEN
observation for D-10's second incomplete-widening bug, mirroring the convention the two red-to-green
pairs above already established in this same file. **Do not "fix" these tests by loosening or removing
an assertion; the fix belongs in the emitter, not the test.**
