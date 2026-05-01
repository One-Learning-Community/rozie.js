// Phase 2 Plan 02-03 — ReactiveDepGraph (REACT-06)
//
// Babel scope-walk identifier tracking matching eslint-plugin-react-hooks/exhaustive-deps
// `gatherDependenciesRecursively` algorithm exactly. Per D-21, OPAQUE at the helper-function
// boundary — helper-function calls are recorded as closure deps but the analyzer does NOT
// recurse into helper bodies.
//
// Refs are stable-identity wrappers (matching ExhaustiveDeps' `isStableKnownHookValue`) and
// MUST NOT appear in dep sets — this is the key property that prevents stale-closure bugs
// in the React target (Phase 4) `useEffect` dep arrays.
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as t from '@babel/types';
import { parseExpression } from '@babel/parser';
import { parse } from '../../src/parse.js';
import {
  collectAllDeclarations,
  createEmptyBindings,
} from '../../src/semantic/bindings.js';
import type { BindingsTable } from '../../src/semantic/bindings.js';
import { computeExpressionDeps } from '../../src/reactivity/computeDeps.js';
import { buildReactiveDepGraph } from '../../src/reactivity/buildDepGraph.js';
import type { SignalRef } from '../../src/reactivity/signalRef.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function bindingsForExample(name: string): { src: string; bindings: BindingsTable; ast: NonNullable<ReturnType<typeof parse>['ast']> } {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${name}.rozie`);
  }
  return { src, bindings: collectAllDeclarations(result.ast), ast: result.ast };
}

/** Build a synthetic BindingsTable seeded with the given prop/data/computed/ref names. */
function syntheticBindings(opts: {
  props?: string[];
  data?: string[];
  refs?: string[];
  slots?: string[];
  computeds?: string[];
}): BindingsTable {
  const b = createEmptyBindings();
  const stubLoc = { start: 0, end: 0 };
  const stubKey = t.identifier('stub');
  const stubProp = t.objectProperty(stubKey, t.objectExpression([]));
  for (const name of opts.props ?? []) {
    b.props.set(name, {
      name,
      decl: stubProp,
      typeIdentifier: null,
      defaultExpression: null,
      isModel: false,
      sourceLoc: stubLoc,
    });
  }
  for (const name of opts.data ?? []) {
    b.data.set(name, {
      name,
      decl: stubProp,
      initializer: t.nullLiteral(),
      sourceLoc: stubLoc,
    });
  }
  for (const name of opts.refs ?? []) {
    b.refs.set(name, { name, elementTag: 'div', sourceLoc: stubLoc });
  }
  for (const name of opts.slots ?? []) {
    b.slots.set(name, { name, presence: 'always', params: [], sourceLoc: stubLoc });
  }
  for (const name of opts.computeds ?? []) {
    b.computeds.set(name, {
      name,
      callback: t.arrowFunctionExpression([], t.nullLiteral()),
      sourceLoc: stubLoc,
    });
  }
  return b;
}

function findRef(
  deps: readonly SignalRef[],
  scope: SignalRef['scope'],
  match: string,
): SignalRef | undefined {
  return deps.find((d) => {
    if (d.scope !== scope) return false;
    if (d.scope === 'closure') return d.identifier === match;
    return d.path[0] === match;
  });
}

