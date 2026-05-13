/**
 * SC3 partial integration test — slot mapping (default / named / scoped-data /
 * scoped-function) at the IR audit level.
 *
 * Note: full SC3 (the 6-class slot acceptance matrix) is Phase 7's gate; this
 * test covers the Lit-side of the slot IR audit only. Specifically:
 *
 *   - default slot         → `<slot></slot>`
 *   - named slot           → `<slot name="X"></slot>`
 *   - scoped data-typed    → `<slot name="X" data-rozie-params=${...}>`
 *   - scoped function-typed → host-listener wiring emitted
 *
 * Reads the locked Modal + TodoList snapshots — fixtures already locked by
 * fixtures.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODAL = resolve(HERE, '../fixtures/Modal.lit.ts.snap');
const TODOLIST = resolve(HERE, '../fixtures/TodoList.lit.ts.snap');
const DROPDOWN = resolve(HERE, '../fixtures/Dropdown.lit.ts.snap');

describe('SC3 — slot mapping (partial integration)', () => {
  it('default slot emits <slot></slot> verbatim (no name attribute)', () => {
    const code = readFileSync(MODAL, 'utf8');
    expect(code).toMatch(/<slot><\/slot>/);
  });

  it('named slot emits <slot name="X"></slot>', () => {
    const code = readFileSync(MODAL, 'utf8');
    expect(code).toMatch(/<slot name="header">/);
    expect(code).toMatch(/<slot name="footer">/);
  });

  it('scoped slot data-typed emits data-rozie-params attribute', () => {
    const code = readFileSync(TODOLIST, 'utf8');
    expect(code).toContain('data-rozie-params=');
    expect(code).toContain('JSON.stringify(');
  });

  it('scoped slot function-typed emits host-listener wiring (D-LIT-12)', () => {
    // Dropdown's <slot name="trigger" :open="..." :toggle="..." /> has toggle as a function-typed param.
    const code = readFileSync(DROPDOWN, 'utf8');
    expect(code).toMatch(/this\.addEventListener\('rozie-trigger-toggle'/);
  });

  it('default slot in shadow tree uses queryAssignedElements({ flatten: true })', () => {
    // The flatten:true + no slot: filter is the default-slot decorator opts.
    const code = readFileSync(MODAL, 'utf8');
    expect(code).toContain('@queryAssignedElements({ flatten: true })');
  });

  it('named slots use queryAssignedElements with slot: filter', () => {
    const code = readFileSync(MODAL, 'utf8');
    expect(code).toContain("@queryAssignedElements({ slot: 'header', flatten: true })");
    expect(code).toContain("@queryAssignedElements({ slot: 'footer', flatten: true })");
  });

  it('NO @queryAssignedNodes calls in any slot decl (D-LIT-14 correction)', () => {
    const modal = readFileSync(MODAL, 'utf8');
    const todoList = readFileSync(TODOLIST, 'utf8');
    const dropdown = readFileSync(DROPDOWN, 'utf8');
    for (const code of [modal, todoList, dropdown]) {
      expect(code).not.toMatch(/@queryAssignedNodes\s*\(/);
    }
  });
});
