/**
 * compose.ts — Phase 5 Plan 02a Task 3.
 *
 * Wraps `MagicString.generateMap` with the .rozie-source-reference convention
 * mirroring the Vue + React targets. Sets `map.sources = ['<abs>.rozie']` and
 * `map.sourcesContent = [originalRozieText]` so Vite's downstream
 * `@sveltejs/vite-plugin-svelte` chain reports the original `.rozie` file in
 * stack traces (DX-01).
 *
 * Mirrors packages/targets/vue/src/sourcemap/compose.ts.
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
  // original .rozie source. Without this, `ms` was built via `.append()` on a
  // `MagicString('')` which produces no positional tracking — generateMap
  // would emit `;`-only mappings and `.rozie` would never appear in the
  // bundled source-map's `sources[]`. Mirrors the React/Vue target fix.
  let projected: MagicString;
  if (opts.source.length > 0) {
    projected = new MagicString(opts.source);
    projected.overwrite(0, opts.source.length, ms.toString());
  } else {
    projected = ms;
  }

  const map = projected.generateMap({
    source: opts.filename,
    file: opts.filename + '.svelte',
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
