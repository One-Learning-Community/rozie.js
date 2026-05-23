/**
 * rewriteTemplateExpression unit tests — Lit target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteTemplateExpression.ts`, previously exercised only end-to-end
 * by emitTemplate / emitTemplateAttribute integration tests.
 *
 * `rewriteTemplateExpression(expr, ir, opts?)` renders a single Babel
 * Expression for embedding inside Lit's html`` interpolation `${...}`:
 *
 *   $props.X         → this.X
 *   $data.X          → this._X.value
 *   $refs.X          → this._refX
 *   $slots.X         → this._hasSlot<Suffix>
 *   $emit('n', x)    → this.dispatchEvent(new CustomEvent('n', {...}))
 *   bare computed    → this.<name>
 *
 * `opts.shadowAliases` names are NOT rewritten (locally-bound, e.g. r-for
 * loop aliases).
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseExpression, parse as babelParse } from '@babel/parser';
import type { File } from '@babel/types';
import type { IRComponent, SlotDecl, ParamDecl } from '../../../../core/src/ir/types.js';
import { rewriteTemplateExpression } from '../rewrite/rewriteTemplateExpression.js';

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

function param(name: string): ParamDecl {
  return { type: 'ParamDecl', name, sourceLoc: { start: 0, end: 0 } };
}

/** Parse a script body into a Babel File for the IR's setupBody. */
function scriptFile(src: string): File {
  return babelParse(src, { sourceType: 'module' });
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

describe('rewriteTemplateExpression — Lit sigil matrix', () => {
  it('$props.X (model) → this.X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('value'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.value');
  });

  it('$props.X (non-model) → this.X', () => {
    const ir = buildIR({ props: [prop('label', false)] });
    const expr = t.memberExpression(t.identifier('$props'), t.identifier('label'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.label');
  });

  it('$data.X → this._X.value', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('count'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._count.value');
  });

  it('$data.X = y → this._X.value = y (AssignmentExpression left)', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('$data'), t.identifier('count')),
      t.numericLiteral(5),
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._count.value = 5');
  });

  it('$props.X = y → this.X = y (AssignmentExpression left)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('$props'), t.identifier('value')),
      t.numericLiteral(5),
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.value = 5');
  });

  it('$refs.X → this._refX', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = t.memberExpression(t.identifier('$refs'), t.identifier('dialogEl'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._refDialogEl');
  });

  it('$slots.X → this._hasSlot<Suffix>', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('header'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._hasSlotHeader');
  });

  it('$slots.default → this._hasSlotDefault', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('default'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._hasSlotDefault');
  });

  it('portal slot $slots.X → this.X !== undefined', () => {
    const ir = buildIR({ slots: [{ ...buildSlotDecl('event'), isPortal: true }] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('event'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.event !== undefined');
  });

  it("$emit('n', x) → this.dispatchEvent(new CustomEvent(...))", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [
      t.stringLiteral('save'),
      t.identifier('payload'),
    ]);
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toContain('this.dispatchEvent(new CustomEvent("save"');
    expect(out).toContain('detail: payload');
  });

  it("$emit('n') with zero args → detail: undefined", () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [t.stringLiteral('save')]);
    expect(rewriteTemplateExpression(expr, ir)).toContain('detail: undefined');
  });

  it('bare computed name → this.<name>', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const expr = t.logicalExpression(
      '&&',
      t.identifier('total'),
      t.booleanLiteral(true),
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.total && true');
  });

  it('$el → this', () => {
    const ir = buildIR();
    expect(rewriteTemplateExpression(t.identifier('$el'), ir)).toBe('this');
  });
});

describe('rewriteTemplateExpression — OptionalMemberExpression variants', () => {
  it('$refs.X?.y re-wires object → this._refX?.y', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs.dialogEl?.focus()');
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._refDialogEl?.focus()');
  });

  it('$props?.X re-wires object → this?.X', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    const expr = parseExpression('$props?.value');
    expect(rewriteTemplateExpression(expr, ir)).toBe('this?.value');
  });

  it('$data?.X → this._X.value', () => {
    const ir = buildIR({ state: [state('config')] });
    const expr = parseExpression('$data?.config');
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._config.value');
  });

  it('$refs?.X re-wires object → this._refX', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    const expr = parseExpression('$refs?.dialogEl');
    // The OptionalMemberExpression visitor re-wires the object; the node
    // stays an optional member so `?.` is preserved on generation.
    expect(rewriteTemplateExpression(expr, ir)).toBe('this._refDialogEl?.dialogEl');
  });
});

