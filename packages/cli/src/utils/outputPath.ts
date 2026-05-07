// outputPath — D-89 output layout for `rozie build`.
//
// `dist/{target}/{source-rel-path}/Foo.{ext}` — per-target subdir + source-tree
// preservation. The source-rel-path is computed from `rootDir` (project root,
// default process.cwd()) so a flat per-target tree mirrors the source tree.
//
// Examples (rootDir='/repo', outDir='/repo/dist'):
//   /repo/Counter.rozie                         → /repo/dist/{target}/Counter.{ext}
//   /repo/src/components/forms/Input.rozie      → /repo/dist/{target}/src/components/forms/Input.{ext}
//
// Phase 6 OQ4 RESOLVED: source-rel-path preservation is the canonical
// per-package npm convention for cross-framework component libraries.
import {
  basename as pathBasename,
  dirname as pathDirname,
  join as pathJoin,
  relative as pathRelative,
} from 'node:path';

/**
 * Per-target file extension for the primary emitted artefact.
 * Sidecars (`.d.ts`, `.module.css`, `.global.css`, `.map`) are derived
 * from this in `runBuildMatrix`.
 */
export const TARGET_EXTENSIONS: Record<'vue' | 'react' | 'svelte' | 'angular', string> = {
  vue: '.vue',
  react: '.tsx',
  svelte: '.svelte',
  angular: '.ts',
};

/**
 * D-89: compute the absolute output path for a given (input, target) tuple.
 *
 * @param inputAbs   absolute path to the source `.rozie` file
 * @param target     one of the four supported targets
 * @param outDir     absolute path to the output root
 * @param rootDir    absolute path to the project root (controls the rel-path)
 * @returns absolute output path with target subdir + source-rel-path preserved
 */
export function computeOutputPath(
  inputAbs: string,
  target: 'vue' | 'react' | 'svelte' | 'angular',
  outDir: string,
  rootDir: string,
): string {
  const sourceDir = pathDirname(inputAbs);
  const sourceRel = pathRelative(rootDir, sourceDir);
  const baseName = pathBasename(inputAbs, '.rozie');
  const ext = TARGET_EXTENSIONS[target];
  return pathJoin(outDir, target, sourceRel, baseName + ext);
}
