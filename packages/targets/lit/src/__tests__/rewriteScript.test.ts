/**
 * rewriteScript unit tests — Lit target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteScript.ts` (`collectMethodNamesFromProgram`, `rewriteScript`,
 * `renderExpression`, `renderStatements`), previously exercised only end-to-end
 * by emitScript / emitLit integration tests.
 *
 * `rewriteScript(fileIn, ir, opts?)` takes the UNCLONED Babel File and clones
 * internally (cloneScriptProgram), returning { file, program }:
 *
 *   $props.X      → this.X
 *   $data.X       → this._X.value          ; $data.X = y → this._X.value = y
 *   $refs.X       → this._refX
 *   $slots.X      → this._hasSlot<Suffix>  ; portal slot → this.X !== undefined
 *   scoped slot   → (this._hasSlot<Suffix> || this.X !== undefined)
 *   $emit('n', x) → this.dispatchEvent(new CustomEvent('n', {...}))
 *   $snapshot(x)  → x ; $el → this._ref__rozieRoot
 *   bare method/computed name → this.name (with parent-position + shadowing skips)
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import _generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import type { File } from '@babel/types';
import type { IRComponent, SlotDecl, ParamDecl } from '../../../../core/src/ir/types.js';
import {
  collectMethodNamesFromProgram,
  renderExpression,
  renderStatements,
  rewriteScript,
} from '../rewrite/rewriteScript.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

function buildSlotDecl(name: string, params: ParamDecl[] = []): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params,
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

function param(name: string): ParamDecl {
  return { type: 'ParamDecl', name, sourceLoc: { start: 0, end: 0 } };
}

/** Parse a script body into a Babel File (UNCLONED — rewriteScript clones it). */
function parseFile(src: string, ts = false): File {
  return babelParse(src, {
    sourceType: 'module',
    plugins: ts ? ['typescript'] : [],
  });
}

/** Rewrite a script body and generate the resulting code. */
function rewrite(src: string, ir: IRComponent, ts = false): string {
  const file = parseFile(src, ts);
  const { program } = rewriteScript(file, ir);
  return generate(program).code;
}

describe('collectMethodNamesFromProgram', () => {
  it('collects a top-level function declaration', () => {
    const file = parseFile('function doThing() {}');
    const names = collectMethodNamesFromProgram(file, buildIR());
    expect(names.has('doThing')).toBe(true);
  });

  it('collects a top-level arrow const', () => {
    const file = parseFile('const handler = () => {};');
    const names = collectMethodNamesFromProgram(file, buildIR());
    expect(names.has('handler')).toBe(true);
  });

  it('does NOT collect a $computed() const', () => {
    const file = parseFile('const total = $computed(() => 1);');
    const names = collectMethodNamesFromProgram(file, buildIR());
    expect(names.has('total')).toBe(false);
  });

  it('does NOT collect names colliding with state/computed/ref/prop/slot reserved set', () => {
    const ir = buildIR({
      state: [state('count')],
      computed: [computed('total')],
      refs: [ref('panelEl')],
      props: [prop('value', true)],
      slots: [buildSlotDecl('header')],
    });
    const file = parseFile(
      'const count = 1; const total = 2; const panelEl = 3; const value = 4; const header = 5;',
    );
    const names = collectMethodNamesFromProgram(file, ir);
    expect(names.size).toBe(0);
  });
});

