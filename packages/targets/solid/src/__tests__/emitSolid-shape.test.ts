/**
 * emitSolid-shape tests — Plan 06.3-01 Task 2 Tests 1-4.
 *
 * Verifies the shape contract of emitSolid():
 *   Test 1: Returns { code: string, map, diagnostics: [] } shape
 *   Test 2: Emitted code is parseable TSX
 *   Test 3: Emits an import from 'solid-js'
 *   Test 4: Applies splitProps universally (D-141)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { emitSolid } from '../emitSolid.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

describe('emitSolid — shape contract', () => {
  it('Test 1: returns { code, map, diagnostics } shape', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    expect(ast).not.toBeNull();
    const { ir } = lowerToIR(ast!, {});
    expect(ir).not.toBeNull();
    const result = emitSolid(ir!, { filename: 'Counter.rozie', source });
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
    expect(Array.isArray(result.diagnostics)).toBe(true);
    // Diagnostics should only contain warnings or less — no errors.
    const errors = result.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('Test 2: emits parseable TSX', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const { ir } = lowerToIR(ast!, {});
    const result = emitSolid(ir!, { filename: 'Counter.rozie', source });
    expect(() =>
      babelParse(result.code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      }),
    ).not.toThrow();
  });

  it("Test 3: emits an import from 'solid-js' and 'export default function Counter'", () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const { ir } = lowerToIR(ast!, {});
    const result = emitSolid(ir!, { filename: 'Counter.rozie', source });
    expect(result.code).toContain("from 'solid-js'");
    expect(result.code).toContain('export default function Counter');
  });

  it('Test 4: applies splitProps universally — code contains splitProps(_props, ...)', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const { ir } = lowerToIR(ast!, {});
    const result = emitSolid(ir!, { filename: 'Counter.rozie', source });
    expect(result.code).toContain('splitProps(_props,');
  });
});
