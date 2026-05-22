/**
 * rewriteScript unit tests — Svelte target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteScript.ts` (`svelteCallbackPropName` + `rewriteRozieIdentifiers`),
 * previously exercised only end-to-end by emitScript integration tests.
 *
 * `rewriteRozieIdentifiers(program, ir, diagnostics)` mutates a CLONED Babel
 * Program in place:
 *
 *   $props.X → X ; $data.X → X ; $refs.X → X (or `X!` via refLowersToNonNull)
 *   $slots.X → X ; $emit('foo', x) → onfoo?.(x) ; $snapshot(x) → $state.snapshot(x)
 *   $el (free read) → __rozieRoot
 *
 * Pushes ROZ621 when a ref name collides with a data/computed/prop name.
 * Skips identifiers/member-exprs in TS type position.
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import _generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import type { Diagnostic } from '../../../../core/src/diagnostics/Diagnostic.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import {
  rewriteRozieIdentifiers,
  svelteCallbackPropName,
} from '../rewrite/rewriteScript.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

function buildSlotDecl(name: string): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'always',
    nestedSlots: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

function buildIR(overrides: Partial<IRComponent> = {}): IRComponent {
  const scriptProgram = t.file(t.program([]));
  return {
    type: 'IRComponent',
    name: 'TestComponent',
    props: [],
    state: [],
    computed: [],
    refs: [],
    emits: [],
    slots: [],
    lifecycle: [],
    watchers: [],
    listeners: [],
    styles: {
      type: 'StyleSection',
      scopedRules: [],
      rootRules: [],
      portalRules: [],
      sourceLoc: { start: 0, end: 0 },
    },
    components: [],
    setupBody: { type: 'SetupBody', scriptProgram, annotations: [] },
    template: null,
    sourceLoc: { start: 0, end: 0 },
    ...overrides,
  };
}

function prop(name: string, isModel: boolean): IRComponent['props'][number] {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    defaultValue: null,
    isModel,
    required: false,
    sourceLoc: { start: 0, end: 0 },
  };
}

function state(name: string): IRComponent['state'][number] {
  return {
    type: 'StateDecl',
    name,
    initializer: t.numericLiteral(0),
    sourceLoc: { start: 0, end: 0 },
  };
}

function ref(name: string): IRComponent['refs'][number] {
  return { type: 'RefDecl', name, elementTag: 'div', sourceLoc: { start: 0, end: 0 } };
}

function computed(name: string): IRComponent['computed'][number] {
  return {
    type: 'ComputedDecl',
    name,
    body: t.numericLiteral(1),
    deps: [],
    sourceLoc: { start: 0, end: 0 },
  };
}

/** Parse a script body, clone, rewrite, generate. Returns code + diagnostics. */
function rewrite(
  src: string,
  ir: IRComponent,
  plugins: ('typescript' | 'jsx')[] = [],
): { code: string; diagnostics: Diagnostic[] } {
  const parsed = babelParse(src, { sourceType: 'module', plugins });
  const cloned = cloneScriptProgram(parsed);
  const diagnostics: Diagnostic[] = [];
  rewriteRozieIdentifiers(cloned, ir, diagnostics);
  return { code: generate(cloned).code, diagnostics };
}

describe('svelteCallbackPropName', () => {
  it('prepends `on` to a plain event name', () => {
    expect(svelteCallbackPropName('close')).toBe('onclose');
  });

  it('strips hyphens and lowercases', () => {
    expect(svelteCallbackPropName('event-click')).toBe('oneventclick');
  });

  it('lowercases a camelCase event name', () => {
    expect(svelteCallbackPropName('valueChange')).toBe('onvaluechange');
  });

  it('handles an already-lowercase single token', () => {
    expect(svelteCallbackPropName('search')).toBe('onsearch');
  });
});

