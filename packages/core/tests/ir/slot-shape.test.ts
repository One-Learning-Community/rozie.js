// Phase 2 Plan 02-05 Task 1 — D-18 SlotDecl shape lock.
//
// IR-02 / D-18: SlotDecl shape is THE most expensive decision in the project to
// retrofit. The snapshot test (fixtures/ir/SlotDecl-shape.snap) plus the
// type-level assertions catch drift at both the field-shape and field-types
// levels. Phase 4 React emitter MAY amend; that amendment must be a deliberate
// ROADMAP change, not silent drift.
import { describe, it, expect, expectTypeOf } from 'vitest';
// Value import of the @rozie/core barrel (hoisted — see the re-export test below).
import * as rozieCore from '../../src/index.js';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import { compile, type CompileTarget } from '../../src/index.js';
import * as t from '@babel/types';
import type { TSType, Expression } from '@babel/types';
import type {
  SlotDecl,
  ParamDecl,
  TemplateNode,
  IRComponent,
  PropDecl,
  PropTypeAnnotation,
  StateDecl,
  ComputedDecl,
  RefDecl,
  LifecycleHook,
  Listener,
  ListenerTarget,
  SetupBody,
  SetupAnnotation,
  TemplateElementIR,
  AttributeBinding,
  TemplateConditionalIR,
  TemplateLoopIR,
  TemplateSlotInvocationIR,
  TemplateFragmentIR,
  TemplateInterpolationIR,
  TemplateStaticTextIR,
  StyleSection,
} from '../../src/ir/types.js';
import type { SourceLoc } from '../../src/ast/types.js';

