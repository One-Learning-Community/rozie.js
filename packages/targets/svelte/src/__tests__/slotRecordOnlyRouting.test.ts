/**
 * Plan 79-05 Task 1 — Svelte non-identifier slot name record-only routing (R12/D-03).
 *
 * A slot name that is not a valid JS identifier (e.g. `cell-status`) can no
 * longer mint a private-prop-alias binding — Svelte 5 collapses snippets and
 * props into one `$props()` destructure, so a hyphenated key there is a hard
 * parse error. This plan routes such a name through the pre-existing
 * `snippets` bracket-keyed record ALONE, on all four producer minting sites
 * (props-interface member, `$props()` destructure key, private prop alias,
 * `$derived` merge) plus the consumer fill.
 *
 * Identifier-named slots (e.g. `header`) MUST stay byte-identical to the
 * pre-phase merged form — that is the core byte-identity guarantee (AC-22)
 * this whole phase is built on.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../emitSvelte.js';

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

function compileSvelte(ir: IRComponent, filename: string): string {
  return emitSvelte(ir, { filename }).code;
}

describe('Svelte producer — non-identifier slot name record-only routing (R12/D-03)', () => {
  it('a non-identifier slot name (cell-status) emits a bracket-keyed snippets lookup with NO `??` merge', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Cell.rozie');
    expect(code).toContain("$derived(snippets?.['cell-status'])");
    const derivedLine = code.match(/const [^\n]*= \$derived\(snippets\?\.\['cell-status'\]\);/);
    expect(derivedLine).not.toBeNull();
    expect(derivedLine![0]).not.toContain('??');
  });

  it('a non-identifier slot name mints NO cell-status-derived member on the $props() destructure (the hard parse-error guard)', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Cell.rozie');
    const destructureMatch = code.match(/let \{([\s\S]*?)\}: Props = \$props\(\);/);
    expect(destructureMatch).not.toBeNull();
    expect(destructureMatch![1]).not.toContain('-');
    expect(code).not.toMatch(/__cell-statusProp/);
  });

  it('a non-identifier slot name mints NO named member on the props interface', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ value: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status" :value="$props.value"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Cell.rozie');
    expect(code).not.toMatch(/^\s*cell-status\?: Snippet/m);
  });

  it('an identifier-named slot (header) stays byte-identical to the pre-phase merged form', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'X.rozie');
    expect(code).toContain('const header = $derived(__headerProp ?? snippets?.header);');
    expect(code).toContain('header: __headerProp');
    expect(code).toContain('snippets?: Record<string, any>;');
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
    const code = compileSvelte(ir, 'Mixed.rozie');
    const cellIdx = code.indexOf("$derived(snippets?.['cell-status'])");
    const headerIdx = code.indexOf('$derived(__headerProp ?? snippets?.header)');
    expect(cellIdx).toBeGreaterThan(-1);
    expect(headerIdx).toBeGreaterThan(-1);
    expect(cellIdx).toBeLessThan(headerIdx);
  });

  it('the sanitized local binding is prefixed and camel-joined, and cannot collide with a same-shaped prop name', () => {
    const ir = lowerInline(`
<rozie name="Cell">
<props>{ cellStatus: { type: String, default: '' } }</props>
<template>
<div><slot name="cell-status"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'Cell.rozie');
    // The sanitized ident (`cellStatus`) would collide with the `cellStatus` prop
    // if left unprefixed — the `__rozieSlot_` sigil prevents that collision.
    expect(code).toContain('const __rozieSlot_cellStatus = $derived(');
    expect(code).not.toMatch(/^\s*const cellStatus = \$derived/m);
  });

  it('a non-identifier slot name containing a single quote and a backslash is escaped, not emitted raw (T-79-07)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="a'b\\c"></slot></div>
</template>
</rozie>
`);
    const code = compileSvelte(ir, 'X.rozie');
    expect(code).toContain("snippets?.['a\\'b\\\\c']");
  });
});

describe('Svelte consumer — non-identifier slot fill routes into the merged snippets record (R12/D-03)', () => {
  it('a fill targeting a non-identifier slot name (#cell-status) emits a record entry, not a named snippet block', () => {
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
    const code = compileSvelte(ir, 'ConsumerX.rozie');
    expect(code).toMatch(/snippets=\{\{\s*\['cell-status'\]:\s*__rozieDynSlot_\d+\s*\}\}/);
    expect(code).not.toMatch(/\{#snippet cell-status/);
  });
});
