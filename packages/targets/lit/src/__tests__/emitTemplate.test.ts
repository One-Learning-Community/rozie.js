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

describe('dispatchEvent translation (Phase 07.3.1 D-LIT-17)', () => {
  /**
   * D-LIT-17 — function-typed slot params (e.g. `close`) can't cross the
   * `data-rozie-params` JSON transport (JSON.stringify drops function values).
   * The producer already wires `addEventListener('rozie-<slot>-<param>', ...)`
   * via emitHostListenerWiring.ts. The consumer must dispatch a matching
   * CustomEvent instead of trying to invoke the (always-undefined) function
   * captured into `this._<slot>Ctx`.
   *
   * Detection at buildEventParts matches the EXACT shape
   * `this._<X>Ctx?.<param>` (anchored, no surrounding wrap, no member-chain
   * continuation, no call expression). Composite expressions fall through to
   * the Plan 03 late-binding wrap (which preserves data-typed param semantics).
   */
  function compileConsumer(source: string, name = 'TestConsumer'): string {
    const { ast } = parse(source, { filename: `${name}.rozie` });
    if (!ast) throw new Error('parse() returned null');
    const registry = createDefaultRegistry();
    const { ir } = lowerToIR(ast, { modifierRegistry: registry });
    if (!ir) throw new Error('lowerToIR() returned null');
    ir.name = name;
    return emitLit(ir, {
      filename: `${name}.rozie`,
      source,
      modifierRegistry: registry,
    }).code;
  }

  it('emits dispatchEvent for exact-shape this._headerCtx?.close handler', () => {
    const source = `<rozie name="HeaderCloseConsumer">

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <h2>Title</h2>
      <button @click="close">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'HeaderCloseConsumer');
    expect(code).toContain(
      "(e) => this.dispatchEvent(new CustomEvent('rozie-header-close', { detail: e, bubbles: true, composed: true }))",
    );
    // The old late-binding wrap MUST NOT appear at the dispatch site — that
    // was the broken path (function ref always undefined through JSON).
    expect(code).not.toMatch(/\(this\._headerCtx\?\.close\)\?\.\(e\)/);
  });

  it('emits dispatchEvent with correct event-name kebab format for footer slot toggle param', () => {
    const source = `<rozie name="FooterToggleConsumer">

<components>
{
  Drawer: './Drawer.rozie',
}
</components>

<template>
  <Drawer>
    <template #footer="{ toggle }">
      <button @click="toggle">⇆</button>
    </template>
  </Drawer>
</template>
`;
    const code = compileConsumer(source, 'FooterToggleConsumer');
    expect(code).toContain("'rozie-footer-toggle'");
    expect(code).toContain(
      "(e) => this.dispatchEvent(new CustomEvent('rozie-footer-toggle', { detail: e, bubbles: true, composed: true }))",
    );
  });

  it('falls back to late-binding wrap for composite expression with ctx reference', () => {
    // A composite expression `close(); doSomething()` is NOT a bare
    // `this._<X>Ctx?.<param>` shape — it's a multi-statement program where
    // `close` is just one identifier among several. The dispatchEvent
    // detection regex (anchored `^...$`) refuses to match; the Plan 03
    // late-binding wrap takes over so data-typed param references still
    // resolve correctly at click time.
    const source = `<rozie name="CompositeConsumer">

<script>
function doSomething() {}
</script>

<components>
{
  Modal: './Modal.rozie',
}
</components>

<template>
  <Modal>
    <template #header="{ close }">
      <button @click="close(); doSomething()">×</button>
    </template>
  </Modal>
</template>
`;
    const code = compileConsumer(source, 'CompositeConsumer');
    // The dispatchEvent shape MUST NOT appear for the composite handler.
    expect(code).not.toMatch(
      /dispatchEvent\(new CustomEvent\('rozie-header-close'/,
    );
    // The Plan 03 late-binding wrap MUST appear (preserves data-typed
    // param semantics for composite expressions).
    expect(code).toMatch(/@click=\$\{\(e\) => \{ .*this\._headerCtx\?\.close/);
  });

  it('does not affect non-ctx handlers', () => {
    // A handler that references a component method (no `_<X>Ctx?.` shape)
    // MUST NOT be wrapped at all — emit the bare reference for Lit's
    // built-in handler binding.
    const source = `<rozie name="NonCtxConsumer">

<script>
function onConfirm() {}
</script>

<template>
  <button @click="onConfirm">Confirm</button>
</template>
`;
    const code = compileConsumer(source, 'NonCtxConsumer');
    expect(code).toMatch(/@click=\$\{this\.onConfirm\}/);
    // No dispatchEvent translation
    expect(code).not.toContain('rozie-');
    // No late-binding wrap
    expect(code).not.toMatch(/\(e\) => \(this\.onConfirm\)\?\.\(e\)/);
  });
});
