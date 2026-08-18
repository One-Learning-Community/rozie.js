/**
 * Phase 80 Plan 07 (Task 3) — the five SPEC prohibitions as standing
 * negative-assertion tests. Each describe block names the prohibition it
 * enforces so a future failure is self-explaining.
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

/** Every Angular fixture family this phase's Task 1 rebless touched. */
function listAngularFixtureFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', 'tests/dist-parity/fixtures/*.angular.ts', 'tests/slot-matrix/fixtures/*/expected.angular.ts', 'tests/regressions/fixtures/*/expected.angular.ts'],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return out.split('\n').filter((l) => l.length > 0);
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

describe('prohibition 2 — MUST NOT make @rozie/runtime-angular a dependency of Angular output that does not use record-path slots', () => {
  it('a zero-slot component (examples/Counter.rozie) emits no @rozie/runtime-angular import', () => {
    const code = compileAngular(readExample('Counter'), 'Counter.rozie');
    expect(code).not.toContain('@rozie/runtime-angular');
    expect(code).not.toContain('RozieSlot');
  });

  it('a component with only identifier-named static slots (ProducerIdentifierOnly) emits no @rozie/runtime-angular import', () => {
    const code = compileAngular(readFixture('ProducerIdentifierOnly'), 'ProducerIdentifierOnly.rozie');
    expect(code).not.toContain('@rozie/runtime-angular');
    expect(code).not.toContain('RozieSlot');
  });

  it('POSITIVE CONTROL: a record-path producer (ProducerRecordPath) DOES import @rozie/runtime-angular — proves the two negative assertions above are not vacuous', () => {
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

describe('prohibition 4 — MUST NOT alter emitted output for identifier-named static slot fills', () => {
  const files = listAngularFixtureFiles();

  it('discovers a non-trivial set of tracked Angular fixture files (sanity — a broken glob would make every case below vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(files.filter((f) => !RECORD_PATH_FIXTURES.includes(f)))(
    '%s is byte-identical to its content at the pre-fix baseline commit',
    (relPath) => {
      const current = readFileSync(join(REPO_ROOT, relPath), 'utf8');
      const baseline = readAtBaseline(relPath);
      // Fail with the offending path so a regression names itself, rather
      // than a generic "strings differ" assertion failure.
      if (current !== baseline) {
        throw new Error(`${relPath} drifted from the pre-fix baseline commit ${BASELINE_COMMIT} — this is out of scope for the record-path rewrite.`);
      }
      expect(current).toBe(baseline);
    },
  );
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
