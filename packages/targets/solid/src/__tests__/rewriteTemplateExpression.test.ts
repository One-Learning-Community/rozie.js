/**
 * rewriteTemplateExpression tests — Solid target.
 *
 * Phase 07.3.2 Plan 09 — §slots-X-merge describe block.
 *
 * Asserts the producer-side $slots.X rewrite (consumed by `r-if`/`r-show`
 * guards + interpolations) merges the static-named slot prop field with the
 * consumer-side dynamic-name slots map. Mirrors the canonical merge shape
 * already in use at the invocation site (`emitSlotInvocation.ts:139`):
 *
 *   `$slots.<X>`  →  `(_props.<X>Slot ?? _props.slots?.['<x>'])`
 *
 * Without this merge, `r-if="$slots.header"` guards short-circuit to `undefined`
 * when ONLY a dynamic-name fill is provided by the consumer
 * (`<template #[$data.slotName]>`), and the dynamic-fill slot is silently
 * dropped from the rendered output. See F-07.3.2-05-A row #4 (Solid Modal 2)
 * in `.planning/phases/07.3.2-.../07.3.2-05-SUMMARY.md`.
 *
 * Pitfall 2 lock — the merge expression MUST stay inline (inside the
 * surrounding JSX-tracked expression context); hoisting to `untrack(...)` or
 * a top-level `const merged = ...` would break Solid's reactivity-on-change.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import type { IRComponent, SlotDecl, ParamDecl } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

function buildSlotDecl(name: string, params: ParamDecl[] = []): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params,
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
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], portalRules: [], sourceLoc: { start: 0, end: 0 } },
    components: [],
    setupBody: {
      type: 'SetupBody',
      scriptProgram,
      annotations: [],
    },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

describe('§slots-X-merge — $slots.X rewrites to merged dynamic-fallback form (Phase 07.3.2 Plan 09)', () => {
  it("rewrites bare $slots.header to (_props.headerSlot ?? _props.slots?.['header'])", () => {
    // The canonical RED→GREEN assertion: the rewriter must emit the
    // parenthesized merge expression, not a bare _props.headerSlot.
    const ir = buildIR({
      slots: [buildSlotDecl('header'), buildSlotDecl('footer')],
    });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('header'));
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toBe("(_props.headerSlot ?? _props.slots?.['header'])");
  });

  it("rewrites $props.title || $slots.header r-if guard so it contains the merge AND no bare _props.headerSlot alone", () => {
    // Mirrors examples/Modal.rozie L77 `r-if="$props.title || $slots.header"`.
    // After rewrite, the LHS becomes local.title (non-model prop) and the RHS
    // becomes the merged form. Asserts BOTH that the merge is present AND
    // that the (bug) bare-headerSlot shape is NOT present in a stand-alone
    // form following a `||` operator.
    const ir = buildIR({
      props: [
        {
          name: 'title',
          isModel: false,
          defaultValue: null,
          typeAnnotation: { kind: 'identifier', name: 'String' },
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      slots: [buildSlotDecl('header'), buildSlotDecl('footer')],
    });
    const expr = t.logicalExpression(
      '||',
      t.memberExpression(t.identifier('$props'), t.identifier('title')),
      t.memberExpression(t.identifier('$slots'), t.identifier('header')),
    );
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toContain("(_props.headerSlot ?? _props.slots?.['header'])");
    // The bug-shape (`local.title || _props.headerSlot` without merge) MUST
    // not be present — the RHS must always be the merged form.
    expect(out).not.toMatch(/\|\|\s*_props\.headerSlot\s*$/);
  });

  it('leaves $slots.<unknown> unchanged when the slot name is NOT in ir.slots (negative case)', () => {
    // Non-regression: when the slot name is not declared on the IR (e.g.,
    // typo, or stale source that referenced a slot since removed), the
    // rewriter MUST leave the expression untouched so downstream diagnostics
    // surface it. The rewrite only fires inside the gated branch.
    const ir = buildIR({
      slots: [buildSlotDecl('header')], // 'nonexistent' is NOT declared
    });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('nonexistent'));
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toBe('$slots.nonexistent');
  });

  it('rewrites $data.foo, $props.bar, $refs.baz untouched by the §slots-X-merge change (non-regression)', () => {
    // The slots-merge edit must not contaminate sibling identifier-rewrite
    // paths. Confirms $data → signal getter, non-model $props → local.X,
    // and $refs → XRef are all UNCHANGED.
    const ir = buildIR({
      props: [
        {
          name: 'bar',
          isModel: false,
          defaultValue: null,
          typeAnnotation: { kind: 'identifier', name: 'String' },
          sourceLoc: { start: 0, end: 0 },
        },
      ],
      state: [{ name: 'foo', initializer: t.numericLiteral(0), sourceLoc: { start: 0, end: 0 } }],
      refs: [{ type: 'RefDecl', name: 'baz', sourceLoc: { start: 0, end: 0 } } as any],
    });

    // $data.foo
    expect(
      rewriteTemplateExpression(
        t.memberExpression(t.identifier('$data'), t.identifier('foo')),
        ir,
      ),
    ).toBe('foo()');

    // $props.bar (non-model)
    expect(
      rewriteTemplateExpression(
        t.memberExpression(t.identifier('$props'), t.identifier('bar')),
        ir,
      ),
    ).toBe('local.bar');

    // $refs.baz
    expect(
      rewriteTemplateExpression(
        t.memberExpression(t.identifier('$refs'), t.identifier('baz')),
        ir,
      ),
    ).toBe('bazRef');
  });

  it('Pitfall 2 lock — emit contains NO untrack( and NO const-hoisted merge form', () => {
    // The merge MUST be inline so Solid's compiler picks up the reactive
    // dependency on _props.slots. If a future refactor hoists the merge to
    // `untrack(() => _props.slots?.['header'])` or a top-level
    // `const merged = ...` declaration, this test fails — locking the
    // reactivity invariant at the snapshot layer.
    const ir = buildIR({
      slots: [buildSlotDecl('header')],
    });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('header'));
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).not.toContain('untrack(');
    expect(out).not.toMatch(/^\s*const\s+\w+\s*=/);
    // Sanity: the merge IS still in the emit.
    expect(out).toContain("_props.slots?.['header']");
  });
});

// ---------------------------------------------------------------------------
// Quick task 260521-qsh — broad branch-coverage deepening for the Solid
// rewriteTemplateExpression. The §slots-X-merge block above only exercised the
// $slots branch; the describe blocks below drive every remaining sigil handler
// (AssignmentExpression model/data setters, MemberExpression $props model vs
// non-model vs unknown, $data signal getters, $refs, the $slots default-slot
// `_props.children` branch, OptionalMemberExpression twins, the Identifier
// visitor for $computed and invokeAccessors, and the $emit CallExpression).
// ---------------------------------------------------------------------------

function modelProp(name: string): IRComponent['props'][number] {
  return {
    name,
    isModel: true,
    defaultValue: null,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['props'][number];
}
function nonModelProp(name: string): IRComponent['props'][number] {
  return {
    name,
    isModel: false,
    defaultValue: null,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['props'][number];
}
function stateDecl(name: string): IRComponent['state'][number] {
  return {
    name,
    initializer: t.numericLiteral(0),
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['state'][number];
}
function refDecl(name: string): IRComponent['refs'][number] {
  return { type: 'RefDecl', name, sourceLoc: { start: 0, end: 0 } } as IRComponent['refs'][number];
}
function computedDecl(name: string): IRComponent['computed'][number] {
  return {
    type: 'ComputedDecl',
    name,
    body: t.numericLiteral(1),
    deps: [],
    sourceLoc: { start: 0, end: 0 },
  } as IRComponent['computed'][number];
}

import { parseExpression as _parseExpression } from '@babel/parser';
function rewrite(srcExpr: string, ir: IRComponent, opts?: { invokeAccessors?: Set<string> }): string {
  const expr = _parseExpression(srcExpr) as t.Expression;
  return rewriteTemplateExpression(expr, ir, opts);
}

describe('rewriteTemplateExpression — MemberExpression $props/$data/$refs', () => {
  it('$props.X (model) → X() (controllable-signal accessor call)', () => {
    const ir = buildIR({ props: [modelProp('value')] });
    expect(rewrite('$props.value', ir)).toBe('value()');
  });

  it('$props.X (non-model) → local.X', () => {
    const ir = buildIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props.step', ir)).toBe('local.step');
  });

  it('$props.X (unknown prop name) → local.X (unknown-prop fallback branch)', () => {
    const ir = buildIR();
    expect(rewrite('$props.mystery', ir)).toBe('local.mystery');
  });

  it('$data.X → X() (signal getter)', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count', ir)).toBe('count()');
  });

  it('$data.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [stateDecl('known')] });
    expect(rewrite('$data.unknown', ir)).toBe('$data.unknown');
  });

  it('$refs.X → XRef', () => {
    const ir = buildIR({ refs: [refDecl('inputEl')] });
    expect(rewrite('$refs.inputEl', ir)).toBe('inputElRef');
  });

  it('$refs.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [refDecl('known')] });
    expect(rewrite('$refs.unknown', ir)).toBe('$refs.unknown');
  });

  it('$slots default-slot (empty name) → _props.children', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier(''));
    expect(rewriteTemplateExpression(expr, ir)).toBe('_props.children');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [modelProp('x')] });
    expect(rewrite("$props['x']", ir)).toBe("$props['x']");
  });

  it('a non-sigil object name passes through the MemberExpression visitor', () => {
    const ir = buildIR({ props: [modelProp('value')] });
    expect(rewrite('whatever.value', ir)).toBe('whatever.value');
  });

  it('member expression whose object is not an identifier passes through', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('makeIt().count', ir)).toBe('makeIt().count');
  });
});

describe('rewriteTemplateExpression — OptionalMemberExpression $props/$data/$refs', () => {
  it('$props?.X (model) → X()', () => {
    const ir = buildIR({ props: [modelProp('value')] });
    expect(rewrite('$props?.value', ir)).toBe('value()');
  });

  it('$props?.X (non-model) → local.X', () => {
    const ir = buildIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props?.step', ir)).toBe('local?.step');
  });

  it('$props?.X (unknown prop name) → local.X (fallback branch)', () => {
    const ir = buildIR();
    expect(rewrite('$props?.mystery', ir)).toBe('local?.mystery');
  });

  it('$data?.X → X()', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('$data?.count', ir)).toBe('count()');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [stateDecl('known')] });
    expect(rewrite('$data?.unknown', ir)).toBe('$data?.unknown');
  });

  it('$refs?.X → XRef', () => {
    const ir = buildIR({ refs: [refDecl('inputEl')] });
    expect(rewrite('$refs?.inputEl', ir)).toBe('inputElRef');
  });

  it('$refs?.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [refDecl('known')] });
    expect(rewrite('$refs?.unknown', ir)).toBe('$refs?.unknown');
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [modelProp('x')] });
    expect(rewrite('$props?.[k]', ir)).toBe('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [modelProp('value')] });
    expect(rewrite('whatever?.value', ir)).toBe('whatever?.value');
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('makeIt()?.value', ir)).toBe('makeIt()?.value');
  });
});

describe('rewriteTemplateExpression — AssignmentExpression model/data setters', () => {
  it('$data.X = v → setX(v)', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count = 5', ir)).toBe('setCount(5)');
  });

  it('$data.X += v → setX(prev => prev + v) (compound functional updater)', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count += 1', ir)).toBe('setCount(prev => prev + 1)');
  });

  it('$props.X = v (model) → setX(v)', () => {
    const ir = buildIR({ props: [modelProp('value')] });
    expect(rewrite('$props.value = 7', ir)).toBe('setValue(7)');
  });

  it('$props.X = v (non-model) — model-write branch skipped, no setter emitted', () => {
    // Non-model prop write is a best-effort no-op in the AssignmentExpression
    // visitor; the MemberExpression visitor still rewrites the LHS object.
    const ir = buildIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props.step = 1', ir)).toBe('local.step = 1');
  });

  it('$data.X = v with an unknown data name — assignment passes through', () => {
    const ir = buildIR({ state: [stateDecl('known')] });
    expect(rewrite('$data.unknown = 1', ir)).toBe('$data.unknown = 1');
  });

  it('assignment whose LHS is not a member expression passes through', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('plain = 1', ir)).toBe('plain = 1');
  });

  it('assignment with a computed LHS member passes through', () => {
    const ir = buildIR({ state: [stateDecl('count')] });
    expect(rewrite('$data[k] = 1', ir)).toBe('$data[k] = 1');
  });
});

describe('rewriteTemplateExpression — CallExpression $emit', () => {
  it("$emit('change', x) → _props.onChange?.(x)", () => {
    const ir = buildIR();
    expect(rewrite("$emit('change', x)", ir)).toBe('_props.onChange?.(x)');
  });

  it("$emit('value-change', x) → _props.onValueChange?.(x) (kebab → camelCase)", () => {
    const ir = buildIR();
    expect(rewrite("$emit('value-change', x)", ir)).toBe(
      '_props.onValueChange?.(x)',
    );
  });

  it("$emit('') → _props.on?.() (empty event name yields bare 'on')", () => {
    const ir = buildIR();
    expect(rewrite("$emit('')", ir)).toBe('_props.on?.()');
  });

  it('$emit with zero arguments is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit()', ir)).toBe('$emit()');
  });

  it('$emit with a non-string-literal first arg is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit(dynamicName, x)', ir)).toBe('$emit(dynamicName, x)');
  });

  it('a non-$emit call expression passes through', () => {
    const ir = buildIR();
    expect(rewrite('doThing(1, 2)', ir)).toBe('doThing(1, 2)');
  });

  it('a call whose callee is not a bare identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('obj.method()', ir)).toBe('obj.method()');
  });
});

describe('rewriteTemplateExpression — Identifier visitor (computed + invokeAccessors)', () => {
  it('a bare $computed name → name() (signal getter wrap)', () => {
    const ir = buildIR({ computed: [computedDecl('canIncrement')] });
    expect(rewrite('canIncrement', ir)).toBe('canIncrement()');
  });

  it('an invokeAccessors identifier → name() (loop-index accessor wrap)', () => {
    const ir = buildIR();
    expect(rewrite('index', ir, { invokeAccessors: new Set(['index']) })).toBe(
      'index()',
    );
  });

  it('a bare identifier that is neither computed nor an accessor is left bare', () => {
    const ir = buildIR();
    expect(rewrite('plainVar', ir)).toBe('plainVar');
  });

  it('a $computed name already in callee position is NOT double-called', () => {
    const ir = buildIR({ computed: [computedDecl('remaining')] });
    expect(rewrite('remaining()', ir)).toBe('remaining()');
  });

  it('a $computed name as a non-computed member property is NOT wrapped', () => {
    const ir = buildIR({ computed: [computedDecl('remaining')] });
    expect(rewrite('obj.remaining', ir)).toBe('obj.remaining');
  });

  it('a $computed name as a non-computed object-property key is NOT wrapped', () => {
    const ir = buildIR({ computed: [computedDecl('remaining')] });
    expect(rewrite('({ remaining: 1 })', ir)).toBe('{ remaining: 1 }');
  });

  it('a $computed name in shorthand object-property is expanded to { name: name() }', () => {
    const ir = buildIR({ computed: [computedDecl('index')] });
    // Shorthand `{ index }` must expand so the value half keeps its accessor.
    expect(rewrite('({ index })', ir)).toBe('{ index: index() }');
  });

  it('a $computed name in computed object-property key position IS wrapped', () => {
    const ir = buildIR({ computed: [computedDecl('key')] });
    // Computed key `[key]` — the !computed guard does NOT skip; key() applies.
    expect(rewrite('({ [key]: 1 })', ir)).toBe('{ [key()]: 1 }');
  });
});

describe('rewriteTemplateExpression — nesting & passthrough', () => {
  it('rewrites sigils nested inside a conditional expression', () => {
    const ir = buildIR({
      props: [nonModelProp('disabled')],
      state: [stateDecl('count')],
    });
    expect(rewrite('$props.disabled ? 0 : $data.count', ir)).toBe(
      'local.disabled ? 0 : count()',
    );
  });

  it('a pure literal expression passes through unchanged', () => {
    const ir = buildIR();
    expect(rewrite('42', ir)).toBe('42');
  });
});
