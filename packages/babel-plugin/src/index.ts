// @rozie/babel-plugin — Phase 6 Plan 04 / D-92 ImportDeclaration visitor.
//
// Replaces the Phase 1 placeholder with a thin Babel plugin that:
//   1. Visits each `import Foo from './Foo.rozie'` declaration.
//   2. Resolves the absolute .rozie path via the importer's `state.filename`.
//   3. Calls compileImport() → writeSiblingIfStale() → @rozie/core.compile()
//      to emit a sibling `Foo.{ext}` (and React sidecars when target='react').
//   4. Rewrites the import source to the sibling extension so downstream
//      Babel passes (preset-typescript / preset-react / preset-vue) and
//      bundler resolution (Webpack / Metro) handle it as a normal module.
//
// Targets non-Vite distributions: Webpack/babel-loader, Metro, or any
// Babel-driven pipeline. The Vite path remains @rozie/unplugin per D-48.
//
// Plugin order (Pitfall 3): plugins run BEFORE presets in default Babel
// order, so this plugin's import-source rewrite lands before
// preset-typescript / preset-react try to resolve `./Foo.rozie`. Document
// the canonical config in README.md.
//
// Errors are surfaced as Babel errors via `path.buildCodeFrameError` per
// D-97 — consumer sees a Babel-shaped error frame, not a raw Node throw.
//
// Source-LOC budget per D-92: ~50 LOC for this visitor file. Helpers
// (writeSibling.ts, compileImport.ts) carry the fs + cache logic.
import { declare } from '@babel/helper-plugin-utils';
import type { PluginObj } from '@babel/core';
import { resolve as pathResolve, dirname } from 'node:path';
import { compileImport } from './compileImport.js';
import type { RozieBabelTarget } from './writeSibling.js';

export interface RozieBabelPluginOptions {
  /** Required: target framework. Selects emit branch + sibling extension. */
  target: RozieBabelTarget;
}

/** D-92 sibling-extension dispatch table. */
const TARGET_EXTENSIONS = {
  vue: '.vue',
  react: '.tsx',
  svelte: '.svelte',
  angular: '.ts',
} as const satisfies Record<RozieBabelTarget, string>;

const ROZIE_EXT = '.rozie';

export default declare((api, options: RozieBabelPluginOptions): PluginObj => {
  api.assertVersion(7);

  const { target } = options;
  if (!target || !(target in TARGET_EXTENSIONS)) {
    // ROZ820 — invalid target option. Thrown at plugin instantiation so
    // misconfigurations fail fast (before any visitor runs).
    throw new Error(
      `[ROZ820] @rozie/babel-plugin: 'target' option is required and must be one of vue|react|svelte|angular (got ${JSON.stringify(target)})`,
    );
  }
  const ext = TARGET_EXTENSIONS[target];

  return {
    name: '@rozie/babel-plugin',
    visitor: {
      ImportDeclaration(path, state) {
        const src = path.node.source.value;
        if (!src.endsWith(ROZIE_EXT)) return;

        // state.filename is the importer; needed to resolve the relative
        // .rozie path. Babel always provides this when caller passes
        // `filename` to transformAsync; if missing, surface ROZ821 with
        // a code-frame so the consumer sees the offending import.
        const importerFile = state.filename ?? state.file?.opts?.filename;
        if (!importerFile) {
          throw path.buildCodeFrameError(
            `[ROZ821] @rozie/babel-plugin: cannot resolve relative .rozie import without state.filename`,
          );
        }
        const roziePath = pathResolve(dirname(importerFile), src);
        const siblingPath = roziePath.slice(0, -ROZIE_EXT.length) + ext;

        try {
          compileImport(roziePath, siblingPath, target);
        } catch (err) {
          // Re-shape any error from compileImport (ROZ822 compile error
          // or ROZ823 fs error) as a Babel error with code-frame per D-97.
          throw path.buildCodeFrameError(`${(err as Error).message}`);
        }

        // Rewrite the import source so downstream Babel passes + the
        // consumer's bundler resolve the sibling artifact naturally.
        const newSrc = src.slice(0, -ROZIE_EXT.length) + ext;
        path.node.source.value = newSrc;
      },
    },
  };
});
