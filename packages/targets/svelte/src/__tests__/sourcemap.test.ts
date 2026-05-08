/**
 * sourcemap.test.ts — Phase 06.1 D-110/A1 SourceMapConsumer unit test (Svelte target).
 *
 * Asserts that a user-authored residual statement in the emitted Counter.svelte
 * resolves to its exact .rozie source line via SourceMapConsumer.originalPositionFor.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSvelte } from '../emitSvelte.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(__dirname, '../../../../../examples/Counter.rozie');

describe('Phase 06.1 D-110/A1 — Svelte sourcemap resolves to correct .rozie line', () => {
  it('console.log residual statement resolves to its exact .rozie source line', () => {
    const filename = 'Counter.rozie';
    const src = readFileSync(COUNTER_PATH, 'utf8');
    const parseRes = parse(src, { filename });
    expect(parseRes.ast).not.toBeNull();
    const ast = parseRes.ast!;
    const irRes = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
    expect(irRes.ir).not.toBeNull();
    const ir = irRes.ir!;

    const result = emitSvelte(ir, {
      filename,
      source: src,
      blockOffsets: ast.blocks,
    });
    expect(result.map).not.toBeNull();
    const map = result.map!;

    // Locate the user-authored residual statement in the emitted output.
    const stmtMatch = 'console.log("hello from rozie")';
    const stmtIdx = result.code.indexOf(stmtMatch);
    expect(stmtIdx).toBeGreaterThan(-1);

    const before = result.code.slice(0, stmtIdx);
    const line = before.split('\n').length;
    const lastNewline = before.lastIndexOf('\n');
    const column = lastNewline === -1 ? stmtIdx : stmtIdx - (lastNewline + 1);

    const consumer = new SourceMapConsumer({
      version: 3,
      sources: map.sources,
      sourcesContent: map.sourcesContent ?? null,
      names: map.names ?? [],
      mappings: map.mappings,
      file: 'Counter.rozie.svelte',
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    const pos = consumer.originalPositionFor({ line, column });

    // The statement is on line 32 of Counter.rozie.
    const expectedLine = src.split('\n').findIndex((l) => l.includes(stmtMatch)) + 1;
    expect(expectedLine).toBeGreaterThan(0);

    expect(pos.source).toBe(filename);
    expect(pos.line).toBe(expectedLine);
  });
});
