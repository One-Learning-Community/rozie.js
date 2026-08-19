/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 2 (Lit, R6 + D-13).
 *
 * Two pieces:
 *
 * 1. D-13 — `slotScopeParamType.ts` currently serializes ANY declared
 *    `paramTypes` `TSType` verbatim via `@babel/generator` (`generate(tsType)
 *    .code`), a BROADER behavior than the shared `lowerSlotParamType` helper
 *    the other five targets converged on (function-type -> variadic-any,
 *    everything else -> the `any` floor). This is the exact "closing the
 *    folded popover-lit todo" the plan names — the decision is neither
 *    `unknown` NOR a bespoke full-type serialization, but the SAME
 *    function-vs-any policy every target shares. Since `SlotDecl.paramTypes`
 *    is `undefined` for every REAL fixture today (the field is reserved, not
 *    yet populated by any lowerer), this change is byte-identical for every
 *    existing fixture — proven by the pre-existing `slotScopeParamType.test.ts`
 *    staying green. The behavior DIFFERENCE (a non-function declared type
 *    degrading to `any` instead of being serialized precisely) is proven here
 *    with a hand-constructed `paramTypes` array.
 *
 * 2. R6 — `rozieSlots?:` types as the generic `Record<string, (scope: any) =>
 *    unknown>` regardless of any derivable family prefix. `buildRozieSlotsRecordType`
 *    adds one template-literal-keyed member per distinct `namePrefix`.
 */

import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { IRComponent, SlotDecl } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../../emitLit.js';
import { buildRozieSlotsRecordType, slotScopeParamType } from '../slotScopeParamType.js';

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

describe('slotScopeParamType — D-13 unification with the shared lowerSlotParamType policy', () => {
  it('a param bound to a declared function type lowers to a variadic-any function type, not the raw serialized signature', () => {
    const result = slotScopeParamType([tsType('(open: boolean) => void')], 0);
    expect(result).toBe('(...args: any[]) => any');
  });

  it('a param with no paramTypes entry still emits `any` — byte-identical to pre-Plan-12', () => {
    expect(slotScopeParamType(undefined, 0)).toBe('any');
  });

  it('a param bound to a declared NON-function type degrades to the `any` floor (D-13: neither unknown nor bespoke serialization)', () => {
    // Pre-Plan-12 this file's OWN bespoke `generate(tsType).code` would have
    // returned the literal text `string` here. D-13 unifies Lit onto the
    // SAME function-vs-any policy every other target shares.
    expect(slotScopeParamType([tsType('string')], 0)).toBe('any');
  });
});

describe('buildRozieSlotsRecordType — family type surface (R6, Lit)', () => {
  it('no dynamic-name slot at all → the pre-phase generic Record, byte-identical', () => {
    const type = buildRozieSlotsRecordType([
      {
        type: 'SlotDecl',
        name: 'header',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(type).toBe('Record<string, (scope: any) => unknown>');
  });

  it('a SlotDecl with namePrefix emits a template-literal-keyed entry naming every family param', () => {
    const type = buildRozieSlotsRecordType([
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          {
            type: 'ParamDecl',
            name: 'value',
            valueExpression: t.identifier('value'),
            sourceLoc: LOC,
          },
        ],
      }),
    ]);
    expect(type).toContain('[key: `cell-${string}`]:');
    expect(type).toContain('row: any');
    expect(type).toContain('value: any');
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix has no template-literal member (generic Record catch-all only)', () => {
    const type = buildRozieSlotsRecordType([dynamicSlot({})]);
    expect(type).not.toMatch(/\[key: `/);
    expect(type).toContain('Record<string, (scope: any) => unknown>');
  });

  it('a param bound to a declared function type lowers to a variadic-any function type', () => {
    const type = buildRozieSlotsRecordType([
      dynamicSlot({
        namePrefix: 'trigger-',
        params: [
          {
            type: 'ParamDecl',
            name: 'toggle',
            valueExpression: t.identifier('toggle'),
            sourceLoc: LOC,
          },
        ],
        paramTypes: [tsType('(open: boolean) => void')],
      }),
    ]);
    expect(type).toContain('toggle: (...args: any[]) => any');
  });

  it("a static record-only name that textually matches an overlapping family's prefix gets its OWN named entry (Task 3 escape found compiling the real DynamicSlots consumer-ts fixture)", () => {
    const type = buildRozieSlotsRecordType([
      {
        type: 'SlotDecl',
        name: 'cell-total',
        defaultContent: null,
        params: [
          {
            type: 'ParamDecl',
            name: 'value',
            valueExpression: t.identifier('value'),
            sourceLoc: LOC,
          },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          {
            type: 'ParamDecl',
            name: 'value',
            valueExpression: t.identifier('value'),
            sourceLoc: LOC,
          },
        ],
      }),
    ]);
    expect(type).toMatch(/'cell-total'\?: \(scope: \{ value: any \}\) => unknown;/);
  });
});

describe('emitLit — end-to-end family type surface (R6)', () => {
  it('a producer with a namePrefix family emits the template-literal-keyed rozieSlots type', () => {
    const ir = lowerInline(`
<rozie name="CellFamily">
<data>{ dynName: 'cell-status' }</data>
<template>
<div>
  <slot :name="\`cell-\${$data.dynName}\`" :row="$data.dynName" :value="1"></slot>
</div>
</template>
</rozie>
`);
    const { code } = emitLit(ir, {
      filename: 'CellFamily.rozie',
      source: '',
      modifierRegistry: createDefaultRegistry(),
    });
    expect(code).toContain('[key: `cell-${string}`]:');
    expect(code).toContain('row: any');
  });
});
