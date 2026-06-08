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

function buildPortalSlotDecl(name: string): SlotDecl {
  return { ...buildSlotDecl(name), isPortal: true, portalParamNames: [] };
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
      engineRules: [],
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

  it('plain $props.X for an unknown prop name is left untouched', () => {
    const ir = buildIR({ props: [prop('known', true)] });
    // Non-computed member, sigil `$props`, but the prop name is in neither
    // modelProps nor nonModelProps — the `||` test's false arm.
    const { code } = rewrite('const c = $props.mystery;', ir);
    expect(code).toContain('$props.mystery');
  });

  it('plain $data.X for an unknown data name is left untouched', () => {
    const ir = buildIR({ state: [state('known')] });
    const { code } = rewrite('const c = $data.unknown;', ir);
    expect(code).toContain('$data.unknown');
  });

  it('plain $refs.X for an unknown ref name is left untouched', () => {
    const ir = buildIR({ refs: [ref('known')] });
    const { code } = rewrite('const c = $refs.unknown;', ir);
    expect(code).toContain('$refs.unknown');
  });

  it('plain $slots.X for an unknown slot name is left untouched', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const { code } = rewrite('const c = $slots.footer;', ir);
    expect(code).toContain('$slots.footer');
  });

  it('a non-sigil object name passes through the MemberExpression visitor', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite('const c = whatever.value;', ir);
    expect(code).toContain('whatever.value');
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

  it('$refs.X invoked directly as a call callee → X! (parent.callee === node)', () => {
    const ir = buildIR({ refs: [ref('cleanup')] });
    // `$refs.cleanup()` — the ref itself is the callee of a CallExpression, so
    // refLowersToNonNull's `t.isCallExpression(parent) && parent.callee === node`
    // arm returns true.
    const { code } = rewrite('$refs.cleanup();', ir);
    expect(code).toContain('cleanup!()');
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

// `$props.value?.y` parses the `?.` BETWEEN `value` and `y`, so the
// OptionalMemberExpression object is the plain MemberExpression `$props.value`
// — the OptionalMember visitor bails at `!t.isIdentifier(obj)`. To exercise the
// OptionalMemberExpression visitor's OWN sigil branches the `?.` must sit
// directly after the sigil object: `$props?.value`.
describe('rewriteRozieIdentifiers — OptionalMemberExpression sigil-object branches', () => {
  it('$props?.X (model) → X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite('const c = $props?.value;', ir);
    expect(code).toContain('const c = value;');
    expect(code).not.toContain('$props');
  });

  it('$props?.X (non-model) → X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const { code } = rewrite('const c = $props?.step;', ir);
    expect(code).toContain('const c = step;');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = buildIR();
    const { code } = rewrite('const c = $props?.mystery;', ir);
    expect(code).toContain('$props?.mystery');
  });

  it('$data?.X → X', () => {
    const ir = buildIR({ state: [state('count')] });
    const { code } = rewrite('const c = $data?.count;', ir);
    expect(code).toContain('const c = count;');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [state('known')] });
    const { code } = rewrite('const c = $data?.unknown;', ir);
    expect(code).toContain('$data?.unknown');
  });

  it('$refs?.X (bare read) → X (no non-null assertion)', () => {
    const ir = buildIR({ refs: [ref('panelEl')] });
    const { code } = rewrite('const el = $refs?.panelEl;', ir);
    expect(code).toContain('const el = panelEl;');
    expect(code).not.toContain('panelEl!');
  });

  it('$refs?.X flowing into a constructor argument → X! (refLowersToNonNull)', () => {
    const ir = buildIR({ refs: [ref('inputEl')] });
    const { code } = rewrite('flatpickr($refs?.inputEl);', ir);
    expect(code).toContain('flatpickr(inputEl!)');
  });

  it('$slots?.X → X', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const { code } = rewrite('const present = $slots?.header;', ir);
    expect(code).toContain('const present = header;');
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [prop('x', true)] });
    const { code } = rewrite('const c = $props?.[k];', ir);
    expect(code).toContain('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite('const c = whatever?.value;', ir);
    expect(code).toContain('whatever?.value');
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    const { code } = rewrite('const c = makeIt()?.value;', ir);
    expect(code).toContain('makeIt()?.value');
  });
});

