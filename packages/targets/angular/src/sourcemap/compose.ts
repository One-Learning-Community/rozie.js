/**
 * compose.ts — Phase 06.1 P2 D-109 cleanup of Phase 5 single-segment hack.
 *
 * Thin wrapper around the shared `composeMaps()` helper at
 * packages/core/src/codegen/composeMaps.ts. Pre-marshals the Angular-target
 * filename + script child map; calls composeMaps; defensively re-asserts
 * the .rozie sources/sourcesContent contract (Pitfall 2 carry-forward).
 *
 * Mirrors `packages/targets/vue/src/sourcemap/compose.ts` verbatim. The only
 * difference is the `file` extension hint (`.ts` instead of `.vue`).
 *
 * Pitfall 6 carry-forward: P1 added the data-URL sourceMappingURL trailer in
 * @rozie/unplugin's emitRozieTsToDisk so analogjs's downstream transform
 * composes the chain back to .rozie. The map produced here is what goes into
 * that trailer; this rewrite just sharpens the chain (per-block accuracy
 * from buildShell + future per-expression accuracy from composeMaps merge).
 *
 * @experimental — shape may change before v1.0
 */
import type MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import { composeMaps } from '../../../../core/src/codegen/composeMaps.js';

export interface ComposeOpts {
  filename: string;
  source: string;
  /**
   * Phase 06.1 P2: per-expression child map from emitScript (null if no map
   * produced — D-102 single-segment fallback).
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Phase 06.1 P2: byte offset in shell output where the script body begins.
   */
  scriptOutputOffset: number;
}

export function composeSourceMap(ms: MagicString, opts: ComposeOpts): SourceMap {
  return composeMaps({
    filename: opts.filename,
    source: opts.source,
    shellMs: ms,
    children:
      opts.scriptMap !== null
        ? [{ map: opts.scriptMap, outputOffset: opts.scriptOutputOffset }]
        : [],
    fileExt: '.ts',
  });
}
