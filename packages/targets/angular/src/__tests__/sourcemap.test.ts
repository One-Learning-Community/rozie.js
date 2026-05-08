/**
 * sourcemap.test.ts — Phase 06.1 D-110/A1 SourceMapConsumer unit test (Angular target).
 *
 * Asserts that user-authored code in the emitted Counter.ts resolves to its
 * real .rozie source line via SourceMapConsumer.originalPositionFor — NOT
 * line 1 col 0 (the pre-Phase-06.1 degenerate behavior).
 *
 * P2 UPGRADE (scriptMap=real in P2):
 * We now query the SCRIPT-section `console.log("hello from rozie")` residual
 * statement. This is a user-authored ExpressionStatement that goes into the
 * Angular component constructor body. With P2's per-expression scriptMap
 * (generated via @babel/generator sourceMaps:true over the residual statements),
 * the map accurately resolves this line back to its original .rozie source line.
 * The `userCodeLineOffset` semicolon-prepend trick aligns the scriptMap's
 * generated-line numbers with the actual .ts output line numbers.
 *
 * Note: this test asserts the map produced by emitAngular() — NOT the data-URL
 * trailer that @rozie/unplugin adds in P1 Task 4 Part B (Pitfall 6). The
 * trailer is a chain link FROM emitAngular's output TO analogjs; this test
 * directly examines emitAngular's output.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(__dirname, '../../../../../examples/Counter.rozie');

describe('Phase 06.1 D-110/A1 — Angular sourcemap resolves to correct .rozie line', () => {
  it('console.log residual statement resolves to its exact .rozie source line (P2 per-line accuracy)', () => {
    const filename = 'Counter.rozie';
    const src = readFileSync(COUNTER_PATH, 'utf8');
    const parseRes = parse(src, { filename });
    expect(parseRes.ast).not.toBeNull();
    const ast = parseRes.ast!;
    const irRes = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(irRes.ir).not.toBeNull();
    const ir = irRes.ir!;

    const result = emitAngular(ir, {
      filename,
      source: src,
      blockOffsets: ast.blocks,
    });
    expect(result.map).not.toBeNull();
    const map = result.map!;

    // Locate the user-authored `console.log("hello from rozie")` in the
    // emitted .ts constructor body. This is an ExpressionStatement residual
    // from the <script> block; P2's scriptMap maps it back to its .rozie line.
    const declMatch = 'console.log("hello from rozie")';
    const declIdx = result.code.indexOf(declMatch);
    expect(declIdx).toBeGreaterThan(-1);
    const idx = declIdx;

    const before = result.code.slice(0, idx);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    const column = lastNewline === -1 ? idx : idx - (lastNewline + 1);

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: map.sources,
      sourcesContent: map.sourcesContent ?? null,
      names: map.names ?? [],
      mappings: map.mappings,
      file: 'Counter.rozie.ts',
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    const pos = consumer.originalPositionFor({ line, column });

    // Find the .rozie source line for `console.log("hello from rozie")`.
    const consoleDeclLine = src.split('\n').findIndex((l) => /console\.log\("hello from rozie"\)/.test(l)) + 1;
    const styleEndLine = src.split('\n').findIndex((l) => /<\/style>/.test(l)) + 1;
    expect(consoleDeclLine).toBeGreaterThan(0);

    expect(pos.source).toBe(filename);
    expect(pos.line).not.toBe(1); // explicit regression guard (D-110 wording)
    expect(pos.line).not.toBeNull();
    // P2 per-line accuracy: pos.line must resolve to the exact .rozie source line.
    expect(pos.line!).toBe(consoleDeclLine);
    expect(pos.line!).toBeLessThanOrEqual(styleEndLine);
  });
});
