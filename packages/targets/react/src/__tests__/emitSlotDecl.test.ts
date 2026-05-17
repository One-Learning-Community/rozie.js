/**
 * Plan 04-03 Task 2 — emitSlotDecl + refineSlotTypes behaviour tests.
 *
 * Phase 07.3.2 Plan 04 SC#4 appendix at bottom of file — §invoke-named-slot
 * describe block locking the WrapperModal re-projection root-cause fix
 * (refineSlotTypes alignment with emitTypes.ts:152 + emitSlotInvocation
 * no-params named-slot `?.()` invocation) and the Plan 01 + Plan 04
 * composition contract `(props.renderX ?? props.slots?.['x'])?.()`.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../core/src/parse.js';
import { lowerToIR } from '../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../emitReact.js';
import { emitSlotDecl } from '../emit/emitSlotDecl.js';
import { refineSlotTypes } from '../emit/refineSlotTypes.js';
import type { IRComponent, SlotDecl } from '../../../../core/src/ir/types.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

describe('refineSlotTypes — Plan 04-03 Task 2', () => {
  it('default slot, no params → propFieldName: children, propFieldType: ReactNode', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('children');
    expect(refined.propFieldType).toBe('ReactNode');
    expect(refined.ctxInterface).toBe(null);
    expect(refined.defaultLifting).toBe('none');
  });

  it('default slot WITH params → union ReactNode | ((ctx: ChildrenCtx) => ReactNode)', () => {
    // dropdown-react-default-slot bugfix (2026-05-15): the default slot with
    // params is a dual-shape union so consumers that pass ordinary JSX
    // children (e.g. DropdownDemo.rozie) typecheck alongside render-prop
    // consumers. The runtime call site discriminates by typeof === 'function'.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'item', valueExpression: { type: 'Identifier', name: 'item' } as never, sourceLoc: { start: 0, end: 0 } },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('children');
    expect(refined.propFieldType).toBe('ReactNode | ((ctx: ChildrenCtx) => ReactNode)');
    expect(refined.ctxInterface).toMatch(/interface ChildrenCtx \{ item: any; \}/);
  });

  it('named slot, no params → propFieldName: render<Pascal>, propFieldType: () => ReactNode (Phase 07.3.2 fix — aligns with emitTypes.ts:152 public .d.ts)', () => {
    // Phase 07.3.2 SC#4 WrapperModal re-projection root cause was bare
    // `ReactNode` here vs `() => ReactNode` in emitTypes.ts:152 (.d.ts).
    // Consumer-side emitSlotFiller.ts:126 always wraps body in an arrow;
    // producer must declare the function shape so it knows to invoke.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'header',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderHeader');
    expect(refined.propFieldType).toBe('() => ReactNode');
  });

  it('named slot WITH params → renderTrigger?: (ctx: TriggerCtx) => ReactNode + interface', () => {
    // Named slots stay strict-function-only: consumers reach for renderTrigger={…}
    // deliberately so there's no ambiguity to bridge at the runtime call site.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'open', valueExpression: { type: 'Identifier', name: 'open' } as never, sourceLoc: { start: 0, end: 0 } },
        { type: 'ParamDecl', name: 'toggle', valueExpression: { type: 'Identifier', name: 'toggle' } as never, sourceLoc: { start: 0, end: 0 } },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderTrigger');
    expect(refined.propFieldType).toBe('(ctx: TriggerCtx) => ReactNode');
    expect(refined.ctxInterface).toMatch(/interface TriggerCtx \{ open: any; toggle: any; \}/);
  });
});

describe('emitSlotDecl — Plan 04-03 Task 2', () => {
  it('Modal: 2 named slots (header, footer) → 2 prop fields, no ctx interfaces (no params)', () => {
    const ir = lowerInline(`
<rozie name="X">
<template>
<div>
  <header><slot name="header"></slot></header>
  <footer><slot name="footer"></slot></footer>
</div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.slotPropFields.length).toBe(2);
    expect(result.slotPropFields.some((s) => s.includes('renderHeader'))).toBe(true);
    expect(result.slotPropFields.some((s) => s.includes('renderFooter'))).toBe(true);
    expect(result.slotCtxInterfaces.length).toBe(0);
  });

  it('Dropdown trigger: named slot WITH params → renderTrigger field + TriggerCtx interface', () => {
    const ir = lowerInline(`
<rozie name="X">
<props>{ open: { type: Boolean, default: false } }</props>
<script>const toggle = () => {}</script>
<template>
<div><slot name="trigger" :open="$props.open" :toggle="toggle"></slot></div>
</template>
</rozie>
`);
    const result = emitSlotDecl(ir);
    expect(result.slotPropFields.some((s) => s.includes('renderTrigger?: (ctx: TriggerCtx) => ReactNode'))).toBe(true);
    expect(result.slotCtxInterfaces.some((s) => /interface TriggerCtx \{ open: any; toggle: any; \}/.test(s))).toBe(true);
  });
});

describe('refineSlotTypes / emitSlotInvocation — §invoke-named-slot (Phase 07.3.2 SC#4 WrapperModal re-projection root cause)', () => {
  // SC#4 root cause was a divergence between two emission sites that BOTH
  // describe the same slot field:
  //   - refineSlotTypes.ts:108 returned propFieldType: 'ReactNode' for
  //     no-params named slots (used for the inline TSX Props interface).
  //   - emitTypes.ts:152 declared the same field as `() => ReactNode` in
  //     the public .d.ts.
  // Consumer-side emitSlotFiller.ts:126 ALWAYS wraps slot bodies in an
  // arrow (`renderHeader={() => (<>...</>)}`), and the producer-side
  // invocation at emitSlotInvocation.ts:279-303 rendered the function
  // reference directly as a React child — triggering React "Functions are
  // not valid as a React child" (dev) or silent no-op (production). The
  // WrapperModal Modal 3 dogfood made this user-visible because its
  // #brand/#actions slot fills are no-params named slots.
  //
  // Plan 04 closed the divergence by aligning refineSlotTypes with the
  // .d.ts shape AND switching emitSlotInvocation no-params named-slot
  // path to INVOKE via `?.()`. Composition with Plan 01's merged fieldRef
  // is `(props.renderBrand ?? props.slots?.['brand'])?.()` — valid JS.

  it('refineSlotTypes returns `() => ReactNode` for no-params named slot (aligns with emitTypes.ts:152 public .d.ts)', () => {
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'brand',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderBrand');
    expect(refined.propFieldType).toBe('() => ReactNode');
    expect(refined.ctxInterface).toBe(null);
  });

  it('refineSlotTypes still returns bare `ReactNode` for default slot (Pattern 2 is named-slot-only — React magic-prop overlap)', () => {
    // The default slot keeps the bare `ReactNode` shape because it
    // overlaps with React's built-in `children` prop semantics — consumers
    // expect to pass `<X>jsx children</X>` directly and have it render
    // verbatim. The Pattern 2 alignment in refineSlotTypes.ts:105-128
    // explicitly targets ONLY the `if (!isDefault && !hasParams)` branch.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: '',
      defaultContent: null,
      params: [],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('children');
    expect(refined.propFieldType).toBe('ReactNode');
  });

  it('refineSlotTypes still returns `(ctx: <Name>Ctx) => ReactNode` for with-params named slot (no regression — strict render-prop)', () => {
    // Named slot WITH params is the strict render-prop shape — consumers
    // explicitly opt in by writing `renderTrigger={({ open }) => …}`.
    // Plan 04 does NOT touch this branch.
    const slot: SlotDecl = {
      type: 'SlotDecl',
      name: 'trigger',
      defaultContent: null,
      params: [
        { type: 'ParamDecl', name: 'open', valueExpression: { type: 'Identifier', name: 'open' } as never, sourceLoc: { start: 0, end: 0 } },
      ],
      presence: 'always',
      nestedSlots: [],
      sourceLoc: { start: 0, end: 0 },
    };
    const refined = refineSlotTypes(slot);
    expect(refined.propFieldName).toBe('renderTrigger');
    expect(refined.propFieldType).toBe('(ctx: TriggerCtx) => ReactNode');
  });

  it('emitSlotInvocation no-params named slot emits `?.()` invocation (mirrors with-params at L301-309)', () => {
    // Verify the emit shape end-to-end by running a no-params named slot
    // through the full emitter pipeline. The fallback-less branch returns
    // `{${fieldRef}?.()}` (bare invocation); the conditional branches
    // return `{${fieldRef} ? ${fieldRef}() : ${fallback}}`. Both forms
    // INVOKE the function — fixing the SC#4 silent-fail.
    const ir = lowerInline(`
<rozie name="X">
<template>
<div><slot name="header"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'X.rozie' });
    // The composed shape: merge + invocation. The parenthesised merge
    // expression `(a ?? b)` from Plan 01 wraps cleanly inside the
    // `?.()` invocation from Plan 04 — `(a ?? b)?.()` is valid JS.
    expect(code).toContain("(props.renderHeader ?? props.slots?.['header'])?.()");
  });

  it('emit composition with Plan 01 merge: WrapperModal-style brand-slot produces `(props.renderBrand ?? props.slots?.[\\\'brand\\\'])?.()` (locks cross-plan contract)', () => {
    // This test runs a WrapperModal-shaped IR (no-params named #brand slot
    // re-projected through a wrapper) through the full emitter pipeline
    // and asserts the exact composed emit string contains BOTH the Plan 01
    // merge AND the Plan 04 invocation. This locks the cross-plan
    // composition contract — if a future change in EITHER plan breaks
    // the composition, this test fails immediately.
    const ir = lowerInline(`
<rozie name="WrapperModalLike">
<template>
<div><slot name="brand"></slot></div>
</template>
</rozie>
`);
    const { code } = emitReact(ir, { filename: 'WrapperModalLike.rozie' });
    // Plan 01 merge + Plan 04 invoke — both shapes layered.
    expect(code).toContain("(props.renderBrand ?? props.slots?.['brand'])?.()");
    // Pattern 2 alignment — inline TSX Props interface declares the
    // function shape.
    expect(code).toMatch(/renderBrand\?: \(\) => ReactNode/);
  });
});
