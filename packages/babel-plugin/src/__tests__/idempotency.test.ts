// Plan 06-04 Task 2 — mtime-idempotency (DIST-03 I1/I2/I3/I4).
//
// Per RESEARCH Pitfall 1 — atomic-save editor jitter on APFS/NFS can shift
// the new sibling's mtime SLIGHTLY backwards relative to the .rozie. The
// 100ms tolerance window in writeSiblingIfStale prevents that from looking
// like staleness.
//
// We use utimesSync to set mtimes deterministically rather than relying
// on Date.now() ordering (some Linux filesystems round to seconds; tests
// flake without explicit mtime control).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { transformAsync } from '@babel/core';
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import rozieBabelPlugin from '../index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(HERE, '../../../../examples');

describe('rozieBabelPlugin idempotency — mtime-based skip (DIST-03)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-babel-idem-'));
  });
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /** Helper: set mtime on a file to (now + offsetMs). */
  function setMtime(path: string, mtimeMs: number): void {
    const seconds = mtimeMs / 1000;
    utimesSync(path, seconds, seconds);
  }

  it('I1: idempotent skip — fresh sibling not recompiled (mtime stays put)', async () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    copyFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), roziePath);
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Counter from './Counter.rozie';\n", 'utf8');

    // First transform — emits sibling.
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const siblingPath = join(tmpDir, 'Counter.vue');
    const mtimeAfterFirst = statSync(siblingPath).mtimeMs;

    // Force the sibling to be 500ms newer than the .rozie so it's
    // unambiguously "fresh" (well outside the 100ms tolerance).
    const rozieMtimeMs = statSync(roziePath).mtimeMs;
    setMtime(siblingPath, rozieMtimeMs + 500);
    const mtimeBeforeSecond = statSync(siblingPath).mtimeMs;

    // Second transform — should skip compile + write.
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const mtimeAfterSecond = statSync(siblingPath).mtimeMs;

    // First write happened
    expect(mtimeAfterFirst).toBeGreaterThan(0);
    // Second invocation didn't re-write (mtime unchanged from manual setMtime)
    expect(mtimeAfterSecond).toBe(mtimeBeforeSecond);
  });

  it('I2: recompile when sibling is older than .rozie', async () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    copyFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), roziePath);
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Counter from './Counter.rozie';\n", 'utf8');

    // First transform — sibling exists.
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const siblingPath = join(tmpDir, 'Counter.vue');

    // Now simulate a user edit: bump the .rozie's mtime well into the
    // future (10s) and rewind the sibling 10s into the past — sibling
    // is now 20s older than .rozie, far outside tolerance.
    const baseMs = Date.now();
    setMtime(roziePath, baseMs);
    setMtime(siblingPath, baseMs - 20_000);
    const mtimeBefore = statSync(siblingPath).mtimeMs;

    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const mtimeAfter = statSync(siblingPath).mtimeMs;

    // mtime advanced — write happened.
    expect(mtimeAfter).toBeGreaterThan(mtimeBefore);
  });

  it('I3: 100ms tolerance window — sibling 50ms BEHIND rozie still considered fresh', async () => {
    // Simulate atomic-save jitter: sibling.mtimeMs = rozie.mtimeMs - 50.
    // Within the MTIME_TOLERANCE_MS=100 window → must NOT recompile.
    const roziePath = join(tmpDir, 'Counter.rozie');
    copyFileSync(resolve(EXAMPLES_DIR, 'Counter.rozie'), roziePath);
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Counter from './Counter.rozie';\n", 'utf8');

    // Initial pass to create the sibling.
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const siblingPath = join(tmpDir, 'Counter.vue');

    // Pin mtimes deterministically: rozie at T, sibling at T-50ms.
    const baseMs = Date.now();
    setMtime(roziePath, baseMs);
    setMtime(siblingPath, baseMs - 50);
    const mtimeBefore = statSync(siblingPath).mtimeMs;

    // Within tolerance → skip.
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const mtimeAfter = statSync(siblingPath).mtimeMs;

    expect(mtimeAfter).toBe(mtimeBefore);

    // Outside tolerance → recompile.
    setMtime(siblingPath, baseMs - 200);
    const mtimeBeforeOutOfTolerance = statSync(siblingPath).mtimeMs;
    await transformAsync(readFileSync(importer, 'utf8'), {
      filename: importer,
      plugins: [[rozieBabelPlugin, { target: 'vue' }]],
      babelrc: false,
      configFile: false,
    });
    const mtimeAfterOutOfTolerance = statSync(siblingPath).mtimeMs;
    expect(mtimeAfterOutOfTolerance).toBeGreaterThan(mtimeBeforeOutOfTolerance);
  });

  it('I4: compile error surfaces as ROZ822 Babel error', async () => {
    // Deliberately malformed .rozie that produces a parse-time severity:'error'
    // diagnostic. The <props> block syntax is broken (mismatched braces) which
    // hits SCRIPT_PARSE_ERROR / NOT_OBJECT_LITERAL territory.
    const roziePath = join(tmpDir, 'Bad.rozie');
    writeFileSync(
      roziePath,
      '<rozie name="Bad" />\n<props>\n{ invalid: ( garbage }\n</props>\n',
      'utf8',
    );
    const importer = join(tmpDir, 'consumer.ts');
    writeFileSync(importer, "import Bad from './Bad.rozie';\n", 'utf8');

    await expect(
      transformAsync(readFileSync(importer, 'utf8'), {
        filename: importer,
        plugins: [[rozieBabelPlugin, { target: 'vue' }]],
        babelrc: false,
        configFile: false,
      }),
    ).rejects.toThrow(/ROZ822/);
  });
});
