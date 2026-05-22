// Phase 12 Plan 02 Task 2 — lowerer resolves r-model modifiers, populates
// the IR `modifiers` field, and emits ROZ960..ROZ963.
//
// The r-model branch of lowerTemplate resolves each `.modifier` against the
// registry inline (collected-not-thrown), populates `AttributeBinding.
// modifiers`, and emits four hard errors that replace today's silent drops:
//   ROZ960 — unknown r-model modifier (did-you-mean among model modifiers)
//   ROZ961 — a valid EVENT modifier used on r-model
//   ROZ962 — a modifier on a non-modifier directive (r-if/r-for/r-show/...)
//   ROZ963 — a built-in model modifier on consumer-side r-model:propName
//
// Harness mirrors lowerTemplate-two-way-typo.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type {
  IRComponent,
  TemplateNode,
  AttributeBinding,
  ResolvedModelModifier,
} from '../../src/ir/types.js';

function lower(src: string): { ir: IRComponent | null; diagnostics: Diagnostic[] } {
  const result = parse(src, { filename: 'consumer.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { ir, diagnostics } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  return { ir, diagnostics };
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

/** Wrap a `<template>` body fragment into a complete .rozie source. */
function rozie(templateBody: string, dataBlock = '{ x: 1 }'): string {
  return `<rozie name="RModelProbe">
<data>
${dataBlock}
</data>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** Wrap a body that uses a child component (for r-model:propName). */
function rozieWithComponent(templateBody: string): string {
  return `<rozie name="RModelProbe">
<components>
{ Modal: './Modal.rozie' }
</components>
<data>
{ x: 1 }
</data>
<template>
${templateBody}
</template>
</rozie>
`;
}

/** Recursively collect every AttributeBinding from the IR template tree. */
function collectAttrs(root: TemplateNode): AttributeBinding[] {
  const out: AttributeBinding[] = [];
  const walk = (n: TemplateNode): void => {
    if (n.type === 'TemplateElement') {
      out.push(...n.attributes);
      n.children.forEach(walk);
    } else if (n.type === 'TemplateConditional') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateLoop') {
      n.body.forEach(walk);
    } else if (n.type === 'TemplateMatch') {
      n.branches.forEach((b) => b.body.forEach(walk));
    } else if (n.type === 'TemplateSlotInvocation') {
      n.fallback.forEach(walk);
    } else if (n.type === 'TemplateFragment') {
      n.children.forEach(walk);
    }
  };
  walk(root);
  return out;
}

function modelBinding(ir: IRComponent | null): AttributeBinding | undefined {
  if (!ir?.template) return undefined;
  return collectAttrs(ir.template).find(
    (a) =>
      (a.kind === 'binding' && a.name === 'r-model') ||
      a.kind === 'twoWayBinding',
  );
}

describe('lowerTemplate — r-model modifier resolution (Phase 12)', () => {
  it('<input r-model.number> → binding with a `number` modifier entry', () => {
    const { ir, diagnostics } = lower(rozie('<input r-model.number="x"/>'));
    expect(byCode(diagnostics, 'ROZ960')).toEqual([]);
    const b = modelBinding(ir);
    expect(b?.kind).toBe('binding');
    const mods = (b as { modifiers?: ResolvedModelModifier[] }).modifiers ?? [];
    expect(mods.map((m) => m.name)).toContain('number');
  });

  it('bare <input r-model> → empty/absent modifiers, binding otherwise unchanged', () => {
    const { ir, diagnostics } = lower(rozie('<input r-model="x"/>'));
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const b = modelBinding(ir);
    expect(b?.kind).toBe('binding');
    expect(b?.name).toBe('r-model');
    const mods = (b as { modifiers?: ResolvedModelModifier[] }).modifiers;
    expect(mods === undefined || mods.length === 0).toBe(true);
  });

  it('r-model.lazy.number.trim → modifiers list orders `number` last (D-07)', () => {
    const { ir, diagnostics } = lower(
      rozie('<input r-model.lazy.number.trim="x"/>'),
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const b = modelBinding(ir);
    const mods = (b as { modifiers?: ResolvedModelModifier[] }).modifiers ?? [];
    const names = mods.map((m) => m.name);
    // `.number` is always terminal among the value transforms; `.trim`
    // precedes it. `.lazy` is orthogonal (event-swap) — it may sit anywhere.
    expect(names).toContain('number');
    expect(names).toContain('trim');
    expect(names.indexOf('trim')).toBeLessThan(names.indexOf('number'));
  });

  it('r-model.numbr → ROZ960 error with a `.number` did-you-mean', () => {
    const { diagnostics } = lower(rozie('<input r-model.numbr="x"/>'));
    const hits = byCode(diagnostics, 'ROZ960');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message.toLowerCase()).toContain('number');
  });

  it('r-model.stop → ROZ961 "event modifier, not a model modifier" error', () => {
    const { diagnostics } = lower(rozie('<input r-model.stop="x"/>'));
    const hits = byCode(diagnostics, 'ROZ961');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message.toLowerCase()).toContain('event modifier');
  });

  it('<div r-show.foo> → ROZ962 "directive takes no modifiers" error', () => {
    const { diagnostics } = lower(rozie('<div r-show.foo="x"></div>'));
    const hits = byCode(diagnostics, 'ROZ962');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('r-show');
  });

  it('r-html/r-text/r-if/r-for + a modifier each → ROZ962 (no silent drop)', () => {
    const cases: Array<[string, string]> = [
      ['<div r-html.x="x"></div>', 'r-html'],
      ['<span r-text.x="x"></span>', 'r-text'],
      ['<div r-if.x="x"></div>', 'r-if'],
      ['<li r-for.x="i in [1]"></li>', 'r-for'],
    ];
    for (const [body, expectedDirective] of cases) {
      const { diagnostics } = lower(rozie(body));
      const hits = byCode(diagnostics, 'ROZ962');
      expect(hits.length, body).toBe(1);
      expect(hits[0]!.severity, body).toBe('error');
      expect(hits[0]!.message, body).toContain(expectedDirective);
    }
  });

  it('a built-in modifier on r-model:propName → ROZ963 error', () => {
    const { diagnostics } = lower(
      rozieWithComponent('<Modal r-model:open.number="x"></Modal>'),
    );
    const hits = byCode(diagnostics, 'ROZ963');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('bare r-model:propName (no modifier) → no ROZ963', () => {
    const { diagnostics } = lower(
      rozieWithComponent('<Modal r-model:open="x"></Modal>'),
    );
    expect(byCode(diagnostics, 'ROZ963')).toEqual([]);
  });
});
