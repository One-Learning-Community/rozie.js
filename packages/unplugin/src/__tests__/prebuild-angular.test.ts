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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, mkdirSync, statSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  emitRozieTsToDisk,
  prebuildAngularRozieFiles,
} from '../transform.js';
import { ModifierRegistry } from '@rozie/core';
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

  it('Phase 06.1 Pitfall 6: embeds merged sourcemap as base64 data-URL trailer', () => {
    // Without this trailer, analogjs's downstream transform (which reads
    // .rozie.ts from disk) breaks the sourcemap chain — stack traces would
    // resolve to the synthesized .rozie.ts rather than the .rozie source.
    // Plan 06.1-01 must_haves truth #4.
    const roziePath = join(tmpDir, 'Counter.rozie');
    writeFileSync(roziePath, COUNTER_ROZIE);
    emitRozieTsToDisk(roziePath, makeRegistry());
    const code = readFileSync(roziePath + '.ts', 'utf8');
    // The trailer is the LAST non-empty line, matching the canonical form
    // `^//# sourceMappingURL=data:application/json;base64,[A-Za-z0-9+/=]+$`.
    const lines = code.split('\n').filter((l) => l.length > 0);
    const lastLine = lines[lines.length - 1];
    expect(lastLine).toMatch(
      /^\/\/# sourceMappingURL=data:application\/json;base64,[A-Za-z0-9+/=]+$/,
    );
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

// Phase 06.2 follow-up — cross-rozie composition shim. The Angular target's
// rewriteRozieImport produces extensionless imports for cross-rozie
// composition (e.g. `import { Counter } from './Counter'`). Without a
// resolvable `./Counter.ts` on disk, analogjs's NgCompiler fails AOT
// compilation on any component that imports another rozie component and
// falls back to runtime __decorate. Fix: prebuild also emits a tiny
// re-export shim `Counter.ts` next to `Counter.rozie.ts` whenever a
// `<components>` block declares a cross-rozie target.
const MODAL_WITH_COMPONENTS = `<rozie name="Modal">
<components>
{
  Counter: './Counter.rozie',
}
</components>
<props>
{ open: { type: Boolean, default: false, model: true } }
</props>
<template>
<div r-if="$props.open" class="modal">
  <Counter />
</div>
</template>
</rozie>
`;

const TREE_NODE_SELF_REF = `<rozie name="TreeNode">
<components>
{
  TreeNode: './TreeNode.rozie',
}
</components>
<props>
{ node: { type: Object, default: () => ({ id: '', label: '', children: [] }) } }
</props>
<template>
<div class="tn">
  <span>{{ $props.node.label }}</span>
  <ul r-for="child in $props.node.children" :key="child.id">
    <TreeNode :node="child" />
  </ul>
</div>
</template>
</rozie>
`;

describe('D-70 cross-rozie shim emission (Phase 06.2 follow-up)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'rozie-d70-shim-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('emits Counter.ts re-export shim when Modal.rozie imports Counter via <components>', () => {
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    writeFileSync(join(tmpDir, 'Modal.rozie'), MODAL_WITH_COMPONENTS);
    emitRozieTsToDisk(join(tmpDir, 'Modal.rozie'), makeRegistry());
    const shimPath = join(tmpDir, 'Counter.ts');
    expect(existsSync(shimPath)).toBe(true);
    const content = readFileSync(shimPath, 'utf8');
    expect(content).toMatch(/^\/\/ @rozie-cross-rozie-shim/);
    expect(content).toContain("export * from './Counter.rozie';");
    expect(content).toContain("export { default } from './Counter.rozie';");
  });

  it('does NOT emit a shim for self-references (D-114 outer-name route)', () => {
    writeFileSync(join(tmpDir, 'TreeNode.rozie'), TREE_NODE_SELF_REF);
    emitRozieTsToDisk(join(tmpDir, 'TreeNode.rozie'), makeRegistry());
    expect(existsSync(join(tmpDir, 'TreeNode.ts'))).toBe(false);
  });

  it('does NOT clobber a consumer-authored .ts file (no marker line)', () => {
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    writeFileSync(join(tmpDir, 'Modal.rozie'), MODAL_WITH_COMPONENTS);
    const consumerCounterTs = "// hand-written by consumer\nexport const x = 42;\n";
    writeFileSync(join(tmpDir, 'Counter.ts'), consumerCounterTs);
    emitRozieTsToDisk(join(tmpDir, 'Modal.rozie'), makeRegistry());
    expect(readFileSync(join(tmpDir, 'Counter.ts'), 'utf8')).toBe(consumerCounterTs);
  });

  it('overwrites a stale shim from a prior prebuild', () => {
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    writeFileSync(join(tmpDir, 'Modal.rozie'), MODAL_WITH_COMPONENTS);
    // Pre-existing shim with marker but stale content (different filename).
    const stale = "// @rozie-cross-rozie-shim\nexport * from './stale.rozie';\n";
    writeFileSync(join(tmpDir, 'Counter.ts'), stale);
    emitRozieTsToDisk(join(tmpDir, 'Modal.rozie'), makeRegistry());
    const refreshed = readFileSync(join(tmpDir, 'Counter.ts'), 'utf8');
    expect(refreshed).not.toBe(stale);
    expect(refreshed).toContain("export * from './Counter.rozie';");
  });

  it('emits no shim when the .rozie file has no <components> block', () => {
    writeFileSync(join(tmpDir, 'Counter.rozie'), COUNTER_ROZIE);
    emitRozieTsToDisk(join(tmpDir, 'Counter.rozie'), makeRegistry());
    // Counter.rozie has no <components> block — no shims should be written.
    // (The .rozie.ts disk-cache is still emitted for Counter itself.)
    expect(existsSync(join(tmpDir, 'Counter.ts'))).toBe(false);
  });
});

// Quick task 260515-1y4 — cross-tree prebuild support. The Angular target's
// D-70 disk-cache prebuild only walked DOWN from a single Vite project root,
// but the visual-regression rig's `tests/visual-regression/` host needs to
// walk `<repo>/examples/` (which sits ABOVE the Vite project root). The fix:
// `RozieOptions.prebuildExtraRoots: readonly string[]` — an explicit
// allowlist of additional roots the prebuild walker traverses, with the
// trust-boundary in `emitRozieTsToDisk` widened from one root to the union.
//
// Symlinks are still refused (T-05-04b-03 / WR-01 closure) — both for files
// DISCOVERED inside any root (existing behavior) AND for the extra root
// entries themselves (new, mirrors the in-tree symlink-skip).
describe('Quick 260515-1y4: cross-tree prebuild via prebuildExtraRoots', () => {
  let projectRoot: string;
  let extraRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), 'rozie-1y4-project-'));
    extraRoot = mkdtempSync(join(tmpdir(), 'rozie-1y4-extra-'));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    rmSync(extraRoot, { recursive: true, force: true });
  });

  it('prebuildAngularRozieFiles walks extraRoots in addition to rootDir', () => {
    const insidePath = join(projectRoot, 'Inside.rozie');
    writeFileSync(insidePath, COUNTER_ROZIE.replace('name="Counter"', 'name="Inside"'));
    const outsidePath = join(extraRoot, 'Outside.rozie');
    writeFileSync(outsidePath, COUNTER_ROZIE.replace('name="Counter"', 'name="Outside"'));

    const processed = prebuildAngularRozieFiles(projectRoot, makeRegistry(), [extraRoot]);

    // Both files should be processed and live in the returned array.
    expect(processed.sort()).toEqual([insidePath, outsidePath].sort());
    // Both .rozie.ts siblings should be on disk.
    expect(existsSync(insidePath + '.ts')).toBe(true);
    expect(existsSync(outsidePath + '.ts')).toBe(true);
    // Sanity-check the emitted Angular content for the extra-root file.
    const outsideTs = readFileSync(outsidePath + '.ts', 'utf8');
    expect(outsideTs).toContain("from '@angular/core'");
    expect(outsideTs).toContain('@Component');
  });

  it('emitRozieTsToDisk accepts an array of allowed roots and refuses writes outside ALL of them', () => {
    const outsideRoot = mkdtempSync(join(tmpdir(), 'rozie-1y4-outside-'));
    try {
      const fooPath = join(outsideRoot, 'Foo.rozie');
      writeFileSync(fooPath, COUNTER_ROZIE.replace('name="Counter"', 'name="Foo"'));
      expect(() =>
        emitRozieTsToDisk(fooPath, makeRegistry(), [projectRoot, extraRoot]),
      ).toThrow(/refusing to emit \.rozie\.ts/);
      // Ensure the message includes the offending path so consumers can debug.
      expect(() =>
        emitRozieTsToDisk(fooPath, makeRegistry(), [projectRoot, extraRoot]),
      ).toThrow(new RegExp(fooPath.replace(/\//g, '\\/')));
    } finally {
      rmSync(outsideRoot, { recursive: true, force: true });
    }
  });

  it('emitRozieTsToDisk single-element array equivalent to string back-compat', () => {
    const insidePath = join(projectRoot, 'Inside.rozie');
    writeFileSync(insidePath, COUNTER_ROZIE.replace('name="Counter"', 'name="Inside"'));
    // Both forms must succeed and produce the same on-disk file.
    expect(() =>
      emitRozieTsToDisk(insidePath, makeRegistry(), projectRoot),
    ).not.toThrow();
    const stringForm = readFileSync(insidePath + '.ts', 'utf8');
    rmSync(insidePath + '.ts');
    expect(() =>
      emitRozieTsToDisk(insidePath, makeRegistry(), [projectRoot]),
    ).not.toThrow();
    const arrayForm = readFileSync(insidePath + '.ts', 'utf8');
    expect(arrayForm).toBe(stringForm);
  });

  it('prebuildAngularRozieFiles refuses a symlinked extraRoot with console.warn', () => {
    // Real extra root (B) with one .rozie file inside.
    const realExtra = mkdtempSync(join(tmpdir(), 'rozie-1y4-real-extra-'));
    const realRoziePath = join(realExtra, 'Real.rozie');
    writeFileSync(realRoziePath, COUNTER_ROZIE.replace('name="Counter"', 'name="Real"'));

    // Symlink pointing at realExtra. We hand THIS path to prebuildExtraRoots.
    const symlinkContainer = mkdtempSync(join(tmpdir(), 'rozie-1y4-symlink-container-'));
    const symlinkPath = join(symlinkContainer, 'Link');
    try {
      symlinkSync(realExtra, symlinkPath, 'dir');
    } catch (err) {
      // Some CI sandboxes refuse symlink creation entirely; skip silently.
      if ((err as NodeJS.ErrnoException).code === 'EPERM') {
        rmSync(realExtra, { recursive: true, force: true });
        rmSync(symlinkContainer, { recursive: true, force: true });
        return;
      }
      throw err;
    }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      // The walker must NOT throw — symlinks are SKIPPED (consistency with
      // the in-tree symlink-skip behavior of the walker).
      expect(() =>
        prebuildAngularRozieFiles(projectRoot, makeRegistry(), [symlinkPath]),
      ).not.toThrow();
      // No .rozie.ts should have been emitted in the real extra directory.
      expect(existsSync(realRoziePath + '.ts')).toBe(false);
      // The skip should be surfaced as a console.warn with the [@rozie/unplugin] prefix.
      const warnings = warnSpy.mock.calls.map((args) => String(args[0]));
      expect(warnings.some((m) => m.includes('[@rozie/unplugin]') && m.includes('symlink'))).toBe(true);
    } finally {
      warnSpy.mockRestore();
      rmSync(realExtra, { recursive: true, force: true });
      rmSync(symlinkContainer, { recursive: true, force: true });
    }
  });
});
