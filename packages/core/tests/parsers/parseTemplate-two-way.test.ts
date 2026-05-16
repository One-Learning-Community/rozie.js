// Phase 07.3 Plan 01 Task 2 — parser-side coverage for `r-model:propName=`
// (Wave 1 — regression guard).
//
// Per 07.3-PATTERNS.md §`packages/core/src/parsers/parseTemplate.ts` (analog
// row): the parser ALREADY recognises `r-model:propName=` for free — it
// produces a generic `kind='directive'` template attribute with
// `name='model:<propName>'`. NO PARSER CHANGE is needed in Wave 2.
//
// This test exists as a regression guard: if a later refactor of the directive
// recogniser inadvertently swallows colon-suffixed names, the test goes red
// before reaching the lowerer.
//
// WAVE 1 STATE: this test should ALREADY PASS against the current parser.
// That is intentional per 07.3-01-PLAN.md task 2 behavior section.
import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../src/parsers/parseTemplate.js';
import type {
  TemplateElement,
  TemplateNode,
} from '../../src/ast/blocks/TemplateAST.js';

function findElement(
  nodes: readonly TemplateNode[],
  tag: string,
): TemplateElement | null {
  for (const n of nodes) {
    if (n.type === 'TemplateElement' && n.tagName === tag) return n;
    if (n.type === 'TemplateElement') {
      const inner = findElement(n.children, tag);
      if (inner) return inner;
    }
  }
  return null;
}

describe('parseTemplate — Phase 07.3 r-model:propName= argument-form (TWO-WAY-01)', () => {
  it("produces kind='directive' name='model:open' for <Modal r-model:open=\"$data.x\">", () => {
    const src = '<Modal r-model:open="$data.x" />';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const modal = findElement(result.node?.children ?? [], 'Modal');
    expect(modal).not.toBeNull();
    const dir = modal!.attributes.find(
      (a) => a.kind === 'directive' && a.name === 'model:open',
    );
    expect(dir).toBeDefined();
    expect(dir!.kind).toBe('directive');
    if (dir!.kind === 'directive') {
      expect(dir!.name).toBe('model:open');
      expect(dir!.value).toBe('$data.x');
    }
  });

  it('preserves the propName argument verbatim (multi-word, e.g. selectedTab)', () => {
    const src = '<Tabs r-model:selectedTab="$data.tab" />';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const tabs = findElement(result.node?.children ?? [], 'Tabs');
    const dir = tabs!.attributes.find(
      (a) => a.kind === 'directive' && a.name === 'model:selectedTab',
    );
    expect(dir).toBeDefined();
    if (dir!.kind === 'directive') {
      expect(dir!.name).toBe('model:selectedTab');
      expect(dir!.value).toBe('$data.tab');
    }
  });

  it('does NOT classify bare r-model="…" as model:<empty> (regression guard for TWO-WAY-02)', () => {
    // Bare r-model (no colon argument) remains the form-input sugar branch.
    // The directive should parse with name === 'model' (not 'model:').
    const src = '<input r-model="$data.draft" />';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const input = findElement(result.node?.children ?? [], 'input');
    const dir = input!.attributes.find(
      (a) => a.kind === 'directive' && a.name.startsWith('model'),
    );
    expect(dir).toBeDefined();
    if (dir!.kind === 'directive') {
      expect(dir!.name).toBe('model');
    }
  });
});
