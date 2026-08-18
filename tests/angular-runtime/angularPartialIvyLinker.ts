import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { transformAsync } from '@babel/core';
import { createEs2015LinkerPlugin } from '@angular/compiler-cli/linker/babel';
import type { Plugin } from 'vite';

// Phase 80 Plan 08 — closes OPEN RISK R-80-NG0203.
//
// `@rozie/runtime-angular` ships partial-Ivy declarations (`ɵɵngDeclareFactory`
// / `ɵɵngDeclareDirective`, correct per D-03/SPEC R1 — see ng-package.json and
// tsconfig.lib.json in packages/runtime/angular). Partial-Ivy output is a
// CONTRACT, not a finished artifact: it must be run through the Angular
// Linker before a consumer can construct an instance. A real Angular CLI /
// esbuild build applies this automatically via `@angular/build`'s own
// javascript-transformer-worker (see its `createLinkerPlugin` /
// `requiresLinking` helpers — this file's recipe, including the linker
// options and the five-method `fileSystem` shape, is copied from there
// verbatim). `@analogjs/vite-plugin-angular` does not run that linker at all
// (grep its source — there is no "linker" anywhere in it).
//
// This Vite plugin fills that gap for THIS harness only: any module whose
// source contains an `ɵɵngDeclare*` call (i.e. an unlinked partial-Ivy
// declaration) is run through the compiler-cli's own Babel linker plugin
// before Angular ever sees it. `linkerJitMode: false` because this harness
// compiles fixtures through real AOT (`jit: false` in the `angular()` plugin
// options below), not JIT — see that option's own comment for why JIT is
// categorically wrong for this phase's signal-query design.
export function angularPartialIvyLinkerPlugin(): Plugin {
  let linkerBabelPlugin: unknown;

  return {
    name: 'rozie-angular-partial-ivy-linker',
    enforce: 'pre',
    async transform(code, id) {
      // Cheap guard: only files that actually contain an unlinked partial
      // declaration pay the Babel-parse cost. `.rozie.ts` disk-cache files
      // and hand-authored `.ts` sources never contain this string — only a
      // package built with `angularCompilerOptions.compilationMode: "partial"`
      // does (currently only `@rozie/runtime-angular`).
      if (!code.includes('ɵɵngDeclare')) {
        return null;
      }

      linkerBabelPlugin ??= createEs2015LinkerPlugin({
        linkerJitMode: false,
        // Workaround for https://github.com/angular/angular/issues/42769,
        // matching @angular/build's own linker invocation.
        sourceMapping: false,
        logger: {
          level: 1, // Info level
          debug(...args: unknown[]) {
            console.debug(...args);
          },
          info(...args: unknown[]) {
            console.info(...args);
          },
          warn(...args: unknown[]) {
            console.warn(...args);
          },
          error(...args: unknown[]) {
            console.error(...args);
          },
        },
        // `LinkerPluginOptions['fileSystem']` types its methods against
        // compiler-cli's branded `AbsoluteFsPath` / `PathSegment` string
        // subtypes (nominal typing enforced via a phantom `_brand` field).
        // Plain `node:fs` / `node:path` functions return structurally
        // identical but nominally distinct `string`s. `@angular/build`'s own
        // linker invocation (this file's cited source) passes the exact
        // same raw Node functions — the branding is compile-time-only
        // ceremony with no runtime behavior difference, so the cast below
        // matches upstream's own (untyped, since it's compiled JS) usage.
        fileSystem: {
          resolve,
          exists: existsSync,
          dirname,
          relative,
          readFile: readFileSync,
        } as unknown as Parameters<typeof createEs2015LinkerPlugin>[0]['fileSystem'],
      });

      const result = await transformAsync(code, {
        filename: id,
        configFile: false,
        babelrc: false,
        browserslistConfigFile: false,
        compact: false,
        sourceMaps: false,
        plugins: [linkerBabelPlugin as never],
      });

      return { code: result?.code ?? code, map: null };
    },
  };
}
