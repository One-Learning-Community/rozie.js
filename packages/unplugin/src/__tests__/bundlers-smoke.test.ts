// `@rozie/unplugin/*` non-Vite bundler smoke tests.
//
// The Vite entry has a full e2e gate (`vite.test.ts`). This file covers the
// other five adapters Rozie's `unplugin` factory exposes: Rollup, Webpack,
// esbuild, Rolldown, Rspack. Coverage shape per bundler:
//
//   1. SHAPE — the entrypoint import succeeds and the factory call returns
//      a plugin object with the canonical shape for that bundler's API.
//   2. BUILD (where the bundler has a clean programmatic API + native TS
//      handling) — invoke the bundler programmatically against a tiny
//      `.rozie` source, assert the compiled output reaches the bundle.
//
// Build smokes run for esbuild, Rolldown, and Rollup (with esbuild as the
// TS transformer). Webpack gets a shape-only smoke because a full
// programmatic build requires a memfs + ts-loader / esbuild-loader setup
// that adds significantly more dependency weight than the coverage value
// justifies — Rspack's API is intentionally Webpack-compatible, so the
// Webpack shape smoke covers both. The underlying Rozie transform/load
// pipeline is exercised end-to-end by `vite.test.ts`; what's load-bearing
// here is that each per-bundler entrypoint factory produces a working
// plugin shape.
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TMP_ROOT = resolve(__dirname, '..', '..', '.tmp-bundlers-smoke-' + Date.now());