describe('rewriteRozieIdentifiers — sigil rewrites', () => {
  it('$props.X (model) → X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite('const x = $props.value;', ir);
    expect(code).toContain('const x = value;');
    expect(code).not.toContain('$props.');
  });

  it('$props.X (non-model) → X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const { code } = rewrite('const x = $props.step;', ir);
    expect(code).toContain('const x = step;');
  });

  it('$data.X → X', () => {
    const ir = buildIR({ state: [state('count')] });
    const { code } = rewrite('const x = $data.count;', ir);
    expect(code).toContain('const x = count;');
    expect(code).not.toContain('$data.');
  });

  it('$refs.X (bare read) → X', () => {
    const ir = buildIR({ refs: [ref('panelEl')] });
    const { code } = rewrite('if (!$refs.panelEl) doThing();', ir);
    expect(code).toContain('if (!panelEl)');
  });

  it('$slots.X → X', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const { code } = rewrite('const present = $slots.header;', ir);
    expect(code).toContain('const present = header;');
  });

  it('$slots default slot (empty-string SlotDecl) keyed as `default`', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    const { code } = rewrite('const present = $slots.default;', ir);
    expect(code).toContain('const present = default;');
  });

  it("$emit('foo', x) → onfoo?.(x)", () => {
    const ir = buildIR();
    const { code } = rewrite("$emit('foo', payload);", ir);
    expect(code).toContain('onfoo?.(payload)');
    expect(code).not.toContain('$emit');
  });

  it("$emit('event-click', x) → oneventclick?.(x) via svelteCallbackPropName", () => {
    const ir = buildIR();
    const { code } = rewrite("$emit('event-click', payload);", ir);
    expect(code).toContain('oneventclick?.(payload)');
  });

  it("$emit() with zero args is left untouched", () => {
    const ir = buildIR();
    const { code } = rewrite('$emit();', ir);
    expect(code).toContain('$emit();');
  });

  it('$emit(nonStringLiteral) is left untouched', () => {
    const ir = buildIR();
    const { code } = rewrite('$emit(dynamicName);', ir);
    expect(code).toContain('$emit(dynamicName);');
  });

  it('$snapshot(x) → $state.snapshot(x)', () => {
    const ir = buildIR({ state: [state('config')] });
    const { code } = rewrite('const c = $snapshot($data.config);', ir);
    expect(code).toContain('$state.snapshot(config)');
  });

  it('$snapshot with non-single args is left untouched', () => {
    const ir = buildIR();
    const { code } = rewrite('$snapshot(a, b);', ir);
    expect(code).toContain('$snapshot(a, b);');
  });

  it('$data.X?.y OptionalMemberExpression → X?.y', () => {
    const ir = buildIR({ state: [state('config')] });
    const { code } = rewrite('const c = $data.config?.y;', ir);
    expect(code).toContain('config?.y');
  });

  it('$props.X?.y OptionalMemberExpression → X?.y', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite('const c = $props.value?.y;', ir);
    expect(code).toContain('value?.y');
  });

  it('$slots.X?.y OptionalMemberExpression → X?.y', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const { code } = rewrite('const c = $slots.header?.y;', ir);
    expect(code).toContain('header?.y');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const { code } = rewrite("const c = $props['x'];", ir);
    expect(code).toContain("$props['x']");
  });
});

