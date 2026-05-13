/**
 * compose.ts — Thin wrapper around the shared `composeMaps()` helper.
 *
 * Verbatim port of packages/targets/solid/src/sourcemap/compose.ts — the
 * magic-string source-map API is target-agnostic. The only difference is the
 * `file` extension hint (`.ts` for Lit instead of `.tsx` for Solid/React).
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
   * Per-expression child map from emitScript (null if no map produced —
   * D-102 single-segment fallback).
   */
  scriptMap: EncodedSourceMap | null;
  /**
   * Byte offset in shell output where the script body begins.
   */
  scriptOutputOffset: number;
  /**
   * 0-indexed line offset of the user-authored statements within the .ts output.
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
    fileExt: '.ts',
    userCodeLineOffset: opts.userCodeLineOffset,
  });
}
