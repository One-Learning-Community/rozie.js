/**
 * compose.ts — Phase 06.1 P2 D-109 cleanup of Phase 5 single-segment hack.
 *
 * Thin wrapper around the shared `composeMaps()` helper at
 * packages/core/src/codegen/composeMaps.ts. Pre-marshals the Svelte-target
 * filename + script child map; calls composeMaps; defensively re-asserts
 * the .rozie sources/sourcesContent contract (Pitfall 2 carry-forward).
 *
 * Mirrors `packages/targets/vue/src/sourcemap/compose.ts` verbatim. The only
 * difference is the `file` extension hint (`.svelte` instead of `.vue`).
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
  /**
   * 0-indexed line offset of the user-authored statements within the .svelte output.
   * When provided alongside scriptMap, composeMaps applies a semicolon-prefix
   * shift so the script map's generated lines align with the .svelte output lines.
   */
  userCodeLineOffset?: number;
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
    fileExt: '.svelte',
    userCodeLineOffset: opts.userCodeLineOffset,
  });
}
