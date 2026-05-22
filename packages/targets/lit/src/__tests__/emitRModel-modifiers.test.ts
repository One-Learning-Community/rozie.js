/**
 * Phase 12 Plan 03 Task 2 — Lit `r-model` modifier emit.
 *
 * Covers the resolved-`modifiers` consumption added to `buildRModelParts`
 * in `emit/emitTemplate.ts` (the live Lit r-model emit path):
 *   - `.number` / `.trim` value-transform splicing into the committed value
 *   - `.lazy` per D-08 — Lit swaps `@input` -> `@change`
 *   - bare `r-model` (no modifier) stays byte-identical to pre-phase
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../emitLit.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const errs = result.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length > 0) throw new Error('parse errors: ' + JSON.stringify(errs));
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  const lerrs = lowered.diagnostics.filter((d) => d.severity === 'error');
  if (lerrs.length > 0) throw new Error('lower errors: ' + JSON.stringify(lerrs));
  return lowered.ir;
}

function emit(rozie: string): string {
  const ir = lowerInline(rozie);
  const { code } = emitLit(ir, {
    filename: 'inline.rozie',
    source: rozie,
    modifierRegistry: createDefaultRegistry(),
  });
  return code;
}

describe('Lit emitRModel — modifier emit (Phase 12 Plan 03)', () => {
  it('bare r-model emits .value + @input (byte-identical to pre-phase)', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('.value=${');
    expect(code).toContain('@input=${');
    expect(code).not.toContain('@change=${');
  });

  it('.number wraps the value access in a numeric coercion before the assignment', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.number="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('.value=${');
    expect(code).toContain('@input=${');
    expect(code).toContain('parseFloat');
    expect(code).toContain('HTMLInputElement).value');
  });

  it('.trim applies .trim() to the value access before the assignment', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('.value=${');
    // `.trim` fragment `$v.trim()` wraps the value access: `(...).trim()`.
    expect(code).toContain('HTMLInputElement).value).trim()');
  });

  it('.lazy swaps @input -> @change', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.lazy="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('.value=${');
    expect(code).toContain('@change=${');
    expect(code).not.toContain('@input=${');
  });

  it('.lazy.number.trim emits @change whose committed value is trim-then-number coerced', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.lazy.number.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('.value=${');
    expect(code).toContain('@change=${');
    expect(code).toContain('.trim()');
    expect(code).toContain('parseFloat');
    expect(code).not.toContain('@input=${');
  });
});
