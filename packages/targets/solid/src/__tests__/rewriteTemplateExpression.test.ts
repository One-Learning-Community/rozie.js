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
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
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
