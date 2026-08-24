/**
 * Phase 80 Plan 07 (Task 3) — the five SPEC prohibitions as standing
 * negative-assertion tests. Each describe block names the prohibition it
 * enforces so a future failure is self-explaining.
 *
 * Phase 80 Plan 12 (Task 3) — AMENDED prohibitions 2 and 4 for the D-09 fix
 * (the widened `hasKeyedFillIntake` gate — 80-CONTEXT.md D-09). Prohibition
 * 2's dependency boundary moved from "does NOT use record-path slots" to
 * "declares NO slots"; prohibition 4 split into 4a (RETAINED byte-identical:
 * @ContentChild path, per-slot context interfaces, consumer static filler
 * markup, static-content-child-leftmost precedence) and 4b, which for a time
 * carried a machine-checked inverse transform instead of whole-file
 * byte-identity. Quick task 260819-qo8 further extended that transform (the
 * `rozieDisplay`/`rozieAttr`/`rozieToken` move to `@rozie/runtime-angular`
 * imports).
 *
 * Quick task 260819-sg9 (Tier 2, Task 3 STEP 9-10) RETIRED the inverse
 * transform entirely and advanced `BASELINE_COMMIT` to this quick task's own
 * re-bless commit. Reasons (full rationale in that commit's message and the
 * plan's `<open_question_resolution>`): the transform had grown to 9
 * permitted differences across two amendments and each addition further
 * eroded real byte-comparison coverage over the tracked corpus (by the time
 * of retirement, 120 of 131 tracked 4b fixtures carried the applier body a
 * tenth extension would have had to re-fabricate rather than compare); the
 * transform's own doc comment stated its job was proving the widened intake
 * gate's insertions were *additive*, but Tier 2 is a *deletion* (the inlined
 * IIFE bodies leave the emitted text entirely), so extending the transform a
 * tenth time would have made the sibling `no-deletion` guard self-satisfying
 * rather than a real check. Prohibition 4b is now, once again, whole-file
 * byte-identity against `BASELINE_COMMIT` for every tracked fixture — the
 * baseline reset restores the original, strictly stronger form with zero
 * enumerated tolerances. Prohibition 5's machine-checkable half (the
 * `RECORD_PATH_FIXTURES` "must differ from baseline" list) is retired for
 * the same reason: at a fresh baseline nothing in the tracked corpus differs
 * from it by construction, so that half would be vacuously true. The
 * WORDING of prohibitions 1, 2, 3, 4a, and 5 is otherwise unaffected.
 *
 * Phase 81 Plan 06 advanced `BASELINE_COMMIT` again, to
 * `1b1d444cb2d23b022559d7b694df23b1394e8894` — the `pnpm --filter
 * dist-parity bootstrap` rebless commit that regenerated
 * `tests/dist-parity/fixtures/PropDocs.angular.ts` under the frozen 81-05
 * per-target `docs.example` renderer (its `@example` block now reads
 * `<rozie-prop-docs label="Save" />` instead of `<PropDocs label="Save" />`).
 * This IS the owed prohibition-5 hand-diff for this advance (performed, not
 * deferred again): `git diff --name-only 78d5b5b0c621dad0c6e0643204b0f15c040e739a
 * 1b1d444cb2d23b022559d7b694df23b1394e8894` scoped to the same three globs
 * `listAngularFixtureFiles()` below tracks (dist-parity fixtures, slot-matrix
 * expected-output fixtures, regressions expected-output fixtures) returned exactly one
 * path, `tests/dist-parity/fixtures/PropDocs.angular.ts`, out of 131 tracked
 * fixtures. That is precisely the fixture this phase's rebless was supposed
 * to touch (`PropDocs.rozie` is the only compiled fixture carrying a
 * `docs.example`) and nothing else in the tracked corpus silently drifted or
 * silently failed to change, despite several intervening emitter-adjacent
 * commits between the two baselines (e.g. `packages/targets/angular/src/emit/
 * emitScript.ts` and `emitTypes.ts` both changed in that range) — none of
 * those changes touched any byte this tracked corpus exercises, corroborated
 * independently by prohibition 4b itself passing 130/131 cases (the sole
 * failure being the one fixture this phase intentionally changed) BEFORE
 * this baseline advance landed. The freshly advanced baseline again makes
 * prohibition 5's machine-checkable half vacuous by construction; the next
 * advance owes this same by-hand diff.
 *
 * Quick task 260818-okc (Task 3) — GENERALIZES prohibition 1's source-level
 * case's region-discovery, defensively, ahead of a follow-up cold-rebuild
 * task. `ProducerRecordPath` is a MIXED producer (its plain `<slot>` mints a
 * `defaultTpl` @ContentChild field alongside its `:name`-bound record-path
 * slot), so once the emitter fix from 260818-okc lands in a rebuilt
 * `@rozie/target-angular` dist, this fixture's diagnostics gain a SECOND
 * dev-mode-guarded region (`ngAfterContentInit()`) alongside the existing
 * `effect()` — the old single-region form (isolate `effect(() => {` and
 * require every `console.` index to fall inside it) would fail against that
 * post-rebuild output, handing a latent breakage to the rebuild task. The
 * WORDING of prohibition 1 does NOT change (still: zero unguarded console
 * output in production builds) — only the region-DISCOVERY implementation
 * generalizes to find every guarded region instead of assuming exactly one.
 *
 * Quick task 260819-sg9 (Tier 2, Task 2) AMENDED prohibition 2 again — see
 * that describe block's own comment for the full account.
 *
 * Ambient globals (`describe`, `it`, `expect`, `vi`) per setup-vitest.ts —
 * do NOT `import { describe, it, expect } from 'vitest'` here.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestBed } from '@angular/core/testing';
import { compileAngular } from './compileAngular';
import { ConsumerDuplicateRuntimeKeys } from './fixtures/ConsumerDuplicateRuntimeKeys.rozie';
import { ensureTestBedInit } from './testBedInit';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '../..');
const FIXTURES_DIR = join(HERE, 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, `${name}.rozie`), 'utf8');
}

function readExample(name: string): string {
  return readFileSync(join(REPO_ROOT, 'examples', `${name}.rozie`), 'utf8');
}

/**
 * The byte-identity baseline for every tracked Angular fixture (prohibition
 * 4b). Advanced by Phase 81 Plan 06 to that plan's own `dist-parity
 * bootstrap` re-bless commit — see the header comment above for the owed
 * prohibition-5 hand-diff performed at this advance, and for why this could
 * not be set until AFTER that commit existed (the SHA is unknowable before
 * the commit it names). Previously advanced by Quick task 260819-sg9 (Tier
 * 2, Task 3 STEP 10).
 */
