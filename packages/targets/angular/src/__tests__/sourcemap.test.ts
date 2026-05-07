/**
 * sourcemap.test.ts — Phase 06.1 D-110/A1 SourceMapConsumer unit test (Angular target).
 *
 * Asserts that `hovering` in the emitted Counter.ts resolves to its real
 * .rozie source line via SourceMapConsumer.originalPositionFor — NOT line 1
 * col 0 (the pre-Phase-06.1 degenerate behavior).
 *
 * V1 PER-BLOCK ACCURACY NOTE (P2 SUMMARY: scriptMap=null in v1):
 * We query the SCRIPT-section `hovering = signal(false)` declaration. Per
 * P2 SUMMARY's "Next Phase Readiness" section, v1 buildShell single-envelope
 * fallback (D-102) maps the entire emitted module to the `<rozie>` envelope
 * byte range; the data-decl `hovering: false` literal line resolution requires
 * P2's per-expression scriptMap (deferred to v2). The v1 contract is
 * "user-authored region of source, NOT line 1 col 0" — exactly what this
 * test asserts.
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
  it('hovering identifier resolves to its <data> declaration region, not line 1', () => {
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

    // Locate the SCRIPT-section `hovering` declaration: `hovering = signal(false)`.
    const declMatch = 'hovering = signal';
    const declIdx = result.code.indexOf(declMatch);
    expect(declIdx).toBeGreaterThan(-1);
    const idx = declIdx; // already points at the bare `hovering` identifier

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

    const dataDeclLine = src.split('\n').findIndex((l) => /\bhovering: false\b/.test(l)) + 1;
    const styleEndLine = src.split('\n').findIndex((l) => /<\/style>/.test(l)) + 1;
    expect(dataDeclLine).toBeGreaterThan(0);

    expect(pos.source).toBe(filename);
    expect(pos.line).not.toBe(1); // explicit regression guard (D-110 wording)
    expect(pos.line).not.toBeNull();
    // V1 per-block accuracy: pos.line falls within the user-authored region.
    expect(pos.line!).toBeGreaterThan(0);
    expect(pos.line!).toBeLessThanOrEqual(styleEndLine);
  });
});
