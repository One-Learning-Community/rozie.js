/**
 * fixtures.test.ts — Plan 06.4-02 fixture-lock harness.
 *
 * Compiles each of the 8 reference examples with target='lit' and locks the
 * output via Vitest's `toMatchFileSnapshot`. The snapshot files live at
 * src/__tests__/fixtures/<Name>.lit.ts.snap and double as the byte-identical
 * reference for the emitter — any unintended drift surfaces as a snapshot diff.
 *
 * The integration tests (sc1-*, sc2-*, sc3-*, sc6-*) read these snapshots
 * directly via `readFileSync`.
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
const FIXTURES = resolve(HERE, 'fixtures');

function compileToLit(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  if (!ast) throw new Error(`parse() returned null for ${name}.rozie`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${name}.rozie`);
  const { code } = emitLit(ir, {
    filename: `${name}.rozie`,
    source,
    modifierRegistry: registry,
  });
  return code;
}

describe('emitLit fixtures — Plan 06.4-02 locked snapshots', () => {
  it('Counter.lit.ts.snap', async () => {
    const code = compileToLit('Counter');
    // SC1 invariants (Phase 06.4 success criterion 1).
    expect(code).toContain('export default class Counter extends SignalWatcher(LitElement)');
    expect(code).toContain("@customElement('rozie-counter')");
    expect(code).toContain('createLitControllableProperty');
    expect(code).toContain('static styles = css`');
    expect(code).toContain('render()');
    expect(code).toContain('html`');
    // Invariants
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    expect(code).not.toMatch(/@queryAssignedNodes\s*\(/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Counter.lit.ts.snap'));
  });

  it('SearchInput.lit.ts.snap', async () => {
    const code = compileToLit('SearchInput');
    expect(code).toContain('export default class SearchInput extends SignalWatcher(LitElement)');
    expect(code).toContain("@customElement('rozie-search-input')");
    expect(code).toContain('.value=${');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'SearchInput.lit.ts.snap'));
  });

  it('Dropdown.lit.ts.snap', async () => {
    const code = compileToLit('Dropdown');
    expect(code).toContain('export default class Dropdown extends SignalWatcher(LitElement)');
    expect(code).toContain('attachOutsideClickListener');
    expect(code).toContain('injectGlobalStyles');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Dropdown.lit.ts.snap'));
  });

  it('TodoList.lit.ts.snap', async () => {
    const code = compileToLit('TodoList');
    expect(code).toContain('export default class TodoList extends SignalWatcher(LitElement)');
    expect(code).toContain('repeat(');
    expect(code).toContain('data-rozie-params');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TodoList.lit.ts.snap'));
  });

  it('Modal.lit.ts.snap', async () => {
    const code = compileToLit('Modal');
    expect(code).toContain('export default class Modal extends SignalWatcher(LitElement)');
    expect(code).toContain("injectGlobalStyles('rozie-modal-global'");
    expect(code).toContain('_disconnectCleanups');
    // Counter is composed inside Modal via <components>.
    expect(code).toContain("import './Counter.rozie';");
    expect(code).toContain('<rozie-counter');
    // Slot presence
    expect(code).toContain('@queryAssignedElements');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    expect(code).not.toMatch(/@queryAssignedNodes\s*\(/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Modal.lit.ts.snap'));
  });

  it('TreeNode.lit.ts.snap', async () => {
    const code = compileToLit('TreeNode');
    expect(code).toContain('export default class TreeNode extends SignalWatcher(LitElement)');
    // Self-reference: NO 'import ./TreeNode.rozie;' (the class self-registers).
    expect(code).not.toContain("import './TreeNode.rozie';");
    // The recursive child uses `<rozie-tree-node>` tag emitted inside html``.
    expect(code).toContain('<rozie-tree-node');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'TreeNode.lit.ts.snap'));
  });

  it('Card.lit.ts.snap', async () => {
    const code = compileToLit('Card');
    expect(code).toContain('export default class Card extends SignalWatcher(LitElement)');
    // Wrapper composition: side-effect import for CardHeader, NO symbol bind.
    expect(code).toContain("import './CardHeader.rozie';");
    expect(code).toContain('<rozie-card-header');
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'Card.lit.ts.snap'));
  });

  it('CardHeader.lit.ts.snap', async () => {
    const code = compileToLit('CardHeader');
    expect(code).toContain('export default class CardHeader extends SignalWatcher(LitElement)');
    expect(code).toContain("@customElement('rozie-card-header')");
    expect(code).not.toMatch(/unsafe-html|unsafeHTML/);
    await expect(code).toMatchFileSnapshot(resolve(FIXTURES, 'CardHeader.lit.ts.snap'));
  });
});
