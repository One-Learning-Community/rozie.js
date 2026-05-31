/**
 * rewriteScript unit tests — Solid target.
 *
 * Quick task 260521-tdt — dedicated unit coverage for
 * `rewrite/rewriteScript.ts` (`rewriteRozieIdentifiers`,
 * `rewriteRozieExpressionNode`), previously exercised only end-to-end by
 * emitScript / emitSolid integration tests.
 *
 * `rewriteRozieIdentifiers(cloned, ir)` mutates a CLONED Babel File in place
 * and returns { rewrittenProgram, diagnostics }:
 *
 *   $props.X (model) read    → X()       ; $props.X (non-model/unknown) → local.X
 *   $props.X = v (model)     → setX(v)   ; compound → setX(X() OP v)
 *   $data.X read             → X()       ; $data.X = v → setX(v) ; += → setX(X() + n)
 *   $refs.X → XRef ; $refs.__rozieRoot → __rozieRootRef!
 *   $emit('e', args) → _props.onE?.(args) (toSolidEventPropName camelizes)
 *   $slots.X → (_props.XSlot ?? _props.slots?.['X']) ; default slot → _props.children
 *   $snapshot(x) → x ; bare computed name → name() ; $el → __rozieRootRef!
 */
import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import _generate from '@babel/generator';
import { parse as babelParse } from '@babel/parser';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';
import { cloneScriptProgram } from '../rewrite/cloneProgram.js';
import {
  rewriteRozieExpressionNode,
  rewriteRozieIdentifiers,
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

/** Parse, clone, rewrite, generate. Returns code + diagnostics. */
function rewrite(
  src: string,
  ir: IRComponent,
  ts = false,
): { code: string; diagnostics: ReturnType<typeof rewriteRozieIdentifiers>['diagnostics'] } {
  const parsed = babelParse(src, {
    sourceType: 'module',
    plugins: ts ? ['typescript'] : [],
  });
  const cloned = cloneScriptProgram(parsed);
  const { rewrittenProgram, diagnostics } = rewriteRozieIdentifiers(cloned, ir);
  return { code: generate(rewrittenProgram).code, diagnostics };
}

describe('rewriteRozieIdentifiers — $props', () => {
  it('$props.X (model) read → X()', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('const x = $props.value;', ir).code).toContain('const x = value();');
  });

  it('$props.X (non-model) read → local.X', () => {
    const ir = buildIR({ props: [prop('step', false)] });
    expect(rewrite('const x = $props.step;', ir).code).toContain('const x = local.step;');
  });

  it('unknown $props.X read → local.X (best-effort)', () => {
    const ir = buildIR();
    expect(rewrite('const x = $props.mystery;', ir).code).toContain('const x = local.mystery;');
  });

  it('$props.X = v (model) → setX(v)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('$props.value = 5;', ir).code).toContain('setValue(5);');
  });

  it('$props.X += v (model compound) → setX(X() + v)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('$props.value += 2;', ir).code).toContain('setValue(value() + 2);');
  });

  it('$props.X++ (model) → setX(X() + 1)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('$props.value++;', ir).code).toContain('setValue(value() + 1);');
  });

  it('$props.X-- (model) → setX(X() - 1)', () => {
    const ir = buildIR({ props: [prop('value', true)] });
    expect(rewrite('$props.value--;', ir).code).toContain('setValue(value() - 1);');
  });
});

describe('rewriteRozieIdentifiers — $data', () => {
  it('$data.X read → X()', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('const x = $data.count;', ir).code).toContain('const x = count();');
  });

  it('$data.X = v → setX(v)', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('$data.count = 5;', ir).code).toContain('setCount(5);');
  });

  it('$data.X += n compound → setX(X() + n)', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('$data.count += 3;', ir).code).toContain('setCount(count() + 3);');
  });

  it('$data.X *= n compound → setX(X() * n)', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('$data.count *= 4;', ir).code).toContain('setCount(count() * 4);');
  });

  it('$data.X++ → setX(X() + 1)  (regression: was `count()++` — invalid)', () => {
    const ir = buildIR({ state: [state('count')] });
    const code = rewrite('$data.count++;', ir).code;
    expect(code).toContain('setCount(count() + 1);');
    expect(code).not.toContain('++');
  });

  it('$data.X-- → setX(X() - 1)', () => {
    const ir = buildIR({ state: [state('count')] });
    const code = rewrite('$data.count--;', ir).code;
    expect(code).toContain('setCount(count() - 1);');
    expect(code).not.toContain('--');
  });

  it('prefix `++$data.X` → setX(X() + 1)  (statement context: prefix ≡ postfix)', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('++$data.count;', ir).code).toContain('setCount(count() + 1);');
  });

  it('`++` on a plain non-reactive local passes through verbatim', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('let tmp = 0; tmp++;', ir).code).toContain('tmp++;');
  });

  it('expression-context `$data.X++` (value used) is left unchanged (deferred edge case)', () => {
    const ir = buildIR({ state: [state('count')] });
    // Postfix value matters here; lowering to a setter call would change
    // semantics, so the visitor only fires in statement context.
    const code = rewrite('const y = $data.count++;', ir).code;
    expect(code).toContain('++');
  });

  it('$data.X ??= n (operator not in COMPOUND_OP_MAP) → simple setX(n) fallback', () => {
    const ir = buildIR({ state: [state('count')] });
    // `??=` has no binary-operator mapping; buildSetterCall falls back to the
    // simple `setX(rhs)` form.
    expect(rewrite('$data.count ??= 9;', ir).code).toContain('setCount(9);');
  });

  it('AssignmentExpression with a non-member LHS passes through unchanged', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('let x = 0; x = 5;', ir).code).toContain('x = 5;');
  });

  it('AssignmentExpression with a computed-member LHS is not sigil-rewritten', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('$data["count"] = 5;', ir).code).toContain('$data["count"] = 5;');
  });

  it('AssignmentExpression whose member LHS has a non-identifier object passes through', () => {
    const ir = buildIR({ state: [state('count')] });
    // `foo().bar = 1` — member LHS, but the object is a CallExpression, so the
    // `!t.isIdentifier(obj)` guard bails.
    expect(rewrite('foo().bar = 1;', ir).code).toContain('foo().bar = 1;');
  });

  it('computed-member read ($data["count"]) is left untouched', () => {
    const ir = buildIR({ state: [state('count')] });
    expect(rewrite('const x = $data["count"];', ir).code).toContain('$data["count"]');
  });

  it('member expression with a non-identifier object passes through unchanged', () => {
    const ir = buildIR();
    expect(rewrite('const x = foo().bar;', ir).code).toContain('foo().bar');
  });
});

