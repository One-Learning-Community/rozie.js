/**
 * D-70 disk-cache prebuild tests (Plan 05-04b deferred follow-up).
 *
 * Covers the `.rozie` → `.rozie.ts` on-disk emit helpers:
 *
 *   - `emitRozieTsToDisk(roziePath, registry)` — synthesises a single file's
 *     output and writes the `.rozie.ts` sibling next to it.
 *   - `prebuildAngularRozieFiles(rootDir, registry)` — recursive scan over
 *     `rootDir`, writing every `.rozie` it finds to its sibling `.rozie.ts`.
 *   - HMR re-emit semantics: re-running the helper with unchanged source
 *     skips the write (no-op when content is identical).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  emitRozieTsToDisk,
  prebuildAngularRozieFiles,
} from '../transform.js';
import { ModifierRegistry } from '../../../core/src/modifiers/ModifierRegistry.js';
import { registerBuiltins } from '../../../core/src/modifiers/registerBuiltins.js';

function makeRegistry(): ModifierRegistry {
  const r = new ModifierRegistry();
  registerBuiltins(r);
  return r;
}

const COUNTER_ROZIE = `<rozie name="Counter">
<props>
{ value: { type: Number, default: 0, model: true } }
</props>
<template>
<button class="counter">{{ $props.value }}</button>
</template>
</rozie>
`;

describe('D-70 disk-cache: emitRozieTsToDisk', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-d70-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes Foo.rozie.ts next to Foo.rozie', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitRozieTsToDisk(roziePath, makeRegistry());
    expect(outPath).toBe(roziePath + '.ts');
    expect(existsSync(outPath)).toBe(true);
    const code = readFileSync(outPath, 'utf8');
    expect(code).toContain("from '@angular/core'");
    expect(code).toContain('@Component');
    expect(code).toContain("selector: 'rozie-counter'");
  });

  it('skips re-write when emitted content is byte-identical (HMR no-op)', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitRozieTsToDisk(roziePath, makeRegistry());
    const firstMtime = statSync(outPath).mtimeMs;
    // Wait at least one millisecond so a real write would advance mtime.
    const start = Date.now();
    while (Date.now() === start) {
      // busy-spin a single tick
    }
    emitRozieTsToDisk(roziePath, makeRegistry());
    const secondMtime = statSync(outPath).mtimeMs;
    expect(secondMtime).toBe(firstMtime);
  });

  it('overwrites the .rozie.ts when the source changes', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    emitRozieTsToDisk(roziePath, makeRegistry());
    const initial = readFileSync(roziePath + '.ts', 'utf8');

    // Mutate the source so the emitted output differs (rename to Counter2).
    const mutated = COUNTER_ROZIE.replace('name="Counter"', 'name="CounterX"');
    writeFileSync(roziePath, mutated);
    emitRozieTsToDisk(roziePath, makeRegistry());
    const updated = readFileSync(roziePath + '.ts', 'utf8');
    expect(updated).not.toBe(initial);
    expect(updated).toContain('CounterX');
  });
});

describe('D-70 disk-cache: prebuildAngularRozieFiles', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-d70-scan-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('recursively scans and emits every .rozie under rootDir', () => {
    const a = join(tmpDir, 'Counter.rozie');
    const subdir = join(tmpDir, 'sub');
    mkdirSync(subdir);
    const b = join(subdir, 'Counter2.rozie');
    writeFileSync(a, COUNTER_ROZIE);
    writeFileSync(b, COUNTER_ROZIE.replace('name="Counter"', 'name="Counter2"'));

    const processed = prebuildAngularRozieFiles(tmpDir, makeRegistry());
    expect(processed.sort()).toEqual([a, b].sort());
    expect(existsSync(a + '.ts')).toBe(true);
    expect(existsSync(b + '.ts')).toBe(true);
  });

  it('skips node_modules and other build-artefact dirs', () => {
    const ok = join(tmpDir, 'OK.rozie');
    writeFileSync(ok, COUNTER_ROZIE);
    // .rozie inside node_modules — must NOT be picked up.
    const nodeModulesDir = join(tmpDir, 'node_modules', 'pkg');
    mkdirSync(nodeModulesDir, { recursive: true });
    writeFileSync(join(nodeModulesDir, 'Skip.rozie'), COUNTER_ROZIE);
    // .rozie inside dist/ — must NOT be picked up.
    const distDir = join(tmpDir, 'dist');
    mkdirSync(distDir);
    writeFileSync(join(distDir, 'Skip2.rozie'), COUNTER_ROZIE);

    const processed = prebuildAngularRozieFiles(tmpDir, makeRegistry());
    expect(processed).toEqual([ok]);
  });

  it('does not throw when rootDir contains no .rozie files', () => {
    expect(() => prebuildAngularRozieFiles(tmpDir, makeRegistry())).not.toThrow();
  });
});
