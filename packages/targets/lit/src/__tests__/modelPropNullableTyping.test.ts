/**
 * Lit nullable model prop typing (quick 261019-ti9, orchestrator add-on F).
 *
 * A `model: true` prop with `default: null` and a null-failing type (`String`,
 * `Number`) emitted `createLitControllableProperty<string>({ …, defaultValue: null })`
 * and a `get value(): string` accessor — a strict-tsc TS2322 ("Type 'null' is not
 * assignable to type 'string'"). React, Solid, Vue, Svelte and Angular all type the
 * same prop `string | null`. The generic and the public accessor now carry the same
 * `| null` widening the `_<name>_attr` mirror and the non-model fields already had
 * (renderFieldSuffix, Phase 65 Class 1).
 *
 * Unchanged: a model prop with a non-null default, and a type that already admits
 * `null`.
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(props: string): string {
  const source = `<rozie name="ModelNull">
<props>
${props}
</props>
<template>
<div>{{ $props.value }}</div>
</template>
</rozie>`;
  return emitLit(lowerInline(source), {
    filename: 'inline.rozie',
    source,
    modifierRegistry: createDefaultRegistry(),
  }).code;
}

describe('emitLit — nullable model prop typing (add-on F)', () => {
  it('String model with default null: the controllable generic and the accessor admit null', () => {
    const code = emit(`{ value: { type: String, default: null, model: true } }`);
    expect(code).toContain('createLitControllableProperty<string | null>(');
    expect(code).toContain('get value(): string | null {');
    expect(code).toContain('set value(v: string | null) {');
    expect(code).not.toContain('createLitControllableProperty<string>(');
  });

  it('Number model with default null is widened the same way', () => {
    const code = emit(`{ value: { type: Number, default: null, model: true } }`);
    expect(code).toContain('createLitControllableProperty<number | null>(');
    expect(code).toContain('get value(): number | null {');
  });

  it('NO-REGRESS: a model prop with a non-null default keeps the narrow type', () => {
    const code = emit(`{ value: { type: String, default: 'x', model: true } }`);
    expect(code).toContain('createLitControllableProperty<string>(');
    expect(code).toContain('get value(): string {');
    expect(code).not.toContain('createLitControllableProperty<string | null>(');
    expect(code).not.toContain('get value(): string | null');
  });

  it('NO-REGRESS: a model prop with no default keeps the narrow type', () => {
    const code = emit(`{ value: { type: String, model: true } }`);
    expect(code).toContain('createLitControllableProperty<string>(');
    expect(code).not.toContain('createLitControllableProperty<string | null>(');
  });
});
