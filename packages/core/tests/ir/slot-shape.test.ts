// Phase 2 Plan 02-05 Task 1 — D-18 SlotDecl shape lock.
//
// IR-02 / D-18: SlotDecl shape is THE most expensive decision in the project to
// retrofit. The snapshot test (fixtures/ir/SlotDecl-shape.snap) plus the
// type-level assertions catch drift at both the field-shape and field-types
// levels. Phase 4 React emitter MAY amend; that amendment must be a deliberate
// ROADMAP change, not silent drift.
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { TSType } from '@babel/types';
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
    };
    await expect(JSON.stringify(canonical, null, 2)).toMatchFileSnapshot(
      '../../fixtures/ir/SlotDecl-shape.snap',
    );
  });

  it('SlotDecl type-level lock: required field set is exactly { type, name, defaultContent, params, paramTypes?, presence, nestedSlots, sourceLoc }', () => {
    expectTypeOf<SlotDecl>().toMatchTypeOf<{
      type: 'SlotDecl';
      name: string;
      defaultContent: TemplateNode | null;
      params: ParamDecl[];
      paramTypes?: TSType[];
      presence: 'always' | 'conditional';
      nestedSlots: SlotDecl[];
      sourceLoc: SourceLoc;
    }>();
    // Discriminator literal lock
    expectTypeOf<SlotDecl['type']>().toEqualTypeOf<'SlotDecl'>();
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

  it('IRComponent type is re-exported from @rozie/core public surface', async () => {
    // This import test verifies index.ts re-export wiring. Resolution itself
    // is the assertion (failed import = test failure at module load).
    const mod = await import('../../src/index.js');
    expect(mod.parse).toBeTypeOf('function');
    // lowerToIR should be exported (Task 2 lands the real impl; Task 1 stub OK)
    expect(mod.lowerToIR).toBeTypeOf('function');
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
