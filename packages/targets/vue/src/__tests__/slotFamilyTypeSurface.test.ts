/**
 * slotFamilyTypeSurface.test.ts — Phase 79 Plan 12 Task 1 (Vue, R6 + D-13).
 *
 * `buildSlotTypeBlock` (refineSlotTypes.ts) keys every SlotDecl by
 * `s.name === '' ? 'default' : s.name` — WRONG for a dynamic-name slot, which
 * ALSO carries `name === ''` (79-06 Assumption A1) but is not the genuine
 * default slot. Pre-Plan-12 this mints a spurious `default(...)` member for
 * every dynamic-name slot — R6's documented bug, visible today in the four
 * `loop-mustache-*-slot-rfor` fixtures' `expected.vue` snapshots (79-13 owns
 * their re-bless).
 *
 * This file drives `buildSlotTypeBlock` directly with hand-constructed
 * SlotDecl fixtures — the same technique `emitTemplate.test.ts`'s existing
 * "buildSlotTypeBlock — slot type signatures" describe block uses — so each
 * behavior case is isolated from the (still-incomplete, per 79-KNOWN-RED-
 * BASELINE.md) `:name`-inside-`r-for` parser path.
 */
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import { parse as babelParse } from '@babel/parser';
import type { SlotDecl } from '../../../../core/src/ir/types.js';
import { buildSlotTypeBlock } from '../emit/refineSlotTypes.js';

const LOC = { start: 0, end: 0 };

/** Parse a bare TS type string into its `TSType` AST node. */
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

describe('buildSlotTypeBlock — family type surface (Phase 79 Plan 12 Task 1, R6)', () => {
  it('a SlotDecl with namePrefix emits a template-literal-keyed index signature, not a `default(...)` member', () => {
    const block = buildSlotTypeBlock([
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: LOC },
          { type: 'ParamDecl', name: 'value', valueExpression: t.identifier('value'), sourceLoc: LOC },
        ],
      }),
    ]);
    expect(block).not.toContain('default(');
    expect(block).toContain('[key: `cell-${string}`]:');
    expect(block).toContain('row: any');
    expect(block).toContain('value: any');
  });

  it('a SlotDecl with dynamicNameExpr and NO namePrefix degrades to a GENERIC plain string index signature (not its own param shape)', () => {
    const block = buildSlotTypeBlock([
      dynamicSlot({
        params: [{ type: 'ParamDecl', name: 'label', valueExpression: t.identifier('label'), sourceLoc: LOC }],
      }),
    ]);
    expect(block).not.toContain('default(');
    expect(block).not.toMatch(/\[key: `/);
    expect(block).toBe('  [key: string]: ((props: any) => any) | undefined;');
    // Regression guard: the no-prefix slot's OWN param name must NOT leak
    // into the generic catch-all's value type — a `[key: string]` signature
    // applies to every key that matches no narrower signature, so tying it
    // to one specific slot's shape would be actively wrong for any other
    // key (including a coexisting static/family member).
    expect(block).not.toContain('label');
  });

  it('two no-prefix dynamic-name slots with DIFFERENT param shapes still emit exactly ONE generic catch-all, never either slot\'s own shape', () => {
    const block = buildSlotTypeBlock([
      dynamicSlot({ params: [{ type: 'ParamDecl', name: 'label', valueExpression: t.identifier('label'), sourceLoc: LOC }] }),
      dynamicSlot({ params: [{ type: 'ParamDecl', name: 'title', valueExpression: t.identifier('title'), sourceLoc: LOC }] }),
    ]);
    const occurrences = block.split('\n').filter((l) => l.includes('[key: string]')).length;
    expect(occurrences).toBe(1);
    expect(block).not.toContain('label');
    expect(block).not.toContain('title');
  });

  it('a static slot whose name is a proper prefix-extension of a family coexists with the family — BOTH members appear', () => {
    const block = buildSlotTypeBlock([
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
    expect(block).toContain("'cell-total'(props: {  }): any;");
    expect(block).toContain('[key: `cell-${string}`]:');
  });

  it('a param bound to a declared function type (paramTypes) lowers to a variadic-any function type, not bare `any`', () => {
    const block = buildSlotTypeBlock([
      {
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
      },
    ]);
    expect(block).toContain('toggle: (...args: any[]) => any');
  });

  it('a param with no inferable type (no paramTypes entry) still emits `any` — the floor, not a default', () => {
    const block = buildSlotTypeBlock([
      {
        type: 'SlotDecl',
        name: 'trigger',
        defaultContent: null,
        params: [
          { type: 'ParamDecl', name: 'open', valueExpression: t.identifier('open'), sourceLoc: LOC },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: LOC,
      },
    ]);
    expect(block).toContain('open: any');
  });

  it('a component with no dynamic-name slot emits a type surface character-for-character identical to pre-phase', () => {
    const block = buildSlotTypeBlock([
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
    expect(block).toBe('  header(props: {  }): any;');
  });

  it('two dynamic-name families sharing the SAME derivable prefix do not double-emit the index signature', () => {
    const block = buildSlotTypeBlock([
      dynamicSlot({ namePrefix: 'cell-' }),
      dynamicSlot({ namePrefix: 'cell-' }),
    ]);
    const occurrences = block.split('\n').filter((l) => l.includes('[key: `cell-${string}`]')).length;
    expect(occurrences).toBe(1);
  });
});
