/**
 * rewriteTemplateExpression unit tests — Vue target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteTemplateExpression.ts`, previously exercised only end-to-end
 * by emitTemplate / emitTemplateAttribute integration tests.
 *
 * `rewriteTemplateExpression(expr, ir)` renders a single Babel Expression for
 * use inside a Vue `<template>` — the TEMPLATE context, so `.value` is OMITTED
 * because Vue's template compiler auto-unwraps top-level Refs:
 *
 *   $props.X (model)     → X            (NO .value — auto-unwrap)
 *   $props.X (non-model) → props.X
 *   $data.X              → X            (NO .value — auto-unwrap)
 *   $refs.X              → XRef         (Ref suffix only)
 *   $emit(...)           → emit(...)
 *   $slots.X             → $slots.X     (Vue's $slots proxy passthrough)
 *   unknown $props.X     → $props.X     (untouched — ROZ100 warned upstream)
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

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
      engineRules: [],
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

describe('rewriteTemplateExpression — TEMPLATE-context sigil matrix (NO .value)', () => {
  it('$props.X (model) → X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('value'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('value');
  });

  it('$props.X (non-model) → props.X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('step'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('props.step');
  });

  it('$data.X → X', () => {
    const ir = buildIR({ state: [state('hovering')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('hovering'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('hovering');
  });

  it('$refs.X → XRef', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = t.memberExpression(t.identifier('$refs'), t.identifier('dialogEl'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogElRef');
  });

  it('$emit(...) → emit(...)', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('search'),
      t.identifier('q'),
    ]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('emit("search", q)');
  });

  it('$slots.header is left as-is (Vue $slots proxy passthrough)', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('header'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$slots.header');
  });

  it('mixed model + non-model + data in a logical guard', () => {
    const ir = buildIR({
      props: [prop('open', true), prop('disabled', false)],
      state: [state('hovering')],
    });
    const expr = parseExpression('$props.open && !$props.disabled && $data.hovering');
    expect(rewriteTemplateExpression(expr, ir)).toBe('open && !props.disabled && hovering');
  });
});

describe('rewriteTemplateExpression — OptionalMemberExpression variants', () => {
  // `$props?.value` makes the OptionalMemberExpression's object the bare
  // identifier `$props`, exercising the OptionalMemberExpression visitor.
  it('$props?.X (model) → X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('$props?.value');
    expect(rewriteTemplateExpression(expr, ir)).toBe('value');
  });

  it('$props?.X (non-model) → props?.X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = parseExpression('$props?.step');
    expect(rewriteTemplateExpression(expr, ir)).toBe('props?.step');
  });

  it('$data?.X → X', () => {
    const ir = buildIR({ state: [state('config')] });
    const expr = parseExpression('$data?.config');
    expect(rewriteTemplateExpression(expr, ir)).toBe('config');
  });

  it('$refs?.X → XRef', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs?.dialogEl');
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogElRef');
  });

  it('regular MemberExpression inside an optional chain: $refs.X?.y', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs.dialogEl?.y');
    expect(rewriteTemplateExpression(expr, ir)).toBe('dialogElRef?.y');
  });

  it('unknown $props?.X on OptionalMemberExpression is left untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$props?.unknown');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props?.unknown');
  });

  it('unknown $data?.X on OptionalMemberExpression is left untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$data?.unknown');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$data?.unknown');
  });

  it('unknown $refs?.X on OptionalMemberExpression is left untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$refs?.unknown');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$refs?.unknown');
  });

  it('computed-access OptionalMemberExpression ($props?.["x"]) untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const expr = parseExpression('$props?.["x"]');
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props?.["x"]');
  });

  it('non-identifier-object OptionalMemberExpression untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('foo()?.bar');
    expect(rewriteTemplateExpression(expr, ir)).toBe('foo()?.bar');
  });
});

describe('rewriteTemplateExpression — negatives', () => {
  it('unknown $props.X is left untouched (ROZ100 already warned)', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('mystery'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$props.mystery');
  });

  it('unknown $data.X is left untouched', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('mystery'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$data.mystery');
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

  it('non-$ member expressions pass through unchanged', () => {
    const ir = buildIR();
    const expr = parseExpression('foo.bar');
    expect(rewriteTemplateExpression(expr, ir)).toBe('foo.bar');
  });

  it('member expression with a non-identifier object passes through unchanged', () => {
    const ir = buildIR();
    // `foo().bar` — object is a CallExpression, exercising the
    // `!t.isIdentifier(obj)` early-return.
    const expr = parseExpression('foo().bar');
    expect(rewriteTemplateExpression(expr, ir)).toBe('foo().bar');
  });

  it('non-$emit call expressions pass through unchanged', () => {
    const ir = buildIR();
    const expr = parseExpression('doThing(1)');
    expect(rewriteTemplateExpression(expr, ir)).toBe('doThing(1)');
  });
});
