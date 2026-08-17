/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 2 (Angular, R6 + D-13).
 *
 * Angular's `buildEligibleSlotDecls`/`buildNgTemplateContextGuard` already
 * correctly EXCLUDE a dynamic-name slot (79-11, `isRecordOnlySlotDecl`) —
 * it mints no `@ContentChild` field and no ctx interface, because Angular's
 * record path (`templates()?.[expr]`) has no compile-time selector to attach
 * one to. That exclusion is correct and untouched by this task.
 *
 * What is missing is R6's family type surface: a dynamic-name slot with a
 * derivable `namePrefix` gets NO synthesized ctx interface at all today, so
 * the static `ngTemplateContextGuard` union has no entry for it — a family's
 * real param shape is nowhere in the generated `.ts` file. This task adds a
 * FAMILY ctx interface (keyed by the family's PascalCased prefix, mirroring
 * Lit's `pascalCaseFragment` convention) and folds it into the guard's union.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse as babelParse } from '@babel/parser';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitAngular } from '../../emitAngular.js';
import { buildFamilyCtxDecls, buildNgTemplateContextGuard } from '../refineSlotTypes.js';
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

describe('buildFamilyCtxDecls — family ctx interface (R6, Angular)', () => {
  it('a SlotDecl with namePrefix emits a PascalCased Ctx interface naming every family param', () => {
    const decls = buildFamilyCtxDecls([
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          { type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC },
        ],
      }),
    ]);
    expect(decls).toHaveLength(1);
    expect(decls[0]).toContain('interface CellCtx {');
    expect(decls[0]).toContain('$implicit: { row: any; value: any }');
    expect(decls[0]).toContain('row: any;');
    expect(decls[0]).toContain('value: any;');
  });

  it('a zero-param family emits an empty Ctx interface', () => {
    const decls = buildFamilyCtxDecls([dynamicSlot({ namePrefix: 'row-' })]);
    expect(decls).toEqual(['interface RowCtx {}']);
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix emits no family ctx interface at all', () => {
    const decls = buildFamilyCtxDecls([dynamicSlot({})]);
    expect(decls).toEqual([]);
  });

  it('a param bound to a declared function type lowers to a variadic-any function type', () => {
    const decls = buildFamilyCtxDecls([
      dynamicSlot({
        namePrefix: 'trigger-',
        params: [{ type: 'ParamDecl', name: 'toggle', valueExpression: t.identifier('toggle'), sourceLoc: LOC }],
        paramTypes: [tsType('(open: boolean) => void')],
      }),
    ]);
    expect(decls[0]).toContain('toggle: (...args: any[]) => any');
  });

  it('two dynamic-name families sharing the SAME derivable prefix do not double-emit the interface', () => {
    const decls = buildFamilyCtxDecls([
      dynamicSlot({ namePrefix: 'cell-' }),
      dynamicSlot({ namePrefix: 'cell-' }),
    ]);
    expect(decls).toHaveLength(1);
  });
});

describe('buildNgTemplateContextGuard — family coverage (R6)', () => {
  it('the guard union includes the family Ctx name alongside a coexisting static slot', () => {
    const guard = buildNgTemplateContextGuard('MixedFamily', [
      { type: 'SlotDecl', name: 'header', defaultContent: null, params: [], presence: 'always', nestedSlots: [], sourceLoc: LOC },
      dynamicSlot({ namePrefix: 'cell-' }),
    ]);
    expect(guard).not.toBeNull();
    expect(guard).toContain('HeaderCtx');
    expect(guard).toContain('CellCtx');
  });

  it('a component with ONLY a no-prefix dynamic-name slot (no family ctx, no eligible static slot) still returns null, byte-identical to pre-phase', () => {
    const guard = buildNgTemplateContextGuard('OnlyDynamic', [dynamicSlot({})]);
    expect(guard).toBeNull();
  });
});

describe('emitAngular — end-to-end family type surface (R6)', () => {
  it('a component with no dynamic-name slot emits no family ctx interface, byte-identical', () => {
    const ir = lowerInline(`
<rozie name="Header">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitAngular(ir, { filename: 'Header.rozie' });
    expect(code).not.toContain('Ctx {}');
  });

  it('a producer with a namePrefix family emits the family Ctx interface and the guard covers it', () => {
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
    const { code } = emitAngular(ir, { filename: 'CellFamily.rozie' });
    expect(code).toContain('interface CellCtx {');
    expect(code).toMatch(/ngTemplateContextGuard[\s\S]*CellCtx/);
  });
});
