/**
 * sourcemap.test.ts — Phase 06.1 D-110/A1 + P2 SourceMapConsumer unit test (React target).
 *
 * Asserts that user-authored <script> statements in the emitted Counter.tsx
 * resolve to their real .rozie source lines via SourceMapConsumer.originalPositionFor.
 *
 * P2 ACCURACY NOTE (userCodeLineOffset / GEN_OPTS_MAP):
 * emitScript now generates a unified source map from mappable user-authored
 * statements (those NOT wrapped by tryWrapEscapingHelperUseCallback). The map
 * is shifted by userCodeLineOffset semicolons in composeMaps so tsx output
 * lines align with .rozie source lines. This test verifies that `console.log`
 * (a plain ExpressionStatement) maps correctly to its line in Counter.rozie.
 *
 * Hook-section declarations (useState, useControllableState, useMemo, etc.)
 * are NOT covered by the per-statement map — they are generated synthetic
 * nodes with no .rozie source location. The P1 shell-level fallback covered
 * them coarsely; P2 focuses on user-authored code precision.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(__dirname, '../../../../../examples/Counter.rozie');

describe('Phase 06.1 D-110/A1 — React sourcemap resolves to correct .rozie line', () => {
  it('console.log user statement resolves to its <script> line, not line 1', () => {
    const filename = 'Counter.rozie';
    const src = readFileSync(COUNTER_PATH, 'utf8');
    const parseRes = parse(src, { filename });
    expect(parseRes.ast).not.toBeNull();
    const ast = parseRes.ast!;
    const irRes = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(irRes.ir).not.toBeNull();
    const ir = irRes.ir!;

    const result = emitReact(ir, {
      filename,
      source: src,
      blockOffsets: ast.blocks,
    });
    expect(result.map).not.toBeNull();
    const map = result.map!;

    // Locate the user-authored `console.log("hello from rozie")` statement in
    // the emitted React tsx — this is a plain ExpressionStatement (not wrapped
    // by tryWrapEscapingHelperUseCallback), so it appears in the per-statement
    // source map with its original .rozie source location.
    const declMatch = 'console.log("hello from rozie")';
    const declIdx = result.code.indexOf(declMatch);
    expect(declIdx).toBeGreaterThan(-1);

    const before = result.code.slice(0, declIdx);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    const column = lastNewline === -1 ? declIdx : declIdx - (lastNewline + 1);

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: map.sources,
      sourcesContent: map.sourcesContent ?? null,
      names: map.names ?? [],
      mappings: map.mappings,
      file: 'Counter.rozie.tsx',
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    const pos = consumer.originalPositionFor({ line, column });

    // Per Pitfall 10 — derive expected source line at runtime.
    const scriptConsoleLogLine =
      src.split('\n').findIndex((l) => /console\.log\(/.test(l)) + 1;
    const styleEndLine = src.split('\n').findIndex((l) => /<\/style>/.test(l)) + 1;
    expect(scriptConsoleLogLine).toBeGreaterThan(0);

    expect(pos.source).toBe(filename);
    expect(pos.line).not.toBe(1); // explicit regression guard (D-110 wording)
    expect(pos.line).not.toBeNull();
    // P2 per-statement accuracy: the console.log line should resolve precisely
    // to its Counter.rozie <script> block line.
    expect(pos.line!).toBeGreaterThan(0);
    expect(pos.line!).toBeLessThanOrEqual(styleEndLine);
    // Tighter bound: console.log is in the <script> block, so the resolved line
    // should match the actual source line within ±2 (allowing for minor offset
    // differences due to generator formatting).
    expect(Math.abs(pos.line! - scriptConsoleLogLine)).toBeLessThanOrEqual(2);
  });
});
