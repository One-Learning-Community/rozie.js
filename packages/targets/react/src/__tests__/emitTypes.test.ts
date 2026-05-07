/**
 * Plan 06-02 Task 1 — emitReactTypes behaviour tests.
 *
 * 13 cases covering D-84 model triplet, D-86 best-effort param-type inference,
 * `unknown` fallback, PropTypeAnnotation kind expansion, compile() integration,
 * and the 5 reference-example file snapshots that Plan 06-06's parity gate
 * compares across unplugin/babel/CLI entrypoints.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';

import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { compile } from '../../../../core/src/compile.js';
import type { IRComponent } from '../../../../core/src/ir/types.js';
import { emitReactTypes } from '../emit/emitTypes.js';
import { makeSelectIR } from '../../../../../tests/fixtures/generics/select-ir.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const FIXTURES = resolve(__dirname, 'fixtures/emitTypes');

function load(name: string): { ir: IRComponent; src: string } {
  const src = readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) throw new Error(`parse failed for ${name}`);
  const lowered = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  if (!lowered.ir) throw new Error(`lower failed for ${name}`);
  return { ir: lowered.ir, src };
}

/** Tiny helper to build a minimal IR for synthetic-shape tests (Test 7, 12, 13). */
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
    listeners: [],
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
    styles: { type: 'StyleSection', scopedRules: [], rootRules: [], sourceLoc: { start: 0, end: 0 } },
    sourceLoc: { start: 0, end: 0 },
  };
}

