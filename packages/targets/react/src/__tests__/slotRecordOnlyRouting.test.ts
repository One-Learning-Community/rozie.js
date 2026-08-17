/**
 * Plan 79-04 Task 1 — React non-identifier slot name record-only routing (R12/D-03).
 *
 * A slot name that is not a valid JS identifier (e.g. `cell-status`) can no
 * longer mint a `render<Pascal>` named-prop path — ROZ127's identifier check
 * was retired in 79-03 (D-05), so such a name reaches this emitter for the
 * first time. This plan routes it through the pre-existing Phase 07.3.2
 * bracket-keyed record (`props.slots?.[...]`) ALONE, on all three sides of
 * the slot trio (producer declaration + invocation, consumer fill).
 *
 * Identifier-named slots (e.g. `header`) MUST stay byte-identical to the
 * pre-phase merged form — that is the core byte-identity guarantee (AC-22)
 * this whole phase is built on.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

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

describe('React producer — non-identifier slot name record-only routing (R12/D-03)', () => {
  it('a non-identifier slot name (cell-status) emits a bracket-keyed record lookup with NO `??` merge', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'Cell.rozie' });
    expect(code).toContain("props.slots?.['cell-status']");
    // Isolate the invocation expression and assert the two-character nullish-
    // coalescing operator never appears inside it.
    const invocation = code.match(/\{props\.slots\?\.\['cell-status'\][^}]*\}/);
    expect(invocation).not.toBeNull();
    expect(invocation![0]).not.toContain('??');
  });

  it('a non-identifier slot name mints NO renderCellStatus-shaped field on the inline props interface', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'Cell.rozie' });
    expect(code).not.toMatch(/renderCellStatus/);
  });

  it('an identifier-named slot (header) stays byte-identical to the pre-phase merged+invoke form', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'X.rozie' });
    expect(code).toContain("{(props.renderHeader ?? props.slots?.['header'])?.()}");
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
    const { code } = emitReact(ir, { filename: 'Mixed.rozie' });
    const cellIdx = code.indexOf("props.slots?.['cell-status']");
    const headerIdx = code.indexOf("(props.renderHeader ?? props.slots?.['header'])");
    expect(cellIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(-1);
    expect(cellIdx).toBeLessThan(headerIdx);
  });

  it('backstop: a zero-scope-param non-identifier slot emits a zero-arg record call, not an empty-object call', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="cell-status"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'X.rozie' });
    expect(code).toContain("{props.slots?.['cell-status']?.()}");
    expect(code).not.toContain("props.slots?.['cell-status']?.({})");
  });

  it('a non-identifier slot name containing a single quote and a backslash is escaped, not emitted raw (T-79-07)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="a'b\\c"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'X.rozie' });
    // The raw, unescaped name would break out of the string literal — assert
    // the emitted source instead carries the escaped form.
    expect(code).toContain("props.slots?.['a\\'b\\\\c']");
  });
});

describe('React consumer — non-identifier slot fill routes into the merged slots record (R12/D-03)', () => {
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
    const { code } = emitReact(ir, { filename: 'ConsumerX.rozie' });
    expect(code).toMatch(/slots=\{\{\s*'cell-status':\s*\(\{\s*value\s*\}\)\s*=>/);
    expect(code).not.toMatch(/renderCellStatus=/);
  });
});