describe('SlotDecl shape lock — Plan 02-05 (D-18)', () => {
  it('SlotDecl runtime shape lock: hand-authored canonical snapshot at fixtures/ir/SlotDecl-shape.snap', async () => {
    const canonical: SlotDecl = {
      type: 'SlotDecl',
      name: 'header',
      defaultContent: null,
      params: [],
      // paramTypes intentionally omitted (optional)
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 100, end: 200 },
      // Phase 79 R1 — dynamicNameExpr / namePrefix are additive optional
      // fields (see SlotDecl's doc comment in ir/types.ts). Included here,
      // with illustrative example values, to lock their runtime JSON shape
      // at both the field-shape and field-types levels — the same
      // deliberate, ROADMAP-visible amendment the file header above already
      // calls for. `name: 'header'` co-occurring with `dynamicNameExpr` set
      // is not a contradiction: it is exactly the real lowerSlots() output
      // for the ROZ090 error case (`<slot name="header" :name="k">`) — the
      // static name is retained (collected-not-thrown, D-08) even though
      // the binding is also flagged as invalid. `sourceLoc: { start: 100,
      // end: 200 }` above is the SAME kind of arbitrary illustrative value,
      // not a reproduction of a real compile.
      dynamicNameExpr: t.identifier('col'),
      namePrefix: 'cell-',
    };
    await expect(JSON.stringify(canonical, null, 2)).toMatchFileSnapshot(
      '../../fixtures/ir/SlotDecl-shape.snap',
    );
  });

  it('SlotDecl type-level lock: required field set is exactly { type, name, defaultContent, params, paramTypes?, presence, nestedSlots, sourceLoc, dynamicNameExpr?, namePrefix? }', () => {
    expectTypeOf<SlotDecl>().toMatchTypeOf<{
      type: 'SlotDecl';
      name: string;
      defaultContent: TemplateNode | null;
      params: ParamDecl[];
      paramTypes?: TSType[];
      presence: 'always' | 'conditional';
      nestedSlots: SlotDecl[];
      sourceLoc: SourceLoc;
      dynamicNameExpr?: Expression;
      namePrefix?: string;
    }>();
    // Discriminator literal lock
    expectTypeOf<SlotDecl['type']>().toEqualTypeOf<'SlotDecl'>();
  });

  it('Phase 79 R1: dynamicNameExpr and namePrefix are optional (mirrors the SlotFillerDecl.dynamicNameExpr optionality-lock precedent)', () => {
    const withoutDynamicName: SlotDecl = {
      type: 'SlotDecl',
      name: 'header',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
      // dynamicNameExpr / namePrefix intentionally omitted (optional)
    };
    expect('dynamicNameExpr' in withoutDynamicName).toBe(false);
    expect('namePrefix' in withoutDynamicName).toBe(false);

    const withDynamicName: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
      dynamicNameExpr: t.memberExpression(t.identifier('col'), t.identifier('key')),
      namePrefix: 'cell-',
    };
    expect(withDynamicName.namePrefix).toBe('cell-');
    expectTypeOf<SlotDecl['dynamicNameExpr']>().toEqualTypeOf<Expression | undefined>();
    expectTypeOf<SlotDecl['namePrefix']>().toEqualTypeOf<string | undefined>();
  });

  it('Default slot sentinel: name === "" is permitted (A1 sentinel)', () => {
    const x: SlotDecl['name'] = '';
    expect(x).toBe('');
  });

  it('presence is locked to "always" | "conditional"', () => {
    const a: SlotDecl['presence'] = 'always';
    const b: SlotDecl['presence'] = 'conditional';
    expect([a, b]).toEqual(['always', 'conditional']);
    // @ts-expect-error — 'sometimes' is not a valid presence value
    const _bad: SlotDecl['presence'] = 'sometimes';
    void _bad;
  });

  it('nestedSlots is recursive SlotDecl[]', () => {
    const child: SlotDecl = {
      type: 'SlotDecl',
      name: 'child',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const parent: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [child],
      sourceLoc: { start: 0, end: 0 },
    };
    expect(parent.nestedSlots[0]?.name).toBe('child');
    // Recursive type confirmation
    expectTypeOf<SlotDecl['nestedSlots']>().toEqualTypeOf<SlotDecl[]>();
  });

  it('All 23+ IR primitive types are exported from packages/core/src/ir/types.ts', () => {
    // Existence smoke: each named export is reachable at the type level.
    // (Type-only imports are erased at runtime; we use type assertions to
    // verify the module surface compiles. The act of importing each name
    // above is itself the existence proof under verbatimModuleSyntax.)
    type _Surface = [
      IRComponent,
      PropDecl,
      PropTypeAnnotation,
      StateDecl,
      ComputedDecl,
      RefDecl,
      SlotDecl,
      ParamDecl,
      LifecycleHook,
      Listener,
      ListenerTarget,
      SetupBody,
      SetupAnnotation,
      TemplateNode,
      TemplateElementIR,
      AttributeBinding,
      TemplateConditionalIR,
      TemplateLoopIR,
      TemplateSlotInvocationIR,
      TemplateFragmentIR,
      TemplateInterpolationIR,
      TemplateStaticTextIR,
      StyleSection,
    ];
    const _proof: _Surface | undefined = undefined;
    expect(_proof).toBeUndefined();
  });

  it('IRComponent type is re-exported from @rozie/core public surface', () => {
    // Verifies index.ts re-export wiring: the static top-level import of
    // ../../src/index.js IS the resolution assertion — a broken barrel fails
    // the whole file at load. Hoisted from a per-test `await import()`, which
    // under turbo's parallel runner raced the 5s test timeout (the barrel's
    // transform cost is now paid at file load, which has no per-test cap).
    expect(rozieCore.parse).toBeTypeOf('function');
    // lowerToIR should be exported (Task 2 lands the real impl; Task 1 stub OK)
    expect(rozieCore.lowerToIR).toBeTypeOf('function');
  });

  it('Every IR node type carries sourceLoc: SourceLoc', () => {
    // Structural check via type-level constraint.
    expectTypeOf<IRComponent>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<PropDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<StateDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<ComputedDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<RefDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<SlotDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<ParamDecl>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<LifecycleHook>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<Listener>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateElementIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateConditionalIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateLoopIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateSlotInvocationIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateFragmentIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateInterpolationIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<TemplateStaticTextIR>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
    expectTypeOf<StyleSection>().toMatchTypeOf<{ sourceLoc: SourceLoc }>();
  });
});

/**
 * Phase 79 Plan 79-06 Task 3 — the AC-1/AC-3/AC-5/AC-12 shape-lock
 * behavioral proofs PATTERNS.md's "IR snapshot test" section assigns to
 * THIS file (in addition to the richer diagnostics coverage already proven
 * in `src/ir/__tests__/slotDynamicName.test.ts`). Driven through the real
 * `lowerToIR` pipeline — a hand-constructed object cannot prove the
 * compiler actually derives this shape for this input.
 */
function lowerDynName(source: string, filename = 'ShapeLock.rozie'): SlotDecl[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(`parse() returned null AST: ${parseDiags.map((d) => d.code).join(', ')}`);
  }
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry(), filename });
  if (!ir) throw new Error('lowerToIR returned null ir');
  return ir.slots;
}

