// Phase 07.2 Plan 01 Task 3 — parser-side coverage for `<template #name>` /
// `<template #name="{ params }">` / `<template #default>` / `<template #[expr]>`
// fill-directive grammar.
//
// The parser does NOT classify `#`-prefixed attributes as a distinct kind —
// it preserves rawName verbatim and lets the IR lowerer (lowerSlotFillers.ts)
// re-interpret the # prefix. This test locks the parser-side invariant:
//
//   1. <template #name> elements parse without diagnostic
//   2. The full rawName ('#header' / '#default' / '#[expr]') is preserved
//      verbatim on the corresponding TemplateAttr
//   3. The scoped-param destructure value is preserved verbatim
//   4. Byte-accurate source locations on the fill-directive attribute
import { describe, it, expect } from 'vitest';
import { parseTemplate } from '../../src/parsers/parseTemplate.js';
import type { TemplateElement, TemplateNode } from '../../src/ast/blocks/TemplateAST.js';

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

function findAllTemplates(
  nodes: readonly TemplateNode[],
): TemplateElement[] {
  const out: TemplateElement[] = [];
  for (const n of nodes) {
    if (n.type === 'TemplateElement') {
      if (n.tagName === 'template') out.push(n);
      out.push(...findAllTemplates(n.children));
    }
  }
  return out;
}

describe('parseTemplate — Phase 07.2 fill-directive grammar (R1)', () => {
  it('parses <template #name> without diagnostic and preserves rawName verbatim', () => {
    const src = '<Modal><template #header><h2>Hi</h2></template></Modal>';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const fills = findAllTemplates(result.node?.children ?? []);
    expect(fills).toHaveLength(1);
    const fillAttr = fills[0]!.attributes.find((a) => a.rawName.startsWith('#'));
    expect(fillAttr).toBeDefined();
    expect(fillAttr!.rawName).toBe('#header');
    expect(fillAttr!.value).toBeNull(); // boolean-style attribute
  });

  it('parses <template #name="{ close }"> and preserves the scoped-param value', () => {
    const src =
      '<Modal><template #header="{ close }"><button @click="close">x</button></template></Modal>';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const fills = findAllTemplates(result.node?.children ?? []);
    expect(fills).toHaveLength(1);
    const fillAttr = fills[0]!.attributes.find((a) => a.rawName.startsWith('#'));
    expect(fillAttr).toBeDefined();
    expect(fillAttr!.rawName).toBe('#header');
    expect(fillAttr!.value).toBe('{ close }');
  });

  it('parses <template #default>', () => {
    const src = '<Modal><template #default>Default body</template></Modal>';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const fills = findAllTemplates(result.node?.children ?? []);
    expect(fills).toHaveLength(1);
    expect(fills[0]!.attributes[0]!.rawName).toBe('#default');
  });

  it('parses <template #[someExpr]> dynamic-name form (bracketed expression preserved verbatim)', () => {
    const src = '<Modal><template #[someExpr]>dyn body</template></Modal>';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const fills = findAllTemplates(result.node?.children ?? []);
    expect(fills).toHaveLength(1);
    expect(fills[0]!.attributes[0]!.rawName).toBe('#[someExpr]');
  });

  it('byte-accurate source locations on the fill-directive attribute', () => {
    //                  0         1         2         3         4
    //                  0123456789012345678901234567890123456789012345678
    const src = '<Modal><template #header><h2>Hi</h2></template></Modal>';
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    const fills = findAllTemplates(result.node?.children ?? []);
    const attr = fills[0]!.attributes[0]!;
    // '#header' starts at byte offset 17 (after '<template ')
    const sliced = src.slice(attr.loc.start, attr.loc.start + attr.rawName.length);
    expect(sliced).toBe('#header');
  });

  it('round-trip parses a 3-fill Modal usage (header named-scoped + loose default body + footer named-scoped)', () => {
    const src = `<Modal>
  <template #header="{ close }"><h2>Hi</h2></template>
  Body content
  <template #footer="{ close }"><button @click="close">x</button></template>
</Modal>`;
    const result = parseTemplate(src, { start: 0, end: src.length }, src);
    expect(result.diagnostics).toEqual([]);
    const modal = findElement(result.node?.children ?? [], 'Modal');
    expect(modal).toBeDefined();
    const fills = (modal!.children || []).filter(
      (n): n is TemplateElement => n.type === 'TemplateElement' && n.tagName === 'template',
    );
    expect(fills).toHaveLength(2);
    expect(fills[0]!.attributes[0]!.rawName).toBe('#header');
    expect(fills[1]!.attributes[0]!.rawName).toBe('#footer');
    // Loose text "Body content" must appear as a TextNode child of Modal.
    const looseText = (modal!.children || []).find(
      (n) => n.type === 'TemplateText' && n.text.includes('Body content'),
    );
    expect(looseText).toBeDefined();
  });
});
