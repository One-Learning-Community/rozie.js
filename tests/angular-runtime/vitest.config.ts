import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
// @ts-expect-error — @rozie/unplugin's /vite entry ships types via its own
// package export map; the workspace TS project reference resolves it at
// build time, but this package's isolated tsconfig doesn't wire the path.
import Rozie from '@rozie/unplugin/vite';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

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
  plugins: [Rozie({ target: 'angular' }), angular({ jit: false })],
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
        // KNOWN GAP (discovered standing up this harness, does not block
        // this plan — see probe/ProbeProducer.ts): `@rozie/runtime-angular`
        // ships partial-Ivy declarations (`ɵɵngDeclareFactory` /
        // `ɵɵngDeclareDirective`, correct per D-03/SPEC R1). A real Angular
        // CLI / esbuild build links every `node_modules` dependency
        // automatically via `@angular/build`'s dependency-optimizer;
        // `@analogjs/vite-plugin-angular` does not run that linker at all
        // (grep its source — there is no "linker" anywhere in it), and its
        // OWN dep-optimizer-scoped Angular-file heuristic
        // (`/(Component|Directive|Pipe|Injectable|NgModule)\(/`) false-
        // positive-matches `ɵɵngDeclareDirective(`'s trailing substring and
        // mangles the file into a broken ad-hoc factory if routed through
        // `optimizeDeps.include`. Importing `@rozie/runtime-angular`'s
        // BUILT dist under this harness currently crashes with NG0203 the
        // moment a `RozieSlot` instance is constructed inside an embedded
        // view (signal `input.required()`/`inject()` field initializers
        // running outside an injection context). Whichever later plan
        // (04/05/08) first mounts the POST-FIX emitted output — which
        // genuinely imports `{ RozieSlot } from '@rozie/runtime-angular'`
        // — must solve this properly (most likely: apply
        // `@angular/compiler-cli/linker/babel`'s documented Babel plugin to
        // the dist file via a small custom `transform` hook keyed off
        // `code.includes('ɵɵngDeclare')`, NOT via `optimizeDeps.include`).
        // Task 1's probe and Task 3's fixtures in THIS plan do not import
        // `@rozie/runtime-angular` at all: the probe consumes the directive
        // from its plain-decorator SOURCE (compiled fresh by this
        // package's own ngtsc Program), and Task 3 exercises the CURRENT
        // pre-fix emitter, which has no runtime-package import yet (see
        // 80-02-SUMMARY.md) — so this gap does not weaken R7.
        inline: [/@rozie\//],
      },
    },
  },
});
