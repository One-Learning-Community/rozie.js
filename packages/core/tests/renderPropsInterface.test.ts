// Phase 22 Plan 22-02 Task 1 — renderPropsInterface core-shared renderer.
//
// Hoists the framework-AGNOSTIC `export interface <Name>Props { … }` body
// (model-triplet, required/optional gating, ir.emits→on<Event> callbacks, slot
// params) plus `renderPropType` and `inferParamType` out of React's
// emitTypes.ts so the five Wave-2 per-target renderers cannot drift from the
// React mapping.
//
// The slot-children type token (React's `ReactNode`) is PARAMETERIZED via
// opts.slotChildrenType so non-React targets substitute their own slot idiom.
import { describe, it, expect } from 'vitest';
import * as t from '@babel/types';
import {
  renderPropsInterface,
  renderPropType,
  inferParamType,
} from '../src/codegen/renderPropsInterface.js';
import type { IRComponent, ParamDecl } from '../src/ir/types.js';

/** Minimal IR for synthetic-shape tests. */
function emptyIR(name: string): IRComponent {
  return {
    type: 'IRComponent',
    name,
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    expose: [],
    provides: [],
    injects: [],
    setupBody: {
      type: 'SetupBody',
      scriptProgram: {
        type: 'File',
        program: {
          type: 'Program',
          body: [],
          directives: [],
          sourceType: 'module',
        },
      } as never,
      annotations: [],
    },
    template: null,
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      portalRules: [],
      engineRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    sourceLoc: { start: 0, end: 0 },
  };
}