describe('SlotDecl.dynamicNameExpr / namePrefix — AC-1/AC-3/AC-5/AC-12 shape proofs (Phase 79 Plan 79-06 Task 3)', () => {
  it('AC-2: <slot :name="col.key"> — dynamicNameExpr present, no `name` ParamDecl', () => {
    const slots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot :name="col.key" />
</template>
</rozie>`);
    expect(slots[0]!.dynamicNameExpr).toBeDefined();
    expect(slots[0]!.params.every((p) => p.name !== 'name')).toBe(true);
  });

  it('AC-3: <slot :name="\'cell\'"> and <slot :name="`cell`"> both constant-fold to a static name, no dynamicNameExpr key', () => {
    const stringLitSlots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot :name="'cell'" />
</template>
</rozie>`);
    const templateLitSlots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot :name="\`cell\`" />
</template>
</rozie>`);
    for (const slots of [stringLitSlots, templateLitSlots]) {
      expect(slots[0]!.name).toBe('cell');
      expect('dynamicNameExpr' in slots[0]!).toBe(false);
    }
  });

  it('AC-5: <slot :name="`cell-${k}`"> sets namePrefix === "cell-"', () => {
    const slots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot :name="\`cell-\${k}\`" />
</template>
</rozie>`);
    expect(slots[0]!.namePrefix).toBe('cell-');
  });

  it('AC-12: <slot :name="`${k}-cell`"> (empty leading quasi) leaves namePrefix unset', () => {
    const slots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot :name="\`\${k}-cell\`" />
</template>
</rozie>`);
    expect(slots[0]!.dynamicNameExpr).toBeDefined();
    expect('namePrefix' in slots[0]!).toBe(false);
  });

  it('AC-1: a static-only-name producer produces zero new keys on ANY of its SlotDecls (whole-component byte-identity)', () => {
    const slots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <slot name="header" />
  <slot name="footer" :x="1" />
</template>
</rozie>`);
    expect(slots.length).toBe(2);
    for (const slot of slots) {
      expect('dynamicNameExpr' in slot).toBe(false);
      expect('namePrefix' in slot).toBe(false);
    }
  });

  it('held-out ordering backstop: two dynamic families in one producer emit their SlotDecls in TEMPLATE DOCUMENT ORDER', () => {
    const slots = lowerDynName(`
<rozie name="ShapeLock">
<template>
  <div>
    <slot :name="\`row-\${r}\`" />
    <slot :name="\`cell-\${c}\`" />
    <slot name="footer" />
    <slot :name="\`row-\${r2}\`" />
  </div>
</template>
</rozie>`);
    // Assert on the ORDERED list of namePrefix values (a Set assertion could
    // not detect a reordering) — includes the interleaved static slot's
    // undefined placeholder to prove relative document position survives.
    expect(slots.map((s) => s.namePrefix ?? `(static:${s.name})`)).toEqual([
      'row-',
      'cell-',
      '(static:footer)',
      'row-',
    ]);
  });

  it('AC-3 byte-identity (compile-level, all six targets): a static name="cell" producer and an equivalent constant-folding :name="\'cell\'" producer emit IDENTICAL output', () => {
    const ALL_TARGETS: CompileTarget[] = ['react', 'vue', 'solid', 'svelte', 'angular', 'lit'];
    const staticProducer = `
<rozie name="FoldCell">
<props>
{ total: { type: Number, default: 0 } }
</props>
<template>
  <slot name="cell" :value="$props.total">
    <strong>{{ $props.total }}</strong>
  </slot>
</template>
</rozie>
`;
    const constantFoldProducer = `
<rozie name="FoldCell">
<props>
{ total: { type: Number, default: 0 } }
</props>
<template>
  <slot :name="'cell'" :value="$props.total">
    <strong>{{ $props.total }}</strong>
  </slot>
</template>
</rozie>
`;
    for (const target of ALL_TARGETS) {
      const staticResult = compile(staticProducer, { target, filename: 'FoldCell.rozie' });
      const dynamicResult = compile(constantFoldProducer, { target, filename: 'FoldCell.rozie' });
      const staticErrors = staticResult.diagnostics.filter((d) => d.severity === 'error');
      const dynamicErrors = dynamicResult.diagnostics.filter((d) => d.severity === 'error');
      expect(staticErrors, `${target} static-name compile errors`).toHaveLength(0);
      expect(dynamicErrors, `${target} constant-folded :name compile errors`).toHaveLength(0);
      expect(dynamicResult.code, `${target}: constant-folded :name="'cell'" must byte-match name="cell"`).toBe(
        staticResult.code,
      );
    }
  });
});