describe('rewriteRozieIdentifiers — $el parent-position skip ladder', () => {
  it('$el as a VariableDeclarator id is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // `let $el = ...` — `$el` occupies the declarator `id`, not a free read.
    const { code } = rewrite('let $el = computeIt();', ir);
    expect(code).toContain('let $el =');
    expect(code).not.toContain('__rozieRoot');
  });

  it('$el as a non-computed member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('const v = obj.$el;', ir);
    expect(code).toContain('obj.$el');
    expect(code).not.toContain('__rozieRoot');
  });

  it('$el as a non-computed ObjectProperty key is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('const o = { $el: 1 };', ir);
    expect(code).toContain('$el: 1');
    expect(code).not.toContain('__rozieRoot');
  });

  it('$el occupying a function-parameter position is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // The visitor is scope-unaware: it skips the `$el` node that IS the param
    // (the `parentPath.isFunction()` / `params.includes` guard) but still
    // lowers a free `$el` read in the body. The param identifier staying bare
    // is the assertion that exercises the skip arm.
    const { code } = rewrite('function handle($el) { doThing(); }', ir);
    expect(code).toContain('function handle($el)');
    expect(code).not.toContain('__rozieRoot');
  });

  it('arrow-function $el parameter is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const { code } = rewrite('const f = ($el) => doThing();', ir);
    expect(code).toContain('$el =>');
    expect(code).not.toContain('__rozieRoot');
  });

  it('$el as a computed member property IS treated as a free read', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // Computed access — `$el` is a genuine value read here, so it lowers.
    const { code } = rewrite('const v = obj[$el];', ir);
    expect(code).toContain('__rozieRoot');
  });

  it('$el as a computed ObjectProperty key IS treated as a free read', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // Computed key — the `!parentPath.node.computed` ObjectProperty guard does
    // NOT skip; `$el` lowers.
    const { code } = rewrite('const o = { [$el]: 1 };', ir);
    expect(code).toContain('__rozieRoot');
  });

  it('$el as an arrow-function expression body (parented by Function, not a param) lowers', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // `() => $el` — `$el`'s parentPath is the ArrowFunctionExpression but it is
    // NOT in `params`, so the `params.includes` guard's false arm falls through
    // and the free read lowers.
    const { code } = rewrite('const f = () => $el;', ir);
    expect(code).toContain('__rozieRoot');
  });
});

describe('rewriteRozieIdentifiers — $portals portal-slot branch', () => {
  it('$portals.<name>(...) renames the object to `portals`', () => {
    const ir = buildIR({ slots: [buildPortalSlotDecl('item')] });
    const { code } = rewrite('$portals.item(container, scope);', ir);
    expect(code).toContain('portals.item(container, scope)');
    expect(code).not.toContain('$portals');
  });

  it('$portals.<name> with no matching portal slot is left untouched', () => {
    const ir = buildIR({ slots: [buildPortalSlotDecl('item')] });
    const { code } = rewrite('$portals.other(container);', ir);
    expect(code).toContain('$portals.other(container)');
  });

  it('a non-portal slot of the same name does NOT enable the $portals rename', () => {
    // buildSlotDecl produces a slot with isPortal undefined → not in portalSlotNames.
    const ir = buildIR({ slots: [buildSlotDecl('item')] });
    const { code } = rewrite('$portals.item(container);', ir);
    expect(code).toContain('$portals.item(container)');
  });
});

describe('rewriteRozieIdentifiers — MemberExpression TS type-position skip', () => {
  it('$data.X inside a `typeof` member-expression type query is left intact', () => {
    const ir = buildIR({ state: [state('foo')] });
    // The MemberExpression `$data.foo` lives inside a TS type annotation —
    // isInTypePosition must short-circuit the MemberExpression visitor.
    const { code } = rewrite('let x: typeof $data.foo;', ir, ['typescript']);
    expect(code).toContain('typeof $data.foo');
    expect(code).not.toContain('typeof foo');
  });
});

