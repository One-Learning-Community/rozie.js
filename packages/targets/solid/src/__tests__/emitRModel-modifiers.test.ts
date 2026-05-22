/**
 * Phase 12 Plan 03 Task 2 — Solid `r-model` modifier emit.
 *
 * Covers the resolved-`modifiers` consumption added to `emitRModel.ts`:
 *   - `.number` / `.trim` value-transform splicing into the setter call
 *   - `.lazy` per D-08 — Solid swaps `onInput` -> `onChange`
 *   - bare `r-model` (no modifier) stays byte-identical to pre-phase
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../emitSolid.js';
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
  const { code } = emitSolid(ir, { filename: 'inline.rozie', source: rozie });
  return code;
}

describe('Solid emitRModel — modifier emit (Phase 12 Plan 03)', () => {
  it('bare r-model emits value + onInput (byte-identical to pre-phase)', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x()}');
    expect(code).toContain('onInput=');
    expect(code).toContain('setX(e.currentTarget.value)');
    expect(code).not.toContain('onChange=');
  });

  it('.number wraps the value access in a numeric coercion before the setter', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.number="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x()}');
    expect(code).toContain('onInput=');
    expect(code).toContain('parseFloat');
    expect(code).toContain('e.currentTarget.value');
    expect(code).toContain('setX(');
  });

  it('.trim applies .trim() to the value access before the setter', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x()}');
    expect(code).toContain('e.currentTarget.value.trim()');
    expect(code).toContain('setX(');
  });

  it('.lazy swaps onInput -> onChange (Solid onChange IS the native change event)', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.lazy="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x()}');
    expect(code).toContain('onChange=');
    expect(code).toContain('setX(e.currentTarget.value)');
    // .lazy uses onChange, not onInput.
    expect(code).not.toContain('onInput=');
  });

  it('.lazy.number.trim emits onChange whose committed value is trim-then-number coerced', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.lazy.number.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x()}');
    expect(code).toContain('onChange=');
    expect(code).toContain('.trim()');
    expect(code).toContain('parseFloat');
    expect(code).not.toContain('onInput=');
  });
});
