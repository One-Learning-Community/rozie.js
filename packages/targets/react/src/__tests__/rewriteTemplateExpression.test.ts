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