describe('rewriteRozieIdentifiers — refLowersToNonNull', () => {
  it('bare $refs.X read → X (no non-null assertion)', () => {
    const ir = buildIR({ refs: [ref('panelEl')] });
    const { code } = rewrite('const el = $refs.panelEl;', ir);
    expect(code).toContain('const el = panelEl;');
    expect(code).not.toContain('panelEl!');
  });

  it('$refs.X as object of a non-optional member → X! (TS18048 narrowing)', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const { code } = rewrite('$refs.dialogEl.focus();', ir);
    expect(code).toContain('dialogEl!.focus()');
  });

  it('$refs.X as a function-call argument → X!', () => {
    const ir = buildIR({ refs: [ref('inputEl')] });
    const { code } = rewrite('flatpickr($refs.inputEl);', ir);
    expect(code).toContain('flatpickr(inputEl!)');
  });

  it('$refs.X nested inside an object literal passed to a constructor → X!', () => {
    const ir = buildIR({ refs: [ref('editorEl')] });
    const { code } = rewrite('new Editor({ element: $refs.editorEl });', ir);
    expect(code).toContain('editorEl!');
  });

  it('$refs.X nested inside an array literal passed to a call → X!', () => {
    const ir = buildIR({ refs: [ref('hostEl')] });
    const { code } = rewrite('mountAll([$refs.hostEl]);', ir);
    expect(code).toContain('hostEl!');
  });

  it('$refs.X?.method() (author opted into optionality) stays bare X', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const { code } = rewrite('$refs.dialogEl?.focus();', ir);
    expect(code).toContain('dialogEl?.focus()');
    expect(code).not.toContain('dialogEl!');
  });
});

describe('rewriteRozieIdentifiers — $el free read', () => {
  it('$el free read lowers to __rozieRoot (IR carries RefDecl __rozieRoot)', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('const root = $el;', ir);
    expect(code).toContain('const root = __rozieRoot;');
  });

  it('$el flowing into a constructor argument lowers to __rozieRoot!', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('new SortableJS($el, {});', ir);
    expect(code).toContain('__rozieRoot!');
  });

  it('$el as a member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('obj.$el;', ir);
    expect(code).toContain('obj.$el;');
  });
});

describe('rewriteRozieIdentifiers — ROZ621 collision diagnostic', () => {
  it('pushes ROZ621 when a ref name collides with a <data> declaration', () => {
    const ir = buildIR({ state: [state('foo')], refs: [ref('foo')] });
    const { diagnostics } = rewrite('const x = 1;', ir);
    const collision = diagnostics.find((d) => d.code === 'ROZ621');
    expect(collision).toBeDefined();
    expect(collision!.severity).toBe('error');
    expect(collision!.message).toMatch(/foo/);
  });

  it('pushes ROZ621 when a ref name collides with a <computed> declaration', () => {
    const ir = buildIR({ computed: [computed('bar')], refs: [ref('bar')] });
    const { diagnostics } = rewrite('const x = 1;', ir);
    expect(diagnostics.some((d) => d.code === 'ROZ621')).toBe(true);
  });

  it('pushes ROZ621 when a ref name collides with a <props> declaration', () => {
    const ir = buildIR({ props: [prop('baz', false)], refs: [ref('baz')] });
    const { diagnostics } = rewrite('const x = 1;', ir);
    expect(diagnostics.some((d) => d.code === 'ROZ621')).toBe(true);
  });

  it('emits NO diagnostic when ref names do not collide', () => {
    const ir = buildIR({ state: [state('count')], refs: [ref('panelEl')] });
    const { diagnostics } = rewrite('const x = 1;', ir);
    expect(diagnostics).toHaveLength(0);
  });
});

describe('rewriteRozieIdentifiers — TS type-position skip', () => {
  it('$data.X inside a `typeof` type query is left intact', () => {
    const ir = buildIR({ state: [state('foo')] });
    const { code } = rewrite('let x: typeof $data.foo;', ir, ['typescript']);
    expect(code).toContain('typeof $data.foo');
  });

  it('$el inside a type position is not rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // `$el` appearing as a type reference identifier — guarded by isInTypePosition.
    const { code } = rewrite('let x: $el;', ir, ['typescript']);
    expect(code).toContain('$el');
  });
});

describe('rewriteRozieIdentifiers — console preservation', () => {
  it('console.log survives byte-identical through clone + rewrite', () => {
    const ir = buildIR({ props: [prop('value', false)] });
    const { code } = rewrite(
      'console.log("hello from rozie"); const y = $props.value;',
      ir,
    );
    expect(code).toContain('console.log("hello from rozie")');
    expect(code).toContain('const y = value;');
  });
});
