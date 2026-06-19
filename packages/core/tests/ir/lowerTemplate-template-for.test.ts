// Phase 50 — `<template r-for>` multi-root loop-body lowering.
//
// A `<template r-for="x in xs">` host is NON-RENDERING: its CHILDREN are lifted
// directly into the produced `TemplateLoop.body`, so a single loop iteration can
// render MULTIPLE sibling root elements (e.g. a data <tr> plus a conditional
// detail <tr>). Each of the six target emitters already carries a wrapper-free
// `body.length > 1` branch; this suite asserts the FRONT-END lowering shape that
// makes those branches reachable:
//   - `<template r-for>` with 2 children → ONE `TemplateLoop` whose `body.length === 2`
//   - the loop's iterator alias + iterable expression are parsed off the `<template>`
//   - the `:key` on the `<template>` becomes `keyExpression`
//   - the lifted body contains NO literal `template`-tag `TemplateElement` (the
//     host is transparent, not rendered as an inert HTML <template>)
//   - a single-child `<template r-for>` still produces `body.length === 1`
//   - a NORMAL (non-template) `r-for` element is byte-unchanged: `body: [inner]`
//     where `inner` is the lowered element itself.
//
// Harness mirrors lowerTemplate-match.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

function lowerSource(src: string) {
  const result = parse(src, { filename: 'template-for.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

type IRNodeWithType<T extends string> = { type: T } & Record<string, unknown>;

function collectByType<T extends string>(root: unknown, typeTag: T): IRNodeWithType<T>[] {
  const out: IRNodeWithType<T>[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === typeTag) out.push(n as IRNodeWithType<T>);
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };
  visit(root);
  return out;
}

type LoopNode = {
  type: 'TemplateLoop';
  itemAlias: string;
  indexAlias: string | null;
  iterableExpression: Record<string, unknown>;
  keyExpression: Record<string, unknown> | null;
  body: Array<Record<string, unknown>>;
};

function loopNodes(root: unknown): LoopNode[] {
  return collectByType(root, 'TemplateLoop') as unknown as LoopNode[];
}

describe('<template r-for> multi-root loop body — Phase 50', () => {
  const MULTI_SRC = `<rozie name="ForProbe">
<data>
{ rows: [], openId: null }
</data>
<template>
<table>
  <tbody>
    <template r-for="row in $data.rows" :key="row.id">
      <tr class="data"><td>{{ row.label }}</td></tr>
      <tr class="detail" r-if="$data.openId === row.id"><td>detail</td></tr>
    </template>
  </tbody>
</table>
</template>
</rozie>
`;

  it('lifts the <template> children into a single TemplateLoop with body.length === 2', () => {
    const { ir } = lowerSource(MULTI_SRC);
    expect(ir).not.toBeNull();
    const loops = loopNodes(ir!.template);
    expect(loops.length).toBe(1);
    // Two structural roots per iteration: the data <tr> + the conditional
    // detail <tr> (lowered to a TemplateConditional). Whitespace text between
    // them may also appear; assert AT LEAST the two structural roots are present
    // and that there are 2+ body entries.
    expect(loops[0]!.body.length).toBeGreaterThanOrEqual(2);
    const structural = loops[0]!.body.filter(
      (n) => n['type'] !== 'TemplateStaticText',
    );
    expect(structural.length).toBe(2);
    expect(structural[0]!['type']).toBe('TemplateElement');
    // The conditional detail <tr> folds into a TemplateConditional.
    expect(structural[1]!['type']).toBe('TemplateConditional');
  });

  it('parses the iterator alias and iterable expression off the <template>', () => {
    const { ir } = lowerSource(MULTI_SRC);
    const loop = loopNodes(ir!.template)[0]!;
    expect(loop.itemAlias).toBe('row');
    expect(loop.indexAlias).toBeNull();
    expect(loop.iterableExpression).not.toBeNull();
    // `$data.rows` is a MemberExpression.
    expect(loop.iterableExpression['type']).toBe('MemberExpression');
  });

  it('carries the :key on the <template> as keyExpression', () => {
    const { ir } = lowerSource(MULTI_SRC);
    const loop = loopNodes(ir!.template)[0]!;
    expect(loop.keyExpression).not.toBeNull();
    // `row.id` is a MemberExpression.
    expect(loop.keyExpression!['type']).toBe('MemberExpression');
  });

  it('does NOT emit a literal template-tag TemplateElement (host is transparent)', () => {
    const { ir } = lowerSource(MULTI_SRC);
    const loop = loopNodes(ir!.template)[0]!;
    // No node in the lifted body (or anywhere in the loop subtree) is a
    // rendered <template> element.
    const elements = collectByType(loop, 'TemplateElement') as Array<
      Record<string, unknown>
    >;
    const literalTemplates = elements.filter((e) => e['tagName'] === 'template');
    expect(literalTemplates.length).toBe(0);
  });

  it('captures the (item, idx) index alias when present', () => {
    const src = `<rozie name="ForProbe">
<data>
{ rows: [] }
</data>
<template>
<tbody>
  <template r-for="(row, i) in $data.rows" :key="i">
    <tr><td>{{ row }}</td></tr>
    <tr><td>{{ i }}</td></tr>
  </template>
</tbody>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const loop = loopNodes(ir!.template)[0]!;
    expect(loop.itemAlias).toBe('row');
    expect(loop.indexAlias).toBe('i');
    const structural = loop.body.filter((n) => n['type'] !== 'TemplateStaticText');
    expect(structural.length).toBe(2);
  });

  it('still produces body.length === 1 for a single-child <template r-for>', () => {
    const src = `<rozie name="ForProbe">
<data>
{ rows: [] }
</data>
<template>
<ul>
  <template r-for="row in $data.rows" :key="row.id">
    <li>{{ row.label }}</li>
  </template>
</ul>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const loop = loopNodes(ir!.template)[0]!;
    const structural = loop.body.filter((n) => n['type'] !== 'TemplateStaticText');
    expect(structural.length).toBe(1);
    expect(structural[0]!['type']).toBe('TemplateElement');
    expect(structural[0]!['tagName']).toBe('li');
  });

  it('leaves a NORMAL (non-template) r-for element unchanged: body is the single lowered element', () => {
    const src = `<rozie name="ForProbe">
<data>
{ rows: [] }
</data>
<template>
<ul>
  <li r-for="row in $data.rows" :key="row.id">{{ row.label }}</li>
</ul>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const loop = loopNodes(ir!.template)[0]!;
    // Normal-element path: body is exactly [the lowered <li>], no whitespace
    // siblings, no transparent-host flattening.
    expect(loop.body.length).toBe(1);
    expect(loop.body[0]!['type']).toBe('TemplateElement');
    expect(loop.body[0]!['tagName']).toBe('li');
  });
});
