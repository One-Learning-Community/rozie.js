/**
 * DIST-05 strict-bytes parity gate (Plan 06-06 / D-93).
 *
 * Asserts that ALL FOUR Rozie distribution entrypoints produce byte-identical
 * output for every (5 reference example × 4 targets) tuple:
 *   • Leg 1 — @rozie/core.compile() direct
 *   • Leg 2 — @rozie/cli runBuildMatrix (writes to disk)
 *   • Leg 3 — @rozie/babel-plugin (writes sibling via transformAsync)
 *   • Leg 4 — @rozie/unplugin createTransformHook (in-process)
 *
 * Total: 5 × 4 × 4 = 80 byte-equal assertions + React sidecar checks
 * (.d.ts / .module.css / .global.css) per fixture × 3 legs that surface
 * those sidecars (Legs 1-3; Leg 4 doesn't surface sidecars in the same
 * shape — they're virtual ids in unplugin per D-58).
 *
 * Trailing-newline normalization (D-93): `normalize()` matches the bootstrap
 * script's write-time normalization. No other normalization at assertion
 * time — bytes ARE the contract. .map parity is deferred to v2 per
 * RESEARCH OQ4.
 *
 * The test suite runs in-process with no child_process spawns; total runtime
 * < 5s on a warm cache.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { compile, ModifierRegistry, registerBuiltins } from '@rozie/core';
import { runBuildMatrix } from '@rozie/cli';
// `createTransformHook` is the test-only entrypoint into unplugin's
// per-target pipeline; not exported from `@rozie/unplugin` (the public
// surface is `unplugin` factory). Imported directly from the source via
// relative path — same pattern as `@rozie/core/compile.ts` importing
// sibling target-* packages by relative path. The dist-parity workspace
// is private; this is allowed.
import { createTransformHook } from '../../packages/unplugin/src/transform.js';
import { transformAsync } from '@babel/core';
import rozieBabelPlugin from '@rozie/babel-plugin';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const FIXTURES_DIR = resolve(HERE, 'fixtures');

const EXAMPLES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;
const TARGETS = ['vue', 'react', 'svelte', 'angular'] as const;
type Target = (typeof TARGETS)[number];

function primaryExt(target: Target): string {
  if (target === 'angular') return '.angular.ts';
  if (target === 'react') return '.tsx';
  return `.${target}`;
}

/** D-89 layout: CLI/babel emit `.tsx` for React; the parity fixture is `.tsx` too. */
function emittedExt(target: Target): string {
  if (target === 'angular') return '.ts';
  if (target === 'react') return '.tsx';
  return `.${target}`;
}

function loadFixture(name: string, target: Target): string {
  return readFileSync(join(FIXTURES_DIR, `${name}${primaryExt(target)}`), 'utf8');
}

function loadSidecarOrNull(name: string, suffix: string): string | null {
  try {
    return readFileSync(join(FIXTURES_DIR, `${name}${suffix}`), 'utf8');
  } catch {
    return null;
  }
}

/** Match bootstrap script's write-time normalization (D-93 trailing-LF only). */
function normalize(s: string): string {
  return s.endsWith('\n') ? s : `${s}\n`;
}