describe('computeExpressionDeps (Plan 02-03 Task 1) — single-expression analyzer', () => {
  it('Test 1: Dropdown when-predicate produces deps [props.open, props.closeOnOutsideClick] (Phase 2 success criterion 3 fragment)', () => {
    const bindings = syntheticBindings({ props: ['open', 'closeOnOutsideClick'] });
    const expr = parseExpression('$props.open && $props.closeOnOutsideClick');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(2);
    expect(findRef(deps, 'props', 'open')).toBeDefined();
    expect(findRef(deps, 'props', 'closeOnOutsideClick')).toBeDefined();
  });

  it('Test 2: deep member access $props.items.filter(...).length narrows path to root identifier (Pitfall 1)', () => {
    const bindings = syntheticBindings({ props: ['items'] });
    const expr = parseExpression('$props.items.filter(i => !i.done).length');
    const deps = computeExpressionDeps(expr, bindings);
    // Should produce exactly [{scope:'props',path:['items']}] — narrowed to root.
    expect(deps).toHaveLength(1);
    const ref = deps[0]!;
    expect(ref.scope).toBe('props');
    if (ref.scope === 'props') {
      expect(ref.path).toEqual(['items']);
    }
  });

  it('Test 3: $refs.foo is excluded — refs are stable per ExhaustiveDeps isStableKnownHookValue (D-21)', () => {
    const bindings = syntheticBindings({ refs: ['triggerEl'] });
    const expr = parseExpression('$refs.triggerEl.contains(event.target)');
    const deps = computeExpressionDeps(expr, bindings);
    // refs are stable — never appear as deps.
    expect(deps.find((d) => d.scope === 'refs' as never)).toBeUndefined();
    // event is a function param-like local; not a binding — also excluded.
    // Result is therefore empty (no other reactive reads).
    expect(deps).toHaveLength(0);
  });

  it('Test 4: $slots.foo is recorded as a dep (Pitfall 5)', () => {
    const bindings = syntheticBindings({ slots: ['header'] });
    const expr = parseExpression('$slots.header');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(1);
    const ref = deps[0]!;
    expect(ref.scope).toBe('slots');
    if (ref.scope === 'slots') {
      expect(ref.path).toEqual(['header']);
    }
  });

  it('Test 5: helperFn($data.x) records helperFn as closure dep, NOT a transitive read of $data.x (D-21 opaque)', () => {
    const bindings = syntheticBindings({ data: ['x'] });
    const expr = parseExpression('helperFn($data.x)');
    const deps = computeExpressionDeps(expr, bindings);
    // Must include helperFn as closure dep
    expect(findRef(deps, 'closure', 'helperFn')).toBeDefined();
    // Must include $data.x because it appears LITERALLY in the expression
    // (the call argument). What D-21 forbids is recursion INTO the helperFn
    // *body* — not the visible call args.
    expect(findRef(deps, 'data', 'x')).toBeDefined();
  });

  it('Test 5b: helperFn() with no args — closure dep on helperFn only, no descent into body', () => {
    const bindings = syntheticBindings({});
    const expr = parseExpression('helperFn()');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(1);
    expect(findRef(deps, 'closure', 'helperFn')).toBeDefined();
  });

  it('Test 6: shadowing — function params are NOT recorded as deps', () => {
    const bindings = syntheticBindings({});
    const expr = parseExpression('(item) => item.id');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(0);
  });

  it('Test 7: computed reference (canIncrement is a $computed) records {scope:computed,path:[canIncrement]}', () => {
    const bindings = syntheticBindings({ computeds: ['canIncrement'] });
    const expr = parseExpression('canIncrement && doSomething()');
    const deps = computeExpressionDeps(expr, bindings);
    // canIncrement → computed dep
    expect(findRef(deps, 'computed', 'canIncrement')).toBeDefined();
    // doSomething → closure dep (not in computeds)
    expect(findRef(deps, 'closure', 'doSomething')).toBeDefined();
  });

  it('Test 8: deduplication — $props.x appearing twice produces exactly one dep entry', () => {
    const bindings = syntheticBindings({ props: ['x'] });
    const expr = parseExpression('$props.x + $props.x');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(1);
    expect(findRef(deps, 'props', 'x')).toBeDefined();
  });

  it('Test 9: combined — $props.open && !$data.busy && $refs.triggerEl?.contains(e.target) → [props.open, data.busy] (refs excluded)', () => {
    const bindings = syntheticBindings({ props: ['open'], data: ['busy'], refs: ['triggerEl'] });
    const expr = parseExpression('$props.open && !$data.busy && $refs.triggerEl?.contains(e.target)');
    const deps = computeExpressionDeps(expr, bindings);
    expect(findRef(deps, 'props', 'open')).toBeDefined();
    expect(findRef(deps, 'data', 'busy')).toBeDefined();
    // No refs should appear.
    expect(deps.some((d) => d.scope === ('refs' as never))).toBe(false);
  });

  it('Test 10: D-08 defensive — null/undefined input returns [] without throwing', () => {
    const bindings = syntheticBindings({});
    expect(computeExpressionDeps(null, bindings)).toEqual([]);
    expect(computeExpressionDeps(undefined, bindings)).toEqual([]);
  });

  it('Test 11: shadowing inside arrow body — let x = 1; x is local, not reactive', () => {
    const bindings = syntheticBindings({ props: ['x'] });
    // Inside the arrow body, `x` resolves to the inner `let x`, not $props.x.
    const expr = parseExpression('(() => { let x = 1; return x; })');
    const deps = computeExpressionDeps(expr, bindings);
    expect(findRef(deps, 'props', 'x')).toBeUndefined();
  });

  it('Test 12: $emit and $el are stable identifiers (treated like refs — excluded)', () => {
    const bindings = syntheticBindings({ data: ['x'] });
    const expr = parseExpression('$emit("change", $data.x); $el');
    // SequenceExpression body — should record $data.x but not $emit/$el.
    const deps = computeExpressionDeps(expr, bindings);
    expect(findRef(deps, 'data', 'x')).toBeDefined();
    expect(deps.some((d) => d.scope === 'closure' && d.identifier === '$emit')).toBe(false);
    expect(deps.some((d) => d.scope === 'closure' && d.identifier === '$el')).toBe(false);
  });

  it('Test 13: Object literal property keys are NOT identifier reads (e.g. { value: $props.x } — only x is reactive)', () => {
    const bindings = syntheticBindings({ props: ['x'] });
    const expr = parseExpression('({ value: $props.x })');
    const deps = computeExpressionDeps(expr, bindings);
    expect(deps).toHaveLength(1);
    expect(findRef(deps, 'props', 'x')).toBeDefined();
  });

  it('Test 14: Refs accessed via $refs.foo never appear (multiple refs in one expression)', () => {
    const bindings = syntheticBindings({ refs: ['triggerEl', 'panelEl'] });
    const expr = parseExpression('$refs.triggerEl !== null && $refs.panelEl !== null');
    const deps = computeExpressionDeps(expr, bindings);
    // Refs are stable — neither ref appears.
    expect(deps).toHaveLength(0);
  });
});

