/**
 * Plan 04-05 Task 1 — emitStyle (React target) re-stringification + 5×2 .css.snap fixtures.
 *
 * Mirrors Phase 3's emitStyle test surface, with React-target naming
 * (moduleCss / globalCss instead of scoped / global) and React-target
 * fixture file extensions (`.module.css.snap` and `.global.css.snap`
 * sibling pairs per D-53 + D-54).
 *
 * Per spike outcome (.planning/phases/.../04-05-SPIKE.md): Path 2 chosen —
 * the React target emits CSS to sibling `.module.css` and `.global.css`
 * paths that Vite's CSS-Modules pipeline picks up via file extension.
 * Class hashing happens at Vite bundle time, NOT here.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import type { IRComponent, StyleSection } from '../../../../core/src/ir/types.js';
import { emitStyle } from '../emit/emitStyle.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, '../../fixtures');

function loadExample(name: string): { ir: IRComponent; src: string } {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse() returned null AST for ${name}`);
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error(`lowerToIR() returned null IR for ${name}`);
  return { ir: lowered.ir, src };
}

describe('emitStyle (React target) — Wave 0 + reference example tests', () => {
  it('Test 1: Counter (no :root) returns { moduleCss: <css>, globalCss: null }', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitStyle(ir.styles, src);
    expect(result.moduleCss.length).toBeGreaterThan(0);
    expect(result.moduleCss).toContain('.counter');
    expect(result.moduleCss).toContain('button:disabled');
    expect(result.globalCss).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 2: Dropdown (:root present) — :root in globalCss only', () => {
    const { ir, src } = loadExample('Dropdown');
    const result = emitStyle(ir.styles, src);
    expect(result.moduleCss.length).toBeGreaterThan(0);
    expect(result.globalCss).not.toBeNull();
    expect(result.globalCss).toContain(':root');
    expect(result.globalCss).toContain('--rozie-dropdown-z');
    expect(result.moduleCss).not.toContain(':root');
    expect(result.moduleCss).toContain('.dropdown');
    expect(result.moduleCss).toContain('.dropdown-panel');
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 3: Modal (has :root) returns moduleCss + globalCss', () => {
    const { ir, src } = loadExample('Modal');
    const result = emitStyle(ir.styles, src);
    expect(result.moduleCss.length).toBeGreaterThan(0);
    expect(result.globalCss).not.toBeNull();
    expect(result.globalCss).toContain(':root');
    expect(result.globalCss).toContain('--rozie-modal-z');
    expect(result.moduleCss).not.toContain(':root');
    expect(result.moduleCss).toContain('.modal-backdrop');
  });

  it('Test 4: SearchInput (no :root) returns moduleCss only', () => {
    const { ir, src } = loadExample('SearchInput');
    const result = emitStyle(ir.styles, src);
    expect(result.moduleCss.length).toBeGreaterThan(0);
    expect(result.globalCss).toBeNull();
    expect(result.moduleCss).toContain('.search-input');
  });

  it('Test 5: TodoList (no :root) returns moduleCss only', () => {
    const { ir, src } = loadExample('TodoList');
    const result = emitStyle(ir.styles, src);
    expect(result.moduleCss.length).toBeGreaterThan(0);
    expect(result.globalCss).toBeNull();
    expect(result.moduleCss).toContain('.todo-list');
  });

  it('Test 6: Synthetic empty StyleSection returns { moduleCss: "", globalCss: null }', () => {
    const empty: StyleSection = {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const result = emitStyle(empty, '');
    expect(result.moduleCss).toBe('');
    expect(result.globalCss).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 7: CSS Module class names un-hashed at this stage (Vite hashes at bundle time)', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitStyle(ir.styles, src);
    // Class names like `.counter` appear verbatim — NOT hashed (no `_abc123` suffix).
    // Vite's CSS-Modules pipeline performs hashing when it sees the .module.css extension.
    expect(result.moduleCss).toMatch(/\.counter\s*\{/);
    expect(result.moduleCss).not.toMatch(/\.counter_[a-zA-Z0-9]/);
  });
});

describe('emitStyle (React target) — 5×2 sibling fixture snapshots', () => {
  // Per D-53 + D-54: Counter / SearchInput / TodoList have no :root → globalCss empty.
  // Dropdown + Modal have :root → both files populated.
  for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
    it(`${name}.module.css.snap (scoped)`, async () => {
      const { ir, src } = loadExample(name);
      const result = emitStyle(ir.styles, src);
      await expect(result.moduleCss).toMatchFileSnapshot(
        resolve(FIXTURES, `${name}.module.css.snap`),
      );
    });

    it(`${name}.global.css.snap (root, may be empty)`, async () => {
      const { ir, src } = loadExample(name);
      const result = emitStyle(ir.styles, src);
      // Empty file when no :root rules — keeps the 5x2 fixture grid stable.
      const dump = result.globalCss ?? '';
      await expect(dump).toMatchFileSnapshot(resolve(FIXTURES, `${name}.global.css.snap`));
    });
  }
});

describe('emitStyle — Pitfall 6 documentation', () => {
  it('No reference example exercises nested @media :root (v1 acceptable simplification)', () => {
    for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
      const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
      const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
      if (!styleMatch) continue;
      const cssBody = styleMatch[1]!;
      const hasNestedRootInMedia = /@media[^{]+\{[^}]*:root[^}]*\}/m.test(cssBody);
      expect(hasNestedRootInMedia, `${name} unexpectedly has nested @media :root`).toBe(false);
    }
  });
});
