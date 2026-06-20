/**
 * partial-origin-sourcemap.test.ts — Phase 55 (script-partial literal
 * byte-identity) SC-2 source-map LINE-fidelity gate for spliced partial nodes.
 *
 * Phase 55 decouples the line `@babel/generator` uses for emit spacing/comment
 * placement (rewritten to a HOST-contiguous value, Plan 02) from the line it uses
 * for the source-map origin (must still resolve to the `.rzts` partial-local line,
 * Plan 03). This test compiles examples/PartialInlineHostC.rozie — whose `usedName`
 * $computed is INLINED from the sibling ./partialLogicC.rzts — with
 * `sourceMap: true` and a resolverRoot of examples/, then asserts that the emitted
 * source map resolves the spliced declarations to:
 *
 *   • a `source` ending in `.rzts` (the partial origin FILE — D-01). Before
 *     Plan 03 the userCodeLineOffset compose branch hardcoded the host `.rozie`
 *     as the only source, collapsing every spliced node's `.rzts` origin; the
 *     Plan 03 line-restore preserves the per-node `.rzts` source AND, AND
 *   • a PARTIAL-LOCAL origin line (the authored line in partialLogicC.rzts), NOT
 *     the host-contiguous emit line (~34–40) that Plan 02 stamped onto `loc` for
 *     generator spacing — the strict R7 LINE fidelity restored by the composeMaps
 *     per-block offset subtraction.
 *
 * NOTE ON PROBE SHAPE: the assertion decodes the emitted `.map` and inspects the
 * resolved ORIGINAL positions directly (via SourceMapConsumer.eachMapping) rather
 * than probing one fixed generated position with originalPositionFor. A spliced
 * declaration's GENERATED-line alignment is independently imperfect for partial
 * content (see .planning/.../deferred-items.md #1 — a pre-existing userCodeLineOffset
 * machinery limitation orthogonal to the Plan 03 original-line restore), so a
 * fixed-generated-position probe is unreliable. Decoding the map proves the thing
 * Plan 03 actually delivers: the spliced block's declarations resolve to the
 * `.rzts` FILE at their PARTIAL-LOCAL origin LINES.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { compile } from '@rozie/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../examples');

// The host that inlines `{ usedName }` from ./partialLogicC.rzts.
const HOST = 'PartialInlineHostC.rozie';

// PARTIAL-LOCAL origin lines (in examples/partialLogicC.rzts) of the spliced
// block's three surviving declarations — recovered by the Plan 03 line-restore:
//   • 20 — the between-statement block comment above `double`
//   • 21 — the retained `double` transitive helper
//   • 23 — the leading comment immediately above the used `usedName` $computed
//          (the declaration's recoverable partial-local anchor)
// Pre-restore these were the host-contiguous emit lines 36/37/39 (Plan 02). If
// the fixture's comment header changes these must move with it.
const SPLICED_PARTIAL_LINES = [20, 21, 23];

// partialLogicC.rzts is 26 lines; any restored .rzts line at or below this is
// partial-local (i.e. the offset WAS subtracted), categorically distinct from the
// host-contiguous emit lines the generator stamped onto `loc`.
const PARTIAL_LINE_COUNT = 26;

describe('Phase 55 — spliced partial node source-map resolves to .rzts origin LINE', () => {
  it('the spliced usedName closure resolves to partialLogicC.rzts at partial-local lines (not the host-contiguous emit line)', () => {
    const filename = resolve(EXAMPLES_DIR, HOST);
    const source = readFileSync(filename, 'utf8');

    // Compile React with source maps; resolverRoot=examples so the
    // ProducerResolver locates the sibling ./partialLogicC.rzts at inline time.
    const result = compile(source, {
      target: 'react',
      filename,
      resolverRoot: EXAMPLES_DIR,
      sourceMap: true,
      types: false,
    });

    expect(result.code.length).toBeGreaterThan(0);
    expect(result.map).not.toBeNull();

    // D-01 (file origin): the `.rzts` partial survives as a map source — it was
    // collapsed onto the host `.rozie` before the Plan 03 restore.
    expect(result.map!.sources.some((s) => s.endsWith('.rzts'))).toBe(true);

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: result.map!.sources,
      sourcesContent: result.map!.sourcesContent ?? null,
      names: result.map!.names ?? [],
      mappings: result.map!.mappings,
      file: `${HOST}.tsx`,
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    // Collect every ORIGINAL line that resolves to the `.rzts` partial.
    const rztsLines = new Set<number>();
    consumer.eachMapping((m) => {
      if ((m.source ?? '').endsWith('.rzts')) rztsLines.add(m.originalLine);
    });

    expect(rztsLines.size).toBeGreaterThan(0);

    // D-01 (line fidelity): each spliced declaration's PARTIAL-LOCAL origin line
    // is recovered — proving the per-block offset was subtracted (pre-restore
    // these resolved to the host-contiguous emit lines 36/37/39).
    for (const line of SPLICED_PARTIAL_LINES) {
      expect(rztsLines.has(line)).toBe(true);
    }

    // And the recovered lines are partial-LOCAL (at/below the partial's authored
    // line count), categorically NOT the host-contiguous emit lines.
    const minLine = Math.min(...rztsLines);
    expect(minLine).toBeGreaterThan(0);
    expect(minLine).toBeLessThanOrEqual(PARTIAL_LINE_COUNT);
  });
});
