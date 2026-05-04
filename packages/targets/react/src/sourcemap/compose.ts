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
 * Phase 4 follow-up (DX-01 fix): magic-string's `generateMap` only emits
 * encoded segments for content that came from the *original* source string.
 * `buildShell` constructs a `MagicString('')` and only calls `.append(...)`,
 * which routes its content into the `outro` field — `outro` is processed via
 * `mappings.advance(outro)` which advances output position WITHOUT producing
 * any source segments. Result: `mappings` was a string of `;` separators
 * only, the `.rozie` file was absent from the bundle's `sources[]`, and the
 * "[rozie] Source map generated with empty mappings" warning fired on every
 * build.
 *
 * The fix re-projects the generated code back onto the original `.rozie`
 * source: build a *fresh* MagicString from the original `.rozie` text,
 * `overwrite(0, source.length, ms.toString())` to replace it with the
 * generated output, then call `generateMap`. magic-string treats this as an
 * `addEdit(...)` for chunk[0..source.length] which produces a real segment
 * at output (0,0) → source (0,0). Bundle source-maps now include the
 * `.rozie` file in `sources[]` and DevTools can navigate from a stack frame
 * back to the `.rozie` file (DX-01 success criterion 4).
 *
 * Per-block fine-grained mappings (one segment per <script>/<template>/
 * <style> block) is a future enhancement — the current single-segment map
 * is the minimum viable fix for DX-01.
 *
 * @experimental — shape may change before v1.0
 */
import MagicString from 'magic-string';
import type { SourceMap } from 'magic-string';

export interface ComposeOpts {
  /** Absolute or relative path to the .rozie source — surfaced in dev-tools. */
  filename: string;
  /** Original .rozie source text — embedded in sourcesContent. */
  source: string;
}

export function composeSourceMap(ms: MagicString, opts: ComposeOpts): SourceMap {
  // Re-project the emitted output through a fresh MagicString anchored to
  // the original `.rozie` source — see header comment for the rationale.
  // When the original source is empty (defensive — should not happen in the
  // production pipeline), fall back to the original ms so we still produce
  // a (degenerate) map without throwing.
  let projected: MagicString;
  if (opts.source.length > 0) {
    projected = new MagicString(opts.source);
    projected.overwrite(0, opts.source.length, ms.toString());
  } else {
    projected = ms;
  }

  const map = projected.generateMap({
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
  // no encoded segments). With the projected-source fix above, this branch
  // should only fire when `opts.source` is empty (a degenerate case) — the
  // warning remains as a guard against future regressions.
  if (!map.mappings || /^[;,]*$/.test(map.mappings)) {
    console.warn('[rozie] Source map generated with empty mappings for', opts.filename);
  }

  return map;
}
