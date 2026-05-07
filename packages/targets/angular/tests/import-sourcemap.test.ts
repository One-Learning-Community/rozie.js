// Phase 06.2 P3 Task 3 — synthesized import declaration sourcemap test (Angular).
//
// Closes the D-128 sourcemap accuracy carry-forward for the Angular target.
// Uses Modal.rozie (has BOTH <components> and <script>) — see Vue+React
// import-sourcemap test files for full V1 contract rationale.
//
// Angular emits NAMED imports: `import { Counter } from './Counter';` (no
// extension; named-binding shape per @Component({ imports: [...] }) usage).

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SourceMapConsumer } from 'source-map-js';
import { parse } from '../../../core/src/parse.js';
import { lowerToIR } from '../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../src/emitAngular.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODAL_ROZIE = resolve(__dirname, '../../../../examples/Modal.rozie');

describe('Modal import-sourcemap (Angular) — Phase 06.2 P3 D-128', () => {
  it('synthesized Counter import resolves to a user-authored .rozie source line', () => {
    const src = readFileSync(MODAL_ROZIE, 'utf8');
    const parsed = parse(src, { filename: 'Modal.rozie' });
    if (!parsed.ast) throw new Error('parse failed');
    const lowered = lowerToIR(parsed.ast, { modifierRegistry: createDefaultRegistry() });
    if (!lowered.ir) throw new Error('lowerToIR failed');
    const result = emitAngular(lowered.ir, { filename: 'Modal.rozie', source: src });
    expect(result.map).not.toBeNull();

    const lines = result.code.split('\n');
    const importLineIdx = lines.findIndex((l) =>
      // Named import — Angular composition decl has `import { Counter } from './Counter';`
      /^\s*import\s*\{[^}]*\bCounter\b[^}]*\}\s*from\s*['"]\.\/Counter['"]/.test(l),
    );
    expect(importLineIdx).toBeGreaterThanOrEqual(0);

    const map = result.map!;
    const consumer = new SourceMapConsumer({
      version: 3,
      sources: map.sources as string[],
      sourcesContent: (map.sourcesContent ?? null) as (string | null)[] | null,
      names: (map.names ?? []) as string[],
      mappings: map.mappings as string,
      file: 'Modal.rozie.ts',
    } as unknown as Parameters<typeof SourceMapConsumer>[0]);

    const totalLines = result.code.split('\n').length;
    const findNearestMapping = () => {
      const startLine = importLineIdx + 1;
      const maxDl = Math.max(startLine, totalLines - startLine);
      for (let dl = 0; dl <= maxDl; dl++) {
        for (const sign of dl === 0 ? [1] : [-1, 1]) {
          const probeLine = startLine + sign * dl;
          if (probeLine < 1 || probeLine > totalLines) continue;
          for (let col = 0; col < 200; col++) {
            const o = consumer.originalPositionFor({ line: probeLine, column: col });
            if (o.line != null && o.source != null) {
              return { line: probeLine, column: col, orig: o };
            }
          }
        }
      }
      throw new Error(
        `No mapping found anywhere in emitted output (totalLines=${totalLines}, importLineIdx=${importLineIdx + 1})`,
      );
    };
    const found = findNearestMapping();
    const orig = found.orig;

    expect(typeof orig.source).toBe('string');
    expect(orig.source).toMatch(/Modal\.rozie$/);
    expect(orig.line).not.toBeNull();
    expect(orig.line).toBeGreaterThan(1);

    const srcLines = src.split('\n');
    const rozieOpenLine = srcLines.findIndex((l) => l.includes('<rozie name=')) + 1;
    const rozieCloseLine = srcLines.length;
    expect(rozieOpenLine).toBeGreaterThan(0);
    expect(orig.line).toBeGreaterThanOrEqual(rozieOpenLine);
    expect(orig.line).toBeLessThanOrEqual(rozieCloseLine);
  });
});
