// Phase 3 Plan 05 Task 1 — emitStyle re-stringification + 5 .style.snap fixtures.
//
// Wave 0 verification (RESEARCH A5 / Pattern 9): packages/core/src/parsers/parseStyle.ts
// produces StyleAST with `cssText` plus `rules: StyleRule[]` where each
// StyleRule has `{ selector, loc, isRootEscape }`. packages/core/src/ir/lowerers/
// lowerStyles.ts pushes those StyleRule entries into StyleSection.scopedRules vs
// StyleSection.rootRules based on the `isRootEscape` flag.
//
// CRITICAL FINDING: The IR's StyleSection does NOT carry the postcss AST or the
// raw cssText — only StyleRule references with byte offsets into the ORIGINAL
// .rozie source. The plan's "Path A" (clone postcss Rule objects) does not
// apply because there are no postcss Rules in the IR. We follow Path C:
// emitStyle takes the original .rozie source text and slices each rule by its
// loc.start..loc.end. This is the simplest restringify path that matches the
// Phase 1 split semantics (`isRootEscape` flag determines bucket).
//
// Pitfall 6 (`@media :root { ... }`) — Phase 1's parseStyle only flags TOP-LEVEL
// rules with `selector === ':root'` as `isRootEscape: true`. Nested `:root`
// inside @media stays in scopedRules. The reference examples don't currently
// exercise nested :root; v1 acceptable per RESEARCH lines 1265-1270.

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

const FIXTURE_FORMAT = (out: { scoped: string; global: string | null }): string => {
  // Human-readable two-block dump: scoped first, then GLOBAL marker + global if present.
  if (out.global === null) return out.scoped;
  return `${out.scoped}\n---GLOBAL---\n${out.global}`;
};

describe('emitStyle — Wave 0 + reference example tests', () => {
  it('Test 1: Counter (no :root) returns { scoped: <css>, global: null }', () => {
    const { ir, src } = loadExample('Counter');
    const result = emitStyle(ir.styles, src);
    expect(result.scoped.length).toBeGreaterThan(0);
    expect(result.scoped).toContain('.counter');
    expect(result.scoped).toContain('button:disabled');
    expect(result.global).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 2: Dropdown (:root present) returns scoped + global with :root in global only', () => {
    const { ir, src } = loadExample('Dropdown');
    const result = emitStyle(ir.styles, src);
    expect(result.scoped.length).toBeGreaterThan(0);
    expect(result.global).not.toBeNull();
    // :root MUST appear in global, NOT scoped.
    expect(result.global).toContain(':root');
    expect(result.global).toContain('--rozie-dropdown-z');
    expect(result.scoped).not.toContain(':root');
    // Scoped has actual dropdown rules.
    expect(result.scoped).toContain('.dropdown');
    expect(result.scoped).toContain('.dropdown-panel');
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 3: Synthetic StyleSection with empty arrays returns { scoped: "", global: null }', () => {
    const empty: StyleSection = {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const result = emitStyle(empty, '');
    expect(result.scoped).toBe('');
    expect(result.global).toBeNull();
    expect(result.diagnostics).toEqual([]);
  });

  it('Test 4: Modal (has :root) returns scoped + global', () => {
    const { ir, src } = loadExample('Modal');
    const result = emitStyle(ir.styles, src);
    expect(result.scoped.length).toBeGreaterThan(0);
    expect(result.global).not.toBeNull();
    expect(result.global).toContain(':root');
    expect(result.global).toContain('--rozie-modal-z');
    expect(result.scoped).not.toContain(':root');
    expect(result.scoped).toContain('.modal-backdrop');
  });

  it('Test 5: SearchInput (no :root) returns scoped only', () => {
    const { ir, src } = loadExample('SearchInput');
    const result = emitStyle(ir.styles, src);
    expect(result.scoped.length).toBeGreaterThan(0);
    expect(result.global).toBeNull();
    expect(result.scoped).toContain('.search-input');
  });

  it('Test 6: TodoList (no :root) returns scoped only', () => {
    const { ir, src } = loadExample('TodoList');
    const result = emitStyle(ir.styles, src);
    expect(result.scoped.length).toBeGreaterThan(0);
    expect(result.global).toBeNull();
    expect(result.scoped).toContain('.todo-list');
  });
});

describe('emitStyle — 5 example .style.snap fixtures locked', () => {
  // Each fixture stores `scoped\n---GLOBAL---\nglobal` for human diff readability.
  // Counter/SearchInput/TodoList → scoped-only (no `---GLOBAL---` marker).
  // Dropdown/Modal → both blocks present (`---GLOBAL---` boundary).
  for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
    it(`${name}.style.snap`, async () => {
      const { ir, src } = loadExample(name);
      const result = emitStyle(ir.styles, src);
      const dump = FIXTURE_FORMAT({ scoped: result.scoped, global: result.global });
      await expect(dump).toMatchFileSnapshot(resolve(FIXTURES, `${name}.style.snap`));
    });
  }
});

describe('emitStyle — Pitfall 6 documentation', () => {
  // Acceptance check that none of the 5 reference examples exercise
  // `@media (...) { :root { ... } }`. If a future example introduces this,
  // Plan 1's parseStyle won't mark the inner :root as isRootEscape (because
  // postcss only checks top-level rules); the rule stays in scopedRules and
  // we lose the global :root extraction. Documented as v1 acceptable per
  // RESEARCH lines 1265-1270.
  it('No reference example exercises nested @media :root (v1 acceptable simplification)', () => {
    for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
      const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
      const styleMatch = src.match(/<style>([\s\S]*?)<\/style>/);
      if (!styleMatch) continue;
      const cssBody = styleMatch[1]!;
      // Crude regex: any @media block containing :root would be a counterexample.
      const hasNestedRootInMedia = /@media[^{]+\{[^}]*:root[^}]*\}/m.test(cssBody);
      expect(hasNestedRootInMedia, `${name} unexpectedly has nested @media :root`).toBe(false);
    }
  });
});
