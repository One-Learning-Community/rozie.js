/**
 * compose.ts — Plan 04-05 Task 1 (React target).
 *
 * Wraps `MagicString.generateMap` with the .rozie-source-reference
 * convention from Phase 3 Pitfall 2 (DX-01 carryover): set
 * `map.sources = ['<absolute path>.rozie']` and
 * `map.sourcesContent = [originalRozieText]` so Vite's downstream
 * `@vitejs/plugin-react` (or plugin-react-swc) chain reports the original
 * `.rozie` file for stack traces.
 *
 * Mirrors `packages/targets/vue/src/sourcemap/compose.ts` verbatim — the
 * magic-string source-map API is target-agnostic. The only difference is
 * the `file` extension hint (`.tsx` instead of `.vue`) so downstream
 * source-map consumers correctly classify the emitted output.
 *
 * The defensive re-assertion at the bottom of the function is a Pitfall 2
 * mitigation: if some future magic-string version changes how it derives
 * `sources` from the options, our explicit override guarantees the
 * contract Plan 04-05 depends on.
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
    file: opts.filename + '.tsx',
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

  // Phase 3 WR-01 carryover: warn when mappings are empty (only `;` separators,
  // no encoded segments). buildShell uses MagicString.append() on a fresh
  // empty string, which produces no positional tracking — mappings will be
  // decorative only. Long-term, the shell should use snip/overwrite to get
  // real per-block source positions.
  if (!map.mappings || /^[;,]*$/.test(map.mappings)) {
    console.warn('[rozie] Source map generated with empty mappings for', opts.filename);
  }

  return map;
}
