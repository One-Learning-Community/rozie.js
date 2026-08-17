/**
 * slotDynamicName.test.ts — Phase 79 Plan 79-06 Task 1 (R1/D-12).
 *
 * RED-FIRST: at the point this file is authored, `SlotDecl.dynamicNameExpr`
 * / `SlotDecl.namePrefix` do not exist and `lowerSlots` does not read the
 * bound `:name` attribute at all — every non-trivial assertion below fails
 * until `lowerSlots.ts`'s `:name` reservation lands.
 *
 * Drives through `lowerToIR` (NOT `lowerSlots` in isolation) per D-12's
 * convention, mirroring the sibling `validateEmitNameCollision.test.ts`.
 *
 * Task 2 (same plan) extends this file with the ROZ090/ROZ091/ROZ092/ROZ094
 * per-slot `:name` authoring-diagnostics coverage.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../parse.js';
import { lowerToIR } from '../lower.js';
import { createDefaultRegistry } from '../../modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../diagnostics/Diagnostic.js';
import type { IRComponent, SlotDecl } from '../types.js';

function lower(
  source: string,
  filename = 'DynName.rozie',
): { ir: IRComponent; diagnostics: Diagnostic[] } {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  }
  const { ir, diagnostics: irDiags } = lowerToIR(ast, {
    modifierRegistry: createDefaultRegistry(),
    filename,
  });
  const diagnostics = [...parseDiags, ...irDiags];
  if (!ir) {
    throw new Error(`lowerToIR returned null ir: ${diagnostics.map((d) => d.code).join(', ')}`);
  }
  return { ir, diagnostics };
}

function firstSlot(ir: IRComponent): SlotDecl {
  const slot = ir.slots[0];
  if (!slot) throw new Error('no slots found on ir.slots');
  return slot;
}

describe('lowerSlots — :name reservation IR fields (Phase 79 R1, Plan 79-06 Task 1)', () => {
  it('AC-2: <slot :name="col.key"> sets dynamicNameExpr, leaves name as the empty-string sentinel, and mints NO `name` ParamDecl', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="col.key" :value="col.key" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('');
    expect('dynamicNameExpr' in slot).toBe(true);
    expect(slot.dynamicNameExpr).toBeDefined();
    expect(slot.params.every((p) => p.name !== 'name')).toBe(true);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-3: <slot :name="\'cell\'"> (StringLiteral) constant-folds to a static name with NO dynamicNameExpr/namePrefix keys', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="'cell'" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('cell');
    expect('dynamicNameExpr' in slot).toBe(false);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-3: <slot :name="`cell`"> (zero-interpolation TemplateLiteral) constant-folds identically to the StringLiteral case', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`cell\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('cell');
    expect('dynamicNameExpr' in slot).toBe(false);
    expect('namePrefix' in slot).toBe(false);
  });

  it('AC-5: <slot :name="`cell-${k}`"> sets namePrefix to the leading quasi text', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`cell-\${k}\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.name).toBe('');
    expect(slot.namePrefix).toBe('cell-');
    expect(slot.dynamicNameExpr).toBeDefined();
  });

  it('AC-12: <slot :name="`${k}-cell`"> (empty leading quasi) sets dynamicNameExpr with NO namePrefix key', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot :name="\`\${k}-cell\`" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.dynamicNameExpr).toBeDefined();
    expect('namePrefix' in slot).toBe(false);
  });

  it('byte-identity (AC-1): <slot name="header" :close="c"> carries EXACTLY the pre-Phase-79 enumerable key set — no new keys present-but-undefined', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot name="header" :close="c" />
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(Object.keys(slot).sort()).toEqual(
      ['defaultContent', 'name', 'nestedSlots', 'params', 'presence', 'sourceLoc', 'type'].sort(),
    );
  });

  it('determinePresence: a slot with a non-constant :name inside r-if="$slots.x" stays "always" — a runtime name has no compile-time $slots.<key> guard to test against', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <div r-if="$slots.x">
    <slot :name="col.key" />
  </div>
</template>
</rozie>`);
    const slot = firstSlot(ir);
    expect(slot.presence).toBe('always');
  });

  it('every pre-existing core IR fixture with only static slot names is unaffected — a component with two static slots produces two SlotDecls with no dynamic-name keys', () => {
    const { ir } = lower(`
<rozie name="DynName">
<template>
  <slot name="header" />
  <slot name="footer" :x="1" />
</template>
</rozie>`);
    expect(ir.slots.length).toBe(2);
    for (const slot of ir.slots) {
      expect('dynamicNameExpr' in slot).toBe(false);
      expect('namePrefix' in slot).toBe(false);
    }
  });

  it('ROZ096 (T-79-12): a :name value that fails to parse as a JS expression emits an error and never falls back to a silent `undefined` identifier', async () => {
    const { RozieErrorCode } = await import('../../diagnostics/codes.js');
    const { ir, diagnostics } = lower(`
<rozie name="DynName">
<template>
  <slot :name="(" />
</template>
</rozie>`);
    const hits = diagnostics.filter((d) => d.code === RozieErrorCode.SLOT_DYNAMIC_NAME_PARSE_ERROR);
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc).toBeTruthy();
    const slot = firstSlot(ir);
    expect('dynamicNameExpr' in slot).toBe(false);
  });
});