// NOTE: reading this commit requires real git history. CI must check out with
// `fetch-depth: 0` — actions/checkout's default depth-1 shallow clone does not
// contain this object, and every gate below then fails with
// "Command failed: git show …" (134 of 144 tests, one root cause). The
// angular-matrix workflow sets it explicitly; keep them in sync.
const BASELINE_COMMIT = '1b1d444cb2d23b022559d7b694df23b1394e8894';

/** `git show <commit>:<path>` — throws if the path did not exist at that commit. */
function readAtBaseline(relPath: string): string {
  return execFileSync('git', ['show', `${BASELINE_COMMIT}:${relPath}`], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

/**
 * Every Angular fixture family this phase's rebless passes touched.
 *
 * Phase 80 Plan 12 — widened the slot-matrix glob from
 * `expected.angular.ts` to `expected*.angular.ts` so it also catches
 * `expected.wrapper.angular.ts` (the `consumer-re-projection` wrapper
 * fixture, which the D-09 widening also drifted — a real tracked fixture
 * this sweep previously silently skipped by filename shape, not by design).
 */
function listAngularFixtureFiles(): string[] {
  const out = execFileSync(
    'git',
    [
      'ls-files',
      'tests/dist-parity/fixtures/*.angular.ts',
      'tests/slot-matrix/fixtures/*/expected*.angular.ts',
      'tests/regressions/fixtures/*/expected.angular.ts',
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter((l) => l.length > 0);
}

/**
 * Quick task 260818-okc (Task 3) — the GENERALIZED region-discovery helper
 * for prohibition 1's source-level case. Finds every occurrence of the
 * shared `ngDevMode` guard text — each occurrence begins a dev-mode-guarded
 * region, whether that region is an `effect(() => { ... });` arrow body or a
 * bare `ngAfterContentInit() { ... }` method body (or any future
 * dev-mode-guarded shape sharing the same guard text). Does not attempt to
 * locate each region's closing brace: by construction, every `console.` call
 * this emitter produces is the FIRST guard-protected statement's sibling
 * inside its own region, and no unguarded `console.` call is ever emitted
 * between two regions — so "at least one guard occurrence precedes this
 * console. call, in source order" is a sufficient, shape-agnostic
 * region-membership test without hardcoding either header text.
 */
function findGuardOccurrences(code: string): number[] {
  const guardText = 'globalThis as { ngDevMode?: unknown }';
  const idxs: number[] = [];
  let idx = code.indexOf(guardText);
  while (idx !== -1) {
    idxs.push(idx);
    idx = code.indexOf(guardText, idx + guardText.length);
  }
  return idxs;
}

describe('prohibition 1 — MUST NOT emit console output from compiled components in production builds', () => {
  it('source-level: every `console.` occurrence in the emitted record-path producer sits inside a dev-mode-guarded region, with the guard preceding it in source order — GENERALIZED to discover ALL such regions (was: isolated the single effect() block; see the doc comment above this describe block for why ProducerRecordPath specifically needs this)', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    const guardIdxs = findGuardOccurrences(code);
    expect(guardIdxs.length).toBeGreaterThan(0);

    const consoleOccurrences: number[] = [];
    let idx = code.indexOf('console.');
    while (idx !== -1) {
      consoleOccurrences.push(idx);
      idx = code.indexOf('console.', idx + 1);
    }
    expect(consoleOccurrences.length).toBeGreaterThan(0);
    for (const occ of consoleOccurrences) {
      const precedingGuards = guardIdxs.filter((g) => g < occ);
      expect(precedingGuards.length).toBeGreaterThan(0);
    }
  });

  it('behavioral: mounting the duplicate-runtime-key consumer with dev mode OFF produces zero console output (DESIRED post-fix — blocked by OPEN RISK R-80-NG0203 today)', () => {
    const g = globalThis as { ngDevMode?: unknown };
    const prevDevMode = g.ngDevMode;
    g.ngDevMode = false;
    try {
      ensureTestBedInit();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [ConsumerDuplicateRuntimeKeys] });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const fixture = TestBed.createComponent(ConsumerDuplicateRuntimeKeys);
      fixture.detectChanges();

      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();

      warnSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
      fixture.destroy();
    } finally {
      g.ngDevMode = prevDevMode;
    }
  });
});

// Phase 80 Plan 12 — AMENDED (D-09 fix, 80-CONTEXT.md D-09, SPEC prohibition
// #2 amendment). OLD wording: "MUST NOT make @rozie/runtime-angular a
// dependency of Angular output that does NOT use record-path slots" — this
// tied the dependency boundary to how a producer named its OWN slots
// (identifier vs. record-only), which is exactly the accidental coupling
// that silently dropped a consumer's dynamic `#[expr]` fill whenever its
// target producer's own slots happened to be static identifier names
// (deferred-items.md #3, the D-09 regression this whole plan closes). NEW
// wording: "MUST NOT make @rozie/runtime-angular a dependency of Angular
// output that declares NO slots" — the boundary is now `ir.slots.length >
// 0` (the SAME gate that already governed the `templates` input), so the
// runtime dependency tracks "does this component participate in slot
// filling at all," not "what shape are its own slot names." The
// `ProducerIdentifierOnly` case below INVERTS from a negative assertion
// (Plan 07) to a positive control (Plan 12) for exactly this reason — it
// is no longer on the safe side of the boundary, and pinning it as a
// negative would silently re-encode the bug this plan fixed.
// Quick task 260819-sg9 (Tier 2) — AMENDED AGAIN. `createRozieAttrApplier`/
// `createRozieHostAttrsReader` widened the `@rozie/runtime-angular` import
// gate beyond slots: ANY component whose single-root template gets the
// default `inherit-attrs` auto-fallthrough `$attrs` spread now ALSO
// references the runtime package, regardless of whether it declares slots.
// `examples/Counter.rozie` is zero-slot but IS single-root with default
// `inherit-attrs`, so it legitimately gains the spread factories — the
// prior "SOLE remaining negative boundary" framing no longer holds for
// Counter. The prohibition's SUBJECT (the SLOT dependency boundary — "output
// that declares NO slots must not depend on the slot machinery") is
// untouched; only Counter's role as a package-level control is retired.
// Split into two boundaries: Counter narrows to the SLOT-machinery-specific
// assertion (no RozieSlot, no contentChildren), and
// `examples/ROnProbe.rozie` (`inherit-attrs="false"` + no spread) becomes
// the PACKAGE-LEVEL boundary — a component using none of the runtime
// package's exports at all.
describe('prohibition 2 — AMENDED: MUST NOT make @rozie/runtime-angular a dependency of Angular output that declares NO slots', () => {
  it('a zero-slot component (examples/Counter.rozie) emits no slot-machinery reference — the SLOT dependency boundary (it now legitimately imports the spread factories via the default $attrs auto-fallthrough, unrelated to slots)', () => {
    const code = compileAngular(readExample('Counter'), 'Counter.rozie');
    expect(code).not.toContain('RozieSlot');
    expect(code).not.toContain('contentChildren(');
    // Package-level note, not a boundary assertion: Counter DOES reference
    // @rozie/runtime-angular now (the spread factories), which is why it can
    // no longer serve as the package-level control below.
    expect(code).toContain('@rozie/runtime-angular');
  });

  it('a genuinely no-runtime-package component (examples/ROnProbe.rozie, inherit-attrs="false", no slots, no spread) emits no reference to @rozie/runtime-angular at all — the PACKAGE-LEVEL boundary', () => {
    const code = compileAngular(readExample('ROnProbe'), 'ROnProbe.rozie');
    expect(code).not.toContain('@rozie/runtime-angular');
  });

  it("POSITIVE CONTROL (inverted from Plan 07's negative): a component with only identifier-named static slots (ProducerIdentifierOnly) legitimately DOES import @rozie/runtime-angular under the amended, widened intake gate", () => {
    const code = compileAngular(
      readFixture('ProducerIdentifierOnly'),
      'ProducerIdentifierOnly.rozie',
    );
    expect(code).toMatch(/import \{[^}]*\bRozieSlot\b[^}]*\} from '@rozie\/runtime-angular';/);
    expect(code).toContain('contentChildren(RozieSlot');
  });

  it('POSITIVE CONTROL: a record-path producer (ProducerRecordPath) DOES import @rozie/runtime-angular — proves the zero-slot negative assertion above is not vacuous', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    expect(code).toMatch(/import \{[^}]*\bRozieSlot\b[^}]*\} from '@rozie\/runtime-angular';/);
  });
});

