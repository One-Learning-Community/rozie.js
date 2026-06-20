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
import { decode, encode } from '@jridgewell/sourcemap-codec';
import type MagicString from 'magic-string';
import type { SourceMap as MagicStringSourceMap } from 'magic-string';
import type { File as BabelFile } from '@babel/types';

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
  userCodeLineOffset?: number | undefined;
  /**
   * Phase 55 Plan 03 (SC-2) — per-partial-file constant emit-line offset table,
   * keyed by the partial's absolute `loc.filename` (`.rzts`/`.rzjs`). Built from
   * the lowered script AST via {@link buildPartialLineOffsets}. When present, the
   * line-restore subtracts a source's offset from the ORIGINAL line of every
   * mapping whose `source` is that partial, recovering the true `.rzts`-local line
   * after Plan 02 shifted `loc.start.line` to a host-contiguous emit value. Absent
   * or empty → byte-identical to today (no restore). Never throws (D-04).
   */
  partialLineOffsets?: Map<string, number> | undefined;
}

/** Source-file extension test: a spliced script partial origin (Phase 54/55). */
function isPartialSource(src: string | null | undefined): boolean {
  return !!src && (src.endsWith('.rzts') || src.endsWith('.rzjs'));
}

/**
 * Recover a partial source's constant emit-line offset from the table. The table
 * is keyed by the absolute `loc.filename` stashed at splice time; a child map's
 * `sources` entry is the same absolute path, so an exact lookup is tried first,
 * then a suffix/basename match as a defensive fallback (path normalization can
 * differ between the IR `loc.filename` and the generator's emitted `sources`).
 * Returns `undefined` when no offset is known (mapping left as-is — D-04).
 */
function lookupPartialOffset(
  src: string | null | undefined,
  offsets: Map<string, number> | undefined,
): number | undefined {
  if (!src || !offsets || offsets.size === 0) return undefined;
  const exact = offsets.get(src);
  if (exact !== undefined) return exact;
  for (const [file, off] of offsets) {
    if (src === file || src.endsWith(file) || file.endsWith(src)) return off;
  }
  return undefined;
}

/**
 * Phase 55 Plan 03 (SC-2) — build the per-partial-file constant emit-line offset
 * table from the lowered script AST.
 *
 * Plan 02 shifted each spliced node's `loc.start.line` to a host-contiguous emit
 * value while stashing the true `.rzts` origin on `extra.__roziePartialOrigin`.
 * The per-partial offset is therefore the (constant) delta
 * `loc.start.line − __roziePartialOrigin.line`; subtracting it from a mapping's
 * original line restores the `.rzts`-local line. The offset is constant per
 * spliced block (Plan 02 anchored it), so one entry per partial `source` file
 * suffices — the first stashed node per file wins.
 *
 * Walks `scriptAst.program.body` (the spliced statements sit at top level) and
 * their attached leading/trailing comments (comments carry the stash directly).
 * Never throws (D-04): a missing/zero stash is skipped, a null AST yields an
 * empty table.
 */
export function buildPartialLineOffsets(
  scriptAst: BabelFile | null | undefined,
): Map<string, number> {
  const out = new Map<string, number>();
  const body = scriptAst?.program?.body;
  if (!body) return out;
  const record = (
    carrier: { __roziePartialOrigin?: { line: number; filename?: string } } | undefined,
    locLine: number | undefined,
  ): void => {
    const origin = carrier?.__roziePartialOrigin;
    if (!origin || locLine === undefined) return;
    const key = origin.filename;
    if (!key || out.has(key)) return;
    out.set(key, locLine - origin.line);
  };
  for (const node of body) {
    const extra = node.extra as
      | { __roziePartialOrigin?: { line: number; filename?: string } }
      | undefined;
    record(extra, node.loc?.start.line);
    for (const c of node.leadingComments ?? [])
      record(
        c as unknown as { __roziePartialOrigin?: { line: number; filename?: string } },
        c.loc?.start.line,
      );
    for (const c of node.trailingComments ?? [])
      record(
        c as unknown as { __roziePartialOrigin?: { line: number; filename?: string } },
        c.loc?.start.line,
      );
  }
  return out;
}

