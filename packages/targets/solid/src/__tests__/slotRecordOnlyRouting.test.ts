/**
 * Plan 79-04 Task 2 — Solid non-identifier slot name record-only routing (R12/D-03).
 *
 * A slot name that is not a valid JS identifier (e.g. `cell-status`) can no
 * longer mint a `<name>Slot` field — ROZ127's identifier check was retired in
 * 79-03 (D-05), so such a name reaches this emitter for the first time.
 * Solid's `_props.cell-statusSlot` member-access shape would not even PARSE
 * (`cell - statusSlot` reads as subtraction) for such a name — this plan
 * routes it through the pre-existing bracket-keyed `_props.slots?.[...]`
 * record ALONE, in BOTH the function form and the direct-call form
 * emitSlotInvocation.ts builds, plus the declaration and filler sides.
 *
 * Identifier-named slots (e.g. `header`) MUST stay byte-identical in both
 * forms — the core byte-identity guarantee (AC-22) this whole phase is built
 * on.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { emitSolid } from '../emitSolid.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  const lowered = lowerToIR(result.ast, {});
  if (!lowered.ir) {
    throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

describe('Solid producer — non-identifier slot name record-only routing (R12/D-03)', () => {
  it('function form (no params): a non-identifier slot name emits a bracket-keyed record lookup with NO `??` merge', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'Cell.rozie' });
    expect(code).toContain("_props.slots?.['cell-status']");
    const invocation = code.match(/\{_props\.slots\?\.\['cell-status'\][^}]*\}/);
    expect(invocation).not.toBeNull();
    expect(invocation![0]).not.toContain('??');
  });

  it('direct-call form (no params, no scope args declared): a non-identifier slot mints NO cell-statusSlot field', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<template>
<div><slot name="cell-status"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'Cell.rozie' });
    expect(code).not.toMatch(/cell-?statusSlot/);
    expect(code).not.toMatch(/cellStatusSlot/);
  });

  it('an identifier-named slot (header) stays byte-identical in BOTH the function form and the direct-call form', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'X.rozie' });
    // Direct-call form (no params) — pre-phase merge + no-scope invocation.
    expect(code).toContain("(_props.headerSlot ?? _props.slots?.['header']?.({}))");
  });

  it('an identifier-named slot WITH params stays byte-identical in the function form', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<template>
<div><slot name="trigger" :open="$props.open"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'X.rozie' });
    expect(code).toContain("(_props.triggerSlot ?? _props.slots?.['trigger'])?.(");
  });

  it('backstop: a zero-scope-param non-identifier slot emits a zero-arg record call, not an empty-object call', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="cell-status"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'X.rozie' });
    // The pre-phase identifier convention calls the record side with `({})`
    // to type-align with the static JSX.Element field it merges with — but a
    // record-only slot has no static field to align with, so the backstop
    // requires the plain zero-arg call instead.
    expect(code).toContain("{_props.slots?.['cell-status']?.()}");
    expect(code).not.toContain("_props.slots?.['cell-status']?.({})");
  });

  it('a component declaring BOTH cell-status and header emits record-only for the first and merge for the second, in IR order', () => {
    const ir = lowerInline(`
<rozie name="Mixed">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div>
  <slot name="cell-status" :value="$props.value"></slot>
  <slot name="header"></slot>
</div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'Mixed.rozie' });
    const cellIdx = code.indexOf("_props.slots?.['cell-status']");
    const headerIdx = code.indexOf("(_props.headerSlot ?? _props.slots?.['header']");
    expect(cellIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(-1);
    expect(cellIdx).toBeLessThan(headerIdx);
  });

  it('a non-identifier slot name containing a single quote and a backslash is escaped, not emitted raw (T-79-07)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="a'b\\c"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'X.rozie' });
    expect(code).toContain("_props.slots?.['a\\'b\\\\c']");
  });
});

describe('Solid consumer — non-identifier slot fill routes into the merged slots record (R12/D-03)', () => {
  it('a fill targeting a non-identifier slot name (#cell-status) emits a record entry, not a named prop', () => {
    const ir = lowerInline(`
<rozie name="ConsumerX">
<components>{ Cell: "./Cell.rozie" }</components>
<template>
<div>
  <Cell value="x">
    <template #cell-status="{ value }">
      <span>{{ value }}</span>
    </template>
  </Cell>
</div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'ConsumerX.rozie' });
    expect(code).toMatch(/slots=\{\{\s*'cell-status':\s*\(\{\s*value\s*\}\)\s*=>/);
    expect(code).not.toMatch(/cell-?statusSlot=/);
    expect(code).not.toMatch(/cellStatusSlot=/);
  });
});