describe('renderPropsInterface — Task 1 behavior', () => {
  it('Test 1: model:true triplet emits value?/defaultValue?/onValueChange?', () => {
    const ir = emptyIR('Counter');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'value',
        typeAnnotation: { kind: 'identifier', name: 'Number' },
        defaultValue: null,
        isModel: true,
        required: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    expect(out).toContain('export interface CounterProps {');
    expect(out).toContain('  value?: number;');
    expect(out).toContain('  defaultValue?: number;');
    expect(out).toContain('  onValueChange?: (next: number) => void;');
    expect(out.trimEnd().endsWith('}')).toBe(true);
  });

  it('Test 2: ir.emits → on<Event>?: (...args: unknown[]) => void', () => {
    const ir = emptyIR('Widget');
    ir.emits = ['save', 'value-change'];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    expect(out).toContain('  onSave?: (...args: unknown[]) => void;');
    expect(out).toContain('  onValueChange?: (...args: unknown[]) => void;');
  });

  it('Test 3: renderPropType maps the built-in tokens + union + fallback', () => {
    expect(renderPropType({ kind: 'identifier', name: 'Number' })).toBe('number');
    expect(renderPropType({ kind: 'identifier', name: 'String' })).toBe('string');
    expect(renderPropType({ kind: 'identifier', name: 'Boolean' })).toBe('boolean');
    expect(renderPropType({ kind: 'identifier', name: 'Array' })).toBe('unknown[]');
    expect(renderPropType({ kind: 'identifier', name: 'Object' })).toBe(
      'Record<string, unknown>',
    );
    expect(renderPropType({ kind: 'identifier', name: 'Function' })).toBe(
      '(...args: any[]) => any',
    );
    expect(
      renderPropType({
        kind: 'union',
        members: [
          { kind: 'identifier', name: 'String' },
          { kind: 'identifier', name: 'Number' },
        ],
      }),
    ).toBe('string | number');
    // user-defined identifier passes through verbatim.
    expect(renderPropType({ kind: 'identifier', name: 'MyType' })).toBe('MyType');
  });

  it('Test 4: required vs optional gating', () => {
    const ir = emptyIR('Gating');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'must',
        typeAnnotation: { kind: 'identifier', name: 'String' },
        defaultValue: null,
        isModel: false,
        required: true,
        sourceLoc: { start: 0, end: 0 },
      },
      {
        type: 'PropDecl',
        name: 'maybe',
        typeAnnotation: { kind: 'identifier', name: 'Number' },
        defaultValue: t.numericLiteral(1),
        isModel: false,
        required: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    // a defaulted prop emits `?`; a non-defaulted prop emits NO `?`.
    expect(out).toContain('  must: string;');
    expect(out).toContain('  maybe?: number;');
  });

  it('Test 5: slot-children type is parameterized (not hard-coded ReactNode)', () => {
    const ir = emptyIR('Slotted');
    ir.slots = [
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const react = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    const svelte = renderPropsInterface(ir, { slotChildrenType: 'Snippet' });
    expect(react).toContain('  children?: ReactNode;');
    expect(svelte).toContain('  children?: Snippet;');
  });

  it('Test 6: inferParamType resolves $props member-expression to the prop type', () => {
    const ir = emptyIR('Inf');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'open',
        typeAnnotation: { kind: 'identifier', name: 'Boolean' },
        defaultValue: null,
        isModel: false,
        required: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const param: ParamDecl = {
      type: 'ParamDecl',
      name: 'open',
      valueExpression: t.memberExpression(
        t.identifier('$props'),
        t.identifier('open'),
      ),
      sourceLoc: { start: 0, end: 0 },
    };
    expect(inferParamType(param, ir)).toBe('boolean');
  });

  it('Test 7 (CR-01): model prop `value` + emit `value-change` does NOT duplicate onValueChange', () => {
    const ir = emptyIR('Picker');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'value',
        typeAnnotation: { kind: 'identifier', name: 'String' },
        defaultValue: null,
        isModel: true,
        required: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    ir.emits = ['value-change'];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    // The model triplet owns `onValueChange?`; the colliding emit must be skipped.
    const occurrences = out.split('\n').filter((l) => l.includes('onValueChange?'));
    expect(occurrences).toHaveLength(1);
    // The surviving member is the model triplet's typed form, not the emit's loose form.
    expect(out).toContain('  onValueChange?: (next: string) => void;');
    expect(out).not.toContain('  onValueChange?: (...args: unknown[]) => void;');
  });

  it('Test 8 (CR-01): literal `onSelect` prop + emit `select` does NOT duplicate onSelect', () => {
    const ir = emptyIR('Menu');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'onSelect',
        typeAnnotation: { kind: 'identifier', name: 'Function' },
        defaultValue: null,
        isModel: false,
        required: true,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    ir.emits = ['select'];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    const occurrences = out.split('\n').filter((l) => l.includes('onSelect'));
    expect(occurrences).toHaveLength(1);
    // The surviving member is the literal prop, not the emit-derived handler.
    expect(out).toContain('  onSelect: (...args: any[]) => any;');
  });

  it('Task 0 (79-12): a non-identifier slot name mints NO invalid render<Name> field', () => {
    const ir = emptyIR('Table');
    ir.slots = [
      {
        type: 'SlotDecl',
        name: 'cell-status',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    // The bug this test guards against: `render${capitalize('cell-status')}`
    // produces the syntactically-INVALID field name `renderCell-status`.
    expect(out).not.toMatch(/renderCell-status/);
    // Stronger, shape-based assertion: every emitted member name (the token
    // before `?:` or `:`) must itself be a valid identifier — no hyphen, no
    // leading digit, nothing that would require quoting.
    const memberNames = out
      .split('\n')
      .map((l) => /^\s{2}([^\s?:]+)\??:/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => m[1]);
    for (const name of memberNames) {
      expect(name).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    }
  });

  it('Task 0 (79-12): an identifier-named slot still emits renderHeader byte-identically', () => {
    const ir = emptyIR('Header');
    ir.slots = [
      {
        type: 'SlotDecl',
        name: 'header',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    expect(out).toContain('  renderHeader?: () => ReactNode;');
  });

  it('Task 0 (79-12): the default slot still emits children? byte-identically', () => {
    const ir = emptyIR('Def');
    ir.slots = [
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    expect(out).toContain('  children?: ReactNode;');
  });

  it('Task 3 (79-12) escape found via DynamicSlots fixture: two dynamic-name slots must NOT both mint a `children?:` field — that is a duplicate-member (TS2300) bug in a PUBLIC .d.ts', () => {
    const ir = emptyIR('TwoDynamic');
    const dynamicSlot = (over: Record<string, unknown>) => ({
      type: 'SlotDecl' as const,
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always' as const,
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
      dynamicNameExpr: t.identifier('__placeholder'),
      ...over,
    });
    ir.slots = [
      dynamicSlot({
        namePrefix: 'cell-',
        params: [
          { type: 'ParamDecl', name: 'row', valueExpression: t.identifier('row'), sourceLoc: { start: 0, end: 0 } },
        ],
      }),
      dynamicSlot({
        params: [
          { type: 'ParamDecl', name: 'label', valueExpression: t.identifier('label'), sourceLoc: { start: 0, end: 0 } },
        ],
      }),
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    const childrenLines = out.split('\n').filter((l) => l.includes('children?:'));
    expect(childrenLines).toHaveLength(0);
  });

  it('Task 3 (79-12): a dynamic-name slot alongside a genuine default slot mints the field for the REAL default slot only', () => {
    const ir = emptyIR('DynamicPlusDefault');
    ir.slots = [
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
        dynamicNameExpr: t.identifier('__placeholder'),
      },
      {
        type: 'SlotDecl',
        name: '',
        defaultContent: null,
        params: [],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = renderPropsInterface(ir, { slotChildrenType: 'ReactNode' });
    const childrenLines = out.split('\n').filter((l) => l.includes('children?:'));
    expect(childrenLines).toHaveLength(1);
  });
});
