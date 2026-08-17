/**
 * Plan 79-10 Task 1 — Solid runtime-keyed producer dispatch + matchedFamily
 * consumer routing (R3/R5/D-09).
 *
 * Solid's genuine default slot (`slotName === ''`, no `dynamicNameExpr`) is
 * emitted via a completely separate `resolved()`/`local.children` shape that
 * has NO concept of the `_props.slots` record at all — unlike React, where
 * the default-slot branches already flow through the same merged `fieldRef`
 * as every other slot. A producer `<slot :name="expr">` whose bound name does
 * not constant-fold ALSO carries `slotName === ''` (79-06's Assumption A1),
 * so this plan adds a NEW dedicated dynamic-name branch inside Solid's
 * `slotName === ''` guard that routes to the record BEFORE the
 * `resolved()`/`local.children` default-slot machinery ever runs.
 *
 * `matchedFamily` is exercised by hand-setting the flag directly on the
 * lowered IR's SlotFillerDecl (see React's sibling test file for the
 * rationale) — Task 3's cold-gate compile assertion covers the real
 * cross-file `compile()` round trip.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';
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

describe('Solid producer — runtime-keyed dispatch for a dynamic-name slot (R3/D-09)', () => {
  it('function form (with params): a SlotDecl carrying dynamicNameExpr emits a bracket-keyed record lookup with NO `??` merge', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'Cell.rozie' });
    expect(code).toContain('_props.slots?.[dynName()]');
    expect(code).not.toContain('??');
    expect(code).not.toContain('Slot]');
  });

  it('direct-call form (zero params): a SlotDecl carrying dynamicNameExpr emits a zero-arg record call, not `?.({})`', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ dynName: 'freeform' }</data>
<template>
<div><slot :name="$data.dynName"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'X.rozie' });
    expect(code).toContain('_props.slots?.[dynName()]?.()');
    expect(code).not.toContain('_props.slots?.[dynName()]?.({})');
    expect(code).not.toContain('??');
  });

  it('a static-name SlotDecl in the same component stays byte-identical in BOTH merge forms', () => {
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
    const { code } = emitSolid(ir, { filename: 'Mixed.rozie' });
    expect(code).toContain("(_props.headerSlot ?? _props.slots?.['header']?.({}))");
  });
});

describe('Solid consumer — matchedFamily fill routes into the merged slots record (R5/D-09)', () => {
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
    const { code } = emitSolid(ir, { filename: 'ConsumerX.rozie' });
    expect(code).toMatch(/slots=\{\{\s*'cellStatus':\s*\(\{\s*value\s*\}\)\s*=>/);
    expect(code).not.toMatch(/cellStatusSlot=/);
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
    const { code } = emitSolid(ir, { filename: 'ConsumerY.rozie' });
    expect(code).toContain('cellStatusSlot={({ value }) => (<>');
    expect(code).not.toMatch(/slots=\{\{/);
  });
});