describe('rewriteRozieIdentifiers — $refs and $el', () => {
  it('$refs.X → XRef', () => {
    const ir = buildIR({ refs: [ref('dialogEl')] });
    expect(rewrite('const el = $refs.dialogEl;', ir).code).toContain('const el = dialogElRef;');
  });

  it('$refs.__rozieRoot → __rozieRootRef!', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('const r = $refs.__rozieRoot;', ir).code).toContain('__rozieRootRef!');
  });

  it('$el free read → __rozieRootRef!', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('const r = $el;', ir).code).toContain('__rozieRootRef!');
  });

  it('$el as a member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('obj.$el;', ir).code).toContain('obj.$el;');
  });

  it('$el as a variable-declarator id is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('let $el = 1;', ir).code).toContain('let $el = 1;');
  });

  it('$el as a non-computed object-property key is NOT rewritten', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    expect(rewrite('const o = { $el: 1 };', ir).code).toContain('$el: 1');
  });

  it('$el as a function param keeps the param binding bare', () => {
    const ir = buildIR({ refs: [ref('__rozieRoot')] });
    // The param binding identifier is skipped by the function-param guard.
    expect(rewrite('const f = ($el) => 1;', ir).code).toContain('$el =>');
  });

  it('$portals.X re-wires object → portals.X', () => {
    const ir = buildIR({ slots: [{ ...buildSlotDecl('event'), isPortal: true }] });
    expect(rewrite('$portals.event(c, s);', ir).code).toContain('portals.event(c, s)');
  });
});

describe('rewriteRozieIdentifiers — $emit', () => {
  it("$emit('e', args) → _props.onE?.(args)", () => {
    const ir = buildIR();
    expect(rewrite("$emit('save', payload);", ir).code).toContain('_props.onSave?.(payload)');
  });

  it('toSolidEventPropName camelizes a hyphenated event name', () => {
    const ir = buildIR();
    expect(rewrite("$emit('event-click', x);", ir).code).toContain('_props.onEventClick?.(x)');
  });

  it('toSolidEventPropName camelizes an underscored event name', () => {
    const ir = buildIR();
    expect(rewrite("$emit('date_change', x);", ir).code).toContain('_props.onDateChange?.(x)');
  });

  it('$emit(nonStringLiteral) is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit(dynamicName);', ir).code).toContain('$emit(dynamicName);');
  });

  it("$emit('') with an empty event name → _props.on?.()", () => {
    const ir = buildIR();
    // toSolidEventPropName splits on [-_] and filters empties — an empty event
    // name yields zero parts, producing the bare `on` prop name.
    expect(rewrite("$emit('');", ir).code).toContain('_props.on?.()');
  });

  it('a call with a non-identifier callee passes through unchanged', () => {
    const ir = buildIR();
    expect(rewrite('obj.method(1);', ir).code).toContain('obj.method(1);');
  });
});