describe('rewriteScript — sigil rewrites', () => {
  it('$props.X (model) → this.X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('const x = $props.value;', ir)).toContain('const x = this.value;');
  });

  it('$props.X (non-model) → this.X', () => {
    const ir = buildIR({ props: [prop('label', false)] });
    expect(rewrite('const x = $props.label;', ir)).toContain('const x = this.label;');
  });

  it('unknown $props.X → this.X (best-effort fallback branch)', () => {
    const ir = buildIR();
    expect(rewrite('const x = $props.mystery;', ir)).toContain('const x = this.mystery;');
  });

  it('$data.X read → this._X.value', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('const x = $data.count;', ir)).toContain('const x = this._count.value;');
  });

  it('$data.X = y → this._X.value = y', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('$data.count = 5;', ir)).toContain('this._count.value = 5;');
  });

  it('$props.X = y (model) → this._XControllable.write(y) — NOT the public setter', () => {
    // A producer mutating its own `model: true` prop must route through the
    // controllable's `write()` directly. The public `set X()` property setter
    // routes through `notifyPropertyWrite` (external-parent controlled-mode
    // entry) — sending the producer's own write there would flip a standalone
    // uncontrolled producer into controlled mode and freeze its local state.
    const ir = buildIR({ props: [prop('value', true)] });
    const out = rewrite('$props.value = 5;', ir);
    expect(out).toContain('this._valueControllable.write(5);');
    expect(out).not.toContain('this.value = 5');
  });

  it('$props.X += y (model compound) → write(prev => prev + y) functional updater', () => {
    // Compound model writes desugar to a functional updater so the OLD value
    // is read through the controllable's resolver, not the public getter.
    const ir = buildIR({ props: [prop('count', true)] });
    const out = rewrite('$props.count += 3;', ir);
    expect(out).toContain('this._countControllable.write(prev => prev + 3);');
  });

  it('$props.X = y (non-model) → this.X = y (best-effort runtime-error path)', () => {
    // A non-model prop write stays as a plain member assignment — it never has
    // a controllable backing.
    const ir = buildIR({ props: [prop('value', false)] });
    expect(rewrite('$props.value = 5;', ir)).toContain('this.value = 5;');
  });

  it('AssignmentExpression with a non-member LHS passes through unchanged', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('let x = 0; x = 5;', ir)).toContain('x = 5;');
  });

  it('AssignmentExpression with a computed-member LHS is not sigil-rewritten on the LHS', () => {
    const ir = buildIR({ state: [state('count')] });
    // `$data["count"] = 5` — computed member LHS; the AssignmentExpression
    // visitor bails (`left.computed`). The read-side MemberExpression visitor
    // also skips computed access.
    expect(rewrite('$data["count"] = 5;', ir)).toContain('$data["count"] = 5;');
  });

  it('$refs.X → this._refX', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    expect(rewrite('const el = $refs.dialogEl;', ir)).toContain('const el = this._refDialogEl;');
  });

  it('$refs.X?.y OptionalMemberExpression re-wires object → this._refX?.y', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    expect(rewrite('$refs.dialogEl?.focus();', ir)).toContain('this._refDialogEl?.focus()');
  });

  it('$props?.X OptionalMemberExpression re-wires object → this?.X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    // `$props?.value` makes the OptionalMemberExpression's object the bare
    // `$props` identifier — exercising the OptionalMemberExpression visitor.
    expect(rewrite('const x = $props?.value;', ir)).toContain('this?.value');
  });

  it('$data.X?.y OptionalMemberExpression → this._X.value?.y', () => {
    const ir = buildIR({ state: [state('config')] });
    expect(rewrite('const x = $data.config?.y;', ir)).toContain('this._config.value');
  });

  it('$slots.X → this._hasSlot<Suffix>', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    expect(rewrite('const p = $slots.header;', ir)).toContain('this._hasSlotHeader');
  });

  it('$slots.default → this._hasSlotDefault', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    expect(rewrite('const p = $slots.default;', ir)).toContain('this._hasSlotDefault');
  });

  it('portal slot $slots.X → this.X !== undefined', () => {
    const ir = buildIR({
      slots: [{ ...buildSlotDecl('event'), isPortal: true }],
    });
    expect(rewrite('const p = $slots.event;', ir)).toContain('this.event !== undefined');
  });

  it('scoped (param-carrying non-portal) slot → (this._hasSlot<X> || this.X !== undefined)', () => {
    const ir = buildIR({
      slots: [buildSlotDecl('row', [param('item')])],
    });
    const out = rewrite('const p = $slots.row;', ir);
    expect(out).toContain('this._hasSlotRow');
    expect(out).toContain('this.row !== undefined');
  });

  it("$emit('n', x) → this.dispatchEvent(new CustomEvent(...))", () => {
    const ir = buildIR();
    const out = rewrite("$emit('save', payload);", ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("save"');
    expect(out).toContain('detail: payload');
    expect(out).toContain('bubbles: true');
    expect(out).toContain('composed: true');
  });

  it("$emit('n') with zero args → detail: undefined", () => {
    const ir = buildIR();
    const out = rewrite("$emit('save');", ir);
    expect(out).toContain('detail: undefined');
  });

  it('$emit(nonStringLiteral) is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit(dynamicName);', ir)).toContain('$emit(dynamicName);');
  });

  it('$snapshot(x) → x (identity lowering)', () => {
    const ir = buildIR({ state: [state('config')] });
    const out = rewrite('const c = $snapshot($data.config);', ir);
    expect(out).toContain('const c = this._config.value;');
    expect(out).not.toContain('$snapshot');
  });

  it('$snapshot with non-single args is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$snapshot(a, b);', ir)).toContain('$snapshot(a, b);');
  });

  it('$el free read → this._ref__rozieRoot', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    const out = rewrite('const root = $el;', ir);
    expect(out).toContain('this._ref__rozieRoot');
  });

  it('$el as a member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('obj.$el;', ir)).toContain('obj.$el;');
  });

  it('$el as a non-computed object-property key is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // `{ $el: 1 }` — `$el` is an Identifier in key position; the object-key
    // skip in the `$el` Identifier handler keeps it bare.
    const out = rewrite('const o = { $el: 1 };', ir);
    expect(out).toContain('$el: 1');
  });

  it('$el as a variable-declarator id is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // `let $el = 1` — declarator-id binding position; the skip keeps it bare.
    const out = rewrite('let $el = 1;', ir);
    expect(out).toContain('let $el = 1;');
  });

  it('$el as a function param keeps the param binding bare', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // The param binding identifier is skipped by the function-param guard;
    // the body reference (a non-binding position) is still lowered.
    const out = rewrite('const f = ($el) => $el;', ir);
    expect(out).toContain('$el =>');
    expect(out).toContain('this._ref__rozieRoot');
  });

  it('bare method-name reference → this.name', () => {
    const ir = buildIR();
    const out = rewrite('function doThing() {} doThing();', ir);
    expect(out).toContain('this.doThing()');
  });

  it('bare computed-name reference → this.name', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const out = rewrite('const x = total + 1;', ir);
    expect(out).toContain('this.total');
  });
});

