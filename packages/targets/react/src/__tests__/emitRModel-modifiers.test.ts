/**
 * Phase 12 Plan 03 Task 1 — React `r-model` modifier emit.
 *
 * Covers the resolved-`modifiers` consumption added to `emitRModel.ts`:
 *   - `.number` / `.trim` value-transform splicing into the setter call
 *   - `.lazy` per D-08 — React's uncontrolled `defaultValue` + `onBlur` pattern
 *   - bare `r-model` (no modifier) stays byte-identical to pre-phase
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';
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
  const { code } = emitReact(ir, { filename: 'inline.rozie', source: rozie });
  return code;
}

describe('React emitRModel — modifier emit (Phase 12 Plan 03)', () => {
  it('bare r-model emits controlled value + onChange (byte-identical to pre-phase)', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x}');
    expect(code).toContain('onChange=');
    expect(code).toContain('setX(e.target.value)');
    // No uncontrolled / lazy artifacts.
    expect(code).not.toContain('defaultValue');
    expect(code).not.toContain('onBlur');
  });

  it('.number wraps e.target.value in a numeric coercion before the setter', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.number="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x}');
    expect(code).toContain('onChange=');
    // The .number looseToNumber IIFE coercion wraps e.target.value.
    expect(code).toContain('parseFloat');
    expect(code).toContain('e.target.value');
    expect(code).toContain('setX(');
  });

  it('.trim applies .trim() to e.target.value before the setter', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('value={x}');
    expect(code).toContain('e.target.value.trim()');
    expect(code).toContain('setX(');
  });

  it('.lazy emits an uncontrolled defaultValue binding and an onBlur handler (not value/onChange)', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: '' }</data>
<template>
<input r-model.lazy="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('defaultValue={x}');
    expect(code).toContain('onBlur=');
    expect(code).toContain('setX(e.target.value)');
    // .lazy must NOT emit the controlled value=/onChange= pair.
    expect(code).not.toContain('value={x}');
    expect(code).not.toContain('onChange=');
  });

  it('.lazy.number.trim emits defaultValue + onBlur whose committed value is trim-then-number coerced', () => {
    const code = emit(`
<rozie name="X">
<data>{ x: 0 }</data>
<template>
<input r-model.lazy.number.trim="$data.x" />
</template>
</rozie>
`);
    expect(code).toContain('defaultValue={x}');
    expect(code).toContain('onBlur=');
    // .trim applies first, then .number coerces the trimmed string.
    expect(code).toContain('.trim()');
    expect(code).toContain('parseFloat');
    expect(code).not.toContain('onChange=');
  });
});