// ── cwd ISOLATION (load-bearing — do not remove) ────────────────────────────
// The build smokes below run REAL bundler builds (rollup.rollup / esbuild.build
// / rolldown / webpack), each of which invokes the plugin's `buildStart` hook.
// That hook's sidecar walk roots at `process.cwd()`. Without chdir'ing into
// this suite's tmp root, running the suite from the repo root walks the ENTIRE
// repo and litters every non-package tree (examples/, examples/demos/, …) with
// lit-flavored `.d.rozie.ts` sidecars — which then break the solid demo's
// typecheck (its cross-root `../../../../Counter.rozie` imports resolve to the
// wrong target's sidecar) and would break Angular AOT in any angular build that
// consumes those trees. All test fixture paths below are absolute, so the
// chdir is transparent to them.
let prevCwd: string;
beforeAll(() => {
  prevCwd = process.cwd();
  mkdirSync(TMP_ROOT, { recursive: true });
  process.chdir(TMP_ROOT);
});
afterAll(() => {
  process.chdir(prevCwd);
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

// Minimal `.rozie` source we point each bundler at. `target: 'lit'` because:
//   - It emits plain TypeScript (no JSX) — every bundler in this matrix has
//     either built-in TS handling or accepts an esbuild-based TS transformer.
//   - The emitted code contains `customElements.define('rozie-smoke', ...)`
//     which is a stable, bundler-agnostic marker to grep for.
//   - No host-framework plugin chain is needed (vs Vue/Svelte/Angular).
const ROZIE_SOURCE = `
<rozie name="Smoke">
<props>
{ label: { type: String, default: 'hello' } }
</props>
<template>
<button>{{ $props.label }}</button>
</template>
</rozie>
`.trim();

function setupTmpProject(targetSubdir: string): { dir: string; entry: string; rozieFile: string } {
  const dir = resolve(TMP_ROOT, targetSubdir);
  mkdirSync(dir, { recursive: true });
  const rozieFile = resolve(dir, 'Smoke.rozie');
  writeFileSync(rozieFile, ROZIE_SOURCE);
  // For bundlers whose entry must be JS/TS (Rollup, Rolldown, esbuild build
  // mode), we wrap the `.rozie` import in a tiny entry shim. For programmatic
  // transform-only mode we pass the `.rozie` directly.
  const entry = resolve(dir, 'entry.ts');
  writeFileSync(entry, `import Smoke from './Smoke.rozie';\nexport default Smoke;\n`);
  return { dir, entry, rozieFile };
}

describe('@rozie/unplugin/rollup — shape', () => {
  it('factory returns a Rollup-shaped plugin (name + buildStart/transform hooks)', async () => {
    const mod = await import('../rollup.js');
    const plugin = mod.default({ target: 'lit' });
    expect(plugin).toBeDefined();
    // unplugin@3 wraps a single factory call in an array under the hood when
    // the bundler expects a plugin chain (e.g. Vite). For Rollup the shape is
    // typically a single plugin object OR an array — both are valid here.
    const first = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(first).toBeTypeOf('object');
    expect(first.name).toMatch(/rozie/i);
  });
});

describe('@rozie/unplugin/rollup — build', () => {
  it('compiles .rozie through Rollup with esbuild as the TS transformer', async () => {
    const rollup = await import('rollup');
    const esbuild = await import('esbuild');
    const rozieRollup = (await import('../rollup.js')).default;

    const { dir, entry } = setupTmpProject('rollup-build');

    try {
      const bundle = await rollup.rollup({
        input: entry,
        plugins: [
          rozieRollup({ target: 'lit' }) as never,
          // Inline TS transformer via esbuild's transform API exposed as a
          // tiny Rollup plugin. Keeps the test self-contained — no
          // dependency on @rollup/plugin-typescript / @rollup/plugin-esbuild.
          {
            name: 'inline-esbuild-ts',
            async transform(code: string, id: string) {
              if (!id.endsWith('.ts') && !id.endsWith('.rozie')) return null;
              const out = await esbuild.transform(code, {
                loader: 'ts',
                target: 'es2022',
                format: 'esm',
              });
              return { code: out.code, map: out.map || null };
            },
          },
        ],
        external: (id) => id === 'lit' || id.startsWith('lit/') || id.startsWith('@lit-labs/') || id.startsWith('@rozie/runtime-lit'),
        onwarn: () => {
          /* silence well-known warnings (circular imports in lit, etc.) */
        },
      });

      const { output } = await bundle.generate({ format: 'esm' });
      const code = output[0].type === 'chunk' ? output[0].code : '';
      // Stable load-bearing markers the Rozie compiler always emits for Lit:
      //   - `data-rozie-s-<hash>` scope attribute on every element
      //   - `rozieSpread` / `rozieListeners` runtime helpers (Phase 14/15)
      // These survive TS-decorator lowering, whereas `customElements.define`
      // depends on how the bundler lowers the `@customElement` decorator.
      expect(code).toMatch(/data-rozie-s-|rozieSpread|rozieListeners/);
      expect(code).toMatch(/rozie[-_]smoke|class Smoke/);
      await bundle.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('@rozie/unplugin/esbuild — shape', () => {
  it('factory returns an esbuild-shaped plugin (name + setup)', async () => {
    const mod = await import('../esbuild.js');
    const plugin = mod.default({ target: 'lit' });
    expect(plugin).toBeDefined();
    expect(plugin.name).toMatch(/rozie/i);
    expect(plugin.setup).toBeTypeOf('function');
  });
});

describe('@rozie/unplugin/esbuild — build', () => {
  it('compiles .rozie through esbuild end-to-end (native TS handling)', async () => {
    const esbuild = await import('esbuild');
    const rozieEsbuild = (await import('../esbuild.js')).default;

    const { dir, entry } = setupTmpProject('esbuild-build');

    try {
      const result = await esbuild.build({
        entryPoints: [entry],
        plugins: [rozieEsbuild({ target: 'lit' })],
        bundle: true,
        write: false,
        format: 'esm',
        target: 'es2022',
        external: ['lit', 'lit/*', '@lit-labs/*', '@rozie/runtime-lit'],
        logLevel: 'silent',
      });

      expect(result.outputFiles).toBeDefined();
      expect(result.outputFiles!.length).toBeGreaterThan(0);
      const bundleText = result.outputFiles!.map((f) => f.text).join('\n');
      // Same stable markers as the Rollup smoke — see rationale above.
      expect(bundleText).toMatch(/data-rozie-s-|rozieSpread|rozieListeners/);
      expect(bundleText).toMatch(/rozie[-_]smoke|class Smoke/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('@rozie/unplugin/rolldown — shape', () => {
  it('factory returns a Rolldown-shaped plugin', async () => {
    const mod = await import('../rolldown.js');
    const plugin = mod.default({ target: 'lit' });
    expect(plugin).toBeDefined();
    const first = Array.isArray(plugin) ? plugin[0] : plugin;
    expect(first).toBeTypeOf('object');
    expect(first.name).toMatch(/rozie/i);
  });
});

describe('@rozie/unplugin/rolldown — build', () => {
  it('compiles .rozie through Rolldown (native TS handling)', async () => {
    const rolldown = await import('rolldown');
    const rozieRolldown = (await import('../rolldown.js')).default;

    const { dir, entry } = setupTmpProject('rolldown-build');

    try {
      const bundle = await rolldown.rolldown({
        input: entry,
        plugins: [rozieRolldown({ target: 'lit' }) as never],
        external: (id: string) =>
          id === 'lit' || id.startsWith('lit/') || id.startsWith('@lit-labs/') || id.startsWith('@rozie/runtime-lit'),
        onwarn: () => {
          /* silence */
        },
      });

      const { output } = await bundle.generate({ format: 'esm' });
      const code = output[0].type === 'chunk' ? output[0].code : '';
      // Stable load-bearing markers the Rozie compiler always emits for Lit:
      //   - `data-rozie-s-<hash>` scope attribute on every element
      //   - `rozieSpread` / `rozieListeners` runtime helpers (Phase 14/15)
      // These survive TS-decorator lowering, whereas `customElements.define`
      // depends on how the bundler lowers the `@customElement` decorator.
      expect(code).toMatch(/data-rozie-s-|rozieSpread|rozieListeners/);
      expect(code).toMatch(/rozie[-_]smoke|class Smoke/);
      // Rolldown's `close` is optional on the bundle, present on newer rc's.
      if (typeof (bundle as { close?: () => Promise<void> }).close === 'function') {
        await (bundle as { close: () => Promise<void> }).close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('@rozie/unplugin/webpack — shape', () => {
  it('factory returns a Webpack-shaped plugin (has apply method)', async () => {
    const mod = await import('../webpack.js');
    const Plugin = mod.default;
    // unplugin@3's `.webpack` returns a class-like constructor. Calling it
    // either with `new` or as a function must produce an object with an
    // `apply()` method that the webpack compiler invokes.
    const instance = (Plugin as unknown as new (o: unknown) => { apply: unknown })({ target: 'lit' });
    expect(instance).toBeDefined();
    expect(instance.apply).toBeTypeOf('function');
  });

  it('plugin instance attaches to a real webpack compiler without throwing', async () => {
    const webpack = (await import('webpack')).default;
    const rozieWebpack = (await import('../webpack.js')).default;

    // Phase 1 of the Webpack smoke: plugin.apply() against a real compiler
    // without throwing. The full-bundle smoke is the next test below.
    const compiler = webpack({
      entry: resolve(__dirname, 'entry-does-not-need-to-exist.ts'),
      mode: 'production',
      plugins: [rozieWebpack({ target: 'lit' }) as never],
    });

    expect(compiler).toBeDefined();
    expect(typeof compiler.run).toBe('function');
    await new Promise<void>((res) => compiler.close(() => res()));
  });

  it('full programmatic build: webpack + rozie + esbuild-as-TS-loader → bundle contains compiled Rozie output', async () => {
    const webpack = (await import('webpack')).default;
    const { createFsFromVolume, Volume } = await import('memfs');
    const esbuild = await import('esbuild');
    const rozieWebpack = (await import('../webpack.js')).default;

    const { dir, entry } = setupTmpProject('webpack-build');

    try {
      // In-memory output filesystem so we don't pollute the workspace.
      const outFs = createFsFromVolume(new Volume());

      // Inline TS loader: a tiny webpack loader that delegates to esbuild's
      // transform API. Keeps the smoke self-contained — no dependency on
      // ts-loader / esbuild-loader / @swc/loader. The loader is registered
      // by path under `module.rules.use.loader`.
      const inlineLoaderPath = resolve(dir, 'inline-ts-loader.cjs');
      writeFileSync(
        inlineLoaderPath,
        `const esbuild = require('esbuild');
module.exports = function (source) {
  const callback = this.async();
  esbuild.transform(source, {
    loader: 'ts',
    target: 'es2022',
    format: 'esm',
    sourcefile: this.resourcePath,
  }).then(
    (out) => callback(null, out.code, out.map ? JSON.parse(out.map) : undefined),
    (err) => callback(err),
  );
};
`,
      );

      const compiler = webpack({
        entry,
        mode: 'production',
        // Tell webpack to treat the in-memory FS as the output destination.
        output: {
          path: '/dist',
          filename: 'bundle.js',
          library: { type: 'module' },
        },
        experiments: { outputModule: true },
        resolve: {
          extensions: ['.ts', '.js', '.rozie'],
        },
        module: {
          rules: [
            {
              test: /\.ts$|\.rozie$/,
              use: { loader: inlineLoaderPath },
            },
          ],
        },
        plugins: [rozieWebpack({ target: 'lit' }) as never],
        // Mark Lit + Rozie runtime as external so we don't try to resolve
        // them — the smoke is about the unplugin transform, not Lit's
        // dependency graph.
        externals: [
          ({ request }, callback) => {
            if (
              request === 'lit' ||
              (request && request.startsWith('lit/')) ||
              (request && request.startsWith('@lit-labs/')) ||
              (request && request.startsWith('@rozie/runtime-lit'))
            ) {
              return callback(null, 'module ' + request);
            }
            callback();
          },
        ],
        optimization: {
          minimize: false, // keep markers readable for the assertions below
        },
        // Suppress noisy warnings that don't affect the smoke.
        ignoreWarnings: [() => true],
      });

      // Wire the in-memory output FS.
      (compiler as unknown as { outputFileSystem: unknown }).outputFileSystem = outFs;

      const stats = await new Promise<import('webpack').Stats | undefined>((res, rej) => {
        compiler.run((err, statsArg) => {
          if (err) return rej(err);
          res(statsArg);
        });
      });

      // Webpack may emit non-fatal errors for things like missing source
      // maps from the inline loader; we only fail on a complete build failure
      // (no output file produced).
      const bundlePath = '/dist/bundle.js';
      const bundleExists = outFs.existsSync(bundlePath);
      expect(bundleExists).toBe(true);

      const bundleText = outFs.readFileSync(bundlePath, 'utf8') as string;
      // Same stable markers as the Rollup / esbuild / Rolldown smokes —
      // these survive TS-decorator lowering across every bundler.
      expect(bundleText).toMatch(/data-rozie-s-|rozieSpread|rozieListeners/);
      expect(bundleText).toMatch(/rozie[-_]smoke|class Smoke/);

      await new Promise<void>((res) => compiler.close(() => res()));
      // stats is referenced to satisfy the linter; the actual gate is
      // `bundleExists` + the marker assertions above.
      void stats;
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000); // webpack cold-start is slow; allow 30s
});

describe('@rozie/unplugin/rspack — shape', () => {
  it('factory returns an Rspack-shaped plugin (has apply method)', async () => {
    // Rspack's API is intentionally Webpack-compatible; unplugin@3's `.rspack`
    // adapter returns the same constructor shape as `.webpack`. We don't
    // depend on `@rspack/core` in this package (it's a heavy native dep);
    // the shape test exercises the entrypoint export + factory contract.
    const mod = await import('../rspack.js');
    const Plugin = mod.default;
    const instance = (Plugin as unknown as new (o: unknown) => { apply: unknown })({ target: 'lit' });
    expect(instance).toBeDefined();
    expect(instance.apply).toBeTypeOf('function');
  });
});
