import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
// @ts-expect-error — @rozie/unplugin's /vite entry ships types via its own
// package export map; the workspace TS project reference resolves it at
// build time, but this package's isolated tsconfig doesn't wire the path.
import Rozie from '@rozie/unplugin/vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { angularPartialIvyLinkerPlugin } from './angularPartialIvyLinker';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Phase 80 (D-07b, 2026-08-18) — Angular record-path slot-fill
// content-projection runtime harness, built on REAL ngtsc AOT compilation.
//
// Plugin order: Rozie({ target: 'angular' }) FIRST, angular() SECOND — this
// is the production wiring @rozie/unplugin documents (its runtime peer-dep
// assertion literally says "add angular() to your vite.config.ts plugins
// array AFTER Rozie({ target: 'angular' })"), and it's what
// tests/integration/angular-analogjs/vite.config.ts already does. Rozie's
// `configResolved` hook prebuilds every `.rozie` fixture to a sibling
// `<Name>.rozie.ts` disk-cache file (D-70) BEFORE analogjs's own
// `buildStart` walks its TS Program — Vite guarantees every plugin's
// `configResolved` runs before any plugin's `buildStart`, so the ordering
// is correct regardless of Vitest's module-runner specifics.
//
// jit: false is THE load-bearing option for this whole phase. Read
// node_modules/@analogjs/vite-plugin-angular's angular-vite-plugin.js: `const
// jit = typeof pluginOptions?.jit !== 'undefined' ? pluginOptions.jit :
// isTest;` — under Vitest (`isTest` true), the plugin defaults `jit` to
// `true` UNLESS a caller overrides it. JIT compilation cannot discover
// signal-based `contentChildren()` queries at all (see 80-CONTEXT.md D-07b —
// verified against @angular/core@21.2.13's ReflectionCapabilities-based
// `directiveMetadata()`, which only ever reads decorator-populated
// `propMetadata`). Omitting this option would silently reproduce the exact
// JIT dead end D-07b exists to route around, just one layer further from the
// symptom. MUST NOT be removed or defaulted.
export default defineConfig({
  plugins: [angularPartialIvyLinkerPlugin(), Rozie({ target: 'angular' }), angular({ jit: false })],
  resolve: {
    // pnpm's peer-dependency-aware store gives `@angular/core` a DIFFERENT
    // physical copy per distinct `zone.js` peer resolution context — this
    // package (packages/runtime/angular) and this harness resolve to two
    // separate `@angular/core@19.2.22` instances on disk (verified via
    // `require.resolve` with each package's own resolution root), which is
    // a genuine dual-package hazard: `@angular/core`'s DI internals
    // (`getCurrentInjector`/`enterDI`) are module-scoped closures, so an
    // injection context entered by ONE copy is invisible to `inject()` /
    // `input.required()` calls running inside the OTHER copy — surfacing as
    // NG0203 even though the directive is genuinely linked and genuinely
    // instantiated inside Angular's own directive-instantiation flow. A
    // real npm-installed consumer app has exactly one `@angular/core` for
    // its whole tree and never hits this; `dedupe` reproduces that
    // single-instance guarantee for this monorepo test harness.
    dedupe: [
      '@angular/core',
      '@angular/common',
      '@angular/compiler',
      '@angular/platform-browser',
      '@angular/platform-browser-dynamic',
      'rxjs',
      'zone.js',
    ],
  },
  test: {
    root: __dirname,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setup-vitest.ts'],
    include: ['**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    server: {
      deps: {
        // Vitest's SSR module loader externalizes node_modules/workspace
        // dependencies by default, loading them via Node's native module
        // system and bypassing Vite's plugin `transform` pipeline entirely.
        // `inline` forces `.rozie` fixture output and this repo's own
        // workspace packages through Vite's normal transform pipeline
        // instead (tests/timing/vitest.config.ts documents the identical
        // knob for a different package — Svelte — this is the same
        // mechanism, not a new one).
        //
        // RESOLVED 2026-08-18 (Phase 80 Plan 08, OPEN RISK R-80-NG0203):
        // `@rozie/runtime-angular` ships partial-Ivy declarations
        // (`ɵɵngDeclareFactory` / `ɵɵngDeclareDirective`, correct per
        // D-03/SPEC R1). A real Angular CLI / esbuild build links every
        // `node_modules` dependency automatically via `@angular/build`'s own
        // linker invocation; `@analogjs/vite-plugin-angular` does not run
        // that linker at all (grep its source — there is no "linker"
        // anywhere in it), so importing `@rozie/runtime-angular`'s BUILT
        // dist under this harness used to crash with NG0203 the moment a
        // `RozieSlot` instance was constructed inside an embedded view
        // (signal `input.required()`/`inject()` field initializers running
        // outside an injection context). `angularPartialIvyLinkerPlugin()`
        // above closes this gap directly: it runs
        // `@angular/compiler-cli/linker/babel`'s own linker plugin (the
        // exact recipe `@angular/build`'s javascript-transformer-worker
        // uses) over any module whose code contains an unlinked
        // `ɵɵngDeclare*` call, keyed off `code.includes('ɵɵngDeclare')`
        // rather than `optimizeDeps.include` (whose Angular-file heuristic
        // false-positive-matches `ɵɵngDeclareDirective(`'s trailing
        // substring and mangles the file). See that file for the full
        // recipe and citation.
        inline: [/@rozie\//],
      },
    },
  },
});
