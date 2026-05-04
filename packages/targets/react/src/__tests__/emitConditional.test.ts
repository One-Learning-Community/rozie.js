/**
 * Plan 04-03 Task 1 — emitConditional behaviour tests.
 * Covers: r-if w/o else (short-circuit), r-if + r-else (ternary), 3-branch chain.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';
import { emitTemplate } from '../emit/emitTemplate.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(ir: IRComponent) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  return emitTemplate(ir, collectors, createDefaultRegistry());
}

describe('emitConditional — Plan 04-03 Task 1', () => {
  it('Test 4: single r-if (no else) → short-circuit && form', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<template>
<div>
  <span r-if="$props.open">visible</span>
</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    // The test is wrapped in parens for safe operator-precedence composition
    // (e.g. `(A || B) && body` rather than `A || B && body`).
    expect(jsx).toMatch(/\{\(props\.open\) && /);
  });

  it('Test 5: r-if + r-else → ternary', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ items: { type: Array, default: () => [] } }</props>
<template>
<div>
  <ul r-if="$props.items.length > 0"><li>has-items</li></ul>
  <p r-else>Empty</p>
</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    expect(jsx).toMatch(/\(props\.items\.length > 0\) \?/);
    expect(jsx).toContain(': ');
    expect(jsx).toContain('Empty');
  });

  it('Test 6: r-if + r-else-if + r-else → right-to-left ternary chain', () => {
    const ir = lowerInline(`
<rozie name="X">
<data>{ kind: 'a' }</data>
<template>
<div>
  <span r-if="$data.kind === 'a'">A</span>
  <span r-else-if="$data.kind === 'b'">B</span>
  <span r-else>C</span>
</div>
</template>
</rozie>
`);
    const { jsx } = emit(ir);
    // Expect: { (kind === 'a') ? <span>A</span> : (kind === 'b') ? <span>B</span> : <span>C</span> }
    expect(jsx).toMatch(/\(kind === ['"]a['"]\) \?/);
    expect(jsx).toMatch(/\(kind === ['"]b['"]\) \?/);
    expect(jsx).toContain('C');
  });
});
