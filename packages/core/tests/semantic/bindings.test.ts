// Phase 2 Plan 02-01 Task 1: smoke import for @babel/traverse + Task 3: BindingsTable behavior tests.
//
// The smoke test confirms that @babel/traverse@^7.29.0 is installed, importable
// via default-export, and callable. Plan 02-01 Task 3 extends this file with
// the full BindingsTable test suite (9 behavior tests). Plan 02 (validators)
// then adds further tests for unknownRefValidator etc. via separate files.
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import traverse from '@babel/traverse';
import { parse } from '../../src/parse.js';
import { collectAllDeclarations, createEmptyBindings } from '../../src/semantic/bindings.js';
import { collectPropDecls } from '../../src/semantic/collectors/collectPropDecls.js';
import { stripCircular } from '../helpers/serialize.js';
import type { PropsAST } from '../../src/ast/blocks/PropsAST.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function bindingsForExample(name: string) {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${name}.rozie`);
  }
  return { src, bindings: collectAllDeclarations(result.ast) };
}

function serializableBindings(b: ReturnType<typeof createEmptyBindings>) {
  return {
    props: Object.fromEntries(b.props),
    data: Object.fromEntries(b.data),
    refs: Object.fromEntries(b.refs),
    slots: Object.fromEntries(b.slots),
    computeds: Object.fromEntries(b.computeds),
    emits: [...b.emits].sort(),
    lifecycle: b.lifecycle,
  };
}

describe('@babel/traverse smoke (Plan 02-01 Task 1)', () => {
  it('default export is a function', () => {
    expect(typeof traverse).toBe('function');
  });
});

describe('BindingsTable collectors (Plan 02-01 Task 3)', () => {
  it('Counter.rozie: 4 props collected', () => {
    const { bindings } = bindingsForExample('Counter');
    expect(bindings.props.size).toBe(4);
    expect([...bindings.props.keys()].sort()).toEqual(['max', 'min', 'step', 'value']);
  });

  it('Counter.rozie: $props.value has isModel === true (D-22 detection)', () => {
    const { bindings } = bindingsForExample('Counter');
    const valueProp = bindings.props.get('value');
    expect(valueProp).toBeDefined();
    expect(valueProp!.isModel).toBe(true);
  });

  it('Counter.rozie: $props.step has isModel === false', () => {
    const { bindings } = bindingsForExample('Counter');
    const stepProp = bindings.props.get('step');
    expect(stepProp).toBeDefined();
    expect(stepProp!.isModel).toBe(false);
  });

  it('Dropdown.rozie: refs collected (SEM-04 pre-foundation): triggerEl + panelEl', () => {
    const { bindings } = bindingsForExample('Dropdown');
    expect(bindings.refs.size).toBe(2);
    expect(bindings.refs.has('triggerEl')).toBe(true);
    expect(bindings.refs.has('panelEl')).toBe(true);
  });

  it('Modal.rozie: 3 lifecycle entries in source order (REACT-04)', () => {
    const { bindings } = bindingsForExample('Modal');
    expect(bindings.lifecycle.length).toBe(3);
    // Source order from Modal.rozie lines 48-53: $onMount(lockScroll), $onUnmount(unlockScroll), $onMount(arrow body for focus).
    expect(bindings.lifecycle[0]!.phase).toBe('mount');
    expect(bindings.lifecycle[1]!.phase).toBe('unmount');
    expect(bindings.lifecycle[2]!.phase).toBe('mount');
  });

  it('SearchInput.rozie: 1 computed (isValid)', () => {
    const { bindings } = bindingsForExample('SearchInput');
    expect(bindings.computeds.size).toBe(1);
    expect(bindings.computeds.has('isValid')).toBe(true);
  });

  it('TodoList.rozie: 3 slots (header, default "", empty)', () => {
    const { bindings } = bindingsForExample('TodoList');
    expect(bindings.slots.size).toBe(3);
    expect(bindings.slots.has('header')).toBe(true);
    expect(bindings.slots.has('')).toBe(true);
    expect(bindings.slots.has('empty')).toBe(true);
  });

  it('Modal.rozie: 3 slots (header, footer, default "")', () => {
    const { bindings } = bindingsForExample('Modal');
    expect(bindings.slots.size).toBe(3);
    expect(bindings.slots.has('header')).toBe(true);
    expect(bindings.slots.has('footer')).toBe(true);
    expect(bindings.slots.has('')).toBe(true);
  });

  it('TodoList.rozie: emits set captures all $emit names (add, toggle, remove)', () => {
    const { bindings } = bindingsForExample('TodoList');
    expect(bindings.emits.has('add')).toBe(true);
    expect(bindings.emits.has('toggle')).toBe(true);
    expect(bindings.emits.has('remove')).toBe(true);
  });

  it('prototype-pollution guard: __proto__ key in synthetic <props> is NOT added to bindings.props (T-2-01-01)', () => {
    // Build a synthetic PropsAST containing a property named __proto__.
    const protoKey = t.identifier('__proto__');
    const safeKey = t.identifier('safe');
    const objExpression = t.objectExpression([
      t.objectProperty(protoKey, t.objectExpression([])),
      t.objectProperty(safeKey, t.objectExpression([])),
    ]);
    const propsAST: PropsAST = {
      type: 'PropsAST',
      loc: { start: 0, end: 0 },
      expression: objExpression,
    };
    const bindings = createEmptyBindings();
    collectPropDecls(propsAST, bindings);
    expect(bindings.props.has('__proto__')).toBe(false);
    expect(bindings.props.has('constructor')).toBe(false);
    expect(bindings.props.has('prototype')).toBe(false);
    // The non-forbidden key DOES land in the table.
    expect(bindings.props.has('safe')).toBe(true);
  });

  it('Counter.rozie: snapshot fixture matches', async () => {
    const { bindings } = bindingsForExample('Counter');
    const serialized = serializableBindings(bindings);
    await expect(JSON.stringify(stripCircular(serialized), null, 2)).toMatchFileSnapshot(
      '../../fixtures/bindings/Counter.snap',
    );
  });

  it('SearchInput.rozie: snapshot fixture matches', async () => {
    const { bindings } = bindingsForExample('SearchInput');
    const serialized = serializableBindings(bindings);
    await expect(JSON.stringify(stripCircular(serialized), null, 2)).toMatchFileSnapshot(
      '../../fixtures/bindings/SearchInput.snap',
    );
  });

  it('Dropdown.rozie: snapshot fixture matches', async () => {
    const { bindings } = bindingsForExample('Dropdown');
    const serialized = serializableBindings(bindings);
    await expect(JSON.stringify(stripCircular(serialized), null, 2)).toMatchFileSnapshot(
      '../../fixtures/bindings/Dropdown.snap',
    );
  });

  it('TodoList.rozie: snapshot fixture matches', async () => {
    const { bindings } = bindingsForExample('TodoList');
    const serialized = serializableBindings(bindings);
    await expect(JSON.stringify(stripCircular(serialized), null, 2)).toMatchFileSnapshot(
      '../../fixtures/bindings/TodoList.snap',
    );
  });

  it('Modal.rozie: snapshot fixture matches', async () => {
    const { bindings } = bindingsForExample('Modal');
    const serialized = serializableBindings(bindings);
    await expect(JSON.stringify(stripCircular(serialized), null, 2)).toMatchFileSnapshot(
      '../../fixtures/bindings/Modal.snap',
    );
  });
});
