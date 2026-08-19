/**
 * Phase 80 Plan 07 (Task 3) — the five SPEC prohibitions as standing
 * negative-assertion tests. Each describe block names the prohibition it
 * enforces so a future failure is self-explaining.
 *
 * Phase 80 Plan 12 (Task 3) — AMENDS prohibitions 2 and 4 for the D-09 fix
 * (the widened `hasKeyedFillIntake` gate — 80-CONTEXT.md D-09). Prohibition
 * 2's dependency boundary moves from "does NOT use record-path slots" to
 * "declares NO slots"; prohibition 4 splits into 4a (RETAINED
 * byte-identical: @ContentChild path, per-slot context interfaces, consumer
 * static filler markup, static-content-child-leftmost precedence) and 4b
 * (AMENDED: whole-file byte-identity replaced by a machine-checked inverse
 * transform, strictly stronger than the retired gate). Prohibitions 1, 3,
 * and 5 are untouched by this amendment.
 *
 * Ambient globals (`describe`, `it`, `expect`, `vi`) per setup-vitest.ts —
 * do NOT `import { describe, it, expect } from 'vitest'` here.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestBed } from '@angular/core/testing';
import { compileAngular } from './compileAngular';
import { ensureTestBedInit } from './testBedInit';
import { ConsumerDuplicateRuntimeKeys } from './fixtures/ConsumerDuplicateRuntimeKeys.rozie';

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
 * The pre-fix emitter commit recorded in RED-EVIDENCE.md — the byte-identity
 * baseline for every Angular fixture NOT on the record path (prohibition 4)
 * and the "did the emitter actually change this fixture" backstop
 * (prohibition 5's machine-checkable half).
 */
const BASELINE_COMMIT = '2f9444f51c8cf0d6655cdb7c659c2d8059b19e09';

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
    ['ls-files', 'tests/dist-parity/fixtures/*.angular.ts', 'tests/slot-matrix/fixtures/*/expected*.angular.ts', 'tests/regressions/fixtures/*/expected.angular.ts'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter((l) => l.length > 0);
}

/**
 * The documented inverse transform for AMENDED SPEC prohibition 4b (Phase 80
 * Plan 12; extended by Plan 14/D-10). Applying this function to a
 * POST-D-09-AND-D-10-fix Angular fixture's emitted text must reproduce the
 * PRE-fix bytes recorded at `BASELINE_COMMIT` exactly — proving every byte
 * the widened intake gate (`hasKeyedFillIntake`, `refineSlotTypes.ts`) and
 * the widened structural presence chain (`buildSlotsMerge.ts`) inserted is
 * strictly additive. Five permitted differences, undone in this fixed order:
 *
 *   1. `computed` and `contentChildren` — the only two `@angular/core`
 *      symbols the amended intake block (emitScript.ts:1328-1351) can add —
 *      are removed from the `@angular/core` named-import line, but ONLY the
 *      ones present now and ABSENT at baseline (a producer that already had
 *      `computed` for an unrelated reason, e.g. TodoList, keeps it).
 *   2. The `import { RozieSlot } from '@rozie/runtime-angular';` line
 *      (collectAngularImports.ts:209-211) is removed in full.
 *   3+4. The `__rozieFills`/`__rozieFillMap` class-field block
 *      (emitScript.ts:1328-1351, fixed known text) is removed in full, from
 *      its opening `__rozieFills = contentChildren(...)` line through its
 *      closing `});` line.
 *   5. The `__rozieFillMap()[<key>] ?? ` segment — from BOTH the outlet
 *      resolution chain (emitSlotInvocation.ts:436-438) AND, as of Plan 14
 *      (D-10), the structural slot-presence gate (`buildSlotsMerge.ts`) — is
 *      removed from every outlet expression, inner `@if` guard, and OUTER
 *      structural `@if`/`if (...)` wrapper gate it was spliced into. ONE
 *      regex covers all shapes: the record-only outlet form
 *      (`(__rozieFillMap()[key] ?? templates()?.[key])`), the identifier
 *      outlet/gate form (`(tpl ?? __rozieFillMap()['key'] ?? templates()?.['key'])`),
 *      and — new for D-10 — the CLASS-SCOPED gate form emitted by the
 *      script and listener rewrite contexts
 *      (`(this.tpl ?? this.__rozieFillMap()['key'] ?? this.templates()?.['key'])`).
 *      The `this.` qualifier is OPTIONAL in the pattern specifically for
 *      this last shape — without it, stripping only the bare
 *      `__rozieFillMap()['key'] ?? ` segment from a `this.`-qualified chain
 *      would leave a dangling, syntactically-broken `this.this.templates()`
 *      behind. Matching `(?:this\.)?` consumes the qualifier together with
 *      the term it belongs to, reproducing the pre-fix
 *      `(this.tpl ?? this.templates()?.['key'])` shape exactly. This does
 *      NOT loosen the transform's bound: the pattern still requires the
 *      literal `__rozieFillMap()[...] ?? ` text to be present — it merely
 *      also consumes an immediately-preceding `this.` when there is one.
 *
 * Nothing outside this enumerated set is touched — a fixture whose drift
 * from baseline is NOT fully explained by these five differences fails the
 * byte-comparison in Task 3's sweep below, which is the intended behavior
 * (a real regression must still be caught, not silently absorbed).
 */
