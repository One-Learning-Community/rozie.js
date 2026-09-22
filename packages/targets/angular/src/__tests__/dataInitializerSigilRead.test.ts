// Quick 260922-hk4 (Task 2b) — a `<data>` initializer that reads `$props` /
// `$data` / `$model` must lower to a CLASS-BODY read on Angular.
//
// The `<data>` field becomes a class-field initializer (`fromData =
// signal(...)`), which is real TS in class scope — NOT an Angular template.
// Routing it through rewriteTemplateExpression's default TEMPLATE context
// emitted a bare `value()` / `a()` (TS2304 + runtime ReferenceError), and the
// data-initializer gate did not recognise `$model` at all (raw `$model.open`
// leaked). The class-body form is `this.value()` / `this.a()` / `this.open()`.
//
// TS class-field initializers run in declaration order, so the input field
// must be declared BEFORE the data field that reads it.
//
// Drives emitAngular DIRECTLY (parse → lowerToIR → emitAngular) against the
// LOCAL emitter source.
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../emitAngular.js';

function emit(data: string): string {
  const filename = 'DataInit.rozie';
  const source = `<rozie name="DataInit">
<props>
{
  value: { type: String, default: '' },
  open: { type: Boolean, default: false, model: true },
}
</props>
<data>
${data}
</data>
<template>
<div>{{ $data.out }}</div>
</template>
</rozie>
`;
  const { ast } = parse(source, { filename });
  const { ir } = lowerToIR(ast!, { modifierRegistry: createDefaultRegistry() });
  return emitAngular(ir!, { filename, source }).code;
}

describe('Angular <data> initializer sigil reads are this.-qualified', () => {
  it('$props read → `signal(this.value())`, input declared before the data field', () => {
    const code = emit('{ out: $props.value }');
    expect(code).toContain('out = signal(this.value());');
    expect(code).not.toMatch(/signal\(value\(\)\)/);
    const inputAt = code.indexOf('value = input<');
    const dataAt = code.indexOf('out = signal(');
    expect(inputAt).toBeGreaterThan(-1);
    expect(inputAt).toBeLessThan(dataAt);
  });

  it('$data self-reference → `signal(this.a())`', () => {
    const code = emit('{ a: 1, out: $data.a }');
    expect(code).toContain('out = signal(this.a());');
    expect(code).not.toMatch(/signal\(a\(\)\)/);
  });

  it('$model read → `signal(this.open())`, no raw $model leak', () => {
    const code = emit('{ out: $model.open }');
    expect(code).toContain('out = signal(this.open());');
    expect(code).not.toContain('$model');
    const modelAt = code.indexOf('open = model<');
    expect(modelAt).toBeGreaterThan(-1);
    expect(modelAt).toBeLessThan(code.indexOf('out = signal('));
  });

  it('a plain initializer is untouched', () => {
    expect(emit('{ out: 0 }')).toContain('out = signal(0);');
  });
});
