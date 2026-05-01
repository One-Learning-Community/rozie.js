// PARSE-07 / D-17 — full RozieAST snapshot scaffold (Plan 01 / Wave 0)
// Implementation lands in Plan 04. Anchors paths per RESEARCH.md Pitfall 8.
//
// Per D-17, the full RozieAST per example is committed to fixtures/ast/{name}.snap
// using Vitest toMatchFileSnapshot. These snapshots are the primary acceptance
// fixture for Phase 1.
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../fixtures/ast');

describe('full RozieAST per example (PARSE-07 / D-17)', () => {
  it('test infrastructure is wired', () => {
    expect(EXAMPLES_DIR).toMatch(/examples$/);
    expect(FIXTURES_DIR).toMatch(/fixtures\/ast$/);
  });

  it.todo('full RozieAST snapshot for Counter.rozie matches fixtures/ast/Counter.snap');
  it.todo('full RozieAST snapshot for SearchInput.rozie matches fixtures/ast/SearchInput.snap');
  it.todo('full RozieAST snapshot for Dropdown.rozie matches fixtures/ast/Dropdown.snap');
  it.todo('full RozieAST snapshot for TodoList.rozie matches fixtures/ast/TodoList.snap');
  it.todo('full RozieAST snapshot for Modal.rozie matches fixtures/ast/Modal.snap');
});
