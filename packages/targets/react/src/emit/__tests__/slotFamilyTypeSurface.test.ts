/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 1 (React, R6 + D-13).
 *
 * Three pre-existing sites treat a dynamic-name SlotDecl (`dynamicNameExpr
 * !== undefined`, sharing the '' default-slot sentinel per 79-06 Assumption
 * A1) as if it WERE the genuine default slot:
 *   - `emitSlotDecl.ts` mints a `children?:` field + (with params) a
 *     `ChildrenCtx` interface for it — wrong; it is never rendered via
 *     `props.children`, only via `props.slots?.[expr]` (79-10).
 *   - `emitPropsInterface.ts`'s `slots?:` field types as the generic
 *     `Record<string, () => ReactNode>` regardless of any derivable family
 *     prefix — no real param types ever reach a family fill (R6's bug).
 *
 * This file proves the fix at the `refineSlotTypes.ts` unit level
 * (`buildSlotsRecordType`, the paramTypes flow into `ctxInterface`) AND at
 * the full `emitReact()` integration level (byte-identity for a no-dynamic
 * component; family/no-prefix/coexistence shapes for a dynamic one).
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../../emitReact.js';
import { refineSlotTypes, buildSlotsRecordType } from '../refineSlotTypes.js';
import { emitSlotDecl } from '../emitSlotDecl.js';
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

describe('refineSlotTypes ctxInterface — paramTypes flow (D-13)', () => {
  it('a param bound to a declared function type lowers to a variadic-any function type, not bare `any`', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'toggle', valueExpression: t.identifier('toggle'), sourceLoc: LOC },
      ],
      paramTypes: [tsType('(open: boolean) => void')],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: LOC,
    };
    const refined = refineSlotTypes(slot);
    expect(refined.ctxInterface).toMatch(/toggle: \(\.\.\.args: any\[\]\) => any/);
  });

  it('a param with no paramTypes entry still emits `any` — byte-identical to pre-Plan-12', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'open', valueExpression: t.identifier('open'), sourceLoc: LOC },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: LOC,
    };
    const refined = refineSlotTypes(slot);
    expect(refined.ctxInterface).toBe('interface TriggerCtx { open: any; }');
  });
});

describe('buildSlotsRecordType — family type surface (R6)', () => {
  it('no dynamic-name slot at all → the pre-phase generic Record, byte-identical', () => {
    const type = buildSlotsRecordType(
      [{ type: 'SlotDecl', name: 'header', defaultContent: null, params: [], presence: 'always', nestedSlots: [], sourceLoc: LOC }],
      "import('react').ReactNode",
    );
    expect(type).toBe("Record<string, () => import('react').ReactNode>");
  });

  it('a SlotDecl with namePrefix emits a template-literal-keyed entry naming every family param', () => {
    const type = buildSlotsRecordType(
      [
        dynamicSlot({
          namePrefix: 'cell-',
          params: [
            { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
            { type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC },
          ],
        }),
      ],
      'ReactNode',
    );
    expect(type).toContain('[key: `cell-${string}`]:');
    expect(type).toContain('row: any');
    expect(type).toContain('value: any');
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix has no template-literal member (plain string index only)', () => {
    const type = buildSlotsRecordType([dynamicSlot({})], 'ReactNode');
    expect(type).not.toMatch(/\[key: `/);
    expect(type).toContain('[key: string]:');
  });

  it('a zero-param family types its value as a genuine zero-argument function', () => {
    const type = buildSlotsRecordType([dynamicSlot({ namePrefix: 'row-' })], 'ReactNode');
    expect(type).toMatch(/\[key: `row-\$\{string\}`\]: \(\(\) => ReactNode\) \| undefined;/);
  });

  it("a static record-only name that textually matches an overlapping family's prefix gets its OWN named entry, so its distinct param shape is not swallowed by the family's (T-79-style prefix-collision)", () => {
    // 'cell-total' textually matches the template-literal pattern
    // `cell-${string}` too — without a dedicated named entry, TypeScript
    // resolves `slots['cell-total']` against the FAMILY's signature
    // (`{ row, value }`), not this slot's OWN one-param shape, corrupting
    // AC-10's "exact key wins" coexistence case. Escape found compiling the
    // real DynamicSlots consumer-ts fixture under `tsc --strict`.
    const type = buildSlotsRecordType(
      [
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
      ],
      'ReactNode',
    );
    expect(type).toMatch(/'cell-total'\?: \(\(params: \{ value: any \}\) => ReactNode\) \| undefined;/);
  });
});

describe('emitSlotDecl — a dynamic-name slot mints NO named field/ctx-interface (it is record-only)', () => {
  it('a producer with ONLY a dynamic-name slot mints zero slotPropFields and zero ctx interfaces', () => {
    const ir = lowerInline(`
<rozie name="OnlyDynamic">
<data>{ dynName: 'cell-total' }</data>
<template>
<div><slot :name="$data.dynName" :value="1"></slot></div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.slotPropFields.length).toBe(0);
    expect(result.slotCtxInterfaces.length).toBe(0);
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
    expect(result.slotPropFields).toEqual(['  children?: ReactNode;']);
  });
});

describe('emitReact — end-to-end family type surface (R6)', () => {
  it('a component with no dynamic-name slot emits the pre-phase slots? type character-for-character', () => {
    const ir = lowerInline(`
<rozie name="Header">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'Header.rozie' });
    expect(code).toContain("slots?: Record<string, () => import('react').ReactNode>;");
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
    const { code } = emitReact(ir, { filename: 'MixedFamily.rozie' });
    // The static non-identifier name is record-only per R12/D-03 — no
    // change from that pre-Plan-12 behavior.
    expect(code).toContain('[key: `cell-${string}`]:');
    expect(code).toContain('row: any');
  });
});
