/**
 * rewriteScriptExpression unit tests — Vue target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteListenerExpression.ts`, previously exercised only
 * end-to-end by emitListeners integration tests.
 *
 * `rewriteScriptExpression(expr, ir)` renders a single Babel Expression for
 * inlining inside `<script setup>` — the SCRIPT context, so `.value` IS
 * appended (in contrast to rewriteTemplateExpression which omits it for Vue's
 * template auto-unwrap):
 *
 *   $props.X (model)     → X.value
 *   $props.X (non-model) → props.X
 *   $data.X              → X.value
 *   $refs.X              → XRef.value
 *   $emit(...)           → emit(...)
 *   bare computed name   → name.value
 *
 * Negatives: unknown $props member untouched; computed-member access
 * (`$props['x']`) untouched; computed-name in a parent BINDING position
 * (declarator id, member property, object shorthand key, function param,
 * function-declaration id) must NOT get `.value`.
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { rewriteScriptExpression } from '../rewrite/rewriteListenerExpression.js';

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

function computed(name: string): IRComponent['computed'][number] {
  return {
    type: 'ComputedDecl',
    name,
    body: t.numericLiteral(1),
    deps: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

describe('rewriteScriptExpression — SCRIPT-context sigil matrix', () => {
  it('$props.X (model) → X.value', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('value'));
    expect(rewriteScriptExpression(expr, ir)).toBe('value.value');
  });

  it('$props.X (non-model) → props.X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('step'));
    expect(rewriteScriptExpression(expr, ir)).toBe('props.step');
  });

  it('$data.X → X.value', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('count'));
    expect(rewriteScriptExpression(expr, ir)).toBe('count.value');
  });

  it('$refs.X → XRef.value', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = t.memberExpression(t.identifier('$refs'), t.identifier('dialogEl'));
    expect(rewriteScriptExpression(expr, ir)).toBe('dialogElRef.value');
  });

  it('$emit(...) callee → emit(...)', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [t.stringLiteral('close')]);
    expect(rewriteScriptExpression(expr, ir)).toBe('emit("close")');
  });

  it('bare computed identifier → name.value', () => {
    const ir = buildIR({ computed: [computed('canIncrement')] });
    // A bare identifier expression in a logical guard position.
    const expr = t.logicalExpression(
      '&&',
      t.identifier('canIncrement'),
      t.booleanLiteral(true),
    );
    expect(rewriteScriptExpression(expr, ir)).toBe('canIncrement.value && true');
  });

  it('combined model-prop arithmetic + non-model prop comparison', () => {
    const ir = buildIR({
      props: [prop('value', true), prop('step', false), prop('max', false)],
    });
    const expr = parseExpression('$props.value + $props.step <= $props.max');
    expect(rewriteScriptExpression(expr, ir)).toBe('value.value + props.step <= props.max');
  });
});

describe('rewriteScriptExpression — OptionalMemberExpression variants', () => {
  // `$props?.value` makes the OptionalMemberExpression's object the bare
  // identifier `$props`, exercising the OptionalMemberExpression visitor's
  // sigil branches (`$props.value?.y` would instead route through the regular
  // MemberExpression visitor for the inner `$props.value`).
  it('$props?.X (model) → X?.value (node stays an optional member)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('$props?.value');
    // The visitor re-writes object + property in place; the node remains an
    // OptionalMemberExpression so the `?.` is preserved on generation.
    expect(rewriteScriptExpression(expr, ir)).toBe('value?.value');
  });

  it('$props?.X (non-model) → props?.X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const expr = parseExpression('$props?.step');
    expect(rewriteScriptExpression(expr, ir)).toBe('props?.step');
  });

  it('$data?.X → X?.value', () => {
    const ir = buildIR({ state: [state('config')] });
    const expr = parseExpression('$data?.config');
    expect(rewriteScriptExpression(expr, ir)).toBe('config?.value');
  });

  it('$refs?.X → XRef?.value', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs?.dialogEl');
    expect(rewriteScriptExpression(expr, ir)).toBe('dialogElRef?.value');
  });

  it('regular MemberExpression of an OptionalMemberExpression chain: $refs.X?.focus()', () => {
    // The inner `$refs.dialogEl` is a plain MemberExpression; the `?.focus()`
    // wraps it in an OptionalCall/OptionalMember.
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs.dialogEl?.focus()');
    expect(rewriteScriptExpression(expr, ir)).toBe('dialogElRef.value?.focus()');
  });

  it('unknown $props?.X on OptionalMemberExpression untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$props?.unknown');
    expect(rewriteScriptExpression(expr, ir)).toBe('$props?.unknown');
  });

  it('unknown $data?.X on OptionalMemberExpression untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$data?.unknown');
    expect(rewriteScriptExpression(expr, ir)).toBe('$data?.unknown');
  });

  it('unknown $refs?.X on OptionalMemberExpression untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('$refs?.unknown');
    expect(rewriteScriptExpression(expr, ir)).toBe('$refs?.unknown');
  });

  it('computed-access OptionalMemberExpression ($props?.["x"]) untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const expr = parseExpression('$props?.["x"]');
    expect(rewriteScriptExpression(expr, ir)).toBe('$props?.["x"]');
  });

  it('non-identifier-object OptionalMemberExpression untouched', () => {
    const ir = buildIR();
    const expr = parseExpression('foo()?.bar');
    expect(rewriteScriptExpression(expr, ir)).toBe('foo()?.bar');
  });
});

describe('rewriteScriptExpression — Identifier-visitor parent-position skips', () => {
  it('computed name as a variable-declarator id is NOT given .value', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    // `(() => { let flag = 1; return flag; })()` — declarator id stays bare,
    // the reference gets .value.
    const expr = parseExpression('(() => { let flag = 1; return flag; })()');
    const out = rewriteScriptExpression(expr, ir);
    expect(out).toContain('let flag = 1');
    expect(out).toContain('return flag.value');
  });

  it('computed name as a non-computed member property is NOT given .value', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    // `obj.flag` — `flag` is a property name, not a reference.
    const expr = parseExpression('obj.flag');
    expect(rewriteScriptExpression(expr, ir)).toBe('obj.flag');
  });

  it('computed name already suffixed with .value is left intact', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    const expr = parseExpression('flag.value');
    expect(rewriteScriptExpression(expr, ir)).toBe('flag.value');
  });

  it('computed name as an object shorthand key keeps the key bare (value un-shorthands)', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    // The shorthand KEY is skipped via the `parent.key === path.node &&
    // parent.shorthand` guard; the VALUE position is rewritten + un-shorthanded.
    const expr = parseExpression('({ flag })');
    const out = rewriteScriptExpression(expr, ir);
    expect(out).toBe('{ flag: flag.value }');
  });

  it('computed name as a function param keeps the param binding bare', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    // The param binding identifier is skipped by the function-param guard;
    // the body reference (a non-binding position) is rewritten — this visitor
    // checks parent positions, not lexical scope.
    const expr = parseExpression('(flag) => flag + 1');
    const out = rewriteScriptExpression(expr, ir);
    expect(out).toBe('flag => flag.value + 1');
  });

  it('computed name as a function-declaration id is NOT given .value', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    const expr = parseExpression('(() => { function flag() {} return 1; })()');
    const out = rewriteScriptExpression(expr, ir);
    expect(out).toContain('function flag()');
  });
});

describe('rewriteScriptExpression — negatives', () => {
  it('unknown $props member is left untouched', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('mystery'));
    expect(rewriteScriptExpression(expr, ir)).toBe('$props.mystery');
  });

  it('unknown $data member is left untouched', () => {
    const ir = buildIR();
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('mystery'));
    expect(rewriteScriptExpression(expr, ir)).toBe('$data.mystery');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const expr = t.memberExpression(
      t.identifier('$props'),
      t.stringLiteral('x'),
      /* computed */ true,
    );
    expect(rewriteScriptExpression(expr, ir)).toBe('$props["x"]');
  });

  it('non-$ member expressions pass through unchanged', () => {
    const ir = buildIR();
    const expr = parseExpression('foo.bar.baz');
    expect(rewriteScriptExpression(expr, ir)).toBe('foo.bar.baz');
  });

  it('member expression with a non-identifier object passes through unchanged', () => {
    const ir = buildIR({ computed: [computed('flag')] });
    // `foo().bar` — the MemberExpression object is a CallExpression, exercising
    // the `!t.isIdentifier(obj)` early-return.
    const expr = parseExpression('foo().bar');
    expect(rewriteScriptExpression(expr, ir)).toBe('foo().bar');
  });

  it('non-$emit call expressions pass through unchanged', () => {
    const ir = buildIR();
    const expr = parseExpression('doThing(1, 2)');
    expect(rewriteScriptExpression(expr, ir)).toBe('doThing(1, 2)');
  });

  it('bare identifier that is not a computed name is left untouched', () => {
    const ir = buildIR();
    const expr = t.identifier('somethingElse');
    expect(rewriteScriptExpression(expr, ir)).toBe('somethingElse');
  });
});