describe('rewriteScript — OptionalMemberExpression sigil branches', () => {
  // `$refs?.X` etc. make the OptionalMemberExpression's object the bare sigil
  // identifier, exercising the OptionalMemberExpression visitor directly.
  it('$refs?.X re-wires object → this._refX?.X', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    expect(rewrite('const x = $refs?.dialogEl;', ir)).toContain('this._refDialogEl');
  });

  it('$props?.X re-wires object → this?.X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('const x = $props?.value;', ir)).toContain('this?.value');
  });

  it('$data?.X → this._X.value', () => {
    const ir = buildIR({ state: [state('config')] });
    expect(rewrite('const x = $data?.config;', ir)).toContain('this._config.value');
  });

  it('$portals.X re-wires object → portals.X', () => {
    const ir = buildIR({ slots: [{ ...buildSlotDecl('event'), isPortal: true }] });
    expect(rewrite('$portals.event(container, scope);', ir)).toContain(
      'portals.event(container, scope)',
    );
  });
});

describe('rewriteScript — methodNamesOverride opt', () => {
  it('honors an explicit methodNamesOverride Set', () => {
    const ir = buildIR();
    // The fragment does NOT declare `lockScroll`, so without the override it
    // would not be rewritten. The override forces the rewrite.
    const file = parseFile('lockScroll();');
    const { program } = rewriteScript(file, ir, {
      methodNamesOverride: new Set(['lockScroll']),
    });
    expect(generate(program).code).toContain('this.lockScroll()');
  });
});