describe('rewriteRozieIdentifiers — $slots', () => {
  it('$slots.header → (_props.headerSlot ?? _props.slots?.["header"])', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    expect(rewrite('const s = $slots.header;', ir).code).toContain(
      '(_props.headerSlot ?? _props.slots?.["header"])',
    );
  });

  it('default slot (empty-name SlotDecl) → _props.children', () => {
    const ir = buildIR({ slots: [buildSlotDecl('')] });
    // `$slots['']` would be a computed access; the default slot's bare-name
    // access in source is `$slots.default`-style — here we exercise the
    // empty-name SlotDecl path directly via a member with prop name ''.
    const parsed = babelParse('const s = $slots.x;', { sourceType: 'module' });
    // Rename the member property to '' to model the default-slot sentinel.
    const cloned = cloneScriptProgram(parsed);
    const decl = cloned.program.body[0];
    if (t.isVariableDeclaration(decl)) {
      const init = decl.declarations[0]!.init;
      if (t.isMemberExpression(init) && t.isIdentifier(init.property)) {
        init.property.name = '';
      }
    }
    const { rewrittenProgram } = rewriteRozieIdentifiers(cloned, ir);
    expect(generate(rewrittenProgram).code).toContain('_props.children');
  });

  it('unknown slot name is left untouched', () => {
    const ir = buildIR({ slots: [buildSlotDecl('header')] });
    expect(rewrite('const s = $slots.footer;', ir).code).toContain('$slots.footer;');
  });
});

describe('rewriteRozieIdentifiers — $snapshot and computed', () => {
  it('$snapshot(x) → x (identity lowering)', () => {
    const ir = buildIR({ state: [state('config')] });
    const code = rewrite('const c = $snapshot($data.config);', ir).code;
    expect(code).toContain('const c = config();');
    expect(code).not.toContain('$snapshot');
  });

  it('$snapshot with non-single args is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$snapshot(a, b);', ir).code).toContain('$snapshot(a, b);');
  });

  it('bare computed name → name() (getter call)', () => {
    const ir = buildIR({ computed: [computed('total')] });
    expect(rewrite('const x = total + 1;', ir).code).toContain('total()');
  });
});

describe('rewriteRozieIdentifiers — Identifier-visitor skips', () => {
  it('computed name already a call callee stays a single call', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const code = rewrite('const x = total();', ir).code;
    // Must NOT become total()() — the call-callee skip prevents double-wrapping.
    expect(code).toContain('const x = total();');
    expect(code).not.toContain('total()()');
  });

  it('computed name as an optional-call callee is not double-wrapped', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const code = rewrite('const x = total?.();', ir).code;
    expect(code).not.toContain('total()?.()');
  });

  it('computed name as a member property is NOT rewritten', () => {
    const ir = buildIR({ computed: [computed('total')] });
    expect(rewrite('obj.total;', ir).code).toContain('obj.total;');
  });

  it('computed name as an object key is NOT rewritten', () => {
    const ir = buildIR({ computed: [computed('total')] });
    expect(rewrite('const o = { total: 1 };', ir).code).toContain('total: 1');
  });

  it('computed name as a variable-declarator id stays bare', () => {
    const ir = buildIR({ computed: [computed('total')] });
    const code = rewrite('const total = 1; const x = total;', ir).code;
    expect(code).toContain('const total = 1;');
    expect(code).toContain('const x = total();');
  });

  it('computed name as a function param stays bare', () => {
    const ir = buildIR({ computed: [computed('total')] });
    // The param binding is skipped; the body reference resolves to the param.
    expect(rewrite('const f = (total) => total;', ir).code).toContain('total => total');
  });

  it('a non-computed bare identifier is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const x = somethingElse;', ir).code).toContain('const x = somethingElse;');
  });
});

describe('rewriteRozieIdentifiers — TS type-position skip', () => {
  it('$data.X inside a typeof type query is left intact', () => {
    const ir = buildIR({ state: [state('foo')] });
    expect(rewrite('let x: typeof $data.foo;', ir, true).code).toContain('typeof $data.foo');
  });
});

describe('rewriteRozieIdentifiers — diagnostics', () => {
  it('returns diagnostics as an array', () => {
    const ir = buildIR({ state: [state('count')] });
    const { diagnostics } = rewrite('const x = $data.count;', ir);
    expect(Array.isArray(diagnostics)).toBe(true);
  });
});

describe('rewriteRozieExpressionNode', () => {
  it('rewrites a t.Expression and returns a rewritten expression', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('count'));
    const out = rewriteRozieExpressionNode(expr, ir);
    expect(t.isExpression(out)).toBe(true);
    expect(generate(out as t.Expression).code).toBe('count()');
  });

  it('rewrites a t.BlockStatement and returns a rewritten block', () => {
    const ir = buildIR({ state: [state('count')] });
    const block = t.blockStatement([
      t.expressionStatement(
        t.assignmentExpression(
          '=',
          t.memberExpression(t.identifier('$data'), t.identifier('count')),
          t.numericLiteral(7),
        ),
      ),
    ]);
    const out = rewriteRozieExpressionNode(block, ir);
    expect(t.isBlockStatement(out)).toBe(true);
    expect(generate(out as t.BlockStatement).code).toContain('setCount(7);');
  });

  it('does not mutate the input expression (clones internally)', () => {
    const ir = buildIR({ state: [state('count')] });
    const expr = t.memberExpression(t.identifier('$data'), t.identifier('count'));
    rewriteRozieExpressionNode(expr, ir);
    // The original node is untouched — still `$data.count`.
    expect(generate(expr).code).toBe('$data.count');
  });
});
