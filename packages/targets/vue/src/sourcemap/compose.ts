/**
 * compose.ts — Phase 3 Plan 05 Task 2.
 *
 * Wraps `MagicString.generateMap` with the .rozie-source-reference
 * convention from Pitfall 2 (RESEARCH line 705): set
 * `map.sources = ['<absolute path>.rozie']` and
 * `map.sourcesContent = [originalRozieText]` so Vite's downstream
 * `@vitejs/plugin-vue` chain reports the original `.rozie` file for
 * stack traces (DX-01 success criterion 4).
 *
 * The defensive re-assertion at the bottom of the function is a Pitfall 2
 * mitigation: if some future magic-string version changes how it derives
 * `sources` from the options, our explicit override guarantees the contract
 * Phase 3 depends on.
 *
 * @experimental — shape may change before v1.0
 */
import type MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';

export interface ComposeOpts {
  /** Absolute or relative path to the .rozie source — surfaced in dev-tools. */
  filename: string;
  /** Original .rozie source text — embedded in sourcesContent. */
  source: string;
}

export function composeSourceMap(ms: MagicString, opts: ComposeOpts): SourceMap {
  const map = ms.generateMap({
    source: opts.filename,
    file: opts.filename + '.vue',
    includeContent: true,
    hires: 'boundary',
  });

  // Pitfall 2 mitigation: defensively re-assert sources + sourcesContent.
  // magic-string already does this when source + includeContent are set;
  // the explicit override is belt-and-suspenders for stack-trace stability.
  if (map.sources[0] !== opts.filename) {
    map.sources = [opts.filename];
  }
  if (!map.sourcesContent || map.sourcesContent[0] !== opts.source) {
    map.sourcesContent = [opts.source];
  }

  return map;
}
