// Phase 07.3.2 Plan 08 (TDD RED) — rewriteTemplateExpression tests for the
// $slots.X dynamic-merge contract.
//
// Closes F-07.3.2-05-A row #1 (React Modal 2 dynamic-fill) at the rewriter
// layer: $slots.X (where X is in ir.slots) MUST lower to the merged form
// `(props.renderX ?? props.slots?.['x'])` so that r-if guards evaluate truthy
// when ONLY dynamic-name fills (`<template #[expr]>`) are passed. Before this
// plan the rewriter emitted bare `props.renderX`, which short-circuited the
// `r-if="$props.title || $slots.header"` guard in Modal.rozie:79 to falsy
// when the consumer used only `slots={{ [slotName]: () => ... }}`.
//
// The new merged form mirrors the canonical shape Plan 01 already produces
// at the slot INVOCATION site (emitSlotInvocation.ts:231) — this plan brings
// the GUARD site to the same shape so the two layers agree.
//
// Per the gap-closure key takeaway: snapshot tests alone weren't enough to
// catch the original guard-rewriter gap (the dist-parity snapshots showed
// the bug but no unit test asserted the expected shape directly). The new
// §slots-X-merge describe block locks the contract at the rewriter layer so
// future drift fails at the unit-test level rather than only manifesting as
// runtime D-04 destructure crashes.
import { describe, expect, it } from 'vitest';
import { parseExpression as babelParseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function makeIR(overrides: Partial<IRComponent> = {}): IRComponent {
  // Minimal IRComponent skeleton — fields not exercised by the rewriter are
  // present as empty arrays so TypeScript narrows correctly.
  return {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    ...overrides,
  } as IRComponent;
}

function makeSlot(name: string) {
  return {
    type: 'SlotDecl' as const,
    name,
    defaultContent: null,
    params: [],
    presence: 'conditional' as const,
    nestedSlots: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

function rewrite(srcExpr: string, ir: IRComponent): string {
  const expr = babelParseExpression(srcExpr) as t.Expression;
  return rewriteTemplateExpression(expr, ir);
}

describe('§slots-X-merge — $slots.X rewrites to merged dynamic-fallback form (Phase 07.3.2 Plan 08, F-07.3.2-05-A)', () => {
  it('Test 1: bare $slots.header (slot in ir.slots) → "(props.renderHeader ?? props.slots?.[\'header\'])"', () => {
    const ir = makeIR({ slots: [makeSlot('header')] });
    const out = rewrite('$slots.header', ir);
    // Must produce the exact merged shape (parens + nullish-coalesce +
    // optional-computed-access). This is the contract Plan 04 already
    // established at the INVOCATION site (emitSlotInvocation.ts:231).
    expect(out).toBe("(props.renderHeader ?? props.slots?.['header'])");
  });

  it('Test 2: r-if-style "$props.title || $slots.header" contains the merged shape AND no bare props.renderHeader', () => {
    const ir = makeIR({
      props: [
        {
          type: 'PropDecl',
          name: 'title',
          isModel: false,
          tsType: undefined,
          defaultExpr: undefined,
          required: false,
          sourceLoc: { start: 0, end: 0 },
        } as any,
      ],
      slots: [makeSlot('header'), makeSlot('footer')],
    });
    const out = rewrite('$props.title || $slots.header', ir);
    expect(out).toContain("(props.renderHeader ?? props.slots?.['header'])");
    // The bare unmerged shape MUST NOT survive — that was the bug.
    expect(out).not.toMatch(/\|\|\s*props\.renderHeader\s*$/);
    // The $props.title side still rewrites to props.title (sanity).
    expect(out).toContain('props.title');
  });

  it('Test 3: $slots.footer (separate slot in ir.slots) → "(props.renderFooter ?? props.slots?.[\'footer\'])"', () => {
    const ir = makeIR({ slots: [makeSlot('header'), makeSlot('footer')] });
    const out = rewrite('$slots.footer', ir);
    expect(out).toBe("(props.renderFooter ?? props.slots?.['footer'])");
  });

  it('Test 4: $slots.nonexistent (NOT in ir.slots) → unchanged (negative non-regression)', () => {
    const ir = makeIR({ slots: [makeSlot('header')] });
    const out = rewrite('$slots.nonexistent', ir);
    // The slotNames.has(prop.name) gate must still filter out unknown slots —
    // no rewrite applied; the expression survives as `$slots.nonexistent`.
    expect(out).toBe('$slots.nonexistent');
  });

  it('Test 5: $data.X / $props.X / $refs.X handlers continue to work (cross-handler non-regression)', () => {
    const ir = makeIR({
      state: [{ type: 'StateDecl', name: 'count', initializer: t.numericLiteral(0), sourceLoc: { start: 0, end: 0 } } as any],
      refs: [{ type: 'RefDecl', name: 'inputEl', sourceLoc: { start: 0, end: 0 } } as any],
      props: [
        { type: 'PropDecl', name: 'step', isModel: false, sourceLoc: { start: 0, end: 0 } } as any,
      ],
      slots: [makeSlot('header')],
    });
    expect(rewrite('$data.count', ir)).toBe('count');
    expect(rewrite('$props.step', ir)).toBe('props.step');
    expect(rewrite('$refs.inputEl', ir)).toBe('inputEl.current');
    // And the merge shape still applies to slots side-by-side.
    expect(rewrite('$slots.header', ir)).toBe(
      "(props.renderHeader ?? props.slots?.['header'])",
    );
  });
});

// ---------------------------------------------------------------------------
// Quick task 260521-qsh — broad branch-coverage deepening for the React
// rewriteTemplateExpression. The §slots-X-merge block above only exercised the
// $slots branch; the describe blocks below drive every remaining sigil handler
// (AssignmentExpression model/data setter calls, MemberExpression $props model
// vs non-model, $refs, OptionalMemberExpression twins, the $emit CallExpression
// rewrite) plus the helper edge cases (capitalize empty, toReactEventPropName
// kebab/empty).
// ---------------------------------------------------------------------------

function modelProp(name: string): any {
  return { type: 'PropDecl', name, isModel: true, sourceLoc: { start: 0, end: 0 } };
}
function nonModelProp(name: string): any {
  return { type: 'PropDecl', name, isModel: false, sourceLoc: { start: 0, end: 0 } };
}
function stateDecl(name: string): any {
  return { type: 'StateDecl', name, initializer: t.numericLiteral(0), sourceLoc: { start: 0, end: 0 } };
}
function refDecl(name: string): any {
  return { type: 'RefDecl', name, sourceLoc: { start: 0, end: 0 } };
}

describe('rewriteTemplateExpression — MemberExpression $props/$data/$refs', () => {
  it('$props.X (model) → bare X', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('$props.value', ir)).toBe('value');
  });

  it('$props.X (non-model) → props.X', () => {
    const ir = makeIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props.step', ir)).toBe('props.step');
  });

  it('$props.X (unknown prop name) is left untouched', () => {
    const ir = makeIR({ props: [modelProp('known')] });
    expect(rewrite('$props.mystery', ir)).toBe('$props.mystery');
  });

  it('$data.X → bare X', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count', ir)).toBe('count');
  });

  it('$data.X (unknown data name) is left untouched', () => {
    const ir = makeIR({ state: [stateDecl('known')] });
    expect(rewrite('$data.unknown', ir)).toBe('$data.unknown');
  });

  it('$refs.X → X.current', () => {
    const ir = makeIR({ refs: [refDecl('inputEl')] });
    expect(rewrite('$refs.inputEl', ir)).toBe('inputEl.current');
  });

  it('$refs.X (unknown ref name) is left untouched', () => {
    const ir = makeIR({ refs: [refDecl('known')] });
    expect(rewrite('$refs.unknown', ir)).toBe('$refs.unknown');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = makeIR({ props: [modelProp('x')] });
    expect(rewrite("$props['x']", ir)).toBe("$props['x']");
  });

  it('a non-sigil object name passes through the MemberExpression visitor', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('whatever.value', ir)).toBe('whatever.value');
  });

  it('member expression whose property is not an identifier passes through', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data[dyn]', ir)).toBe('$data[dyn]');
  });

  it('member expression whose object is not an identifier passes through', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('makeIt().count', ir)).toBe('makeIt().count');
  });
});

