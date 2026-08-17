/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 1 (Solid, R6 + D-13).
 *
 * Solid's `emitSlotDecl.ts` dedupes by bare `slot.name` (`seenSlotNames`)
 * BEFORE deciding what to mint — a dynamic-name slot shares the `''`
 * default-slot sentinel (79-06 Assumption A1), so it currently mints a
 * spurious `children?: JSX.Element` field (folded into the genuine default
 * slot's own field) rather than being routed record-only. `emitPropsInterface.ts`'s
 * `slots?:` field types as the generic `Record<string, (ctx: any) =>
 * JSX.Element>` regardless of any derivable family prefix (R6's bug).
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitSolid } from '../../emitSolid.js';
import { emitSlotDecl } from '../emitSlotDecl.js';
import { buildSlotsRecordType } from '../emitPropsInterface.js';
import type { IRComponent, SlotDecl } from '../../../../../core/src/ir/types.js';

const LOC = { start: 0, end: 0 };

function tsType(src: string): t.TSType {
  const ast = babelParse(`type __X = ${src};`, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  const decl = ast.program.body[0] as t.TSTypeAliasDeclaration;
  return decl.typeAnnotation;
}

function dynamicSlot(overrides: Partial<SlotDecl>): SlotDecl {
  return {
    type: 'SlotDecl',
    name: '',
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    sourceLoc: LOC,
    dynamicNameExpr: t.identifier('__placeholder'),
    ...overrides,
  };
}

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

describe('buildSlotsRecordType — family type surface (R6, Solid)', () => {
  it('no dynamic-name slot at all → the pre-phase generic Record, byte-identical', () => {
    const type = buildSlotsRecordType([
      { type: 'SlotDecl', name: 'header', defaultContent: null, params: [], presence: 'always', nestedSlots: [], sourceLoc: LOC },
    ]);
    expect(type).toBe('Record<string, (ctx: any) => JSX.Element>');
  });

  it('a SlotDecl with namePrefix emits a template-literal-keyed entry naming every family param', () => {
    const type = buildSlotsRecordType([
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          { type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC },
        ],
      }),
    ]);
    expect(type).toContain('[key: `cell-${string}`]:');
    expect(type).toContain('row: any');
    expect(type).toContain('value: any');
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix has no template-literal member', () => {
    const type = buildSlotsRecordType([dynamicSlot({})]);
    expect(type).not.toMatch(/\[key: `/);
    expect(type).toContain('[key: string]:');
  });

  it('a zero-param family types its value as a genuine zero-argument function', () => {
    const type = buildSlotsRecordType([dynamicSlot({ namePrefix: 'row-' })]);
    expect(type).toMatch(/\[key: `row-\$\{string\}`\]: \(\(\) => JSX\.Element\) \| undefined;/);
  });

  it('a param bound to a declared function type lowers to a variadic-any function type', () => {
    const type = buildSlotsRecordType([
      dynamicSlot({
        namePrefix: 'trigger-',
        params: [{ type: 'ParamDecl', name: 'toggle', valueExpression: t.identifier('toggle'), sourceLoc: LOC }],
        paramTypes: [tsType('(open: boolean) => void')],
      }),
    ]);
    expect(type).toContain('toggle: (...args: any[]) => any');
  });

  it("a static record-only name that textually matches an overlapping family's prefix gets its OWN named entry (Task 3 escape found compiling the real DynamicSlots consumer-ts fixture)", () => {
    const type = buildSlotsRecordType([
      {
        type: 'SlotDecl',
        name: 'cell-total',
        defaultContent: null,
        params: [{ type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC }],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          { type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC },
        ],
      }),
    ]);
    expect(type).toMatch(/'cell-total'\?: \(\(ctx: \{ value: any \}\) => JSX\.Element\) \| undefined;/);
  });
});

describe('emitSlotDecl (Solid) — a dynamic-name slot mints NO named field/ctx-interface', () => {
  it('a producer with ONLY a dynamic-name slot mints zero fields and zero ctx interfaces', () => {
    const ir = lowerInline(`
<rozie name="OnlyDynamic">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.fields.length).toBe(0);
    expect(result.ctxInterfaces.length).toBe(0);
  });

  it('a dynamic-name slot alongside a genuine default slot mints the field for the REAL default slot only', () => {
    const ir = lowerInline(`
<rozie name="DynamicPlusDefault">
<data>{ dynName: 'cell-total' }</data>
<template>
<div>
  <slot :name="$data.dynName" :value="1"></slot>
  <slot></slot>
</div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    const childrenLines = result.fields.filter((f) => f.includes('children?:'));
    expect(childrenLines.length).toBe(1);
  });
});

describe('emitSolid — end-to-end family type surface (R6)', () => {
  it('a component with no dynamic-name slot emits the pre-phase slots? type character-for-character', () => {
    const ir = lowerInline(`
<rozie name="Header">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'Header.rozie' });
    expect(code).toContain('slots?: Record<string, (ctx: any) => JSX.Element>;');
  });

  it('a static slot coexisting with an overlapping family emits BOTH the static field and the family member', () => {
    const ir = lowerInline(`
<rozie name="MixedFamily">
<data>{ dynName: 'cell-status' }</data>
<template>
<div>
  <slot name="cell-total"></slot>
  <slot :name="\`cell-\${$data.dynName}\`" :row="$data.dynName" :value="1"></slot>
</div>
</template>
</rozie>
`);
    const { code } = emitSolid(ir, { filename: 'MixedFamily.rozie' });
    expect(code).toContain('[key: `cell-${string}`]:');
    expect(code).toContain('row: any');
  });
});