describe('DIST-05 strict-bytes parity gate (D-93)', () => {
  describe.each(EXAMPLES)('%s', (name) => {
    const rozieSourcePath = resolve(ROOT, `examples/${name}.rozie`);
    const rozieSource = readFileSync(rozieSourcePath, 'utf8');

    describe.each(TARGETS)('%s target', (target) => {
      const fixture = loadFixture(name, target);

      it('Leg 1 — compile() direct produces fixture bytes', () => {
        const result = compile(rozieSource, {
          target,
          filename: `${name}.rozie`,
          types: true,
          sourceMap: false,
        });
        expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect(normalize(result.code)).toBe(fixture);

        // React sidecar parity (per D-93 React adds 3 sidecars when present)
        if (target === 'react') {
          const dts = loadSidecarOrNull(name, '.d.ts');
          if (dts !== null) expect(normalize(result.types)).toBe(dts);
          const moduleCss = loadSidecarOrNull(name, '.module.css');
          if (moduleCss !== null && result.css) {
            expect(normalize(result.css)).toBe(moduleCss);
          }
          const globalCss = loadSidecarOrNull(name, '.global.css');
          if (globalCss !== null && result.globalCss) {
            expect(normalize(result.globalCss)).toBe(globalCss);
          }
        }
      });

      it('Leg 2 — CLI runBuildMatrix produces fixture bytes', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-cli-'));
        try {
          await runBuildMatrix(
            [rozieSourcePath],
            {
              target: [target],
              out: tmpDir,
              types: true,
              sourceMap: false,
              root: ROOT,
            },
            { exit: 'throw' },
          );
          // D-89 layout: <outDir>/<target>/<source-rel>/<name>.<ext>
          const outPath = resolve(tmpDir, target, 'examples', `${name}${emittedExt(target)}`);
          const cliBytes = readFileSync(outPath, 'utf8');
          expect(normalize(cliBytes)).toBe(fixture);

          if (target === 'react') {
            const dtsFix = loadSidecarOrNull(name, '.d.ts');
            if (dtsFix !== null) {
              const cliDts = readFileSync(outPath.replace(/\.tsx$/, '.d.ts'), 'utf8');
              expect(normalize(cliDts)).toBe(dtsFix);
            }
            const cssFix = loadSidecarOrNull(name, '.module.css');
            if (cssFix !== null) {
              const cliCss = readFileSync(outPath.replace(/\.tsx$/, '.module.css'), 'utf8');
              expect(normalize(cliCss)).toBe(cssFix);
            }
            const globalFix = loadSidecarOrNull(name, '.global.css');
            if (globalFix !== null) {
              const cliGlobal = readFileSync(outPath.replace(/\.tsx$/, '.global.css'), 'utf8');
              expect(normalize(cliGlobal)).toBe(globalFix);
            }
          }
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 3 — babel-plugin produces fixture bytes via sibling write', async () => {
        const tmpDir = mkdtempSync(join(tmpdir(), 'rozie-parity-babel-'));
        try {
          // Stage the .rozie file in tmpDir so the importer's dirname
          // resolves correctly; the babel-plugin reads `${name}.rozie`
          // sibling-relative to state.filename (the importer).
          const tmpRozie = join(tmpDir, `${name}.rozie`);
          writeFileSync(tmpRozie, rozieSource, 'utf8');
          const importer = join(tmpDir, 'consumer.ts');
          writeFileSync(importer, `import X from './${name}.rozie';`, 'utf8');

          // T-06-06-05 mitigation — capture pre-test mtime watermark so we
          // can assert the sibling was written DURING this test (rather
          // than picked up stale from a prior bootstrap run).
          const testStartMs = Date.now();
          // Slight pad so a same-millisecond write still satisfies > start.
          await new Promise((r) => setTimeout(r, 5));

          await transformAsync(readFileSync(importer, 'utf8'), {
            filename: importer,
            plugins: [[rozieBabelPlugin, { target }]],
            babelrc: false,
            configFile: false,
          });

          const sibling = join(tmpDir, `${name}${emittedExt(target)}`);
          const siblingMs = statSync(sibling).mtimeMs;
          expect(siblingMs).toBeGreaterThanOrEqual(testStartMs);

          const babelBytes = readFileSync(sibling, 'utf8');
          expect(normalize(babelBytes)).toBe(fixture);

          if (target === 'react') {
            const dtsFix = loadSidecarOrNull(name, '.d.ts');
            if (dtsFix !== null) {
              const babelDts = readFileSync(sibling.replace(/\.tsx$/, '.d.ts'), 'utf8');
              expect(normalize(babelDts)).toBe(dtsFix);
            }
            const cssFix = loadSidecarOrNull(name, '.module.css');
            if (cssFix !== null) {
              const babelCss = readFileSync(sibling.replace(/\.tsx$/, '.module.css'), 'utf8');
              expect(normalize(babelCss)).toBe(cssFix);
            }
            const globalFix = loadSidecarOrNull(name, '.global.css');
            if (globalFix !== null) {
              const babelGlobal = readFileSync(sibling.replace(/\.tsx$/, '.global.css'), 'utf8');
              expect(normalize(babelGlobal)).toBe(globalFix);
            }
          }
        } finally {
          rmSync(tmpDir, { recursive: true, force: true });
        }
      });

      it('Leg 4 — unplugin createTransformHook produces fixture bytes', () => {
        const registry = new ModifierRegistry();
        registerBuiltins(registry);
        const hook = createTransformHook(registry, target);
        // Invoke with an empty `this` — the production plugin context carries
        // `addWatchFile` / `warn` / `error`; the hook tolerates their absence
        // (existing transform.test cases verify this).
        const result = hook.call({}, rozieSource, `${name}.rozie`);
        expect(result).not.toBeNull();
        expect(normalize(result!.code)).toBe(fixture);
        // .map parity deferred to v2 per RESEARCH OQ4 — would compare JSON
        // mappings only, ignoring file/sources fields. v1 omits.
      });
    });
  });
});
