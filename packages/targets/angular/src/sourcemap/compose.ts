/**
 * compose.ts — Phase 5 Plan 05-04a Task 3.
 *
 * Wraps `MagicString.generateMap` with the .rozie-source-reference convention
 * mirroring the React/Vue/Svelte targets. Sets `map.sources = [filename]` and
 * `map.sourcesContent = [originalRozieText]` so Vite's downstream
 * `@analogjs/vite-plugin-angular` chain reports the original `.rozie` file in
 * stack traces (DX-01).
 *
 * Mirrors packages/targets/svelte/src/sourcemap/compose.ts and
 * packages/targets/react/src/sourcemap/compose.ts.
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';

export interface ComposeOpts {
  filename: string;
  source: string;
}

export function composeSourceMap(ms: MagicString, opts: ComposeOpts): SourceMap {
  // Re-project the emitted output through a fresh MagicString anchored to the
  // original .rozie source — same fix as the React/Svelte targets to avoid
  // empty mappings.
  let projected: MagicString;
  if (opts.source.length > 0) {
    projected = new MagicString(opts.source);
    projected.overwrite(0, opts.source.length, ms.toString());
  } else {
    projected = ms;
  }

  const map = projected.generateMap({
    source: opts.filename,
    file: opts.filename + '.ts',
    includeContent: true,
    hires: 'boundary',
  });

  if (map.sources[0] !== opts.filename) {
    map.sources = [opts.filename];
  }
  if (!map.sourcesContent || map.sourcesContent[0] !== opts.source) {
    map.sourcesContent = [opts.source];
  }

  return map;
}
