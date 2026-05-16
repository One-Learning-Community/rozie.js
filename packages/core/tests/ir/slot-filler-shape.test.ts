// Phase 07.2 Plan 01 Task 2 — SlotFillerDecl shape lock + TemplateSlotInvocationIR
// `context` field lock + ROZ940..ROZ947 code registration smoke.
//
// Mirrors `slot-shape.test.ts` (Plan 02-05 / D-18) for SlotDecl. SlotFillerDecl
// is the consumer-side sibling shape introduced by Phase 07.2; locking the
// runtime JSON shape + the compile-time type surface here keeps the IR contract
// stable so Wave-1 per-target emitters can consume the new field without drift.
//
// Per Phase 07.1 / MODX-01 self-reference pattern (the cross-package type
// identity fix), this test imports the type via the published `@rozie/core`
// barrel — NOT via a relative path into `../../src/ir/types.js`. If the barrel
// re-export at `packages/core/src/index.ts` ever drops `SlotFillerDecl`, this
// test file fails to type-check, surfacing the regression at the CI gate.
import { describe, it, expect, expectTypeOf } from 'vitest';
import type { TSType, Expression } from '@babel/types';
import type {
  SlotFillerDecl,
  ParamDecl,
  IRTemplateNode as TemplateNode,
  TemplateSlotInvocationIR,
} from '@rozie/core';
import type { SourceLoc } from '../../src/ast/types.js';

describe('SlotFillerDecl shape lock — Phase 07.2 Plan 01 Task 2 (R2 acceptance)', () => {
  it('SlotFillerDecl runtime shape lock: hand-authored canonical snapshot at fixtures/ir/SlotFillerDecl-shape.snap', async () => {
    const canonical: SlotFillerDecl = {
      type: 'SlotFillerDecl',
      name: 'header',
      params: [],
      // paramTypes intentionally omitted (optional, threaded later by IR cache)
      body: [],
      sourceLoc: { start: 100, end: 200 },
      // isDynamic / dynamicNameExpr intentionally omitted (optional)
    };
    await expect(JSON.stringify(canonical, null, 2)).toMatchFileSnapshot(
      '../../fixtures/ir/SlotFillerDecl-shape.snap',
    );
  });

  it('SlotFillerDecl type-level lock: required field set is exactly { type, name, params, paramTypes?, body, sourceLoc, isDynamic?, dynamicNameExpr? }', () => {
    expectTypeOf<SlotFillerDecl>().toMatchTypeOf<{
      type: 'SlotFillerDecl';
      name: string;
      params: ParamDecl[];
      paramTypes?: TSType[];
      body: TemplateNode[];
      sourceLoc: SourceLoc;
      isDynamic?: boolean;
      dynamicNameExpr?: Expression;
    }>();
    // Discriminator literal lock
    expectTypeOf<SlotFillerDecl['type']>().toEqualTypeOf<'SlotFillerDecl'>();
  });

  it('Default-slot sentinel: name === "" is permitted (mirrors SlotDecl D-18 convention)', () => {
    const x: SlotFillerDecl['name'] = '';
    expect(x).toBe('');
  });

  it('isDynamic and dynamicNameExpr are optional (R5 — <template #[expr]>)', () => {
    const dyn: SlotFillerDecl = {
      type: 'SlotFillerDecl',
      name: 'someName',
      params: [],
      body: [],
      sourceLoc: { start: 0, end: 0 },
      isDynamic: true,
    };
    expect(dyn.isDynamic).toBe(true);
    // Lock the optionality at the type level.
    expectTypeOf<SlotFillerDecl['isDynamic']>().toEqualTypeOf<boolean | undefined>();
  });

  it('TemplateSlotInvocationIR.context is REQUIRED and unions "declaration" | "fill-body" (D-06)', () => {
    expectTypeOf<TemplateSlotInvocationIR>().toMatchTypeOf<{
      context: 'declaration' | 'fill-body';
    }>();
    // The field is required, not optional.
    type Ctx = TemplateSlotInvocationIR['context'];
    expectTypeOf<Ctx>().toEqualTypeOf<'declaration' | 'fill-body'>();
  });

  it('SlotFillerDecl is re-exported from @rozie/core barrel (Phase 07.1 self-reference pattern)', async () => {
    // The act of `import type { SlotFillerDecl } from '@rozie/core'` succeeding
    // above is the existence proof under verbatimModuleSyntax — but verify the
    // runtime barrel is also reachable so future relative-path regressions
    // surface here too.
    const mod = await import('@rozie/core');
    expect(mod.RozieErrorCode).toBeDefined();
  });

  it('ROZ940..ROZ947 codes are registered per D-08 policy', async () => {
    const { RozieErrorCode } = await import('@rozie/core');
    expect(RozieErrorCode.DUPLICATE_DEFAULT_FILL).toBe('ROZ940');
    expect(RozieErrorCode.UNKNOWN_SLOT_NAME).toBe('ROZ941');
    expect(RozieErrorCode.DUPLICATE_NAMED_FILL).toBe('ROZ942');
    expect(RozieErrorCode.REPROJECTION_UNDECLARED_WRAPPER_SLOT).toBe('ROZ943');
    expect(RozieErrorCode.REPROJECTION_UNDECLARED_INNER_SLOT).toBe('ROZ944');
    expect(RozieErrorCode.CROSS_PACKAGE_LOOKUP_FAILED).toBe('ROZ945');
    expect(RozieErrorCode.DYNAMIC_NAME_EXPRESSION_INVALID).toBe('ROZ946');
    expect(RozieErrorCode.SCOPED_PARAM_MISMATCH).toBe('ROZ947');
  });
});
