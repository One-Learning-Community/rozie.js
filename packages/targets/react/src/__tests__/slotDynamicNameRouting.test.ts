/**
 * Plan 79-10 Task 1 — React runtime-keyed producer dispatch + matchedFamily
 * consumer routing (R3/R5/D-09).
 *
 * Generalizes 79-04's "non-identifier slot name" record-only routing to a
 * SECOND trigger: a producer `<slot :name="expr">` whose bound name does NOT
 * constant-fold (SlotDecl.dynamicNameExpr / 79-06). Both triggers share the
 * SAME `isRecordOnly` OR-extended decision in emitSlotInvocation.ts (no
 * parallel branch — T-79-24).
 *
 * `matchedFamily` (set by threadParamTypes's cross-file family-matching pass,
 * 79-07) is exercised here by hand-setting the flag directly on the lowered
 * IR's SlotFillerDecl rather than through a real cross-file `compile()` —
 * this isolates the EMIT function's dispatch (this plan's actual job) from
 * the family-matching THREADING itself (already covered by 79-07's own
 * tests). Task 3's cold-gate compile assertion exercises the full,
 * real-file-on-disk round trip against the actual DynamicSlots fixture pair.
 */

import type { IRComponent, SlotFillerDecl } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

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

/** Recursively locate the first SlotFillerDecl named `targetName` anywhere in the IR template tree. */
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

describe('React producer — runtime-keyed dispatch for a dynamic-name slot (R3/D-09)', () => {
  it('a SlotDecl carrying dynamicNameExpr emits a record lookup keyed on the rewritten expression, with no static field operand and no `??`', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'Cell.rozie' });
    expect(code).toContain('props.slots?.[dynName]');
    // This component has exactly ONE slot and no other merge site — a
    // component-wide absence of `??` proves the record-only branch dropped
    // the static-field merge operand entirely, not just this one occurrence.
    expect(code).not.toContain('??');
    expect(code).not.toContain('props.render');
  });

  it('a static-name SlotDecl in the same component emits its merge unchanged, character-for-character', () => {
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
    const { code } = emitReact(ir, { filename: 'Mixed.rozie' });
    expect(code).toContain("{(props.renderHeader ?? props.slots?.['header'])?.()}");
  });

  it('backstop: a dynamic-name producer with zero declared scope params emits a zero-arg record call', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ dynName: 'freeform' }</data>
<template>
<div><slot :name="$data.dynName"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'X.rozie' });
    // Default-slot dual-shape: typeof discriminator invokes with zero args.
    expect(code).toContain(
      "(typeof props.slots?.[dynName] === 'function' ? (props.slots?.[dynName] as Function)() : props.slots?.[dynName])",
    );
    expect(code).not.toContain('props.slots?.[dynName]({})');
  });
});

describe('React consumer — matchedFamily fill routes into the merged slots record (R5/D-09)', () => {
  it("a matchedFamily fill emits the record-object form keyed on the fill's own static name", () => {
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
    const { code } = emitReact(ir, { filename: 'ConsumerX.rozie' });
    expect(code).toMatch(/slots=\{\{\s*'cellStatus':\s*\(\{\s*value\s*\}\)\s*=>/);
    expect(code).not.toMatch(/renderCellStatus=/);
  });

  it('a fill WITHOUT matchedFamily stays on its ordinary named-prop path (byte-identical control)', () => {
    const ir = lowerInline(`
<rozie name="ConsumerY">
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
    const { code } = emitReact(ir, { filename: 'ConsumerY.rozie' });
    expect(code).toContain('renderCellStatus={({ value }) => (<>');
    expect(code).not.toMatch(/slots=\{\{/);
  });
});
