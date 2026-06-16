// ITEM-2 (Phase 46) — bare value-less attribute on a COMPONENT element coerces
// to a `booleanLiteral(true)` binding at the IR layer, identical to the shape a
// bare `:combobox` already produces. This is a correct-by-construction emit fix
// with ZERO per-target emitter edits: all six emitters already render a
// `booleanLiteral(true)` binding as the per-target boolean-true form
// (`combobox={true}` / `:combobox="true"` / `[combobox]="true"` / `.combobox=${true}`).
//
// A bare value-less attribute on a DOM element keeps the existing
// `{ kind: 'static', value: '' }` shape (unchanged HTML — renders `hidden=""`).
//
// An EXPLICIT `combobox=""` on a component is NOT coerced — the bare-vs-explicit
// distinction is preserved by branching on `attr.value === null` BEFORE the
// `?? ''` collapse.

import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { IRComponent, TemplateElementIR } from '../../src/ir/types.js';
import * as t from '@babel/types';

function lower(src: string): IRComponent {
  const result = parse(src, { filename: 'probe.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!ir) throw new Error('lowerToIR returned null IR');
  return ir;
}

/** A `.rozie` declaring a child component <Child> with the given template body. */
function rozieWithChild(templateBody: string): string {
  return `<rozie name="Probe">
<components>{ Child: './Child.rozie' }</components>
<template>
${templateBody}
</template>
</rozie>
`;
}

function firstElement(ir: IRComponent): TemplateElementIR {
  const root = ir.template;
  if (!root) throw new Error('ir.template is null');
  const node =
    root.type === 'TemplateFragment'
      ? root.children.find((c) => c.type === 'TemplateElement')
      : root;
  if (!node || node.type !== 'TemplateElement') {
    throw new Error(`expected a TemplateElement; got ${node?.type ?? 'undefined'}`);
  }
  return node;
}

function attr(el: TemplateElementIR, name: string) {
  const a = el.attributes.find((x) => x.name === name);
  if (!a) throw new Error(`attribute '${name}' not found`);
  return a;
}

describe('lowerTemplate — bare boolean attr on a component', () => {
  it('coerces a bare attr on a COMPONENT element to a booleanLiteral(true) binding', () => {
    const ir = lower(rozieWithChild('<Child combobox />'));
    const el = firstElement(ir);
    expect(el.tagKind).toBe('component');
    const a = attr(el, 'combobox');
    expect(a.kind).toBe('binding');
    if (a.kind !== 'binding') throw new Error('expected binding');
    expect(t.isBooleanLiteral(a.expression)).toBe(true);
    if (t.isBooleanLiteral(a.expression)) {
      expect(a.expression.value).toBe(true);
    }
  });

  it('keeps a bare attr on a DOM element as a static empty-string attribute', () => {
    const ir = lower(rozieWithChild('<div hidden></div>'));
    const el = firstElement(ir);
    expect(el.tagKind).toBe('html');
    const a = attr(el, 'hidden');
    expect(a.kind).toBe('static');
    if (a.kind === 'static') {
      expect(a.value).toBe('');
    }
  });

  it('does NOT coerce an explicit empty-string attr on a component (combobox="")', () => {
    const ir = lower(rozieWithChild('<Child combobox=""></Child>'));
    const el = firstElement(ir);
    expect(el.tagKind).toBe('component');
    const a = attr(el, 'combobox');
    // Explicit `=""` stays a static empty-string attribute — the bare-vs-explicit
    // distinction is preserved.
    expect(a.kind).toBe('static');
    if (a.kind === 'static') {
      expect(a.value).toBe('');
    }
  });

  it('coerces a bare attr on a self-referencing component element too', () => {
    // tagKind === 'self' (the outer <rozie name>) is also a component element.
    const ir = lower(
      `<rozie name="Probe">
<template>
<div><Probe combobox /></div>
</template>
</rozie>
`,
    );
    const root = firstElement(ir);
    const child = root.children.find(
      (c): c is TemplateElementIR =>
        c.type === 'TemplateElement' && c.tagName === 'Probe',
    );
    if (!child) throw new Error('expected a <Probe> self element');
    expect(child.tagKind).toBe('self');
    const a = attr(child, 'combobox');
    expect(a.kind).toBe('binding');
    if (a.kind === 'binding') {
      expect(t.isBooleanLiteral(a.expression)).toBe(true);
    }
  });
});