describe('rewriteScript — Identifier-visitor skips', () => {
  it('method name as a variable-declarator id stays bare', () => {
    const ir = buildIR();
    // `doThing` is collected as a method name; the declarator id must NOT be
    // rewritten to `this.doThing`.
    const out = rewrite('function doThing() {} const x = doThing;', ir);
    expect(out).toContain('function doThing()');
    expect(out).toContain('const x = this.doThing;');
  });

  it('method name as a member property is NOT rewritten', () => {
    const ir = buildIR();
    const out = rewrite('function doThing() {} obj.doThing;', ir);
    expect(out).toContain('obj.doThing;');
  });

  it('method name as an ObjectPattern shorthand key (binding) stays bare', () => {
    const ir = buildIR();
    // `const { doThing } = obj` in a nested scope — binding position; the
    // destructure must NOT un-shorthand to `{ doThing: this.doThing }`.
    const out = rewrite(
      'function doThing() {} const f = () => { const { doThing } = obj; return doThing; };',
      ir,
    );
    expect(out).not.toContain('doThing: this.doThing');
  });

  it('method name as an ObjectExpression shorthand value is un-shorthanded to this.name', () => {
    const ir = buildIR();
    // `return { doThing }` — value position; un-shorthand + rewrite value.
    const out = rewrite('function doThing() {} const o = { doThing };', ir);
    expect(out).toContain('doThing: this.doThing');
  });

  it('method name as a non-shorthand object-property key stays bare', () => {
    const ir = buildIR();
    // `{ doThing: 1 }` — the key `doThing` is a non-shorthand key; the
    // `!parentPath.node.shorthand` guard keeps it bare.
    const out = rewrite('function doThing() {} const o = { doThing: 1 };', ir);
    expect(out).toContain('doThing: 1');
  });

  it('method name as a computed object-property key stays bare', () => {
    const ir = buildIR();
    // `{ [doThing]: 1 }` — computed key; the `parentPath.node.computed` guard
    // keeps the key reference itself out of the un-shorthand path, while the
    // computed-key value position is still a reference.
    const out = rewrite('function doThing() {} const o = { [String(doThing)]: 1 };', ir);
    expect(out).toContain('this.doThing');
  });

  it('method name as a bare function param stays bare', () => {
    const ir = buildIR();
    const out = rewrite('function doThing() {} const f = (doThing) => doThing;', ir);
    // The param + its in-body reference resolve to the LOCAL param — not rewritten.
    expect(out).toContain('doThing => doThing');
  });

  it('a local binding shadowing a method name is NOT rewritten (hasShadowingBinding)', () => {
    const ir = buildIR();
    // Inside the inner block `doThing` is a local `let` — the reference points
    // at the local, not the promoted class method.
    const out = rewrite(
      'function doThing() {} const f = () => { let doThing = 1; return doThing; };',
      ir,
    );
    expect(out).toContain('let doThing = 1');
    expect(out).toContain('return doThing;');
    expect(out).not.toContain('return this.doThing');
  });

  it('a non-computed-non-method bare identifier is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const x = somethingElse;', ir)).toContain('const x = somethingElse;');
  });
});

describe('rewriteScript — computed-access negatives', () => {
  it('computed-member read ($data["count"]) is left untouched', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('const x = $data["count"];', ir)).toContain('$data["count"]');
  });

  it('computed OptionalMemberExpression ($refs?.["x"]) is left untouched', () => {
    const ir = buildIR({ refs: [ref('x')] });
    expect(rewrite('const v = $refs?.["x"];', ir)).toContain('$refs?.["x"]');
  });

  it('member expression with a non-identifier object passes through unchanged', () => {
    const ir = buildIR();
    expect(rewrite('const x = foo().bar;', ir)).toContain('foo().bar');
  });
});

describe('rewriteScript — TS type-position skip', () => {
  it('$data.X inside a typeof type query is left intact', () => {
    const ir = buildIR({ state: [state('foo')] });
    const out = rewrite('let x: typeof $data.foo;', ir, true);
    expect(out).toContain('typeof $data.foo');
  });
});

describe('renderExpression / renderStatements', () => {
  it('renderExpression collapses a member expression to a single-line string', () => {
    const expr = t.memberExpression(t.thisExpression(), t.identifier('value'));
    expect(renderExpression(expr)).toBe('this.value');
  });

  it('renderStatements returns an empty string for an empty array', () => {
    expect(renderStatements([])).toBe('');
  });

  it('renderStatements newline-joins a 2-statement array', () => {
    const s1 = t.expressionStatement(t.callExpression(t.identifier('a'), []));
    const s2 = t.expressionStatement(t.callExpression(t.identifier('b'), []));
    const out = renderStatements([s1, s2]);
    expect(out).toContain('a();');
    expect(out).toContain('b();');
    expect(out.split('\n').length).toBeGreaterThanOrEqual(2);
  });
});
