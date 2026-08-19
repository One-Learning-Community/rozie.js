/**
 * composition unit tests — Plan 06.4-02 Task 2.
 *
 * Verifies cross-rozie composition + self-reference emission per D-LIT
 * carry-forward from Phase 06.2:
 *   - cross-component IR `tagKind: 'component'` emits side-effect
 *     `import './Foo.rozie';` (no symbol bind) + `<rozie-foo>` tag verbatim.
 *   - self-reference IR `tagKind: 'self'` emits `<rozie-tree-node>` tag
 *     with NO extra import — the class self-registers via @customElement.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compile(name: string): string {
  const source = readFileSync(resolve(ROOT, `examples/${name}.rozie`), 'utf8');
  const { ast } = parse(source, { filename: `${name}.rozie` });
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast!, { modifierRegistry: registry });
  return emitLit(ir!, { filename: `${name}.rozie`, source, modifierRegistry: registry }).code;
}

describe('composition — Lit cross-component + self-reference', () => {
  it("Card emits side-effect `import './CardHeader.rozie';` (no symbol bind)", () => {
    const code = compile('Card');
    expect(code).toContain("import './CardHeader.rozie';");
    // It is a BARE import — no `import X from`.
    expect(code).not.toMatch(/import\s+[A-Za-z_][\w]*\s+from\s+['"]\.\/CardHeader\.rozie['"]/);
  });

  it('Card emits <rozie-card-header> tag for the composition reference', () => {
    const code = compile('Card');
    expect(code).toContain('<rozie-card-header');
  });

  it('ModalConsumer embeds Modal + WrapperModal via side-effect imports + <rozie-modal>/<rozie-wrapper-modal> tags', () => {
    const code = compile('ModalConsumer');
    expect(code).toContain("import './Modal.rozie';");
    expect(code).toContain("import './WrapperModal.rozie';");
    expect(code).toContain('<rozie-modal');
    expect(code).toContain('<rozie-wrapper-modal');
  });

  it('TreeNode emits <rozie-tree-node> for self-reference inside its own render', () => {
    const code = compile('TreeNode');
    expect(code).toContain('<rozie-tree-node');
  });

  it('TreeNode does NOT emit a self side-effect import (class self-registers)', () => {
    const code = compile('TreeNode');
    expect(code).not.toContain("import './TreeNode.rozie';");
  });

  it('Each composition target has @customElement decorator that registers the tag', () => {
    expect(compile('Card')).toContain("@customElement('rozie-card')");
    expect(compile('CardHeader')).toContain("@customElement('rozie-card-header')");
    expect(compile('Counter')).toContain("@customElement('rozie-counter')");
    expect(compile('TreeNode')).toContain("@customElement('rozie-tree-node')");
  });
});
