// Phase 12 dogfood: the `.phone` custom MODEL modifier compiles via emitLit
// WITHOUT any change to @rozie/core (Requirement 7/8 SemVer proof).
//
// The .rozie source uses `r-model.phone.lazy` — pairing the custom `.phone`
// modifier with the built-in `.lazy` per CONTEXT §Discretion.
import { describe, expect, it } from 'vitest';
import {
  parse,
  lowerToIR,
  ModifierRegistry,
  registerBuiltins,
} from '@rozie/core';
import { emitLit } from '@rozie/target-lit';
import { phoneModifier } from '../index.js';

function buildRegistry(): ModifierRegistry {
  const registry = new ModifierRegistry();
  registerBuiltins(registry);
  registry.register(phoneModifier);
  return registry;
}

function compile(source: string, filename: string) {
  const registry = buildRegistry();
  const parseResult = parse(source, { filename });
  expect(parseResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (!parseResult.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(parseResult.ast, { modifierRegistry: registry });
  expect(lowered.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  return emitLit(lowered.ir, { source, filename, modifierRegistry: registry });
}

const SOURCE = `<rozie name="PhoneInput">
<template>
<input r-model.phone.lazy="$data.tel" />
</template>
<data>
{ tel: '' }
</data>
</rozie>`;

describe('Phase 12 — .phone compiles via emitLit (custom model-modifier dogfood)', () => {
  it('emits the phone-reformat valueTransform on r-model.phone.lazy', () => {
    const result = compile(SOURCE, 'PhoneInput.rozie');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // Lit's buildRModelParts splices the valueTransform textually around the
    // value access; .lazy swaps @input -> @change.
    expect(result.code).toContain('String(__v)');
  });
});
