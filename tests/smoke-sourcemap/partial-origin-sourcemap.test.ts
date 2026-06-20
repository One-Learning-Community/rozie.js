/**
 * partial-origin-sourcemap.test.ts — Phase 55 (script-partial literal
 * byte-identity) SC-2 source-map LINE-fidelity gate for spliced partial nodes.
 *
 * Phase 55 decouples the line `@babel/generator` uses for emit spacing/comment
 * placement (rewritten to a HOST-contiguous value) from the line it uses for the
 * source-map origin (must still resolve to the `.rzts` partial-local line). This
 * test compiles examples/PartialInlineHostC.rozie — whose `usedName` $computed is
 * INLINED from the sibling ./partialLogicC.rzts — with `sourceMap: true` and a
 * resolverRoot of examples/, then asserts via SourceMapConsumer that a generated
 * position inside the spliced `usedName` declaration resolves to:
 *
 *   • a `source` ending in `.rzts` (the partial origin FILE — already preserved
 *     via loc.filename today), AND
 *   • an `originalLine` equal to the partial-LOCAL line of that declaration (NOT
 *     the host-contiguous emit line) — the strict R7 LINE fidelity restored by
 *     the composeMaps line-restore.
 *
 * SKIPPED in Plan 01: un-skip in Plan 03 after the composeMaps line-restore lands
 * (SC-2 line fidelity). Until then the spliced node's emitted `.map` resolves to
 * the host-contiguous emit line, so this assertion fails by design.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { compile } from '@rozie/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../examples');

// The host that inlines `{ usedName }` from ./partialLogicC.rzts. The partial's
// used $computed export sits on a known partial-LOCAL line — see partialLogicC.rzts.
const HOST = 'PartialInlineHostC.rozie';

// `export const usedName = $computed(...)` in examples/partialLogicC.rzts. If the
// fixture's comment header changes this must move with it.
const PARTIAL_ORIGIN_LINE = 24;

describe.skip('Phase 55 — spliced partial node source-map resolves to .rzts origin LINE', () => {
  it('a generated position inside the spliced usedName declaration maps to partialLogicC.rzts at the partial-local line', () => {
    const filename = resolve(EXAMPLES_DIR, HOST);
    const source = readFileSync(filename, 'utf8');

    // Compile one target (React) with source maps; resolverRoot=examples so the
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

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: result.map!.sources,
      sourcesContent: result.map!.sourcesContent ?? null,
      names: result.map!.names ?? [],
      mappings: result.map!.mappings,
      file: `${HOST}.tsx`,
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    // Locate the emitted `usedName` declaration in the generated output and probe
    // the mapping at that generated position.
    const genLine = result.code.split('\n').findIndex((l) => l.includes('usedName')) + 1;
    expect(genLine).toBeGreaterThan(0);
    const genCol = result.code.split('\n')[genLine - 1]!.indexOf('usedName');

    const original = consumer.originalPositionFor({ line: genLine, column: genCol });

    // The spliced node's source map must resolve to the .rzts PARTIAL, not the
    // host .rozie (D-01 file origin).
    expect(original.source ?? '').toMatch(/\.rzts$/);
    // ...and to the partial-LOCAL line, not the host-contiguous emit line
    // (D-01 line fidelity — the composeMaps line-restore).
    expect(original.line).toBe(PARTIAL_ORIGIN_LINE);
  });
});