describe('emitReactTypes — D-84 canonical shape (Plan 06-02 Task 1)', () => {
  it('Test 1: Counter — header import + interface name', () => {
    const { ir } = load('Counter');
    const out = emitReactTypes(ir);
    expect(out.startsWith(`import type { ReactNode } from 'react';`)).toBe(true);
    expect(out).toContain(`export interface CounterProps {`);
  });

  it('Test 2: Counter — model:true triplet (value/defaultValue/onValueChange)', () => {
    const { ir } = load('Counter');
    const out = emitReactTypes(ir);
    expect(out).toContain(`value?: number;`);
    expect(out).toContain(`defaultValue?: number;`);
    expect(out).toContain(`onValueChange?: (next: number) => void;`);
  });

  it('Test 3: Counter — non-model with default emits optional', () => {
    const { ir } = load('Counter');
    const out = emitReactTypes(ir);
    // step has default 1 → step?: number;
    expect(out).toContain(`step?: number;`);
  });

  it('Test 4: Dropdown scoped slot — D-86 inference produces boolean for $props.open', () => {
    const { ir } = load('Dropdown');
    const out = emitReactTypes(ir);
    // <slot name="trigger" :open="$props.open" :toggle="toggle">
    // open resolves via $props.open → Boolean (D-86 member-expression branch).
    // toggle is an unresolved identifier → '() => void' fallback.
    expect(out).toMatch(
      /renderTrigger\?: \(params: \{ open: boolean; toggle: \(\) => void \}\) => ReactNode;/,
    );
    // NOT 'unknown' for the open param.
    expect(out).not.toMatch(/open: unknown/);
  });

  it('Test 5: TodoList default scoped slot → children?: ReactNode | (params...) => ReactNode', () => {
    const { ir } = load('TodoList');
    const out = emitReactTypes(ir);
    // <slot :item="item" :toggle=... :remove=...> default scoped slot.
    // Note: function-type-in-union must be parenthesised (TS1385) — wrapped form.
    expect(out).toMatch(/children\?: ReactNode \| \(\(params: \{[^}]+\}\) => ReactNode\);/);
  });

  it('Test 6: Synthetic named slot without params → renderHeader?: () => ReactNode', () => {
    // Modal's slots all have :close params, so we use a synthetic IR for this
    // shape (named slot, zero params).
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
    const out = emitReactTypes(ir);
    expect(out).toContain(`renderHeader?: () => ReactNode;`);
  });

  it('Test 7: D-86 fallback — MemberExpression on $props with name not in ir.props → unknown', () => {
    const ir = emptyIR('UnknownParam');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'visible',
        typeAnnotation: { kind: 'identifier', name: 'Boolean' },
        defaultValue: null,
        isModel: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    ir.slots = [
      {
        type: 'SlotDecl',
        name: 'body',
        defaultContent: null,
        params: [
          {
            type: 'ParamDecl',
            name: 'mystery',
            // $props.notInProps — resolves through $props but the prop name
            // doesn't exist in ir.props → genuine 'unknown' fallback.
            valueExpression: t.memberExpression(
              t.identifier('$props'),
              t.identifier('notInProps'),
            ),
            sourceLoc: { start: 0, end: 0 },
          },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = emitReactTypes(ir);
    expect(out).toContain(`mystery: unknown`);
  });

  it('Test 8: PropTypeAnnotation kinds map per spec', () => {
    const ir = emptyIR('Kinds');
    ir.props = [
      { type: 'PropDecl', name: 'a', typeAnnotation: { kind: 'identifier', name: 'Number' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'b', typeAnnotation: { kind: 'identifier', name: 'String' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'c', typeAnnotation: { kind: 'identifier', name: 'Boolean' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'd', typeAnnotation: { kind: 'identifier', name: 'Array' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'e', typeAnnotation: { kind: 'identifier', name: 'Object' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'f', typeAnnotation: { kind: 'identifier', name: 'Function' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
      { type: 'PropDecl', name: 'g', typeAnnotation: { kind: 'identifier', name: 'MyType' }, defaultValue: null, isModel: false, sourceLoc: { start: 0, end: 0 } },
    ];
    const out = emitReactTypes(ir);
    expect(out).toContain(`a: number;`);
    expect(out).toContain(`b: string;`);
    expect(out).toContain(`c: boolean;`);
    expect(out).toContain(`d: unknown[];`);
    expect(out).toContain(`e: Record<string, unknown>;`);
    expect(out).toContain(`f: (...args: unknown[]) => unknown;`);
    expect(out).toContain(`g: MyType;`);
  });

  it('Test 9: Union type → joined with " | "', () => {
    const ir = emptyIR('Union');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'value',
        typeAnnotation: {
          kind: 'union',
          members: [
            { kind: 'identifier', name: 'String' },
            { kind: 'identifier', name: 'Number' },
          ],
        },
        defaultValue: null,
        isModel: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = emitReactTypes(ir);
    expect(out).toContain(`value: string | number;`);
  });

  it('Test 10: compile() React + types:true → result.types contains interface CounterProps', () => {
    const src = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    const result = compile(src, {
      target: 'react',
      types: true,
      filename: 'Counter.rozie',
    });
    expect(result.types).toContain(`interface CounterProps`);
    // and types:false → empty string
    const result2 = compile(src, {
      target: 'react',
      types: false,
      filename: 'Counter.rozie',
    });
    expect(result2.types).toBe('');
  });

  it('Test 11: compile() vue/svelte/angular → types === "" per D-84', () => {
    const src = readFileSync(resolve(EXAMPLES, 'Counter.rozie'), 'utf8');
    for (const target of ['vue', 'svelte', 'angular'] as const) {
      const result = compile(src, { target, filename: 'Counter.rozie' });
      expect(result.types).toBe('');
    }
  });

  it('Test 12: D-86 member-expression on $props with matching prop → renders the prop type', () => {
    const ir = emptyIR('MemberRefExample');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'open',
        typeAnnotation: { kind: 'identifier', name: 'Boolean' },
        defaultValue: null,
        isModel: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    ir.slots = [
      {
        type: 'SlotDecl',
        name: 'panel',
        defaultContent: null,
        params: [
          {
            type: 'ParamDecl',
            name: 'open',
            valueExpression: t.memberExpression(
              t.identifier('$props'),
              t.identifier('open'),
            ),
            sourceLoc: { start: 0, end: 0 },
          },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = emitReactTypes(ir);
    expect(out).toContain(`renderPanel?: (params: { open: boolean }) => ReactNode;`);
  });

  it('Test 13: D-86 bare identifier matching a prop → renders the prop type', () => {
    const ir = emptyIR('BareIdentExample');
    ir.props = [
      {
        type: 'PropDecl',
        name: 'count',
        typeAnnotation: { kind: 'identifier', name: 'Number' },
        defaultValue: null,
        isModel: false,
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    ir.slots = [
      {
        type: 'SlotDecl',
        name: 'badge',
        defaultContent: null,
        params: [
          {
            type: 'ParamDecl',
            name: 'count',
            valueExpression: t.identifier('count'),
            sourceLoc: { start: 0, end: 0 },
          },
        ],
        presence: 'always',
        nestedSlots: [],
        sourceLoc: { start: 0, end: 0 },
      },
    ];
    const out = emitReactTypes(ir);
    expect(out).toContain(`renderBadge?: (params: { count: number }) => ReactNode;`);
  });
});

describe('emitReactTypes — file snapshots for the 5 reference examples', () => {
  it.each(['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'])(
    '%s.d.ts snapshot is stable',
    async (name) => {
      const { ir } = load(name);
      const out = emitReactTypes(ir);
      await expect(out).toMatchFileSnapshot(
        resolve(FIXTURES, `${name}.d.ts.snap`),
      );
    },
  );
});

describe('emitReactTypes — D-85 React full generic preservation (Plan 06-02 Task 2)', () => {
  it('Test G1: interface + function signature carry the type parameter', () => {
    const ir = makeSelectIR();
    const out = emitReactTypes(ir, { genericParams: ['T'] });
    expect(out).toContain(`export interface SelectProps<T> {`);
    expect(out).toContain(
      `declare function Select<T>(props: SelectProps<T>): JSX.Element;`,
    );
  });

  it('Test G2: model triplet propagates the T identifier', () => {
    const ir = makeSelectIR();
    const out = emitReactTypes(ir, { genericParams: ['T'] });
    expect(out).toContain(`selected?: T;`);
    expect(out).toContain(`defaultSelected?: T;`);
    expect(out).toContain(`onSelectedChange?: (next: T) => void;`);
  });

  it('Test G3: Select.rozie fixture file exists at canonical path', () => {
    const fixturePath = resolve(
      __dirname,
      '../../../../../tests/fixtures/generics/Select.rozie',
    );
    expect(existsSync(fixturePath)).toBe(true);
  });

  it('Test G4: makeSelectIR is importable and produces a valid IR', () => {
    const ir = makeSelectIR();
    expect(ir.name).toBe('Select');
    expect(ir.props).toHaveLength(2);
    expect(ir.props[1]?.typeAnnotation).toEqual({
      kind: 'identifier',
      name: 'T',
    });
    expect(ir.props[1]?.isModel).toBe(true);
  });
});
