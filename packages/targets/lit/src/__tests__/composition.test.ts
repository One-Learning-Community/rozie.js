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

  it('Modal embeds Counter via side-effect import + <rozie-counter> tag', () => {
    const code = compile('Modal');
    expect(code).toContain("import './Counter.rozie';");
    expect(code).toContain('<rozie-counter');
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
