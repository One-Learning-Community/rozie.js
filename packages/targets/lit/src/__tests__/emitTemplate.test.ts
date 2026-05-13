/**
 * emitTemplate unit tests — Plan 06.4-02 Task 1.
 *
 * Verifies the Lit sigil emission table (see PATTERNS.md):
 *
 *   :prop="expr"            → prop=${expr} (or .prop= for form inputs)
 *   :disabled="cond"        → ?disabled=${cond} (boolean attribute sigil)
 *   @click="fn"             → @click=${fn}
 *   {{ expr }}              → ${expr}
 *   r-for                   → ${repeat(...)}
 *   r-if/r-else             → inline ternary with `nothing` sentinel
 *   composition <Foo/>      → <rozie-foo></rozie-foo>
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

describe('emitTemplate — Lit sigil emission table', () => {
  it('Counter: emits ?disabled=${...} for boolean attribute binding', () => {
    const code = compile('Counter');
    expect(code).toContain('?disabled=${');
  });

  it('Counter: emits @click=${this.method} for event handlers', () => {
    const code = compile('Counter');
    expect(code).toMatch(/@click=\$\{this\.(increment|decrement)\}/);
  });

  it('Counter: emits ${...} for {{ }} interpolation', () => {
    const code = compile('Counter');
    expect(code).toContain('${this.value}');
  });

  it('SearchInput: emits .value=${...} property binding on form input', () => {
    const code = compile('SearchInput');
    expect(code).toMatch(/\.value=\$\{this\._query\.value\}/);
  });

  it('TodoList: emits ${repeat(...)} for r-for', () => {
    const code = compile('TodoList');
    expect(code).toContain('repeat(');
    expect(code).toContain("from 'lit/directives/repeat.js'");
  });

  it('TodoList: emits inline ternary with `nothing` for r-if/r-else', () => {
    const code = compile('Dropdown');
    expect(code).toContain('? html`');
    expect(code).toContain(': nothing');
    expect(code).toContain("import { LitElement, css, html, nothing } from 'lit';");
  });

  it('Card: emits <rozie-foo> tag for composition <Foo>', () => {
    const code = compile('Card');
    expect(code).toContain('<rozie-card-header');
  });

  it('TreeNode: emits <rozie-tree-node> for self-reference (NO extra import)', () => {
    const code = compile('TreeNode');
    expect(code).toContain('<rozie-tree-node');
    expect(code).not.toContain("import './TreeNode.rozie';");
  });
});