describe('rewriteTemplateExpression — OptionalMemberExpression $props/$data/$refs', () => {
  it('$props?.X (model) → bare X', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('$props?.value', ir)).toBe('value');
  });

  it('$props?.X (non-model) → props.X', () => {
    const ir = makeIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props?.step', ir)).toBe('props?.step');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = makeIR({ props: [modelProp('known')] });
    expect(rewrite('$props?.mystery', ir)).toBe('$props?.mystery');
  });

  it('$data?.X → bare X', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data?.count', ir)).toBe('count');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = makeIR({ state: [stateDecl('known')] });
    expect(rewrite('$data?.unknown', ir)).toBe('$data?.unknown');
  });

  it('$refs?.X → X?.current (optional chain preserved on the rewritten object)', () => {
    const ir = makeIR({ refs: [refDecl('inputEl')] });
    expect(rewrite('$refs?.inputEl', ir)).toBe('inputEl?.current');
  });

  it('$refs?.X (unknown ref name) is left untouched', () => {
    const ir = makeIR({ refs: [refDecl('known')] });
    expect(rewrite('$refs?.unknown', ir)).toBe('$refs?.unknown');
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = makeIR({ props: [modelProp('x')] });
    expect(rewrite('$props?.[k]', ir)).toBe('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('whatever?.value', ir)).toBe('whatever?.value');
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = makeIR();
    expect(rewrite('makeIt()?.value', ir)).toBe('makeIt()?.value');
  });
});