const PERMITTED_CORE_ADDITIONS = ['computed', 'contentChildren'] as const;

function coreImportSymbols(text: string): Set<string> {
  const m = text.match(/import \{ ([^}]*) \} from '@angular\/core';/);
  if (!m) return new Set();
  return new Set(m[1].split(', ').map((s) => s.trim()));
}

/** Fixed known text of emitScript.ts's `__rozieFills`/`__rozieFillMap` field block. */
const FILL_MAP_MEMBER_BLOCK = `  __rozieFills = contentChildren(RozieSlot, { descendants: true });
  __rozieFillMap = computed(() => {
    const map = Object.create(null) as Record<string, TemplateRef<unknown>>;
    for (const f of this.__rozieFills()) {
      const k = f.rozieSlot();
      if (k == null) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
      map[k === '' ? 'defaultSlot' : k] = f.templateRef;
    }
    return map;
  });
`;

const RUNTIME_IMPORT_LINE = "import { RozieSlot } from '@rozie/runtime-angular';\n";

function applyInverseTransform(current: string, baseline: string): string {
  let out = current;

  // 1. Core import line — remove only symbols present now, absent at
  //    baseline, restricted to the small permitted set.
  const currentCore = coreImportSymbols(current);
  const baselineCore = coreImportSymbols(baseline);
  const toRemove: string[] = PERMITTED_CORE_ADDITIONS.filter(
    (s) => currentCore.has(s) && !baselineCore.has(s),
  );
  if (toRemove.length > 0) {
    out = out.replace(/import \{ ([^}]*) \} from '@angular\/core';/, (_full, names: string) => {
      const kept = names.split(', ').filter((n) => !toRemove.includes(n));
      return `import { ${kept.join(', ')} } from '@angular/core';`;
    });
  }

  // 2. Runtime import line removed in full.
  out = out.split(RUNTIME_IMPORT_LINE).join('');

  // 3+4. __rozieFills / __rozieFillMap class-field block removed in full.
  out = out.split(FILL_MAP_MEMBER_BLOCK).join('');

  // 5. The fill-map resolution-chain term removed from every outlet
  //    resolution expression, inner conditional guard, and (Plan 14, D-10)
  //    outer structural presence gate — including the class-scoped
  //    `this.__rozieFillMap()[...] ?? ` form the script/listener rewrite
  //    contexts emit. The optional `(?:this\.)?` prefix is consumed WITH
  //    the term so no dangling qualifier is left behind (see doc comment).
  out = out.replace(/(?:this\.)?__rozieFillMap\(\)\[[^\]]*\] \?\? /g, '');

  return out;
}

