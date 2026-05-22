/**
 * rewriteListenerExpression unit tests — Angular target.
 *
 * Quick task 260521-qsh — broad branch-coverage deepening for
 * `rewrite/rewriteListenerExpression.ts`. The existing
 * rewriteListenerExpression-slots-merge.test.ts only exercises the
 * §slots-X-merge contract (~35% line coverage). The describe blocks below
 * drive every remaining handler: MemberExpression / OptionalMemberExpression
 * $props (model + non-model) / $data / $refs, the $slots merge (static +
 * default-slot), the $emit CallExpression rewrite (incl. kebab/snake
 * sanitization), and the bare-identifier `this.`-prefix / signal-invocation
 * visitor with its parent-position skip ladder and the
 * collisionRenames / classMembers / signalMembers opts.
 *
 * Listener bodies run in class-body context, so IR member references carry
 * the `this.` prefix (mirrors rewriteScript output, NOT bare template shapes).
 */
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import type * as t from '@babel/types';
import { rewriteListenerExpression } from '../rewrite/rewriteListenerExpression.js';
import type {
  IRComponent,
  PropDecl,
  StateDecl,
  RefDecl,
  ComputedDecl,
  SlotDecl,
} from '../../../../core/src/ir/types.js';

const sloc = { start: 0, end: 0 };

function mkProp(name: string, isModel: boolean): PropDecl {
  return {
    type: 'PropDecl',
    name,
    typeAnnotation: { kind: 'identifier', name: 'String' },
    defaultValue: null,
    isModel,
    required: false,
    sourceLoc: sloc,
  } as PropDecl;
}
function mkState(name: string): StateDecl {
  return { type: 'StateDecl', name, initializer: { type: 'NumericLiteral', value: 0 } as t.NumericLiteral, sourceLoc: sloc } as StateDecl;
}
function mkRef(name: string): RefDecl {
  return { type: 'RefDecl', name, elementTag: 'div', sourceLoc: sloc } as RefDecl;
}
function mkComputed(name: string): ComputedDecl {
  return { type: 'ComputedDecl', name, body: { type: 'NumericLiteral', value: 1 } as t.NumericLiteral, deps: [], sourceLoc: sloc } as ComputedDecl;
}
function mkSlot(name: string): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'conditional',
    nestedSlots: [],
    sourceLoc: sloc,
  } as SlotDecl;
}

function buildIR(overrides: Partial<IRComponent> = {}): IRComponent {
  return {
    type: 'IRComponent',
    name: 'TestComp',
    props: [],
    state: [],
    computed: [],
    refs: [],
    slots: [],
    emits: [],
    lifecycle: [],
    listeners: [],
    ...overrides,
  } as unknown as IRComponent;
}

function rw(
  srcExpr: string,
  ir: IRComponent,
  opts?: Parameters<typeof rewriteListenerExpression>[2],
): string {
  return rewriteListenerExpression(parseExpression(srcExpr), ir, opts);
}

describe('rewriteListenerExpression — MemberExpression sigil rewrites', () => {
  it('$props.X (model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rw('$props.value', ir)).toBe('this.value()');
  });

  it('$props.X (non-model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rw('$props.step', ir)).toBe('this.step()');
  });

  it('$props.X (unknown prop name) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('known', true)] });
    expect(rw('$props.mystery', ir)).toBe('$props.mystery');
  });

  it('$data.X → this.X()', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('$data.count', ir)).toBe('this.count()');
  });

  it('$data.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rw('$data.unknown', ir)).toBe('$data.unknown');
  });

  it('$refs.X → this.X()?.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('inputEl')] });
    expect(rw('$refs.inputEl', ir)).toBe('this.inputEl()?.nativeElement');
  });

  it('$refs.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [mkRef('known')] });
    expect(rw('$refs.unknown', ir)).toBe('$refs.unknown');
  });

  it('$slots.X (static name) → merged form with this. prefix', () => {
    const ir = buildIR({ slots: [mkSlot('footer')] });
    expect(rw('$slots.footer', ir)).toBe(
      "(this.footerTpl ?? this.templates()?.['footer'])",
    );
  });

  it('$slots default slot (empty name) → defaultTpl / defaultSlot merge', () => {
    const ir = buildIR({ slots: [mkSlot('')] });
    // Built directly: parseExpression cannot produce `$slots.<empty>`.
    const expr = {
      type: 'MemberExpression',
      object: { type: 'Identifier', name: '$slots' },
      property: { type: 'Identifier', name: '' },
      computed: false,
    } as unknown as t.Expression;
    expect(rewriteListenerExpression(expr, ir)).toBe(
      "(this.defaultTpl ?? this.templates()?.['defaultSlot'])",
    );
  });

  it('$slots.X (unknown slot name) is left untouched', () => {
    const ir = buildIR({ slots: [mkSlot('footer')] });
    expect(rw('$slots.header', ir)).toBe('$slots.header');
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rw("$props['x']", ir)).toBe("$props['x']");
  });

  it('member expression whose object is not an identifier passes through', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('makeIt().count', ir)).toBe('makeIt().count');
  });
});

