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
export const TARGET_EXTENSIONS: Record<'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit', string> = {
  vue: '.vue',
  react: '.tsx',
  svelte: '.svelte',
  angular: '.ts',
  solid: '.tsx',
  lit: '.ts',
};

/**
 * D-89: compute the absolute output path for a given (input, target) tuple.
 *
 * Layout: `<outDir>/<target>/<source-rel-from-rootDir>/<basename>.<ext>`.
 *
 * Path-traversal safety: when the source file lives OUTSIDE `rootDir`
 * (`pathRelative(rootDir, sourceDir)` starts with `..`), we strip the rel
 * component and emit `<outDir>/<target>/<basename>.<ext>` instead. This
 * prevents `--out` from being escaped via cleverly-located inputs.
 *
 * @param inputAbs   absolute path to the source `.rozie` file
 * @param target     one of the four supported targets
 * @param outDir     absolute path to the output root
 * @param rootDir    absolute path to the project root (controls the rel-path)
 * @returns absolute output path with target subdir + source-rel-path preserved
 */
export function computeOutputPath(
  inputAbs: string,
  target: 'vue' | 'react' | 'svelte' | 'angular' | 'solid' | 'lit',
  outDir: string,
  rootDir: string,
): string {
  const sourceDir = pathDirname(inputAbs);
  let sourceRel = pathRelative(rootDir, sourceDir);
  // Defense-in-depth: if the source lives outside rootDir, refuse to thread
  // the `..` traversal through pathJoin (it would escape outDir). Flatten to
  // basename-only when the rel-path starts with `..`.
  if (sourceRel.startsWith('..')) {
    sourceRel = '';
  }
  const baseName = pathBasename(inputAbs, '.rozie');
  const ext = TARGET_EXTENSIONS[target];
  return pathJoin(outDir, target, sourceRel, baseName + ext);
}
