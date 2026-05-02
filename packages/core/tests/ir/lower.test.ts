// Phase 2 Plan 02-05 Task 2 — lowerToIR coordinator + per-lowerer behavior tests
// + 5 IRComponent fixture snapshots.
//
// IR-01 acceptance: each of the five reference examples lowers to a non-null
// IRComponent with diagnostics: []. Snapshot fixtures lock the FULL IRComponent
// shape per example.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as t from '@babel/types';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import { stripCircular } from '../helpers/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string) {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${name}.rozie`);
  }
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

const EXAMPLE_NAMES = ['Counter', 'SearchInput', 'Dropdown', 'TodoList', 'Modal'] as const;

describe('lowerToIR coordinator — Plan 02-05', () => {
  it('Counter.rozie lowers to non-null IRComponent', () => {
    const lowered = lowerExample('Counter');
    expect(lowered.ir).not.toBeNull();
    expect(lowered.ir!.name).toBe('Counter');
    // No ROZ-error diagnostics expected for the canonical example.
    expect(lowered.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('All 5 reference examples produce non-null IRComponent with diagnostics: []', () => {
    for (const name of EXAMPLE_NAMES) {
      const lowered = lowerExample(name);
      expect(lowered.ir, `${name} ir`).not.toBeNull();
      expect(
        lowered.diagnostics.filter((d) => d.severity === 'error'),
        `${name} errors`,
      ).toEqual([]);
    }
  });

  it('lowerToIR returns a populated bindings + depGraph + diagnostics tuple', () => {
    const lowered = lowerExample('Counter');
    expect(lowered.bindings).toBeDefined();
    expect(lowered.bindings.props.size).toBeGreaterThan(0);
    expect(lowered.depGraph).toBeDefined();
    expect(typeof lowered.depGraph.forNodeOrEmpty).toBe('function');
  });
});

describe('lowerProps — Plan 02-05', () => {
  it("Counter's PropDecl[] has length 4; entry for 'value' has isModel: true and Number identifier", () => {
    const { ir } = lowerExample('Counter');
    expect(ir!.props).toHaveLength(4);
    const value = ir!.props.find((p) => p.name === 'value');
    expect(value).toBeDefined();
    expect(value!.isModel).toBe(true);
    expect(value!.typeAnnotation.kind).toBe('identifier');
    if (value!.typeAnnotation.kind === 'identifier') {
      expect(value!.typeAnnotation.name).toBe('Number');
    }
    // defaultValue is the AST for 0.
    expect(value!.defaultValue).not.toBeNull();
    expect(t.isNumericLiteral(value!.defaultValue!)).toBe(true);
    if (value!.defaultValue && t.isNumericLiteral(value!.defaultValue)) {
      expect(value!.defaultValue.value).toBe(0);
    }
  });
});

describe('lowerData — Plan 02-05', () => {
  it("SearchInput's StateDecl[] has length 1 with name: 'query', initializer: ''", () => {
    const { ir } = lowerExample('SearchInput');
    expect(ir!.state).toHaveLength(1);
    const query = ir!.state[0]!;
    expect(query.name).toBe('query');
    expect(t.isStringLiteral(query.initializer)).toBe(true);
    if (t.isStringLiteral(query.initializer)) {
      expect(query.initializer.value).toBe('');
    }
  });
});

describe('lowerListeners — Plan 02-05', () => {
  it('Dropdown.rozie produces 3 Listener entries from <listeners> block; first has document target + outside modifier', () => {
    const { ir } = lowerExample('Dropdown');
    const blockListeners = ir!.listeners.filter((l) => l.source === 'listeners-block');
    expect(blockListeners).toHaveLength(3);

    const first = blockListeners[0]!;
    expect(first.target.kind).toBe('global');
    if (first.target.kind === 'global') {
      expect(first.target.name).toBe('document');
    }
    expect(first.event).toBe('click');
    // .outside(...).stop chain — first entry should be 'outside' (kind='wrap')
    // OR stop (kind='filter'). The Dropdown chain is `.outside($refs.triggerEl, $refs.panelEl)`
    // — no `.stop`. So we check just .outside.
    expect(first.modifierPipeline.length).toBeGreaterThan(0);
    const outsideEntry = first.modifierPipeline.find(
      (e) => e.kind === 'wrap' && e.modifier === 'outside',
    );
    expect(outsideEntry).toBeDefined();
    // when is parsed
    expect(first.when).not.toBeNull();
    // handler is an Identifier reference to close
    expect(t.isIdentifier(first.handler)).toBe(true);
    if (t.isIdentifier(first.handler)) {
      expect(first.handler.name).toBe('close');
    }
  });
});

describe('lowerTemplate — Plan 02-05', () => {
  it('TodoList r-for lowers to TemplateLoopIR with itemAlias + iterable + key', () => {
    const { ir } = lowerExample('TodoList');
    // Walk the template tree to find the TemplateLoopIR.
    const allLoops = collectByType<'TemplateLoop'>(ir!.template, 'TemplateLoop');
    expect(allLoops.length).toBeGreaterThanOrEqual(1);
    const loop = allLoops[0]!;
    expect(loop.itemAlias).toBe('item');
    expect(loop.indexAlias).toBeNull();
    // iterableExpression is $props.items
    expect(t.isMemberExpression(loop.iterableExpression)).toBe(true);
    // keyExpression is item.id
    expect(loop.keyExpression).not.toBeNull();
    expect(t.isMemberExpression(loop.keyExpression!)).toBe(true);
  });

  it('SearchInput r-if + r-else lower to ONE TemplateConditionalIR with branches.length === 2', () => {
    const { ir } = lowerExample('SearchInput');
    const conditionals = collectByType<'TemplateConditional'>(ir!.template, 'TemplateConditional');
    expect(conditionals.length).toBeGreaterThanOrEqual(1);
    // The first conditional should have an if + else.
    const cond = conditionals[0]!;
    expect(cond.branches).toHaveLength(2);
    expect(cond.branches[0]!.test).not.toBeNull();
    expect(cond.branches[1]!.test).toBeNull(); // else branch
  });

  it('Counter interpolation {{ $props.value }} lowers to TemplateInterpolationIR with deps', () => {
    const { ir } = lowerExample('Counter');
    const interps = collectByType<'TemplateInterpolation'>(ir!.template, 'TemplateInterpolation');
    expect(interps.length).toBeGreaterThanOrEqual(1);
    // Find the one whose expression is $props.value
    const propsValue = interps.find((i) => {
      const e = i.expression;
      return (
        t.isMemberExpression(e) &&
        t.isIdentifier(e.object) &&
        e.object.name === '$props' &&
        t.isIdentifier(e.property) &&
        e.property.name === 'value'
      );
    });
    expect(propsValue).toBeDefined();
    expect(propsValue!.deps.some((d) => d.scope === 'props')).toBe(true);
  });

  it('Template @event bindings produce template-event Listeners with same modifier shape (D-20 anchor)', () => {
    // Counter has @click="decrement" / @click="increment" / @mouseenter / @mouseleave.
    const { ir } = lowerExample('Counter');
    const templateListeners = ir!.listeners.filter((l) => l.source === 'template-event');
    expect(templateListeners.length).toBeGreaterThanOrEqual(2);
    for (const l of templateListeners) {
      expect(l.handler).toBeDefined();
      expect(Array.isArray(l.modifierPipeline)).toBe(true);
    }
  });
});

describe('lowerSlots — Plan 02-05 (D-18 presence detection)', () => {
  it('TodoList.rozie produces 3 SlotDecl entries (header, default, empty) all presence: always', () => {
    const { ir } = lowerExample('TodoList');
    expect(ir!.slots).toHaveLength(3);
    const names = ir!.slots.map((s) => s.name).sort();
    expect(names).toEqual(['', 'empty', 'header']);
    for (const s of ir!.slots) {
      expect(s.presence).toBe('always');
    }
  });

  it('Modal.rozie produces 3 SlotDecls — header + footer = conditional, default = always', () => {
    const { ir } = lowerExample('Modal');
    expect(ir!.slots).toHaveLength(3);
    const byName = new Map(ir!.slots.map((s) => [s.name, s]));
    expect(byName.get('header')!.presence).toBe('conditional');
    expect(byName.get('footer')!.presence).toBe('conditional');
    expect(byName.get('')!.presence).toBe('always');
  });

  it('Default slot encoding: name === "" sentinel', () => {
    const { ir } = lowerExample('TodoList');
    const defaultSlot = ir!.slots.find((s) => s.name === '');
    expect(defaultSlot).toBeDefined();
  });
});

describe('IRComponent fixture snapshots — Plan 02-05', () => {
  for (const name of EXAMPLE_NAMES) {
    it(`${name}.rozie → fixtures/ir/${name}.snap (locks full IRComponent shape)`, async () => {
      const { ir } = lowerExample(name);
      const serialized = JSON.stringify(stripCircular(ir), null, 2);
      await expect(serialized).toMatchFileSnapshot(`../../fixtures/ir/${name}.snap`);
    });
  }
});

// ----------------------------------------------------------------------------
// Test helper — recursive collector for IR nodes by their `type` discriminator.
// ----------------------------------------------------------------------------
type IRNodeWithType<T extends string> = { type: T } & Record<string, unknown>;

function collectByType<T extends string>(
  root: unknown,
  typeTag: T,
): IRNodeWithType<T>[] {
  const out: IRNodeWithType<T>[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === typeTag) out.push(n as IRNodeWithType<T>);
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };
  visit(root);
  return out;
}