describe('rewriteTemplateExpression — AssignmentExpression model/data setters', () => {
  it('$data.X = v → setX(v)', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count = 5', ir)).toBe('setCount(5)');
  });

  it('$data.X += v → setX(prev => prev + v) (compound functional updater)', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count += 1', ir)).toBe('setCount(prev => prev + 1)');
  });

  it('$data.X *= v → setX(prev => prev * v)', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data.count *= 2', ir)).toBe('setCount(prev => prev * 2)');
  });

  it('$props.X = v (model) → setX(v)', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('$props.value = 7', ir)).toBe('setValue(7)');
  });

  it('$props.X -= v (model) → setX(prev => prev - v)', () => {
    const ir = makeIR({ props: [modelProp('value')] });
    expect(rewrite('$props.value -= 3', ir)).toBe('setValue(prev => prev - 3)');
  });

  it('$props.X = v (non-model) — assignment NOT rewritten to a setter', () => {
    // Non-model props are not in modelProps, so the AssignmentExpression
    // visitor's `$props` branch is skipped. The MemberExpression visitor still
    // rewrites the LHS object to `props`.
    const ir = makeIR({ props: [nonModelProp('step')] });
    expect(rewrite('$props.step = 1', ir)).toBe('props.step = 1');
  });

  it('$data.X = v with an unknown data name — assignment passes through', () => {
    const ir = makeIR({ state: [stateDecl('known')] });
    expect(rewrite('$data.unknown = 1', ir)).toBe('$data.unknown = 1');
  });

  it('assignment whose LHS is not a member expression passes through', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('plain = 1', ir)).toBe('plain = 1');
  });

  it('assignment with a computed LHS member passes through', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('$data[k] = 1', ir)).toBe('$data[k] = 1');
  });

  it('assignment whose LHS object is not an identifier passes through', () => {
    const ir = makeIR({ state: [stateDecl('count')] });
    expect(rewrite('makeIt().count = 1', ir)).toBe('makeIt().count = 1');
  });
});

describe('rewriteTemplateExpression — CallExpression $emit', () => {
  it("$emit('change', x) → props.onChange?.(x)", () => {
    const ir = makeIR();
    expect(rewrite("$emit('change', x)", ir)).toBe('props.onChange?.(x)');
  });

  it("$emit('value-change', x) → props.onValueChange?.(x) (kebab → camelCase)", () => {
    const ir = makeIR();
    expect(rewrite("$emit('value-change', x)", ir)).toBe(
      'props.onValueChange?.(x)',
    );
  });

  it("$emit('snake_event') → props.onSnakeEvent?.()", () => {
    const ir = makeIR();
    expect(rewrite("$emit('snake_event')", ir)).toBe('props.onSnakeEvent?.()');
  });

  it("$emit('') → props.on?.() (empty event name yields bare 'on' prefix)", () => {
    const ir = makeIR();
    // toReactEventPropName splits to zero parts → returns the bare 'on'.
    expect(rewrite("$emit('')", ir)).toBe('props.on?.()');
  });

  it('$emit with zero arguments is left untouched', () => {
    const ir = makeIR();
    expect(rewrite('$emit()', ir)).toBe('$emit()');
  });

  it('$emit with a non-string-literal first arg is left untouched', () => {
    const ir = makeIR();
    expect(rewrite('$emit(dynamicName, x)', ir)).toBe('$emit(dynamicName, x)');
  });

  it('a non-$emit call expression passes through', () => {
    const ir = makeIR();
    expect(rewrite('doThing(1, 2)', ir)).toBe('doThing(1, 2)');
  });

  it('a call whose callee is not a bare identifier passes through', () => {
    const ir = makeIR();
    expect(rewrite('obj.method()', ir)).toBe('obj.method()');
  });

  it("$emit('select', a, b) forwards multiple rest args", () => {
    const ir = makeIR();
    expect(rewrite("$emit('select', a, b)", ir)).toBe('props.onSelect?.(a, b)');
  });
});

describe('rewriteTemplateExpression — nesting & passthrough', () => {
  it('rewrites sigils nested inside a conditional expression', () => {
    const ir = makeIR({
      props: [nonModelProp('disabled')],
      state: [stateDecl('count')],
    });
    expect(rewrite('$props.disabled ? 0 : $data.count', ir)).toBe(
      'props.disabled ? 0 : count',
    );
  });

  it('rewrites sigils nested inside a logical expression', () => {
    const ir = makeIR({ state: [stateDecl('open')], refs: [refDecl('el')] });
    expect(rewrite('$data.open && $refs.el', ir)).toBe('open && el.current');
  });

  it('a pure literal expression passes through unchanged', () => {
    const ir = makeIR();
    expect(rewrite('42', ir)).toBe('42');
  });
});
