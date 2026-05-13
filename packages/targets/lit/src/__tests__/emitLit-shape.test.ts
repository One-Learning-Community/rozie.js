/**
 * emitLit-shape tests — Plan 06.4-01 Task 2 shape contract.
 *
 * Verifies the P1 stub returns the documented EmitLitResult shape for any
 * input. The per-example .ts fixture snapshots get locked in Plan 06.4-02 (P2).
 *
 * Tests:
 *   - emitLit returns { code: string, map: null, diagnostics: [] }
 *   - The stub code is the documented placeholder for now (P2 swaps in real)
 *   - All per-example fixture-snapshot expectations are it.todo (P2-locked)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

describe('emitLit — shape contract', () => {
  it('returns { code, map, diagnostics } shape for a trivial input', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    expect(ast).not.toBeNull();
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    expect(ir).not.toBeNull();
    const result = emitLit(ir!, {
      filename: 'Counter.rozie',
      source,
      modifierRegistry: registry,
    });
    expect(typeof result.code).toBe('string');
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.map).toBeNull();
    expect(Array.isArray(result.diagnostics)).toBe(true);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('returns the documented P1 stub code for any input', () => {
    const source = readFileSync(resolve(ROOT, 'examples/Counter.rozie'), 'utf8');
    const { ast } = parse(source, { filename: 'Counter.rozie' });
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
    const result = emitLit(ir!);
    // P1 stub returns this exact string until P2 lands real emission.
    expect(result.code).toBe('export default class STUB {}\n');
  });

  it('returns non-empty .ts strings for all 8 reference examples', () => {
    const examples = [
      'Counter',
      'SearchInput',
      'Dropdown',
      'TodoList',
      'Modal',
      'TreeNode',
      'Card',
      'CardHeader',
    ];
    const registry = createDefaultRegistry();
    for (const name of examples) {
      const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
      const { ast } = parse(source, { filename: `${name}.rozie` });
      expect(ast, `parse ${name}.rozie`).not.toBeNull();
      const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
      expect(ir, `lowerToIR ${name}.rozie`).not.toBeNull();
      const result = emitLit(ir!, {
        filename: `${name}.rozie`,
        source,
        modifierRegistry: registry,
      });
      expect(result.code.length, `emitLit ${name}.rozie code`).toBeGreaterThan(0);
      const errors = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errors, `emitLit ${name}.rozie diagnostics`).toHaveLength(0);
    }
  });

  // ---- P2-locked fixture snapshots (it.todo) ----
  it.todo('emitLit(Counter.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(SearchInput.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(Dropdown.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(TodoList.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(Modal.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(TreeNode.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(Card.rozie) matches the locked .ts fixture (Plan 06.4-02)');
  it.todo('emitLit(CardHeader.rozie) matches the locked .ts fixture (Plan 06.4-02)');
});
