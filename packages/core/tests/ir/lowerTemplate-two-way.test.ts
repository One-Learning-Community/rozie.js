// Phase 07.3 Plan 01 Task 2 — lowerTemplate twoWayBinding IR variant test
// scaffold (Wave 1 — RED).
//
// Per 07.3-SPEC.md TWO-WAY-01 / 07.3-PATTERNS.md
// §`packages/core/src/ir/lowerers/lowerTemplate.ts`: a new
// `kind: 'twoWayBinding'` variant is added to the `AttributeBinding`
// discriminated union and the lowerer emits one for any
// `r-model:propName="expr"` on a component tag. The variant carries:
//   - name: propName (the bit after `r-model:`)
//   - expression: parsed Babel Expression for the RHS
//   - deps: SignalRef[] for re-execution accounting
//   - sourceLoc
//
// WAVE 1 RED STATE: the lowerer does NOT yet emit this variant. The existing
// directive branch in lowerTemplate.ts (lines 547-571 per PATTERNS.md) only
// handles bare `model`/`show`/`html`/`text` directive names. Wave 2 adds the
// `attr.name.startsWith('model:')` branch.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

const CONSUMER_SRC = `<rozie name="Consumer">

<components>
{
  Producer: './producer.rozie',
}
</components>

<data>
{
  x: false
}
</data>

<template>
<Producer r-model:open="$data.x" />
</template>

</rozie>
`;

function lowerSource(src: string) {
  const result = parse(src, { filename: 'consumer.rozie' });
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

describe('lowerTemplate twoWayBinding IR variant — Phase 07.3 (TWO-WAY-01)', () => {
  it('produces AttributeBinding with kind: "twoWayBinding" for <Producer r-model:open="$data.x" />', () => {
    const { ir } = lowerSource(CONSUMER_SRC);
    expect(ir).not.toBeNull();
    const elements = collectByType(ir!.template, 'TemplateElement');
    const producerEl = elements.find(
      (e) => (e as unknown as { tagName: string }).tagName === 'Producer',
    );
    expect(producerEl).toBeDefined();
    const attrs = (producerEl as unknown as { attributes: Array<{ kind: string; name: string }> })
      .attributes;
    const twoWay = attrs.find((a) => a.kind === 'twoWayBinding');
    // RED: Wave 1 emits kind: 'binding' with name 'r-model:open' (or similar).
    // Wave 2 emits kind: 'twoWayBinding' with name === 'open'.
    expect(twoWay).toBeDefined();
    expect(twoWay!.name).toBe('open');
  });

  it('does NOT produce kind: "twoWayBinding" for bare r-model on form input (TWO-WAY-02 regression guard)', () => {
    const src = `<rozie name="Consumer">

<data>
{
  draft: ''
}
</data>

<template>
<input r-model="$data.draft" />
</template>

</rozie>
`;
    const { ir } = lowerSource(src);
    expect(ir).not.toBeNull();
    const elements = collectByType(ir!.template, 'TemplateElement');
    const inputEl = elements.find(
      (e) => (e as unknown as { tagName: string }).tagName === 'input',
    );
    expect(inputEl).toBeDefined();
    const attrs = (inputEl as unknown as { attributes: Array<{ kind: string }> }).attributes;
    expect(attrs.find((a) => a.kind === 'twoWayBinding')).toBeUndefined();
  });
});