describe('rewriteRozieIdentifiers — $snapshot non-expression argument', () => {
  it('$snapshot(...x) (spread argument) is left untouched', () => {
    const ir = buildIR();
    // A SpreadElement is not a t.Expression — the `!t.isExpression(arg)` guard
    // returns before the $state.snapshot rewrite.
    const { code } = rewrite('const c = $snapshot(...x);', ir);
    expect(code).toContain('$snapshot(...x)');
    expect(code).not.toContain('$state.snapshot');
  });
});

// Regression — debug `svelte-prop-shadow-self-ref` (2026-06-08).
//
// The `$props.X` → bare-identifier rewrite is scope-blind: a local `const`/`let`
// or a function param shadowing a prop name captures the rewritten identifier.
// The `deconflictPropShadows` pre-pass renames the colliding local/param to
// `<name>$local` BEFORE the rewrite so the bare prop identifier resolves to the
// top-level rune prop binding. Covers BOTH facets:
//   (a) `const X = $props.X`        → MUST NOT emit `const X = X` (TDZ self-ref).
//   (b) `$props.X` inside fn(X){}   → MUST NOT capture the param (wrong value).
describe('rewriteRozieIdentifiers — prop-shadow deconfliction (svelte-prop-shadow-self-ref)', () => {
  it('FACET A: `const X = $props.X` does NOT emit a self-referential `const X = X` (model prop)', () => {
    const ir = buildIR({ props: [prop('src', true)] });
    const { code } = rewrite(
      'function buildSource() { const src = $props.src; return src; }',
      ir,
    );
    // No TDZ self-reference.
    expect(code).not.toMatch(/const src = src\b/);
    // Local renamed; initializer reads the real prop (bare `src`).
    expect(code).toContain('const src$local = src;');
    // The return reads the renamed local, not the prop.
    expect(code).toContain('return src$local;');
    expect(code).not.toContain('$props.');
  });

  it('FACET A: `const X = $props.X` for a NON-model prop also deconflicts', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    const { code } = rewrite(
      'function f() { const step = $props.step; return step + 1; }',
      ir,
    );
    expect(code).not.toMatch(/const step = step\b/);
    expect(code).toContain('const step$local = step;');
    expect(code).toContain('return step$local + 1;');
  });

  it('FACET B: `$props.X` inside a function whose PARAM is named X reads the prop, not the param', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite(
      'function compute(value) { return value + $props.value; }',
      ir,
    );
    // The param is renamed; the `$props.value` lowers to bare `value` (the rune
    // prop binding) while the param reference becomes `value$local`.
    expect(code).toContain('function compute(value$local)');
    expect(code).toContain('return value$local + value;');
    expect(code).not.toContain('$props.');
  });

  it('FACET B: destructured object PARAM shadowing a prop is deconflicted', () => {
    const ir = buildIR({ props: [prop('src', false)] });
    const { code } = rewrite(
      'function f({ src }) { return src + $props.src; }',
      ir,
    );
    expect(code).toContain('src: src$local');
    // `$props.src` → bare `src` (prop); the destructured value reference → renamed.
    expect(code).toContain('return src$local + src;');
  });

  it('leaves a local whose name does NOT collide with any prop untouched (byte-identical)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const { code } = rewrite(
      'function f() { const other = $props.value; return other; }',
      ir,
    );
    expect(code).toContain('const other = value;');
    expect(code).not.toContain('$local');
  });

  it('does NOT rename a local that collides with a DATA name (only props are deconflicted)', () => {
    // `count` is a <data> name, not a prop. A same-named local there is a
    // genuine ROZ621-class concern handled elsewhere; deconflictPropShadows
    // must not touch it.
    const ir = buildIR({ state: [state('count')], props: [prop('value', true)] });
    const { code } = rewrite(
      'function f() { const count = 0; return count; }',
      ir,
    );
    expect(code).not.toContain('$local');
    expect(code).toContain('const count = 0;');
  });

  it('renames every reference to the shadowing local within its scope (not just the declaration)', () => {
    const ir = buildIR({ props: [prop('src', false)] });
    const { code } = rewrite(
      'function f() { const src = $props.src; doA(src); doB(src); return src; }',
      ir,
    );
    expect(code).not.toMatch(/const src = src\b/);
    expect(code).toContain('const src$local = src;');
    expect(code).toContain('doA(src$local)');
    expect(code).toContain('doB(src$local)');
    expect(code).toContain('return src$local;');
  });
});
