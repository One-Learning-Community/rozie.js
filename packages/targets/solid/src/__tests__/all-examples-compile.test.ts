/**
 * Plan 06.3-01 Task 3 — all-examples-compile tests.
 *
 * Tests 4-6 per task specification:
 *   - Test 4: Counter compiles without errors
 *   - Test 5: All 8 examples compile without error-severity diagnostics
 *   - Test 6: Modal cross-rozie import is extensionless (solid: '' in TARGET_EXT_MAP)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');
const EXAMPLES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal', 'TreeNode', 'Card', 'CardHeader'] as const;

describe('compile() — target: solid — P1 reachability', () => {
  for (const name of EXAMPLES) {
    it(name + ' compiles to non-empty TSX without errors', () => {
      const source = readFileSync(resolve(ROOT, 'examples/' + name + '.rozie'), 'utf8');
      const result = compile(source, {
        target: 'solid',
        filename: name + '.rozie',
        sourceMap: false,
      });
      const errs = result.diagnostics.filter((d) => d.severity === 'error');
      expect(errs).toEqual([]);
      expect(result.code.length).toBeGreaterThan(0);
    });
  }

  it("Modal embeds Counter via cross-rozie import (extensionless per solid: '')", () => {
    const source = readFileSync(resolve(ROOT, 'examples/Modal.rozie'), 'utf8');
    const result = compile(source, { target: 'solid', filename: 'Modal.rozie', sourceMap: false });
    expect(result.code).toContain("import Counter from './Counter'");
  });
});
