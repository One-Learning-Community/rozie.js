/**
 * composeMaps.ts — Phase 06.1 D-100.
 *
 * Shared sourcemap merge helper. Chains @babel/generator's per-expression
 * script-body map (the "child" map) into magic-string's per-block shell map
 * (the "parent" map) via @ampproject/remapping. Result: a single Source Map
 * v3 that resolves emitted-output positions all the way back to .rozie.
 *
 * Used by all 4 target compose.ts files. Replaces the per-target
 * single-segment re-projection hack (Phase 3 WR-01 / Phase 4 Plan 04-05
 * Task 1) removed in P2 (D-109).
 *
 * v1: only opts.children[0] is consumed (the <script> map). The children[]
 * array shape is preserved for v2 D-105 template-expression child maps
 * (each <template> inline expression contributes its own child). See
 * Open Questions Q3 (RESOLVED) in 06.1-RESEARCH.md and ChildMap.outputOffset
 * doc below for the v2 dispatch contract.
 *
 * @experimental — shape may change before v1.0
 */
import _remapping from '@ampproject/remapping';
import type { EncodedSourceMap, SourceMapInput } from '@ampproject/remapping';
import type MagicString from 'magic-string';
import type { SourceMap as MagicStringSourceMap } from 'magic-string';

// CJS-interop normalization — mirror of `_generate` pattern at
// packages/targets/vue/src/emit/emitScript.ts:38-62.
type RemappingFn = typeof import('@ampproject/remapping').default;
const remapping: RemappingFn =
  typeof _remapping === 'function'
    ? (_remapping as RemappingFn)
    : (_remapping as unknown as { default: RemappingFn }).default;

/** A child sourcemap to chain into the shell map. */
export interface ChildMap {
  /** The child sourcemap from @babel/generator (or any Source Map v3 source). */
  map: EncodedSourceMap;
  /**
   * Byte offset within shell output (ms.toString()) where this child applies.
   * v1 uses children.length <= 1; v2 will dispatch by output range (Pitfall 4).
   */
  outputOffset: number;
}

export interface ComposeMapsOpts {
  /** .rozie path — surfaced in the `sources` field of the final map. */
  filename: string;
  /** Original .rozie text — embedded in `sourcesContent`. */
  source: string;
  /** buildShell output. */
  shellMs: MagicString;
  /** Zero or more child maps (script body in v1; template expressions in v2). */
  children: ChildMap[];
  /** Final emitted file extension hint for the `file` field. */
  fileExt: '.vue' | '.tsx' | '.svelte' | '.ts';
  /**
   * When provided alongside a children[0] script map: the 0-indexed line
   * offset of the user-authored statements within the tsx output.
   * Prepending this many semicolons to the map's VLQ mappings shifts every
   * generated-line reference so it matches the actual tsx output line numbers
   * rather than the script-body-relative line numbers from @babel/generator.
   */
  userCodeLineOffset?: number;
}

/**
 * Merge the shell map + zero-or-more child maps into a single Source Map v3
 * anchored to .rozie. Defensively re-asserts sources/sourcesContent per
 * Pitfall 2 mitigation.
 */
export function composeMaps(opts: ComposeMapsOpts): MagicStringSourceMap {
  // 1. Generate the shell map. magic-string anchors this to .rozie because
  //    buildShell constructs `new MagicString(rozieSource)` (P1).
  const shellMap = opts.shellMs.generateMap({
    source: opts.filename,
    file: `${opts.filename}${opts.fileExt}`,
    includeContent: true,
    hires: 'boundary',
  });

  // 2. Zero children — return the shell map after defensive re-assertion.
  if (opts.children.length === 0) {
    if (shellMap.sources[0] !== opts.filename) {
      shellMap.sources = [opts.filename];
    }
    if (
      !shellMap.sourcesContent ||
      shellMap.sourcesContent[0] !== opts.source
    ) {
      shellMap.sourcesContent = [opts.source];
    }
    return shellMap;
  }

  // 3. Direct line-offset path (used when userCodeLineOffset is known).
  //
  //    @ampproject/remapping expects the child map to describe how an
  //    intermediate file was generated from the original — that contract
  //    doesn't match our case (both the shell map and the @babel/generator
  //    map independently reference the .rozie file as their source).
  //
  //    Instead we take the script map whose generated positions are 0-indexed
  //    from the top of the emitted userArrowsSection text, and shift them into
  //    the correct tsx output lines by prepending `userCodeLineOffset`
  //    semicolons to the VLQ mappings string. Each ';' represents an empty
  //    line in the source-map format, pushing every subsequent segment down
  //    by one line. The result is a stand-alone source map that correctly
  //    maps tsx-output-lines → .rozie-lines for user-authored statements.
  if (opts.userCodeLineOffset !== undefined) {
    const childMap = opts.children[0]!.map;
    const adjusted: EncodedSourceMap = {
      version: 3,
      file: `${opts.filename}${opts.fileExt}`,
      sources: [opts.filename],
      sourcesContent: [opts.source],
      names: childMap.names ?? [],
      mappings: ';'.repeat(opts.userCodeLineOffset) + childMap.mappings,
    };
    return adjusted as unknown as MagicStringSourceMap;
  }

  // 4. v1: single-child loader returns the child map for the .rozie source.
  //    @ampproject/remapping calls the loader once per `sources` entry in the
  //    parent map; if the returned child map itself references opts.filename
  //    in its sources[], remapping calls the loader AGAIN with the same name.
  //    We must terminate that recursion: track per-file dispatch with a Set
  //    so the second call returns null (signaling "this is the .rozie leaf;
  //    don't recurse further"). Pitfall 4: v2 multi-child needs output-offset
  //    dispatch — out of v1 scope.
  const dispatched = new Set<string>();
  const merged = remapping(
    shellMap as unknown as SourceMapInput,
    (file: string) => {
      if (
        file === opts.filename &&
        opts.children.length >= 1 &&
        !dispatched.has(file)
      ) {
        dispatched.add(file);
        // Note: opts.children[0]!.map satisfies SourceMapInput (EncodedSourceMap is an accepted type).
        return opts.children[0]!.map as SourceMapInput;
      }
      return null;
    },
  );

  // 5. Defensive re-assertion of sources/sourcesContent (Pitfall 2 carry-forward).
  const out = merged as unknown as MagicStringSourceMap;
  if (out.sources[0] !== opts.filename) {
    out.sources = [opts.filename];
  }
  if (!out.sourcesContent || out.sourcesContent[0] !== opts.source) {
    out.sourcesContent = [opts.source];
  }
  return out;
}
