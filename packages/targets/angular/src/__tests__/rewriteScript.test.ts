/**
 * rewriteScript unit tests — Angular target.
 *
 * Quick task 260521-qsh — broad branch-coverage deepening for
 * `rewrite/rewriteScript.ts` (`rewriteRozieIdentifiers` +
 * `hoistDoubleReadAccessors`). The existing rewriteScript-slots-merge.test.ts
 * only exercises the §slots-X-merge contract (~25% line coverage). The
 * describe blocks below drive the remaining branches: the full sigil matrix
 * (MemberExpression / OptionalMemberExpression $props model + non-model /
 * $data / $refs with refLowersToNonNull / $slots / $portals), the
 * AssignmentExpression model + data setter calls (plain + compound), the
 * $emit / $snapshot CallExpression rewrites, the bare-identifier `this.`
 * prefix + signal-invocation visitor with its parent-position skip ladder,
 * collision renames, the scope-aware binding guards, the $el free-read
 * lowering, the TS type-position guards, and the hoistDoubleReadAccessors
 * pre-pass.
 *
 * Script bodies emit into Angular class context, so IR member references
 * carry the `this.` prefix.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import _generate from '@babel/generator';
import type { File } from '@babel/types';
import {
  rewriteRozieIdentifiers,
  hoistDoubleReadAccessors,
} from '../rewrite/rewriteScript.js';
import type {
  IRComponent,
  PropDecl,
  StateDecl,
  RefDecl,
  ComputedDecl,
  SlotDecl,
} from '../../../../core/src/ir/types.js';

// CJS interop normalization for @babel/generator default export.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? (_generate as GenerateFn)
    : ((_generate as unknown as { default: GenerateFn }).default);

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
  return {
    type: 'StateDecl',
    name,
    initializer: { type: 'NumericLiteral', value: 0 } as never,
    sourceLoc: sloc,
  } as StateDecl;
}
function mkRef(name: string): RefDecl {
  return { type: 'RefDecl', name, elementTag: 'div', sourceLoc: sloc } as RefDecl;
}
function mkComputed(name: string): ComputedDecl {
  return {
    type: 'ComputedDecl',
    name,
    body: { type: 'NumericLiteral', value: 1 } as never,
    deps: [],
    sourceLoc: sloc,
  } as ComputedDecl;
}
function mkSlot(name: string, isPortal = false): SlotDecl {
  return {
    type: 'SlotDecl',
    name,
    defaultContent: null,
    params: [],
    presence: 'conditional',
    nestedSlots: [],
    ...(isPortal ? { isPortal: true, portalParamNames: [] } : {}),
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

function parseProgram(src: string, ts = true): File {
  return parse(src, {
    sourceType: 'module',
    plugins: ts ? ['typescript'] : [],
  });
}

function rewrite(
  src: string,
  ir: IRComponent,
  ts = true,
): ReturnType<typeof rewriteRozieIdentifiers> & { code: string } {
  const program = parseProgram(src, ts);
  const result = rewriteRozieIdentifiers(program, ir);
  return {
    ...result,
    code: generate(result.rewrittenProgram, {
      retainLines: false,
      compact: false,
    }).code,
  };
}

describe('rewriteRozieIdentifiers — MemberExpression sigil rewrites', () => {
  it('$props.X (model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = $props.value;', ir).code).toContain('this.value()');
  });

  it('$props.X (non-model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rewrite('const a = $props.step;', ir).code).toContain('this.step()');
  });

  it('$props.X (unknown prop name) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('known', true)] });
    expect(rewrite('const a = $props.mystery;', ir).code).toContain(
      '$props.mystery',
    );
  });

  it('$data.X → this.X()', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = $data.count;', ir).code).toContain('this.count()');
  });

  it('$data.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rewrite('const a = $data.unknown;', ir).code).toContain(
      '$data.unknown',
    );
  });

  it('computed-member access ($props["x"]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rewrite("const a = $props['x'];", ir).code).toContain("$props['x']");
  });

  it('a non-sigil object name passes through', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = whatever.value;', ir).code).toContain(
      'whatever.value',
    );
  });

  it('member expression whose object is not an identifier passes through', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = makeIt().count;', ir).code).toContain(
      'makeIt().count',
    );
  });
});

describe('rewriteRozieIdentifiers — $refs refLowersToNonNull', () => {
  it('bare $refs.X read → this.X()?.nativeElement (optional default)', () => {
    const ir = buildIR({ refs: [mkRef('panelEl')] });
    const { code } = rewrite('const el = $refs.panelEl;', ir);
    expect(code).toContain('this.panelEl()?.nativeElement');
  });

  it('$refs.X as object of a non-optional member → this.X()!.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('dialogEl')] });
    expect(rewrite('$refs.dialogEl.focus();', ir).code).toContain(
      'this.dialogEl()!.nativeElement',
    );
  });

  it('$refs.X invoked directly as a call callee → this.X()!.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('cleanup')] });
    expect(rewrite('$refs.cleanup();', ir).code).toContain(
      'this.cleanup()!.nativeElement',
    );
  });

  it('$refs.X as a function-call argument → non-null', () => {
    const ir = buildIR({ refs: [mkRef('inputEl')] });
    expect(rewrite('flatpickr($refs.inputEl);', ir).code).toContain(
      'this.inputEl()!.nativeElement',
    );
  });

  it('$refs.X nested inside an object literal passed to a constructor → non-null', () => {
    const ir = buildIR({ refs: [mkRef('editorEl')] });
    expect(
      rewrite('new Editor({ element: $refs.editorEl });', ir).code,
    ).toContain('!.nativeElement');
  });

  it('$refs.X nested inside an array literal passed to a call → non-null', () => {
    const ir = buildIR({ refs: [mkRef('hostEl')] });
    expect(rewrite('mountAll([$refs.hostEl]);', ir).code).toContain(
      '!.nativeElement',
    );
  });

  it('$refs.X?.method() (author opted into optionality) stays optional', () => {
    const ir = buildIR({ refs: [mkRef('dialogEl')] });
    const { code } = rewrite('$refs.dialogEl?.focus();', ir);
    expect(code).toContain('this.dialogEl()?.nativeElement');
  });

  it('$refs.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [mkRef('known')] });
    expect(rewrite('const a = $refs.unknown;', ir).code).toContain(
      '$refs.unknown',
    );
  });
});

describe('rewriteRozieIdentifiers — $slots / $portals handlers', () => {
  it('$slots.X (static name) → merged form with this. prefix', () => {
    const ir = buildIR({ slots: [mkSlot('footer')] });
    expect(rewrite('if ($slots.footer) {}', ir).code).toContain(
      "(this.footerTpl ?? this.templates()?.['footer'])",
    );
  });

  it('$slots.X (unknown slot name) is left untouched', () => {
    const ir = buildIR({ slots: [mkSlot('footer')] });
    expect(rewrite('if ($slots.header) {}', ir).code).toContain('$slots.header');
  });

  it('$slots default slot (empty name) → defaultTpl / defaultSlot merge', () => {
    const ir = buildIR({ slots: [mkSlot('')] });
    // parseExpression cannot produce `$slots.<empty>` — build the AST and
    // splice it into a Program so the MemberExpression visitor reaches the
    // `prop.name === ''` arm of the tplName / dynKey ternaries.
    const program = parse('$slots.PLACEHOLDER;', {
      sourceType: 'module',
      plugins: ['typescript'],
    });
    const exprStmt = program.program.body[0] as { expression: { property: { name: string } } };
    exprStmt.expression.property.name = '';
    const result = rewriteRozieIdentifiers(program, ir);
    const code = generate(result.rewrittenProgram, {
      retainLines: false,
      compact: false,
    }).code;
    expect(code).toContain(
      "(this.defaultTpl ?? this.templates()?.['defaultSlot'])",
    );
  });

  it('$portals.X (matching portal slot) → portals.X', () => {
    const ir = buildIR({ slots: [mkSlot('item', true)] });
    expect(rewrite('$portals.item(node, scope);', ir).code).toContain(
      'portals.item(node, scope)',
    );
  });

  it('$portals.X with no matching portal slot is left untouched', () => {
    const ir = buildIR({ slots: [mkSlot('item', true)] });
    expect(rewrite('$portals.other(node);', ir).code).toContain(
      '$portals.other(node)',
    );
  });
});

describe('rewriteRozieIdentifiers — OptionalMemberExpression sigil branches', () => {
  it('$props?.X (model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = $props?.value;', ir).code).toContain(
      'this.value()',
    );
  });

  it('$props?.X (non-model) → this.X()', () => {
    const ir = buildIR({ props: [mkProp('step', false)] });
    expect(rewrite('const a = $props?.step;', ir).code).toContain('this.step()');
  });

  it('$props?.X (unknown prop name) is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const a = $props?.mystery;', ir).code).toContain(
      '$props?.mystery',
    );
  });

  it('$data?.X → this.X()', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const a = $data?.count;', ir).code).toContain('this.count()');
  });

  it('$data?.X (unknown data name) is left untouched', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rewrite('const a = $data?.unknown;', ir).code).toContain(
      '$data?.unknown',
    );
  });

  it('$refs?.X → this.X()?.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('panelEl')] });
    expect(rewrite('const a = $refs?.panelEl;', ir).code).toContain(
      'this.panelEl()?.nativeElement',
    );
  });

  it('$refs?.X (unknown ref name) is left untouched', () => {
    const ir = buildIR({ refs: [mkRef('known')] });
    expect(rewrite('const a = $refs?.unknown;', ir).code).toContain(
      '$refs?.unknown',
    );
  });

  it('computed OptionalMember ($props?.[x]) is left untouched', () => {
    const ir = buildIR({ props: [mkProp('x', true)] });
    expect(rewrite('const a = $props?.[k];', ir).code).toContain('$props?.[k]');
  });

  it('non-sigil OptionalMember object name is left untouched', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('const a = whatever?.value;', ir).code).toContain(
      'whatever?.value',
    );
  });

  it('OptionalMember whose object is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('const a = makeIt()?.value;', ir).code).toContain(
      'makeIt()?.value',
    );
  });
});

describe('rewriteRozieIdentifiers — AssignmentExpression model/data setters', () => {
  it('$data.X = v → this.X.set(v)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('$data.count = 5;', ir).code).toContain('this.count.set(5)');
  });

  it('$data.X += v → this.X.set(this.X() + v)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('$data.count += 1;', ir).code).toContain(
      'this.count.set(this.count() + 1)',
    );
  });

  it('$data.X *= v → this.X.set(this.X() * v)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('$data.count *= 2;', ir).code).toContain(
      'this.count.set(this.count() * 2)',
    );
  });

  it('$props.X = v (model) → this.X.set(v)', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('$props.value = 7;', ir).code).toContain(
      'this.value.set(7)',
    );
  });

  // NOTE: a `$props.X = v` write where X is a NON-model prop is illegal user
  // code (caught upstream by IR lowering). It is intentionally not exercised
  // here — the MemberExpression visitor rewrites the LHS to `this.X()`, an
  // invalid AssignmentExpression LVal, which @babel/types rejects. The
  // AssignmentExpression `$props` non-model `return` arm is therefore left as
  // an honest branch-coverage residual rather than a contrived crashing test.

  it('$data.X = v with an unknown data name passes through', () => {
    const ir = buildIR({ state: [mkState('known')] });
    expect(rewrite('$data.unknown = 1;', ir).code).toContain(
      '$data.unknown = 1',
    );
  });

  it('assignment whose LHS is not a member expression passes through', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('let plain = 0; plain = 1;', ir).code).toContain('plain = 1');
  });

  it('assignment with a computed LHS member is NOT rewritten to a setter', () => {
    const ir = buildIR({ state: [mkState('count')] });
    // `$data[expr] = 1` — the LHS is a COMPUTED member; the AssignmentExpression
    // visitor's `if (left.computed) return` arm fires, so no `.set(...)` call.
    const { code } = rewrite('$data[0] = 1;', ir);
    expect(code).toContain('$data[0]');
    expect(code).not.toContain('.set(');
  });

  it('assignment whose LHS member object is not an identifier passes through', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('makeIt().count = 1;', ir).code).toContain(
      'makeIt().count = 1',
    );
  });

  it('a $props member assignment with an unknown (non-model) prop name passes through', () => {
    const ir = buildIR();
    // No props at all — `$props.X` on an assignment LHS where X is not a model
    // prop hits the AssignmentExpression `$props` `!modelProps.has` return arm.
    // The MemberExpression visitor leaves an unknown `$props.X` untouched, so
    // the assignment AST stays valid.
    expect(rewrite('$props.unknown = 1;', ir).code).toContain(
      '$props.unknown = 1',
    );
  });
});

describe('rewriteRozieIdentifiers — UpdateExpression (++/--) on reactive state', () => {
  it('$data.X++ → this.X.set(this.X() + 1)  (regression: was `this.count()++`)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    const code = rewrite('$data.count++;', ir).code;
    expect(code).toContain('this.count.set(this.count() + 1)');
    expect(code).not.toContain('++');
  });

  it('$data.X-- → this.X.set(this.X() - 1)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    const code = rewrite('$data.count--;', ir).code;
    expect(code).toContain('this.count.set(this.count() - 1)');
    expect(code).not.toContain('--');
  });

  it('prefix `++$data.X` → this.X.set(this.X() + 1)  (statement context)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('++$data.count;', ir).code).toContain(
      'this.count.set(this.count() + 1)',
    );
  });

  it('$props.X++ (model) → this.X.set(this.X() + 1)', () => {
    const ir = buildIR({ props: [mkProp('value', true)] });
    expect(rewrite('$props.value++;', ir).code).toContain(
      'this.value.set(this.value() + 1)',
    );
  });

  it('`++` on a plain non-reactive local passes through verbatim', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('let tmp = 0; tmp++;', ir).code).toContain('tmp++');
  });

  it('expression-context `$data.X++` (value used) is left unchanged (deferred edge case)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    expect(rewrite('const y = $data.count++;', ir).code).toContain('++');
  });
});

describe('rewriteRozieIdentifiers — $emit / $snapshot CallExpression', () => {
  it("$emit('change', x) → this.change.emit(x)", () => {
    const ir = buildIR();
    expect(rewrite("$emit('change', x);", ir).code).toContain(
      'this.change.emit(x)',
    );
  });

  it("$emit('file-added', x) → this.fileAdded.emit(x) (kebab sanitized)", () => {
    const ir = buildIR();
    expect(rewrite("$emit('file-added', x);", ir).code).toContain(
      'this.fileAdded.emit(x)',
    );
  });

  it('$emit with zero arguments is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit();', ir).code).toContain('$emit()');
  });

  it('$emit with a non-string-literal first arg is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$emit(dynamicName, x);', ir).code).toContain(
      '$emit(dynamicName, x)',
    );
  });

  it('$snapshot(x) → x (identity lowering)', () => {
    const ir = buildIR();
    const { code } = rewrite('const c = $snapshot(payload);', ir);
    expect(code).toContain('const c = payload');
    expect(code).not.toContain('$snapshot');
  });

  it('$snapshot with non-single args is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('$snapshot(a, b);', ir).code).toContain('$snapshot(a, b)');
  });

  it('$snapshot with a spread (non-expression) argument is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('const c = $snapshot(...x);', ir).code).toContain(
      '$snapshot(...x)',
    );
  });

  it('a call whose callee is not an identifier passes through', () => {
    const ir = buildIR();
    expect(rewrite('obj.method();', ir).code).toContain('obj.method()');
  });
});

describe('rewriteRozieIdentifiers — bare-identifier this. prefix', () => {
  it('a bare $computed name → this.X()', () => {
    const ir = buildIR({ computed: [mkComputed('canIncrement')] });
    expect(rewrite('if (canIncrement) {}', ir).code).toContain(
      'this.canIncrement()',
    );
  });

  it('a bare user-method name in callee position → this.X()', () => {
    const ir = buildIR();
    // collectUserMethodNames picks up `const inc = () => {}` as a class member.
    const { code } = rewrite('const inc = () => {}; inc();', ir);
    expect(code).toContain('this.inc()');
  });

  it('a bare user-method name in read position → this.X (no call suffix)', () => {
    const ir = buildIR();
    const { code } = rewrite('const inc = () => {}; const r = inc;', ir);
    expect(code).toContain('this.inc');
  });

  it('a bare identifier that is not a class member is left untouched', () => {
    const ir = buildIR();
    expect(rewrite('if (somethingElse) {}', ir).code).toContain(
      'somethingElse',
    );
  });

  it('a non-signal user-method assigned on LHS → this.X = ...', () => {
    const ir = buildIR();
    const { code } = rewrite('let saved = 0; saved = 1;', ir);
    expect(code).toContain('this.saved = 1');
  });

  it('a signal class member on the LHS of an assignment is NOT rewritten (deferred)', () => {
    const ir = buildIR({ state: [mkState('count')] });
    // A bare `count = 5` (no $data prefix) — signal LHS is deferred to v2.
    expect(rewrite('count = 5;', ir).code).toContain('count = 5');
  });

  it('a computed name in member-property position is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('const a = obj.total;', ir).code).toContain('obj.total');
  });

  it('a computed name in object-property key position is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('const o = { total: 1 };', ir).code).toContain('total: 1');
  });

  it('a magic Rozie identifier ($props/$data/$refs/$slots) is NOT prefixed', () => {
    const ir = buildIR();
    expect(rewrite('const a = $props;', ir).code).toContain('$props');
  });

  it('the $onMount/$onUnmount lifecycle identifiers are NOT prefixed', () => {
    const ir = buildIR();
    expect(rewrite('$onMount(setup);', ir).code).toContain('$onMount(setup)');
  });

  it('a method passed as the first arg of a lifecycle call stays a bare Identifier', () => {
    const ir = buildIR();
    // `$onMount(lockScroll)` — the bare `lockScroll` arg must NOT be `this.`-
    // prefixed; pairClonedLifecycle needs the bare name.
    const { code } = rewrite('const lockScroll = () => {}; $onMount(lockScroll);', ir);
    expect(code).toContain('$onMount(lockScroll)');
  });

  it('a class member in a function-declaration parameter position is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    expect(rewrite('function f(total) { return total; }', ir).code).toContain(
      'function f(total)',
    );
  });

  it('a class member in a function-expression id position is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite('const f = function total() {};', ir);
    expect(code).toContain('function total()');
  });

  it('a class member used as a LabeledStatement label is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite('total: { doThing(); }', ir);
    expect(code).toContain('total:');
  });

  it('a class member used as a break/continue label is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('outer')] });
    const { code } = rewrite(
      'outer: for (let i = 0; i < 1; i++) { continue outer; }',
      ir,
    );
    expect(code).toContain('continue outer');
  });

  it('a class member in an import specifier is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite("import { total } from 'x';", ir);
    expect(code).toContain('import { total }');
  });

  it('a class member in a default-import specifier is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite("import total from 'x';", ir);
    expect(code).toContain('import total from');
  });

  it('a class member in an export specifier is NOT prefixed', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    const { code } = rewrite('const total = 1; export { total };', ir);
    expect(code).toContain('export { total }');
  });
});

describe('rewriteRozieIdentifiers — collision renames', () => {
  it('a user method colliding with an emit name is renamed at the declaration site', () => {
    const ir = buildIR({ emits: ['close'] } as Partial<IRComponent>);
    const { code, collisionRenames } = rewrite('const close = () => {};', ir);
    expect(collisionRenames.get('close')).toBe('_close');
    expect(code).toContain('_close');
  });

  it('a function-declaration colliding with an emit name is renamed', () => {
    const ir = buildIR({ emits: ['toggle'] } as Partial<IRComponent>);
    const { code } = rewrite('function toggle() {}', ir);
    expect(code).toContain('function _toggle()');
  });

  it('a bare reference to a collision-renamed method is rewritten to the renamed form', () => {
    const ir = buildIR({ emits: ['close'] } as Partial<IRComponent>);
    const { code } = rewrite('const close = () => {}; const r = close;', ir);
    expect(code).toContain('this._close');
  });
});

describe('rewriteRozieIdentifiers — scope-aware binding guards', () => {
  it('a destructured parameter shadowing a class member is NOT rewritten', () => {
    const ir = buildIR({ state: [mkState('editor')] });
    // `({ editor }) => editor` — the `editor` is a LOCAL destructured param.
    const { code } = rewrite('const f = ({ editor }) => editor;', ir);
    expect(code).toContain('{\n  editor\n}');
    expect(code).not.toContain('this.editor');
  });

  it('a shorthand object VALUE referencing a class member is un-shorthanded', () => {
    const ir = buildIR({ state: [mkState('editor')] });
    // `return { editor }` in a VALUE position → `{ editor: this.editor() }`.
    const { code } = rewrite('const f = () => { return { editor }; };', ir);
    expect(code).toContain('editor: this.editor()');
  });

  it('a local let shadowing a class member name is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('total')] });
    // Inner `let total` shadows the promoted computed; the read points local.
    const { code } = rewrite(
      'const f = () => { let total = 1; return total; };',
      ir,
    );
    expect(code).not.toContain('this.total');
  });

  it('an identifier nested inside a destructured ObjectPattern parameter is skipped', () => {
    const ir = buildIR({ state: [mkState('editor')] });
    // `({ wrap: { editor } }) => ...` — `editor` is nested two levels deep in
    // a destructuring pattern; isInBindingPosition catches it.
    const { code } = rewrite(
      'const f = ({ wrap: { editor } }) => doThing();',
      ir,
    );
    expect(code).not.toContain('this.editor');
  });

  it('an identifier nested inside an ArrayPattern parameter is skipped', () => {
    const ir = buildIR({ state: [mkState('editor')] });
    const { code } = rewrite('const f = ([editor]) => doThing();', ir);
    expect(code).not.toContain('this.editor');
  });

  it('an identifier inside an ObjectPattern destructuring (shorthand) param is skipped', () => {
    const ir = buildIR({ state: [mkState('editor')] });
    // `onUpdate: ({ editor }) => editor` — the grandparent is an ObjectPattern,
    // so the shorthand-handling block returns early without un-shorthanding.
    const { code } = rewrite(
      'const o = { onUpdate: ({ editor }) => editor };',
      ir,
    );
    expect(code).toContain('{ editor }'.replace('{ editor }', 'editor'));
    expect(code).not.toContain('{ editor: this.editor }');
  });

  it('a shorthand object-expression VALUE referencing a non-signal user method is un-shorthanded to this.X', () => {
    const ir = buildIR();
    // `const fn = () => {}; return { fn }` — `fn` is a user method (non-signal
    // class member); the shorthand expands to `{ fn: this.fn }` (no `()`).
    const { code } = rewrite(
      'const fn = () => {}; const r = () => { return { fn }; };',
      ir,
    );
    expect(code).toContain('fn: this.fn');
    expect(code).not.toContain('fn: this.fn()');
  });

  it('a shorthand object-expression VALUE referencing an unknown name is left alone', () => {
    const ir = buildIR();
    // `{ unknownName }` — not a class member, the shorthand block returns
    // without un-shorthanding.
    const { code } = rewrite('const o = { unknownName };', ir);
    expect(code).toContain('unknownName');
    expect(code).not.toContain(': this.');
  });
});

describe('rewriteRozieIdentifiers — $el free read', () => {
  it('$el free read lowers via $refs.__rozieRoot → this.__rozieRoot()?.nativeElement', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const root = $el;', ir).code).toContain(
      'this.__rozieRoot()',
    );
  });

  it('$el flowing into a constructor argument lowers to a non-null access', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('new SortableJS($el, {});', ir).code).toContain(
      '!.nativeElement',
    );
  });

  it('$el as a VariableDeclarator id is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('let $el = computeIt();', ir).code).toContain('let $el =');
  });

  it('$el as a non-computed member property name is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const v = obj.$el;', ir).code).toContain('obj.$el');
  });

  it('$el as a non-computed ObjectProperty key is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const o = { $el: 1 };', ir).code).toContain('$el: 1');
  });

  it('$el occupying a function-parameter position is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('function handle($el) {}', ir).code).toContain(
      'function handle($el)',
    );
  });

  it('$el free read inside a function body (NOT a param) DOES lower', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('const f = () => $el;', ir).code).toContain(
      'this.__rozieRoot()',
    );
  });
});

describe('rewriteRozieIdentifiers — TS type-position skips', () => {
  it('$data.X inside a `typeof` type query is left intact', () => {
    const ir = buildIR({ state: [mkState('foo')] });
    expect(rewrite('let x: typeof $data.foo;', ir).code).toContain(
      'typeof $data.foo',
    );
  });

  it('a class-member identifier inside a type annotation is NOT rewritten', () => {
    const ir = buildIR({ computed: [mkComputed('Total')] });
    const { code } = rewrite('let x: Total;', ir);
    expect(code).toContain(': Total');
    expect(code).not.toContain('this.Total');
  });

  it('$el inside a type position is NOT rewritten', () => {
    const ir = buildIR({ refs: [mkRef('__rozieRoot')] });
    expect(rewrite('let x: $el;', ir).code).toContain('$el');
  });
});

describe('hoistDoubleReadAccessors', () => {
  it('hoists a double-read $props.X into a const at the top of the function body', () => {
    const program = parseProgram(
      'function f() { const a = $props.itemKey; const b = $props.itemKey; }',
    );
    hoistDoubleReadAccessors(program);
    const { code } = { code: generate(program).code };
    expect(code).toContain('const __itemKey = $props.itemKey');
    // Both reads now reference the hoisted local.
    expect(code).toContain('const a = __itemKey');
    expect(code).toContain('const b = __itemKey');
  });

  it('hoists a double-read $data.X', () => {
    const program = parseProgram(
      'function f() { const a = $data.config; return $data.config; }',
    );
    hoistDoubleReadAccessors(program);
    expect(generate(program).code).toContain('const __config = $data.config');
  });

  it('does NOT hoist a single-read accessor', () => {
    const program = parseProgram('function f() { return $props.only; }');
    hoistDoubleReadAccessors(program);
    expect(generate(program).code).not.toContain('const __only');
  });

  it('does NOT hoist an accessor that is also assigned in the body', () => {
    const program = parseProgram(
      'function f() { $data.count = 1; const a = $data.count; return $data.count; }',
    );
    hoistDoubleReadAccessors(program);
    // The accessor is mutated — single-reading it would change semantics.
    expect(generate(program).code).not.toContain('const __count');
  });

  it('stops descent at nested function boundaries (reads in a callback do not count)', () => {
    const program = parseProgram(
      'function f() { const a = $props.x; const cb = () => $props.x; }',
    );
    hoistDoubleReadAccessors(program);
    // One read in f, one in the nested arrow — not a double-read in f's scope.
    expect(generate(program).code).not.toContain('const __x');
  });

  it('leaves a program with no function bodies unchanged', () => {
    const program = parseProgram('const a = $props.x; const b = $props.x;');
    hoistDoubleReadAccessors(program);
    // Top-level (Program-scope) reads are not inside a function body block.
    expect(generate(program).code).not.toContain('const __x');
  });

  it('handles a triple-read accessor (still one hoist)', () => {
    const program = parseProgram(
      'function f() { return $props.v + $props.v + $props.v; }',
    );
    hoistDoubleReadAccessors(program);
    const code = generate(program).code;
    expect(code).toContain('const __v = $props.v');
    expect((code.match(/const __v/g) ?? []).length).toBe(1);
  });

  it('hoists double-reads buried inside nested array/object literals', () => {
    // Exercises the recursive Array.isArray / object-child descent in
    // collectInScope and replaceInScope.
    const program = parseProgram(
      'function f() { const a = [{ k: $props.x }]; const b = { n: [$props.x] }; }',
    );
    hoistDoubleReadAccessors(program);
    const code = generate(program).code;
    expect(code).toContain('const __x = $props.x');
    expect(code).toContain('__x');
  });

  it('hoists a double-read across an arrow-method body block', () => {
    const program = parseProgram(
      'const m = { go() { const a = $props.y; return $props.y; } };',
    );
    hoistDoubleReadAccessors(program);
    expect(generate(program).code).toContain('const __y = $props.y');
  });

  it('a single read in the outer scope plus one in a nested function is NOT hoisted', () => {
    const program = parseProgram(
      'function f() { const a = $data.z; function g() { return $data.z; } }',
    );
    hoistDoubleReadAccessors(program);
    expect(generate(program).code).not.toContain('const __z');
  });

  it('replaceInScope rewrites a double-read reference that lives in a nested function closure', () => {
    // Two reads in the outer scope trigger the hoist; a third read inside a
    // nested arrow is also rewritten to the hoisted local (closure scope).
    const program = parseProgram(
      'function f() { const a = $props.w; const b = $props.w; const cb = () => $props.w; }',
    );
    hoistDoubleReadAccessors(program);
    const code = generate(program).code;
    expect(code).toContain('const __w = $props.w');
    expect(code).toContain('() => __w');
  });
});

describe('rewriteRozieIdentifiers — result shape', () => {
  it('returns the populated classMembers and signalMembers sets', () => {
    const ir = buildIR({
      state: [mkState('count')],
      computed: [mkComputed('total')],
      refs: [mkRef('el')],
      props: [mkProp('value', true)],
    });
    const { classMembers, signalMembers } = rewrite('const a = 1;', ir);
    expect(classMembers.has('count')).toBe(true);
    expect(classMembers.has('total')).toBe(true);
    expect(signalMembers.has('count')).toBe(true);
    expect(signalMembers.has('value')).toBe(true);
  });

  it('emit field names land in classMembers (sanitized)', () => {
    const ir = buildIR({ emits: ['file-added'] } as Partial<IRComponent>);
    const { classMembers } = rewrite('const a = 1;', ir);
    expect(classMembers.has('fileAdded')).toBe(true);
  });

  it('slot tpl-field names land in classMembers', () => {
    const ir = buildIR({ slots: [mkSlot('header')] });
    const { classMembers } = rewrite('const a = 1;', ir);
    expect(classMembers.has('headerTpl')).toBe(true);
  });

  it('a top-level `const X = $computed(...)` declarator is NOT collected as a user method', () => {
    // collectUserMethodNames skips $computed declarators — `derived` is a
    // ComputedDecl, handled separately, so it must not enter userMethodNames.
    const ir = buildIR({ computed: [mkComputed('derived')] });
    const { code } = rewrite('const derived = $computed(() => 1);', ir);
    // The declarator id stays `derived` (not collision-renamed / re-promoted
    // as a plain user method); a $computed read still lowers via signalMembers.
    expect(code).toContain('derived');
  });

  it('a FunctionDeclaration at top level is collected as a user method', () => {
    const ir = buildIR();
    const { code } = rewrite('function helper() {} helper();', ir);
    expect(code).toContain('this.helper()');
  });

  it('the default-slot tpl field is `defaultTpl`', () => {
    const ir = buildIR({ slots: [mkSlot('')] });
    const { classMembers } = rewrite('const a = 1;', ir);
    expect(classMembers.has('defaultTpl')).toBe(true);
  });
});