describe("prohibition 3 — MUST NOT remove, narrow, or silently retype the producer's `templates` input", () => {
  it('the emitted record-path producer still declares the exact pre-phase `templates` signal input text', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    // Read verbatim from emitScript.ts rather than paraphrasing (per Task 3's
    // explicit instruction) — packages/targets/angular/src/emit/emitScript.ts:1271.
    expect(code).toContain(
      'templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);',
    );
  });
});

describe('prohibition 4a — RETAINED byte-identical: @ContentChild declaration path, per-slot context interfaces, consumer static filler markup, static-content-child-leftmost precedence', () => {
  const files = listAngularFixtureFiles();

  it('discovers a non-trivial set of tracked Angular fixture files (sanity — a broken glob would make every case below vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('the identifier-only producer keeps its exact pre-fix @ContentChild declarations and per-slot context interfaces — what prohibition 4 was really protecting, unaffected by the 4b amendment', () => {
    const code = compileAngular(
      readFixture('ProducerIdentifierOnly'),
      'ProducerIdentifierOnly.rozie',
    );
    expect(code).toContain(
      "@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;",
    );
    expect(code).toContain(
      "@ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;",
    );
    expect(code).toMatch(/interface HeaderCtx\b/);
    expect(code).toMatch(/interface FooterCtx\b/);
  });

  it('static content-child stays the LEFTMOST operand in the amended three-tier resolution chain (D-02 invariant, unaffected by the 4b amendment)', () => {
    const code = compileAngular(
      readFixture('ProducerIdentifierOnly'),
      'ProducerIdentifierOnly.rozie',
    );
    const match = code.match(
      /\*ngTemplateOutlet="\((\w+Tpl)\s*\?\?\s*__rozieFillMap\(\)\['([^']+)'\]\s*\?\?\s*templates\(\)\?\.\['([^']+)'\]\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe('headerTpl');
    expect(match![2]).toBe('header');
  });

  it("a real consumer's plain static named fill (ModalConsumer's Modal 1 #header) still emits the exact pre-fix filler markup — an <ng-template #name> projection, never a [rozieSlot] marker; this fixture is NOT in this plan's own rebless set (verified: it never appears in the 42-file Task 2 commit), so its unchanged form IS the 4a control", () => {
    const code = readFileSync(
      join(REPO_ROOT, 'tests/dist-parity/fixtures/ModalConsumer.angular.ts'),
      'utf8',
    );
    expect(code).toContain('<ng-template #header let-close="close">');
    expect(code).not.toMatch(/#header[^>]*\[rozieSlot\]/);
  });
});

// Quick task 260819-sg9 (Tier 2, Task 3 STEP 9-10) — RETIRED the machine-
// checked inverse transform Phase 80 Plan 12 introduced (and Quick task
// 260819-qo8 extended). See this file's header comment for the full
// rationale. Prohibition 4b is restored to its ORIGINAL, strictly stronger
// form: whole-file byte-identity against `BASELINE_COMMIT` for every tracked
// non-record-path Angular fixture, no enumerated tolerances. The advanced
// baseline (this quick task's own re-bless commit) already reflects every
// legitimate emitter change up to and including this quick task, so there
// is no longer a "record path" carve-out to maintain here — every tracked
// fixture is checked, unconditionally.
describe('prohibition 4b — the emitted Angular fixture is byte-identical to BASELINE_COMMIT (RESTORED from the retired 260819-qo8/Phase-80-Plan-12 inverse-transform amendment)', () => {
  const files = listAngularFixtureFiles();

  it.each(files)('%s: byte-identical to the baseline commit', (relPath) => {
    const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
    const baseline = readAtBaseline(relPath);
    if (current !== baseline) {
      throw new Error(
        `${relPath}: not byte-identical to BASELINE_COMMIT (${BASELINE_COMMIT}) — a real emitted-output regression, or BASELINE_COMMIT needs advancing again after a deliberate emitter change.`,
      );
    }
    expect(current).toBe(baseline);
  });
});

describe('prohibition 5 — MUST NOT re-bless a fixture without a behavioral assertion establishing the new bytes are correct', () => {
  // This prohibition routes to JUDGMENT and cannot be fully automated (SPEC's
  // explicit verification: judgment). The judgment half — each rebless
  // citing the runtime test or precedence check that proves its new bytes —
  // lives in the commit message of whichever change re-blessed the fixture,
  // and is reviewed there, not here.
  //
  // Quick task 260819-sg9 (Tier 2, Task 3 STEP 9-10) RETIRED the
  // machine-checkable half (the `RECORD_PATH_FIXTURES` "must differ from
  // baseline" list) alongside the `BASELINE_COMMIT` advance: at a freshly
  // advanced baseline, every tracked fixture is (by construction, per
  // prohibition 4b above) byte-identical to that baseline, so a "must
  // differ from baseline" assertion would be vacuously true for the entire
  // corpus — not a real check. This is a genuine loss of automated coverage
  // for the specific failure mode "an emitter change should have touched
  // this fixture but silently didn't" — that check must be re-established
  // BY HAND against the NEXT baseline advance (diff the two baseline commits
  // and confirm every fixture the change was supposed to touch actually
  // changed), not assumed to still be running here.
  it('the machine-checkable half of this prohibition is retired at the current BASELINE_COMMIT — see the doc comment above for why, and re-establish it by hand at the next baseline advance', () => {
    expect(true).toBe(true);
  });
});