/**
 * Phase 55 Plan 03 — per-target script-map flow survey (Task 1, Assumption A3).
 *
 * SURVEY RESULT (confirmed on disk 2026-06-20):
 *
 *  1. CONVERGENCE — all SIX per-target `sourcemap/compose.ts` wrappers
 *     (react/vue/svelte/solid/lit/angular) import THIS `composeMaps` and route
 *     their @babel/generator <script> child map through it as `children[0]`. No
 *     target hand-rolls a second map merge; `composeMaps` is the single
 *     convergence point, so the spliced-line restore arithmetic lives here ONCE
 *     (D-03/D-05 uniformity) — never in a per-target wrapper or `emitScript.ts`.
 *
 *  2. ACTIVE MAP PATH — the five map-EMITTING targets (react/vue/svelte/solid/
 *     angular) all pass a defined `userCodeLineOffset`, so each takes the
 *     `userCodeLineOffset` branch below (step 3). Empirically, that branch
 *     discarded the child map's per-node `sources` (it hardcoded `[opts.filename]`),
 *     collapsing a spliced node's `.rzts` origin to the host `.rozie` — which is
 *     exactly why the SC-2 line-fidelity smoke test was red/skipped. The restore
 *     therefore lives in step 3. The step-4 remapping path is NOT exercised by
 *     partials (every map-emitting target passes `userCodeLineOffset`), so it is
 *     deliberately left untouched rather than carrying speculative dead code.
 *
 *  3. TABLE BUILD SITE — each of those five `emitXxx.ts` holds the lowered `ir`
 *     (whose `ir.setupBody.scriptProgram` script AST carries the spliced nodes'
 *     `extra.__roziePartialOrigin` stashes from Plan 02). Each builds the
 *     `partialLineOffsets` table via {@link buildPartialLineOffsets} and threads
 *     it into the `ComposeOpts` it already constructs. The table derives from the
 *     IR, NOT from generator output — so NO `emitScript.ts` (the @babel/generator
 *     caller) is touched (D-03).
 *
 *  4. LIT EXCEPTION — `packages/targets/lit/src/emitLit.ts` returns `map: null`
 *     in v1 and does NOT call `composeSourceMap` (the wrapper is implemented but
 *     dead until Phase 7 wires it). Lit therefore has no build+set site; its
 *     wrapper still receives the `partialLineOffsets` field for forward-compat so
 *     the restore flows automatically once Lit's map path is connected.
 *
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

    // Phase 55 Plan 03 (SC-2): when the child map carries spliced `.rzts`/`.rzjs`
    // sources AND we have an offset table, PRESERVE those per-node sources (so a
    // spliced node's map resolves to its `.rzts` origin FILE — D-01) and RESTORE
    // the original LINE by subtracting the partial's constant emit-line offset.
    // The legacy branch below hardcoded `sources:[opts.filename]`, collapsing the
    // `.rzts` origin onto the host `.rozie` and discarding the line entirely.
    const childSources = childMap.sources ?? [];
    const hasPartial =
      childSources.some((s) => isPartialSource(s)) &&
      !!opts.partialLineOffsets &&
      opts.partialLineOffsets.size > 0;

    if (hasPartial) {
      // Decode → subtract the per-source offset from each `.rzts`-sourced segment's
      // original line → re-encode. Subtracting a constant from selected original
      // lines is the entire restore (the constant per-block offset preserves all
      // intra-block deltas — RESEARCH Key Finding). Guarded so a malformed segment
      // never throws (D-04).
      const decoded = decode(childMap.mappings);
      for (const line of decoded) {
        for (const seg of line) {
          // seg = [genCol, srcIdx, origLine, origCol, (nameIdx)] — only segments
          // with a source (length >= 4) carry an original line to restore. The
          // length guard narrows to the sourced-segment tuple; mutating `full`
          // mutates the same array reference the encoder re-reads.
          if (seg.length >= 4) {
            const full = seg as [number, number, number, number, number?];
            const src = childSources[full[1]];
            const off = lookupPartialOffset(src, opts.partialLineOffsets);
            if (off !== undefined) full[2] -= off;
          }
        }
      }
      const restoredMappings = encode(decoded);
      const sources = childSources.slice();
      const sourcesContent = sources.map((s, i) =>
        s === opts.filename ? opts.source : (childMap.sourcesContent?.[i] ?? null),
      );
      const adjusted: EncodedSourceMap = {
        version: 3,
        file: `${opts.filename}${opts.fileExt}`,
        sources,
        sourcesContent,
        names: childMap.names ?? [],
        mappings: ';'.repeat(opts.userCodeLineOffset) + restoredMappings,
      };
      return adjusted as unknown as MagicStringSourceMap;
    }

    // Legacy (no spliced-partial sources) — byte-identical to pre-Phase-55.
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
