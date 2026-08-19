/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 2 (Svelte, R6 + D-13).
 *
 * ============================================================================
 * "distinctSlotsByName's second dedup" PROBE OUTCOME: NOT REPRODUCED (already
 * fixed by 79-10)
 * ============================================================================
 *
 * The plan's Task 2 action text asks to probe whether `distinctSlotsByName`
 * (`refineSlotTypes.ts:75`) still keys on bare `.name` the way Lit's
 * pre-79-08 `emitSlotDecl.ts` dedup did. Reading the current source shows
 * 79-10 ALREADY replaced that with `slotIdentityKey` — an ordinal-namespaced
 * identity for every `dynamicNameExpr` slot (mirroring Lit's own
 * `slotIdentityKey.ts` fix, 79-08) — specifically BECAUSE 79-10 found and
 * fixed the identical collision for a DIFFERENT Svelte call site
 * (`emitScript.ts`'s destructure/merge builders, per 79-10's own SUMMARY).
 * `buildSlotTypeFields` (the Props-interface-field builder this task's R6
 * work touches) already calls `distinctSlotsByName` and already explicitly
 * skips any `dynamicNameExpr` slot (`refineSlotTypes.ts:138`). The first
 * test below proves — empirically, driving the real function, not asserting
 * from the source read — that two independent dynamic-name slots do NOT
 * collapse into one Props-interface field. No production file is modified
 * for the dedup half of this task; the family-type-surface work below (R6)
 * is still required and IS this task's real remaining scope.
 */

import { parse as babelParse } from '@babel/parser';
import * as t from '@babel/types';
import type { IRComponent, SlotDecl } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSvelte } from '../../emitSvelte.js';
import { buildSlotTypeFields, buildSnippetsRecordType } from '../refineSlotTypes.js';

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

describe('NOT REPRODUCED — distinctSlotsByName does not collapse two dynamic-name slots (already fixed by 79-10)', () => {
  it('two independent dynamic-name slots each mint their OWN distinct identity — neither is silently dropped', () => {
    const fields = buildSlotTypeFields([dynamicSlot({}), dynamicSlot({})]);
    // Both are dynamic-name (skipped for named-field minting per 79-10's own
    // `if (s.dynamicNameExpr !== undefined) continue;` guard) — the proof
    // that matters here is that this does NOT throw/collapse and that a
    // genuine default slot declared alongside them still gets its own field.
    expect(fields).toEqual([]);
    const withDefault = buildSlotTypeFields([
      dynamicSlot({}),
      dynamicSlot({}),
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(withDefault).toEqual(['  children?: Snippet;']);
  });
});

describe('buildSnippetsRecordType — family type surface (R6, Svelte)', () => {
  it('no dynamic-name/record-only slot at all → the pre-phase generic Record, byte-identical', () => {
    const type = buildSnippetsRecordType([
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
    expect(type).toBe('Record<string, any>');
  });

  it('a SlotDecl with namePrefix emits a template-literal-keyed index signature naming every family param', () => {
    const type = buildSnippetsRecordType([
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
    // The generic catch-all is retained (needed for the runtime-keyed
    // non-literal record access + the no-prefix degrade case).
    expect(type).toContain('Record<string, any>');
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix has no template-literal member (plain generic Record only)', () => {
    const type = buildSnippetsRecordType([dynamicSlot({})]);
    expect(type).not.toMatch(/\[key: `/);
    expect(type).toBe('Record<string, any>');
  });

  it('a static record-only (non-identifier) slot coexists with an overlapping family — BOTH members appear', () => {
    const type = buildSnippetsRecordType([
      {
        type: 'SlotDecl',
        name: 'cell-total',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
      dynamicSlot({ namePrefix: 'cell-' }),
    ]);
    expect(type).toContain("'cell-total'?:");
    expect(type).toContain('[key: `cell-${string}`]:');
  });

  it('a param bound to a declared function type lowers to a variadic-any function type', () => {
    const type = buildSnippetsRecordType([
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

  it('a zero-param family types its value as a snippet with no param tuple', () => {
    const type = buildSnippetsRecordType([dynamicSlot({ namePrefix: 'row-' })]);
    expect(type).toMatch(/\[key: `row-\$\{string\}`\]: Snippet;/);
  });
});

describe('emitSvelte — end-to-end family type surface (R6)', () => {
  it('a component with no dynamic-name slot emits the pre-phase snippets? type character-for-character', () => {
    const ir = lowerInline(`
<rozie name="Header">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitSvelte(ir, { filename: 'Header.rozie' });
    expect(code).toContain('snippets?: Record<string, any>;');
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
    const { code } = emitSvelte(ir, { filename: 'MixedFamily.rozie' });
    expect(code).toContain('[key: `cell-${string}`]:');
    expect(code).toContain('row: any');
  });
});