describe('rewriteListenerExpression — OptionalMemberExpression sigil rewrites', () => {
  it('$props?.X (model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rw('$props?.value', ir)).toBe('this.value()');
  });

  it('$props?.X (non-model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rw('$props?.step', ir)).toBe('this.step()');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('known', true)] });
    expect(rw('$props?.mystery', ir)).toBe('$props?.mystery');
  });

  it('$data?.X → this.X()', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('$data?.count', ir)).toBe('this.count()');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rw('$data?.unknown', ir)).toBe('$data?.unknown');
  });

  it('$refs?.X → this.X()?.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('inputEl')] });
    expect(rw('$refs?.inputEl', ir)).toBe('this.inputEl()?.nativeElement');
  });

  it('$refs?.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [mkRef('known')] });
    expect(rw('$refs?.unknown', ir)).toBe('$refs?.unknown');
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rw('$props?.[k]', ir)).toBe('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rw('whatever?.value', ir)).toBe('whatever?.value');
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rw('makeIt()?.value', ir)).toBe('makeIt()?.value');
  });
});

describe('rewriteListenerExpression — CallExpression $emit', () => {
  it("$emit('change', x) → this.change.emit(x)", () => {
    const ir = buildIR();
    expect(rw("$emit('change', x)", ir)).toBe('this.change.emit(x)');
  });

  it("$emit('file-added', x) → this.fileAdded.emit(x) (kebab sanitized)", () => {
    const ir = buildIR();
    expect(rw("$emit('file-added', x)", ir)).toBe('this.fileAdded.emit(x)');
  });

  it("$emit('change') with zero rest args → this.change.emit()", () => {
    const ir = buildIR();
    expect(rw("$emit('change')", ir)).toBe('this.change.emit()');
  });

  it('$emit with zero arguments is left untouched', () => {
    const ir = buildIR();
    expect(rw('$emit()', ir)).toBe('$emit()');
  });

  it('$emit with a non-string-literal first arg is left untouched', () => {
    const ir = buildIR();
    expect(rw('$emit(dynamicName, x)', ir)).toBe('$emit(dynamicName, x)');
  });

  it('a non-$emit call expression passes through', () => {
    const ir = buildIR();
    expect(rw('doThing(1, 2)', ir)).toBe('doThing(1, 2)');
  });

  it('a bare emit-name identifier (default classMembers from ir.emits) → this.X', () => {
    // ir.emits is sanitized into the default classMembers set; a bare
    // reference to a (sanitized) emit field gets the `this.` prefix.
    const ir = buildIR({ emits: ['file-added'] } as Partial<IRComponent>);
    expect(rw('fileAdded', ir)).toBe('this.fileAdded');
  });

  it('a call whose callee is not a bare identifier passes through', () => {
    const ir = buildIR();
    expect(rw('obj.method()', ir)).toBe('obj.method()');
  });
});

describe('rewriteListenerExpression — bare-identifier this. prefix + signal invocation', () => {
  it('a bare signal class member (default classMembers) → this.X()', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('count', ir)).toBe('this.count()');
  });

  it('a bare computed class member → this.X()', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rw('total', ir)).toBe('this.total()');
  });

  it('a bare identifier that is not a class member is left untouched', () => {
    const ir = buildIR();
    expect(rw('plainVar', ir)).toBe('plainVar');
  });

  it('a user-method class member (via classMembers opt, non-signal) → this.X (no call)', () => {
    const ir = buildIR();
    expect(
      rw('toggle()', ir, { classMembers: new Set(['toggle']) }),
    ).toBe('this.toggle()');
  });

  it('a non-signal class member read as a bare identifier → this.X (no call suffix)', () => {
    const ir = buildIR();
    expect(
      rw('toggle', ir, { classMembers: new Set(['toggle']) }),
    ).toBe('this.toggle');
  });

  it('a signal class member used as callee → this.X (no double call)', () => {
    const ir = buildIR();
    expect(
      rw('fn()', ir, {
        classMembers: new Set(['fn']),
        signalMembers: new Set(['fn']),
      }),
    ).toBe('this.fn()');
  });

  it('collisionRenames remaps a bare identifier reference', () => {
    const ir = buildIR();
    expect(
      rw('close', ir, {
        collisionRenames: new Map([['close', '_close']]),
        classMembers: new Set(['_close']),
      }),
    ).toBe('this._close');
  });

  it('an identifier in member-property position is NOT prefixed', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('obj.count', ir)).toBe('obj.count');
  });

  it('an identifier in object-property key position is NOT prefixed', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('({ count: 1 })', ir)).toBe('{ count: 1 }');
  });

  it('an identifier in a function-declaration id position is NOT prefixed', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('(function count() {})', ir)).toBe('function count() {}');
  });

  it('an identifier in a VariableDeclarator id position is NOT prefixed', () => {
    const ir = buildIR({ state: [mkState('count')] });
    // The declarator id `count` inside an IIFE-style arrow body.
    expect(rw('(() => { let count = 1; return count; })', ir)).toContain(
      'let count = 1',
    );
  });

  it('an identifier in a function-parameter position is NOT prefixed', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('(count) => count', ir)).toBe('count => this.count()');
  });

  it('a magic Rozie identifier ($props/$data/$refs/$slots/$emit) is NOT prefixed', () => {
    const ir = buildIR();
    expect(rw('$props', ir)).toBe('$props');
    expect(rw('$onMount', ir)).toBe('$onMount');
  });

  it('a signal class member on the LHS of an assignment is NOT rewritten (deferred)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rw('count = 5', ir)).toBe('count = 5');
  });

  it('rewrites sigils nested inside a logical expression', () => {
    const ir = buildIR({ state: [mkState('open')], refs: [mkRef('el')] });
    expect(rw('$data.open && $refs.el', ir)).toBe(
      'this.open() && this.el()?.nativeElement',
    );
  });
});
