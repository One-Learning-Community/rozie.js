/**
 * Plan 79-10 Task 2 — Vue native-path confirmation (R3/D-09).
 *
 * R3 claims Vue is already correct for a producer `<slot :name="expr">`.
 * This plan does NOT take that on faith (per the plan's own action text: "R3's
 * claim was verified against one regression fixture, not against a
 * producer-declared `:name` that has never existed before this phase").
 * Empirically verified during authoring: Vue's real (pre-Plan-10) emit
 * SILENTLY DROPPED the `:name` binding entirely — `node.slotName` stays at
 * the '' default-slot sentinel (79-06's Assumption A1) for a non-folding
 * `:name`, and the producer-side `emitSlotInvocation` (the LIVE function is
 * inline in `emitTemplateNode.ts`, NOT a standalone `emitSlotInvocation.ts`
 * file — the plan's file list assumed the latter) computed `nameAttr` purely
 * from `slotKey`, which is also '' — so the emitted `<slot>` carried NO name
 * attribute at all, collapsing to Vue's unnamed default slot. This file's
 * fix (an explicit dynamicNameExpr branch binding `:name`) is a REAL source
 * change, not a no-op confirmation.
 *
 * Vue's CONSUMER-side `matchedFamily` fill needed no change: `emitSlotFiller`
 * (also inline in `emitTemplateNode.ts`) already emits every non-dynamic,
 * non-default fill as `<template #<name>>` purely from `filler.name`,
 * regardless of how that name was resolved (exact vs. family match) — Vue's
 * native named-slot syntax has no separate "record" concept to route into.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitVue } from '../emitVue.js';
import type { IRComponent, SlotFillerDecl } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

function findFiller(node: unknown, targetName: string): SlotFillerDecl | null {
  if (node !== null && typeof node === 'object') {
    const n = node as { type?: string; slotFillers?: SlotFillerDecl[]; children?: unknown[] };
    if (n.type === 'TemplateElement' && Array.isArray(n.slotFillers)) {
      const found = n.slotFillers.find((f) => f.name === targetName);
      if (found) return found;
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) {
        const found = findFiller(c, targetName);
        if (found) return found;
      }
    }
  }
  return null;
}

describe('Vue producer — a dynamic-name slot binds :name to the rewritten expression (R3/D-09)', () => {
  it('a SlotDecl carrying dynamicNameExpr produces a BOUND name attribute on the emitted <slot> element', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const { code } = emitVue(ir, { filename: 'Cell.rozie' });
    expect(code).toContain('<slot :name="dynName" :value="1">');
    // Never a static `name="..."` attribute, and never silently unnamed.
    expect(code).not.toMatch(/<slot(?!\s*:name)[^>]*name="/);
  });

  it('backstop: a zero-scope-param dynamic producer emits the equivalent zero-param bound-name <slot>', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ dynName: 'freeform' }</data>
<template>
<div><slot :name="$data.dynName"></slot></div>
</template>
</rozie>
`);
    const { code } = emitVue(ir, { filename: 'X.rozie' });
    expect(code).toContain('<slot :name="dynName"></slot>');
  });

  it('a static-name SlotDecl in the same component emits pre-phase output unchanged', () => {
    const ir = lowerInline(`
<rozie name="Mixed">
<data>{ dynName: 'cell-total' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`);
    const { code } = emitVue(ir, { filename: 'Mixed.rozie' });
    expect(code).toContain('<slot name="header"></slot>');
  });
});

describe('Vue consumer — matchedFamily fill stays a native named fill (R5/D-09)', () => {
  it('a matchedFamily fill emits <template #name>, not a record-object form', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell>
    <template #cellStatus="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const filler = findFiller(ir.template, 'cellStatus');
    expect(filler).not.toBeNull();
    filler!.matchedFamily = true;
    const { code } = emitVue(ir, { filename: 'ConsumerX.rozie' });
    expect(code).toContain('<template #cellStatus="{ value }">');
    expect(code).not.toContain('slots={{');
    expect(code).not.toMatch(/rozieSlots|record-object|\[.*\]:\s*\(/);
  });
});
