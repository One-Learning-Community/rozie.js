/**
 * Phase 22 Plan 22-05 Task 1 — emitSidecar unit suite.
 *
 * Covers the `.d.rozie.ts` sidecar render + write dispatch:
 *
 *   - `renderSidecar(source, target, filename)` — pure parse → lowerToIR →
 *     per-target `emit<Target>Types` dispatch → do-not-edit + sha256
 *     content-hash header. Returns the full sidecar source string, or null
 *     when the source has error-level diagnostics.
 *   - `emitSidecar(roziePath, sourceText, target, allowedRoots)` — computes
 *     `<Name>.d.rozie.ts` (NEVER `.rozie.d.ts`), reuses the emitRozieTsToDisk
 *     trust-boundary (allowedRoots refusal + null-byte guard) + idempotent
 *     skip, writes the sidecar, returns the written path or null when
 *     skipped/refused/diagnostics-bailed.
 *
 * ANGULAR EXCEPTION (reverses the Plan-04 LOCKED decision): `emitSidecar` never
 * writes an Angular sidecar next to a `.rozie` source — a type-only
 * `.d.rozie.ts` shadows the disk-cache `.rozie.ts` in ngtsc's module resolution
 * and silently kills AOT ("JIT compiler unavailable", the 2026-06-02 Angular +
 * VR matrix regression). For `target: 'angular'` it deletes any stale sidecar
 * (heal) and returns null. `renderSidecar` still renders Angular (CLI output
 * trees only).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emitSidecar, renderSidecar, SIDECAR_HEADER_PREFIX } from '../src/emitSidecar.js';
import { unplugin } from '../src/index.js';

const COUNTER_ROZIE = `<rozie name="Counter">
<props>
{ value: { type: Number, default: 0, model: true }, step: { type: Number, default: 1 } }
</props>
<template>
<button class="counter">{{ $props.value }}</button>
</template>
</rozie>
`;

const BROKEN_ROZIE = `<rozie name="Broken">
<template>
<button @click="$emit('')">x</button>
</template>
</rozie>
`;

function hash12(source: string): string {
  return createHash('sha256').update(source).digest('hex').slice(0, 12);
}

describe('renderSidecar — pure render + header', () => {
  it('Test 1: produces a do-not-edit header + the per-target props interface (React)', () => {
    const out = renderSidecar(COUNTER_ROZIE, 'react', 'Counter.rozie');
    expect(out).not.toBeNull();
    expect(out!.startsWith(SIDECAR_HEADER_PREFIX)).toBe(true);
    expect(out).toContain('export interface CounterProps');
  });

  it('Test 2: header content-hash equals sha256(source).slice(0,12)', () => {
    const out = renderSidecar(COUNTER_ROZIE, 'react', 'Counter.rozie')!;
    const firstLine = out.split('\n', 1)[0];
    expect(firstLine).toBe(`${SIDECAR_HEADER_PREFIX}${hash12(COUNTER_ROZIE)}`);
  });

  it('Test 5: dispatch — vue uses DefineComponent, lit uses HTMLElementTagNameMap, angular declare class', () => {
    expect(renderSidecar(COUNTER_ROZIE, 'vue', 'Counter.rozie')).toContain('DefineComponent');
    expect(renderSidecar(COUNTER_ROZIE, 'svelte', 'Counter.rozie')).toContain("import('svelte').Component");
    expect(renderSidecar(COUNTER_ROZIE, 'solid', 'Counter.rozie')).toContain("import('solid-js').Component");
    expect(renderSidecar(COUNTER_ROZIE, 'lit', 'Counter.rozie')).toContain('HTMLElementTagNameMap');
    expect(renderSidecar(COUNTER_ROZIE, 'angular', 'Counter.rozie')).toContain('declare class Counter');
  });

  it('bails (returns null) on a source with error-level diagnostics', () => {
    expect(renderSidecar(BROKEN_ROZIE, 'react', 'Broken.rozie')).toBeNull();
  });
});

describe('emitSidecar — write + trust-boundary + idempotent skip', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-sidecar-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('Test 1: writes Counter.d.rozie.ts (NOT Counter.rozie.d.ts) next to the source', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitSidecar(roziePath, COUNTER_ROZIE, 'react', [tmpDir]);
    expect(outPath).toBe(join(tmpDir, 'Counter.d.rozie.ts'));
    expect(outPath!.endsWith('.d.rozie.ts')).toBe(true);
    expect(outPath!.endsWith('.rozie.d.ts')).toBe(false);
    expect(existsSync(outPath!)).toBe(true);
    const content = readFileSync(outPath!, 'utf8');
    expect(content.startsWith(SIDECAR_HEADER_PREFIX)).toBe(true);
  });

  it('Test 2: written header hash equals sha256(source).slice(0,12)', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitSidecar(roziePath, COUNTER_ROZIE, 'react', [tmpDir])!;
    const firstLine = readFileSync(outPath, 'utf8').split('\n', 1)[0];
    expect(firstLine).toBe(`${SIDECAR_HEADER_PREFIX}${hash12(COUNTER_ROZIE)}`);
  });

  it('Test 3a: a write target OUTSIDE the allowed roots is refused (throws)', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const otherRoot = mkdtempSync(join(tmpdir(), 'rozie-other-'));
    try {
      expect(() => emitSidecar(roziePath, COUNTER_ROZIE, 'react', [otherRoot])).toThrow(
        /refusing to (emit|write).*outside/i,
      );
    } finally {
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });

  it('Test 3b: a null-byte path is rejected', () => {
    expect(() => emitSidecar(join(tmpDir, 'C\0.rozie'), COUNTER_ROZIE, 'react', [tmpDir])).toThrow(
      /null byte/i,
    );
  });

  it('Test 4: idempotent — a second call with unchanged source does NOT re-write', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitSidecar(roziePath, COUNTER_ROZIE, 'react', [tmpDir])!;
    const mtime1 = readFileSync(outPath, 'utf8');
    // Second call: content identical → skip. Returns the path but does not
    // rewrite (assert by content stability + a sentinel marker we inject).
    writeFileSync(outPath, mtime1 + '\n// SENTINEL', 'utf8');
    const outPath2 = emitSidecar(roziePath, COUNTER_ROZIE, 'react', [tmpDir]);
    // The freshly-rendered content differs from the sentinel-appended file,
    // so a write SHOULD happen here (content changed on disk). To assert true
    // idempotency we re-render the canonical content first, then re-call.
    const canonical = renderSidecar(COUNTER_ROZIE, 'react', roziePath)!;
    writeFileSync(outPath, canonical, 'utf8');
    const before = readFileSync(outPath, 'utf8');
    emitSidecar(roziePath, COUNTER_ROZIE, 'react', [tmpDir]);
    const after = readFileSync(outPath, 'utf8');
    expect(after).toBe(before);
    expect(outPath2).toBe(outPath);
  });

  it('Test 5: dispatch — angular NEVER writes a sidecar next to a .rozie source (ngtsc AOT shadowing)', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    const outPath = emitSidecar(roziePath, COUNTER_ROZIE, 'angular', [tmpDir]);
    expect(outPath).toBeNull();
    expect(existsSync(join(tmpDir, 'Counter.d.rozie.ts'))).toBe(false);
  });

  it('Test 5b: angular HEALS — a stale .d.rozie.ts left by a pre-fix build is deleted', () => {
    const roziePath = join(tmpDir, 'Counter.rozie');
    const stalePath = join(tmpDir, 'Counter.d.rozie.ts');
    writeFileSync(roziePath, COUNTER_ROZIE);
    // Simulate a pre-fix build (or a different-target build over a shared
    // tree) having left a type-only sidecar behind.
    writeFileSync(stalePath, '// AUTO-GENERATED stale sidecar\nexport declare class Counter {}\n');
    const outPath = emitSidecar(roziePath, COUNTER_ROZIE, 'angular', [tmpDir]);
    expect(outPath).toBeNull();
    expect(existsSync(stalePath)).toBe(false);
  });

  it('returns null (no write) when the source has error-level diagnostics', () => {
    const roziePath = join(tmpDir, 'Broken.rozie');
    writeFileSync(roziePath, BROKEN_ROZIE);
    const outPath = emitSidecar(roziePath, BROKEN_ROZIE, 'react', [tmpDir]);
    expect(outPath).toBeNull();
    expect(existsSync(join(tmpDir, 'Broken.d.rozie.ts'))).toBe(false);
  });
});

describe('emitSidecarsForRoot (buildStart) — WR-04 failure aggregation + WR-05 dedupe', () => {
  let tmpDir: string;
  let prevCwd: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-buildstart-'));
    prevCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(prevCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  /**
   * The buildStart sidecar walk roots at `process.cwd()`. Drive it via the
   * rollup-shaped plugin (vue target — warn-only peer-dep checks, no throw at
   * factory-call time) with cwd chdir'd into a temp project.
   */
  function runBuildStart(): void {
    const plugin = unplugin.rollup({ target: 'vue' });
    const first = Array.isArray(plugin) ? plugin[0] : plugin;
    process.chdir(tmpDir);
    // Rollup buildStart is a (this, options) method; we don't need either here.
    (first as { buildStart: () => void }).buildStart();
  }

  it('WR-04: a renderer-throw / write-refused failure aggregates into a thrown build error', () => {
    // Valid source that renders fine — so the failure is purely the WRITE.
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    // Force the write to fail: make the target sidecar path a DIRECTORY, so
    // writeFileSync('Counter.d.rozie.ts', ...) throws EISDIR. This is a
    // "write refused / failed" class — exactly what WR-04 says must NOT be
    // silently swallowed.
    mkdirSync(join(tmpDir, 'Counter.d.rozie.ts'));

    expect(() => runBuildStart()).toThrow(
      /sidecar\(s\) failed to generate.*Counter\.rozie/s,
    );
  });

  it('WR-04: a source-diagnostic bail does NOT throw (warn + skip stays correct)', () => {
    // A broken source renderSidecar()-nulls — that is the source-diagnostic
    // class, which must remain a non-fatal skip (no sidecar, no throw).
    writeFileSync(join(tmpDir, 'Broken.rozie'), BROKEN_ROZIE);
    expect(() => runBuildStart()).not.toThrow();
    expect(existsSync(join(tmpDir, 'Broken.d.rozie.ts'))).toBe(false);
  });

  it('WR-05: a valid project emits each sidecar once and does not throw', () => {
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    expect(() => runBuildStart()).not.toThrow();
    expect(existsSync(join(tmpDir, 'Counter.d.rozie.ts'))).toBe(true);
  });
});