describe('rewriteTemplateExpression — scoped slot + AssignmentExpression', () => {
  it('scoped (param-carrying non-portal) slot → (this._hasSlot<X> || this.X !== undefined)', () => {
    const ir = buildIR({ slots: [buildSlotDecl('row', [param('item')])] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('row'));
    const out = rewriteTemplateExpression(expr, ir);
    expect(out).toContain('this._hasSlotRow');
    expect(out).toContain('this.row !== undefined');
  });
});

describe('rewriteTemplateExpression — collectMethodNames (populated setupBody)', () => {
  it('bare reference to a top-level function declaration → this.name', () => {
    const ir = buildIR({
      setupBody: {
        type: 'SetupBody',
        scriptProgram: scriptFile('function doThing() {}'),
        annotations: [],
      },
    });
    const expr = t.callExpression(t.identifier('doThing'), []);
    expect(rewriteTemplateExpression(expr, ir)).toBe('this.doThing()');
  });

  it('bare reference to a top-level arrow const → this.name', () => {
    const ir = buildIR({
      setupBody: {
        type: 'SetupBody',
        scriptProgram: scriptFile('const handler = () => {};'),
        annotations: [],
      },
    });
    expect(rewriteTemplateExpression(t.identifier('handler'), ir)).toBe('this.handler');
  });

  it('a $computed() const is NOT collected as a method name', () => {
    const ir = buildIR({
      setupBody: {
        type: 'SetupBody',
        scriptProgram: scriptFile('const total = $computed(() => 1);'),
        annotations: [],
      },
    });
    // `total` is not in computedNames (IR.computed is empty) nor methodNames
    // (the $computed init is skipped) → left untouched.
    expect(rewriteTemplateExpression(t.identifier('total'), ir)).toBe('total');
  });

  it('a setupBody name colliding with a reserved IR name is NOT collected as a method', () => {
    const ir = buildIR({
      state: [state('count')],
      setupBody: {
        type: 'SetupBody',
        scriptProgram: scriptFile('const count = 1;'),
        annotations: [],
      },
    });
    // `count` is reserved (state) — not a method name. Phase 15 follow-up
    // Bug C2 makes bare `<data>` references rewrite to the signal-read shape
    // `this._<name>.value` (same shape as the `$data.<name>` sigil form),
    // covering function-typed data fields used as bare callback identifiers
    // (`@click="fn"` with `fn: () => {}` in `<data>`). Prior behavior left
    // the bare reference unchanged, which raised ReferenceError at render
    // time when the data field was referenced via a template-literal embed.
    expect(rewriteTemplateExpression(t.identifier('count'), ir)).toBe('this._count.value');
  });
});

describe('rewriteTemplateExpression — shadowAliases opt', () => {
  it('a name in shadowAliases is left bare (NOT rewritten to this.name)', () => {
    const ir = buildIR({ computed: [computed('item')] });
    // Without shadowAliases, `item` (a computed name) would become `this.item`.
    const expr = t.memberExpression(t.identifier('item'), t.identifier('id'));
    expect(
      rewriteTemplateExpression(expr, ir, { shadowAliases: ['item'] }),
    ).toBe('item.id');
  });

  it('a non-shadowed computed name is still rewritten when shadowAliases lists other names', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const expr = t.identifier('total');
    expect(
      rewriteTemplateExpression(expr, ir, { shadowAliases: ['item'] }),
    ).toBe('this.total');
  });
});

describe('rewriteTemplateExpression — computed-name Identifier skips', () => {
  it('computed name as a member property is NOT rewritten', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const expr = t.memberExpression(t.identifier('obj'), t.identifier('total'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('obj.total');
  });

  it('computed name as a non-computed object-property key is NOT rewritten', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const expr = t.objectExpression([
      t.objectProperty(t.identifier('total'), t.numericLiteral(1)),
    ]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('{ total: 1 }');
  });

  it('computed name as a function param keeps the param binding bare', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const expr = t.arrowFunctionExpression(
      [t.identifier('total')],
      t.identifier('total'),
    );
    // The param binding identifier is skipped by the function-param guard;
    // the body reference (a non-binding position) is still rewritten — the
    // template visitor checks parent positions, not lexical scope.
    expect(rewriteTemplateExpression(expr, ir)).toBe('total => this.total');
  });
});

describe('rewriteTemplateExpression — negatives', () => {
  it('an identifier that is neither a computed name nor a method name is left untouched', () => {
    const ir = buildIR();
    expect(rewriteTemplateExpression(t.identifier('somethingElse'), ir)).toBe('somethingElse');
  });

  it('unknown slot name is left untouched', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    const expr = t.memberExpression(t.identifier('$slots'), t.identifier('footer'));
    expect(rewriteTemplateExpression(expr, ir)).toBe('$slots.footer');
  });

  it('$emit() with zero args is left untouched', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), []);
    expect(rewriteTemplateExpression(expr, ir)).toBe('$emit()');
  });

  it('$emit(nonStringLiteral) is left untouched', () => {
    const ir = buildIR();
    const expr = t.callExpression(t.identifier('$emit'), [t.identifier('dynamicName')]);
    expect(rewriteTemplateExpression(expr, ir)).toBe('$emit(dynamicName)');
  });

  it('computed-member access ($data["x"]) is left untouched', () => {
    const ir = buildIR({ state: [state('x')] });
    const expr = t.memberExpression(
      t.identifier('$data'),
      t.stringLiteral('x'),
      /* computed */ true,
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('$data["x"]');
  });

  it('computed OptionalMemberExpression ($refs?.["x"]) is left untouched', () => {
    const ir = buildIR({ refs: [ref('x')] });
    expect(rewriteTemplateExpression(parseExpression('$refs?.["x"]'), ir)).toBe('$refs?.["x"]');
  });

  it('AssignmentExpression with a non-member LHS passes through unchanged', () => {
    const ir = buildIR();
    const expr = t.assignmentExpression('=', t.identifier('x'), t.numericLiteral(5));
    expect(rewriteTemplateExpression(expr, ir)).toBe('x = 5');
  });

  it('AssignmentExpression with a computed-member LHS is not sigil-rewritten on the LHS', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.assignmentExpression(
      '=',
      t.memberExpression(t.identifier('$data'), t.stringLiteral('count'), true),
      t.numericLiteral(5),
    );
    expect(rewriteTemplateExpression(expr, ir)).toBe('$data["count"] = 5');
  });

  it('member expression with a non-identifier object passes through unchanged', () => {
    const ir = buildIR();
    expect(rewriteTemplateExpression(parseExpression('foo().bar'), ir)).toBe('foo().bar');
  });

  it('non-$ member expressions and calls pass through unchanged', () => {
    const ir = buildIR();
    expect(rewriteTemplateExpression(parseExpression('foo.bar'), ir)).toBe('foo.bar');
    expect(rewriteTemplateExpression(parseExpression('doThing(1)'), ir)).toBe('doThing(1)');
  });
});