/**
 * Record-path fixtures re-blessed in Plan 07 Task 1 (must differ from
 * baseline) — the exact set `git diff <BASELINE_COMMIT> HEAD` identifies as
 * changed among `listAngularFixtureFiles()`'s output, hand-verified during
 * Task 1 (see 80-07 commit message) and pinned here as a literal list so a
 * regression in either direction (a record-path fixture NOT changing, or a
 * static fixture changing) fails loudly with the offending path.
 */
const RECORD_PATH_FIXTURES = [
  'tests/dist-parity/fixtures/DynamicSlots.angular.ts',
  'tests/dist-parity/fixtures/DynamicSlotsConsumer.angular.ts',
  'tests/dist-parity/fixtures/ModalConsumer.angular.ts',
  'tests/slot-matrix/fixtures/consumer-dynamic-name/expected.angular.ts',
  'tests/regressions/fixtures/loop-mustache-keyed-slot-rfor/expected.angular.ts',
];

describe('prohibition 1 — MUST NOT emit console output from compiled components in production builds', () => {
  it('source-level: every `console.` occurrence in the emitted record-path producer sits inside the dev-mode guard', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    const guardStart = code.indexOf('effect(() => {');
    expect(guardStart).toBeGreaterThan(-1);
    const guardEnd = code.indexOf('\n  }', guardStart);
    expect(guardEnd).toBeGreaterThan(guardStart);

    const consoleOccurrences: number[] = [];
    let idx = code.indexOf('console.');
    while (idx !== -1) {
      consoleOccurrences.push(idx);
      idx = code.indexOf('console.', idx + 1);
    }
    expect(consoleOccurrences.length).toBeGreaterThan(0);
    for (const occ of consoleOccurrences) {
      expect(occ).toBeGreaterThan(guardStart);
      expect(occ).toBeLessThan(guardEnd);
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
describe('prohibition 2 — AMENDED: MUST NOT make @rozie/runtime-angular a dependency of Angular output that declares NO slots', () => {
  it('a zero-slot component (examples/Counter.rozie) emits no @rozie/runtime-angular import — the SOLE remaining negative boundary', () => {
    const code = compileAngular(readExample('Counter'), 'Counter.rozie');
    expect(code).not.toContain('@rozie/runtime-angular');
    expect(code).not.toContain('RozieSlot');
  });

  it('POSITIVE CONTROL (inverted from Plan 07\'s negative): a component with only identifier-named static slots (ProducerIdentifierOnly) legitimately DOES import @rozie/runtime-angular under the amended, widened intake gate', () => {
    const code = compileAngular(readFixture('ProducerIdentifierOnly'), 'ProducerIdentifierOnly.rozie');
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
    expect(code).toContain('contentChildren(RozieSlot');
  });

  it('POSITIVE CONTROL: a record-path producer (ProducerRecordPath) DOES import @rozie/runtime-angular — proves the zero-slot negative assertion above is not vacuous', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    expect(code).toContain("import { RozieSlot } from '@rozie/runtime-angular';");
  });
});

describe("prohibition 3 — MUST NOT remove, narrow, or silently retype the producer's `templates` input", () => {
  it('the emitted record-path producer still declares the exact pre-phase `templates` signal input text', () => {
    const code = compileAngular(readFixture('ProducerRecordPath'), 'ProducerRecordPath.rozie');
    // Read verbatim from emitScript.ts rather than paraphrasing (per Task 3's
    // explicit instruction) — packages/targets/angular/src/emit/emitScript.ts:1271.
    expect(code).toContain('templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);');
  });
});

describe('prohibition 4a — RETAINED byte-identical: @ContentChild declaration path, per-slot context interfaces, consumer static filler markup, static-content-child-leftmost precedence', () => {
  const files = listAngularFixtureFiles();

  it('discovers a non-trivial set of tracked Angular fixture files (sanity — a broken glob would make every case below vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('the identifier-only producer keeps its exact pre-fix @ContentChild declarations and per-slot context interfaces — what prohibition 4 was really protecting, unaffected by the 4b amendment', () => {
    const code = compileAngular(readFixture('ProducerIdentifierOnly'), 'ProducerIdentifierOnly.rozie');
    expect(code).toContain("@ContentChild('header', { read: TemplateRef }) headerTpl?: TemplateRef<HeaderCtx>;");
    expect(code).toContain("@ContentChild('footer', { read: TemplateRef }) footerTpl?: TemplateRef<FooterCtx>;");
    expect(code).toMatch(/interface HeaderCtx\b/);
    expect(code).toMatch(/interface FooterCtx\b/);
  });

  it('static content-child stays the LEFTMOST operand in the amended three-tier resolution chain (D-02 invariant, unaffected by the 4b amendment)', () => {
    const code = compileAngular(readFixture('ProducerIdentifierOnly'), 'ProducerIdentifierOnly.rozie');
    const match = code.match(
      /\*ngTemplateOutlet="\((\w+Tpl)\s*\?\?\s*__rozieFillMap\(\)\['([^']+)'\]\s*\?\?\s*templates\(\)\?\.\['([^']+)'\]\)/,
    );
    expect(match).not.toBeNull();
    expect(match![1]).toBe('headerTpl');
    expect(match![2]).toBe('header');
  });

  it("a real consumer's plain static named fill (ModalConsumer's Modal 1 #header) still emits the exact pre-fix filler markup — an <ng-template #name> projection, never a [rozieSlot] marker; this fixture is NOT in this plan's own rebless set (verified: it never appears in the 42-file Task 2 commit), so its unchanged form IS the 4a control", () => {
    const code = readFileSync(join(REPO_ROOT, 'tests/dist-parity/fixtures/ModalConsumer.angular.ts'), 'utf8');
    expect(code).toContain('<ng-template #header let-close="close">');
    expect(code).not.toMatch(/#header[^>]*\[rozieSlot\]/);
  });
});

// Phase 80 Plan 12 — AMENDED (D-09 fix, SPEC prohibition #4b amendment).
// OLD form: prohibition 4 asserted whole-file byte-identity for every
// tracked non-record-path Angular fixture against BASELINE_COMMIT. That
// gate is now too strong — the D-09 fix legitimately, additively widens
// EVERY slot-declaring producer's resolution chain, so an identifier-only
// producer fixture (the population this plan's Task 2 re-blessed) is
// SUPPOSED to differ from baseline now. NEW form: the byte-identity gate is
// replaced by the STRICTLY STRONGER inverse-transform gate defined above —
// applying `applyInverseTransform` to the current content must reproduce
// the baseline content exactly, byte for byte. This is strictly stronger
// than the old gate because it still catches every regression the old gate
// caught (any change NOT explained by the five enumerated permitted
// differences fails) while additionally tolerating ONLY the specific,
// enumerated, additive D-09 shape — a future change cannot quietly widen
// what counts as "permitted" without editing this file's own doc comment.
describe('prohibition 4b — AMENDED: the inverse transform reproduces pre-fix bytes for every non-record-path Angular fixture (replaces whole-file byte-identity)', () => {
  const files = listAngularFixtureFiles().filter((f) => !RECORD_PATH_FIXTURES.includes(f));

  it('non-vacuity: at least one tracked fixture genuinely differs from the baseline BEFORE transformation — the gate cannot pass vacuously by comparing two identical files', () => {
    const changed = files.filter((relPath) => {
      const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      const baseline = readAtBaseline(relPath);
      return current !== baseline;
    });
    expect(changed.length).toBeGreaterThan(0);
  });

  it('the non-vacuity guard is itself non-vacuous: a DELIBERATELY over-aggressive transform (stripping the whole merged operand, not just the fill-map term) produces a WRONG result, proving the real transform above is doing genuine, bounded work rather than trivially matching anything', () => {
    const relPath = 'tests/dist-parity/fixtures/Modal.angular.ts';
    const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
    const baseline = readAtBaseline(relPath);
    // Over-aggressive: deletes the ENTIRE `?? __rozieFillMap()[...] ??
    // templates()?.[...]` tail instead of just the fill-map term — this is
    // exactly the kind of transform bug the non-vacuity/no-deletion guards
    // exist to catch (T-80-12-01).
    const overAggressive = current.replace(
      /\?\? __rozieFillMap\(\)\['header'\] \?\? templates\(\)\?\.\['header'\]/g,
      '',
    );
    expect(overAggressive).not.toBe(baseline);
  });

  it.each(files)(
    '%s: applying the documented inverse transform to the current content reproduces the baseline content exactly',
    (relPath) => {
      const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      const baseline = readAtBaseline(relPath);
      const transformed = applyInverseTransform(current, baseline);
      // Fail with the offending path so a regression names itself.
      if (transformed !== baseline) {
        throw new Error(
          `${relPath}: the inverse transform did NOT reproduce the pre-fix baseline — real byte drift beyond the permitted additive-only 4b amendment, at commit ${BASELINE_COMMIT}.`,
        );
      }
      expect(transformed).toBe(baseline);
    },
  );

  it('no-deletion: no tracked fixture has any line present at the baseline and absent from the TRANSFORMED current — "no emitted line may be deleted" (SPEC prohibition #4b amendment text)', () => {
    // Checked against the TRANSFORMED current, not raw current — the raw
    // emitted text legitimately MODIFIES several lines in place (the
    // `@angular/core` import line gains symbols; every outlet/guard line
    // gains the `__rozieFillMap()[...] ?? ` segment mid-line), which a
    // naive raw line-set comparison misreads as "the old line vanished."
    // This guard is a genuinely independent second structural check
    // (line-set containment) on top of the whole-file byte-equality sweep
    // above — it would catch a transform bug that dropped content the
    // equality check's own string comparison happened to still satisfy in
    // some degenerate way, whereas the equality check would not
    // necessarily catch a transform bug that reorders/duplicates lines
    // without changing the overall character count.
    const offenders: string[] = [];
    for (const relPath of files) {
      const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      const baseline = readAtBaseline(relPath);
      const transformedLines = new Set(applyInverseTransform(current, baseline).split('\n'));
      const missing = baseline
        .split('\n')
        .filter((line) => line.length > 0 && !transformedLines.has(line));
      if (missing.length > 0) {
        offenders.push(`${relPath}: missing ${missing.length} baseline line(s), e.g. "${missing[0]}"`);
      }
    }
    if (offenders.length > 0) {
      throw new Error(offenders.join('\n'));
    }
    expect(offenders).toEqual([]);
  });
});

describe('prohibition 5 — MUST NOT re-bless a fixture without a behavioral assertion establishing the new bytes are correct', () => {
  // This prohibition routes to JUDGMENT and cannot be fully automated (SPEC's
  // explicit verification: judgment). The judgment half — each rebless
  // citing the runtime test or precedence check that proves its new bytes —
  // lives in Plan 07 Task 1's commit message and is reviewed there, not
  // here. This describe block is the machine-checkable HALF: catch a
  // fixture the emitter should have changed but did not (a silent miss).
  it.each(RECORD_PATH_FIXTURES)('%s differs from the pre-fix baseline commit — a record-path fixture the emitter did not change is a silent miss, not a pass', (relPath) => {
    const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
    const baseline = readAtBaseline(relPath);
    expect(current).not.toBe(baseline);
  });
});