describe('buildReactiveDepGraph (Plan 02-03 Task 2) — coordinator + canonical fixtures', () => {
  it('Dropdown.rozie listener[0].when produces deps [props.open, props.closeOnOutsideClick] AND no refs (Phase 2 success criterion 3 verbatim)', () => {
    const { ast, bindings } = bindingsForExample('Dropdown');
    const graph = buildReactiveDepGraph(ast, bindings);
    // The first listener entry in Dropdown.rozie is the document:click.outside one.
    const deps = graph.forNode('listener.0.when');
    expect(deps).toBeDefined();
    expect(deps).toHaveLength(2);
    expect(findRef(deps, 'props', 'open')).toBeDefined();
    expect(findRef(deps, 'props', 'closeOnOutsideClick')).toBeDefined();
    // CRITICAL: refs MUST NOT appear (Phase 2 success criterion 3 verbatim)
    expect(deps.some((d) => d.scope === ('refs' as never))).toBe(false);
    expect(deps.some((d) => d.scope === 'closure' && d.identifier === 'triggerEl')).toBe(false);
    expect(deps.some((d) => d.scope === 'closure' && d.identifier === 'panelEl')).toBe(false);
  });

  it('Counter.rozie computed canIncrement → deps [props.value, props.step, props.max] (length 3)', () => {
    const { ast, bindings } = bindingsForExample('Counter');
    const graph = buildReactiveDepGraph(ast, bindings);
    const deps = graph.forNode('computed.canIncrement');
    expect(deps).toHaveLength(3);
    expect(findRef(deps, 'props', 'value')).toBeDefined();
    expect(findRef(deps, 'props', 'step')).toBeDefined();
    expect(findRef(deps, 'props', 'max')).toBeDefined();
  });

  it('SearchInput.rozie computed isValid → deps [data.query, props.minLength]', () => {
    const { ast, bindings } = bindingsForExample('SearchInput');
    const graph = buildReactiveDepGraph(ast, bindings);
    const deps = graph.forNode('computed.isValid');
    expect(deps).toHaveLength(2);
    expect(findRef(deps, 'data', 'query')).toBeDefined();
    expect(findRef(deps, 'props', 'minLength')).toBeDefined();
  });

  it('Modal.rozie template r-if="$slots.header" produces dep [slots.header] (Pitfall 5)', () => {
    const { ast, bindings } = bindingsForExample('Modal');
    const graph = buildReactiveDepGraph(ast, bindings);
    // Find any template.attr key whose deps include a slots.header dep.
    let found = false;
    for (const id of graph.nodeIds()) {
      if (!id.startsWith('template.attr.')) continue;
      const deps = graph.forNodeOrEmpty(id);
      if (findRef(deps, 'slots', 'header')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('TodoList.rozie template r-for="item in $props.items" produces dep [props.items]', () => {
    const { ast, bindings } = bindingsForExample('TodoList');
    const graph = buildReactiveDepGraph(ast, bindings);
    // r-for LHS is special — buildReactiveDepGraph extracts the RHS
    // (`$props.items`) and treats it as the iterable expression. Check that
    // *some* template attr has props.items as a dep.
    let found = false;
    for (const id of graph.nodeIds()) {
      if (!id.startsWith('template.')) continue;
      const deps = graph.forNodeOrEmpty(id);
      if (findRef(deps, 'props', 'items')) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('All 5 reference examples produce non-throwing ReactiveDepGraphs (D-08)', () => {
    for (const name of ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal']) {
      const { ast, bindings } = bindingsForExample(name);
      expect(() => buildReactiveDepGraph(ast, bindings)).not.toThrow();
    }
  });

  it('NodeId stability — calling buildReactiveDepGraph twice on the same AST produces identical keysets', () => {
    const { ast, bindings } = bindingsForExample('Dropdown');
    const a = buildReactiveDepGraph(ast, bindings);
    const b = buildReactiveDepGraph(ast, bindings);
    expect([...a.nodeIds()].sort()).toEqual([...b.nodeIds()].sort());
  });

  it('Counter.rozie snapshot fixture matches', async () => {
    const { ast, bindings } = bindingsForExample('Counter');
    const graph = buildReactiveDepGraph(ast, bindings);
    await expect(serializeGraph(graph)).toMatchFileSnapshot(
      '../../fixtures/dep-graph/Counter.snap',
    );
  });

  it('SearchInput.rozie snapshot fixture matches', async () => {
    const { ast, bindings } = bindingsForExample('SearchInput');
    const graph = buildReactiveDepGraph(ast, bindings);
    await expect(serializeGraph(graph)).toMatchFileSnapshot(
      '../../fixtures/dep-graph/SearchInput.snap',
    );
  });

  it('Dropdown.rozie snapshot fixture matches AND does NOT contain triggerEl or panelEl (Phase 2 success criterion 3)', async () => {
    const { ast, bindings } = bindingsForExample('Dropdown');
    const graph = buildReactiveDepGraph(ast, bindings);
    const serialized = serializeGraph(graph);
    expect(serialized).not.toContain('triggerEl');
    expect(serialized).not.toContain('panelEl');
    expect(serialized).toContain('closeOnOutsideClick');
    await expect(serialized).toMatchFileSnapshot(
      '../../fixtures/dep-graph/Dropdown.snap',
    );
  });

  it('TodoList.rozie snapshot fixture matches', async () => {
    const { ast, bindings } = bindingsForExample('TodoList');
    const graph = buildReactiveDepGraph(ast, bindings);
    await expect(serializeGraph(graph)).toMatchFileSnapshot(
      '../../fixtures/dep-graph/TodoList.snap',
    );
  });

  it('Modal.rozie snapshot fixture matches', async () => {
    const { ast, bindings } = bindingsForExample('Modal');
    const graph = buildReactiveDepGraph(ast, bindings);
    await expect(serializeGraph(graph)).toMatchFileSnapshot(
      '../../fixtures/dep-graph/Modal.snap',
    );
  });
});

/** Serialize a ReactiveDepGraph to deterministic JSON for snapshotting. */
function serializeGraph(graph: import('../../src/reactivity/ReactiveDepGraph.js').ReactiveDepGraph): string {
  const ids = [...graph.nodeIds()].sort();
  const obj: Record<string, readonly SignalRef[]> = {};
  for (const id of ids) {
    obj[id] = graph.forNodeOrEmpty(id);
  }
  return JSON.stringify(obj, null, 2);
}
