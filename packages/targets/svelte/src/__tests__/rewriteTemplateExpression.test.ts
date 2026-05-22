/**
 * rewriteTemplateExpression unit tests — Svelte target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteTemplateExpression.ts`, previously exercised only end-to-end
 * by emitTemplate / emitTemplateAttribute integration tests.
 *
 * Svelte 5's template surface uses bare identifiers (no `.value` suffix, no
 * `props.` prefix) so every `$foo.bar` accessor strips the `$foo.` prefix:
 *
 *   $props.X (model OR non-model) → X
 *   $data.X                       → X
 *   $refs.X                       → X
 *   $slots.X                      → X   (default slot keyed 'default')
 *   $emit('foo', x)               → onfoo?.(x)
 *
 * Negatives: $emit() with zero args untouched; $emit(nonStringLiteral)
 * untouched; unknown slot name untouched.
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

function buildSlotDecl(name: string): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

function buildIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      portalRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    components: [],
    setupBody: { type: 'SetupBody', scriptProgram, annotations: [] },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

function prop(name: string, isModel: boolean): IRComponent['props'][number] {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    defaultValue: null,
    isModel,
    required: false,
    sourceLoc: { start: 0, end: 0 },
  };
}

function state(name: string): IRComponent['state'][number] {
  return {
    type: 'StateDecl',
    name,
    initializer: t.numericLiteral(0),
    sourceLoc: { start: 0, end: 0 },
  };
}

function ref(name: string): IRComponent['refs'][number] {
  return { type: 'RefDecl', name, elementTag: 'div', sourceLoc: { start: 0, end: 0 } };
}

describe('rewriteTemplateExpression — Svelte sigil matrix (bare locals)', () => {
  it('$props.X (model) → X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('value'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('value');
  });

  it('$props.X (non-model) → X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('step'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('step');
  });

  it('$data.X → X', () => {
    const ir = buildIR({ state: [state('hovering')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('hovering'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('hovering');
  });

  it('$refs.X → X', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = t.memberExpression(t.identifier('$refs'), t.identifier('dialogEl'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogEl');
  });

  it('$slots.X → X', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('header'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('header');
  });

  it('$slots.default → default (empty-string SlotDecl keyed default)', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('default'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('default');
  });

  it("$emit('foo', x) → onfoo?.(x)", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('foo'),
      t.identifier('x'),
    ]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('onfoo?.(x)');
  });

  it("$emit('foo') with no rest args → onfoo?.()", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [t.stringLiteral('foo')]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('onfoo?.()');
  });

  it("$emit('foo', a, b) carries all rest args → onfoo?.(a, b)", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('foo'),
      t.identifier('a'),
      t.identifier('b'),
    ]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('onfoo?.(a, b)');
  });
});

describe('rewriteTemplateExpression — OptionalMemberExpression variants', () => {
  it('$props.X?.y (model) → X?.y', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('$props.value?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('value?.y');
  });

  it('$props.X?.y (non-model) → X?.y', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = parseExpression('$props.step?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('step?.y');
  });

  it('$data.X?.y → X?.y', () => {
    const ir = buildIR({ state: [state('config')] });
    const expr = parseExpression('$data.config?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('config?.y');
  });

  it('$refs.X?.y → X?.y', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs.dialogEl?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogEl?.y');
  });

  it('$slots.X?.y → X?.y', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = parseExpression('$slots.header?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('header?.y');
  });

  it('unknown $props.X?.y on OptionalMemberExpression is left untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$props.unknown?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props.unknown?.y');
  });
});

// `$props.value?.y` parses with the `?.` BETWEEN `value` and `y`, so the
// OptionalMemberExpression's *object* is the plain MemberExpression `$props.value`
// — the OptionalMember visitor bails at its `!t.isIdentifier(obj)` guard and the
// sigil rewrite is actually carried out by the plain MemberExpression visitor.
// To exercise the OptionalMemberExpression visitor's OWN sigil branches the `?.`
// must sit directly after the sigil object: `$props?.value`.
describe('rewriteTemplateExpression — OptionalMemberExpression sigil-object branches', () => {
  it('$props?.X (model) → X (OptionalMember object is the $props identifier)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('$props?.value');
    expect(rewriteTemplateExpression(expr, ir)).toBe('value');
  });

  it('$props?.X (non-model) → X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = parseExpression('$props?.step');
    expect(rewriteTemplateExpression(expr, ir)).toBe('step');
  });

  it('$data?.X → X', () => {
    const ir = buildIR({ state: [state('hovering')] });
    const expr = parseExpression('$data?.hovering');
    expect(rewriteTemplateExpression(expr, ir)).toBe('hovering');
  });

  it('$refs?.X → X', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs?.dialogEl');
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogEl');
  });

  it('$slots?.X → X', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = parseExpression('$slots?.header');
    expect(rewriteTemplateExpression(expr, ir)).toBe('header');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$props?.unknown');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props?.unknown');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [state('known')] });
    const expr = parseExpression('$data?.unknown');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$data?.unknown');
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const expr = parseExpression('$props?.[x]');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props?.[x]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('whatever?.value');
    expect(rewriteTemplateExpression(expr, ir)).toBe('whatever?.value');
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    // object is a CallExpression, not an Identifier — `!t.isIdentifier(obj)`.
    const expr = parseExpression('makeIt()?.value');
    expect(rewriteTemplateExpression(expr, ir)).toBe('makeIt()?.value');
  });
});

describe('rewriteTemplateExpression — negatives', () => {
  it('$emit() with zero args is left untouched', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), []);
    expect(rewriteTemplateExpression(expr, ir)).toBe('$emit()');
  });

  it('$emit(nonStringLiteral) is left untouched', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [t.identifier('dynamicName')]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('$emit(dynamicName)');
  });

  it('unknown slot name is left untouched', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('footer'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$slots.footer');
  });

  it('unknown $props.X is left untouched', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('mystery'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props.mystery');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const expr = t.memberExpression(
      t.identifier('$props'),
      t.stringLiteral('x'),
      /* computed */ true,
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props["x"]');
  });

  it('non-$ member expressions and calls pass through unchanged', () => {
    const ir = buildIR();
    expect(rewriteTemplateExpression(parseExpression('foo.bar'), ir)).toBe('foo.bar');
    expect(rewriteTemplateExpression(parseExpression('doThing(1)'), ir)).toBe('doThing(1)');
  });

  it('MemberExpression whose object is not an identifier passes through', () => {
    const ir = buildIR();
    // `foo().bar` — the MemberExpression object is a CallExpression, hitting
    // the `!t.isIdentifier(obj)` early return in the MemberExpression visitor.
    expect(rewriteTemplateExpression(parseExpression('foo().bar'), ir)).toBe('foo().bar');
  });
});
