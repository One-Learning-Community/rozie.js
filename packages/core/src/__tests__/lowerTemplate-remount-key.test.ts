// Keyed-remount codegen, Task 1 — `lowerTemplate` component `:key` → the
// shared `TemplateElementIR.remountKeyExpression` marker.
//
// Root cause (docs/superpowers/plans/data-table-super-crosstarget-findings.md
// §3.1): today a `:key` on a composed child component lowers to a generic
// `key` AttributeBinding in `TemplateElementIR.attributes`, indistinguishable
// from a normal prop — React/Solid drop it, Svelte/Angular/Lit forward it
// inert. This test asserts the new additive-optional marker:
//   1. `<MyComp :key="foo" />` (component tag, no r-for) → `remountKeyExpression`
//      is set to the `foo` expression AND no `key` binding remains in
//      `.attributes`.
//   2. `<div r-for="x in xs" :key="x.id"></div>` — the LOOP key path
//      (`findKeyExpression` / `TemplateLoopIR.keyExpression`) is untouched:
//      still a `TemplateLoopIR` with `keyExpression` set; `remountKeyExpression`
//      must NOT be set on the inner element.
//   3. `<div :key="k"></div>` — a plain non-component element — must NOT set
//      `remountKeyExpression` (DOM-element key handling stays untouched).
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse } from '../parse.js';
import { lowerToIR } from '../ir/lower.js';
import { createDefaultRegistry } from '../modifiers/registerBuiltins.js';
import type {
  TemplateNode as IRTemplateNode,
  TemplateElementIR,
  TemplateLoopIR,
} from '../ir/types.js';

function rozie(templateBody: string, opts?: { rozieAttrs?: string; name?: string }): string {
  const attrs = opts?.rozieAttrs ?? '';
  const name = opts?.name ?? 'RemountKeyLower';
  return `<rozie name="${name}"${attrs ? ' ' + attrs : ''}>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** DFS for the first TemplateElementIR whose tagName matches. */
function findElementByTag(node: IRTemplateNode | null, tagName: string): TemplateElementIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateElement') {
      if (cur.tagName === tagName) return cur;
      stack.push(...cur.children);
    } else if (cur.type === 'TemplateFragment') {
      stack.push(...cur.children);
    } else if (cur.type === 'TemplateLoop') {
      stack.push(...cur.body);
    } else if (cur.type === 'TemplateConditional') {
      for (const b of cur.branches) stack.push(...b.body);
    }
  }
  throw new Error(`no IR TemplateElement with tagName '${tagName}' found`);
}

/** DFS for the first TemplateLoopIR. */
function findLoop(node: IRTemplateNode | null): TemplateLoopIR {
  if (!node) throw new Error('IR template is null');
  const stack: IRTemplateNode[] = [node];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (cur.type === 'TemplateLoop') return cur;
    if (cur.type === 'TemplateElement') stack.push(...cur.children);
    else if (cur.type === 'TemplateFragment') stack.push(...cur.children);
    else if (cur.type === 'TemplateConditional') {
      for (const b of cur.branches) stack.push(...b.body);
    }
  }
  throw new Error('no IR TemplateLoop found');
}

function lowerOk(source: string): IRTemplateNode {
  const { ast, diagnostics: parseDiags } = parse(source);
  expect(ast, JSON.stringify(parseDiags)).not.toBeNull();
  const { ir, diagnostics: lowerDiags } = lowerToIR(ast!, {
    modifierRegistry: createDefaultRegistry(),
  });
  expect(ir, JSON.stringify(lowerDiags)).not.toBeNull();
  expect(
    lowerDiags.filter((d) => d.severity === 'error'),
    `unexpected lowering errors: ${JSON.stringify(lowerDiags)}`,
  ).toEqual([]);
  return ir!.template!;
}

describe('lowerTemplate — component :key → remountKeyExpression (keyed-remount codegen Task 1)', () => {
  it('component tag with :key sets remountKeyExpression and drops the raw key binding', () => {
    // Self-recursive tag (tagKind === 'self') matches the outer <rozie name>
    // — no <components> table needed to exercise the component path.
    const root = lowerOk(
      rozie('<div><MyComp :key="foo"></MyComp></div>', { name: 'MyComp' }),
    );
    const el = findElementByTag(root, 'MyComp');
    expect(el.tagKind).toBe('self');
    expect(el.remountKeyExpression).toBeDefined();
    expect(t.isIdentifier(el.remountKeyExpression)).toBe(true);
    expect((el.remountKeyExpression as t.Identifier).name).toBe('foo');
    expect(
      el.attributes.some((a) => a.kind !== 'spreadBinding' && a.name === 'key'),
    ).toBe(false);
  });

  it('r-for loop key is untouched: TemplateLoopIR.keyExpression set, remountKeyExpression NOT set', () => {
    const root = lowerOk(
      rozie('<div><span r-for="x in xs" :key="x.id"></span></div>'),
    );
    const loop = findLoop(root);
    expect(loop.keyExpression).not.toBeNull();
    expect(t.isMemberExpression(loop.keyExpression)).toBe(true);
    const inner = loop.body[0] as TemplateElementIR;
    expect(inner.type).toBe('TemplateElement');
    expect(inner.remountKeyExpression).toBeUndefined();
  });

  it('r-for on a COMPONENT tag: loop key still routes to keyExpression, not remountKeyExpression', () => {
    const root = lowerOk(
      rozie('<div><MyComp r-for="x in xs" :key="x.id"></MyComp></div>', {
        name: 'MyComp',
      }),
    );
    const loop = findLoop(root);
    expect(loop.keyExpression).not.toBeNull();
    const inner = loop.body[0] as TemplateElementIR;
    expect(inner.tagName).toBe('MyComp');
    expect(inner.remountKeyExpression).toBeUndefined();
  });

  it('plain non-component element with :key does NOT set remountKeyExpression', () => {
    const root = lowerOk(rozie('<div :key="k"></div>'));
    const el = findElementByTag(root, 'div');
    expect(el.tagKind).toBe('html');
    expect(el.remountKeyExpression).toBeUndefined();
    // DOM-element key handling stays untouched — the raw binding remains.
    expect(
      el.attributes.some((a) => a.kind !== 'spreadBinding' && a.name === 'key'),
    ).toBe(true);
  });
});
