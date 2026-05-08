/**
 * compose.ts — Phase 06.1 P2 D-109 cleanup of Phase 3 WR-01 single-segment hack.
 *
 * Thin wrapper around the shared `composeMaps()` helper at
 * packages/core/src/codegen/composeMaps.ts. Pre-marshals the Vue-target
 * filename + script child map; calls composeMaps; defensively re-asserts
 * the .rozie sources/sourcesContent contract (Pitfall 2 carry-forward).
 *
 * @experimental — shape may change before v1.0
 */
import type MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';
import type { EncodedSourceMap } from '@ampproject/remapping';
import { composeMaps } from '../../../../core/src/codegen/composeMaps.js';

export interface ComposeOpts {
  /** Absolute or relative path to the .rozie source — surfaced in dev-tools. */
  filename: string;
  /** Original .rozie source text — embedded in sourcesContent. */
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
   * 0-indexed line offset of the user-authored statements within the .vue output.
   * When provided alongside scriptMap, composeMaps applies a semicolon-prefix
   * shift so the script map's generated lines align with the .vue output lines.
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
    fileExt: '.vue',
    userCodeLineOffset: opts.userCodeLineOffset,
  });
}
