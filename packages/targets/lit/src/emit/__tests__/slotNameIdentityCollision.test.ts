/**
 * slotNameIdentityCollision.test.ts — Phase 79 Plan 08 Task 1 (PROBE).
 *
 * 79-RESEARCH.md's Pitfall 1 predicted, at MEDIUM confidence ("logically sound
 * from confirmed source, not empirically reproduced"), that two producer-side
 * dynamic-name `<slot :name>` declarations in one component — both of which
 * carry `SlotDecl.name === ''` per 79-06's confirmed A1 resolution — would
 * collide under two Lit-only call sites that key on bare `SlotDecl.name`:
 *
 *   - `emitSlotDecl.ts:323-328`'s `seenSlotNames` dedup, which keeps only the
 *     FIRST occurrence of each distinct `.name` before emitting per-slot
 *     `@state _hasSlot<X>` / `@queryAssignedElements _slot<X>Elements` class
 *     members.
 *   - `shouldDistributeSlots.ts:41-49`'s duplicate-name gate, which forces
 *     `slotAssignment: 'manual'` (+ `RozieSlotDistributor`) whenever any
 *     `.name` value repeats across the component's (non-portal) slots.
 *
 * This file drives the REAL compile path (parse -> lowerToIR -> emitLit) —
 * per the plan's explicit instruction to measure `lowerSlots`'s actual 79-06
 * behaviour rather than hand-construct an IRComponent — and records the
 * OBSERVED outcome as explicit, exact-count assertions.
 *
 * ============================================================================
 * OBSERVED OUTCOME: CONFIRMED (both)
 * ============================================================================
 *
 * Probe assertion A: a producer with two scoped dynamic-name slots carrying
 * DIFFERENT non-empty `namePrefix` values ('cell-' and 'row-') emits exactly
 * ONE `@state() private _hasSlot` presence-tracking member, not two — the
 * second dynamic family's presence-tracking fields (and its slotchange
 * wiring) are silently dropped by the `seenSlotNames` dedup, because both
 * SlotDecls carry `name === ''` and `slotFieldSuffix('')` folds both to the
 * identical `Default` suffix.
 *
 * Probe assertion B: a producer with one dynamic-name slot PLUS a genuine
 * default `<slot>` (both `name === ''`) trips `shouldDistributeSlots` (it
 * returns `true`), forcing manual slot-assignment mode even though nothing
 * about the component structurally needs it (no `r-for` nesting, no
 * genuinely repeated static name).
 *
 * Disposition: Task 2 is NOT skipped. It implements `slotIdentityKey.ts`,
 * replacing the bare-`.name` key at both call sites with a disambiguator
 * derived from `namePrefix` (or declaration ordinal when no prefix is
 * derivable), and re-derives `slotFieldSuffix` from that same key so the two
 * dynamic families mint distinct class-member identifiers.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitLit } from '../../emitLit.js';

function compileToLit(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  const { code } = emitLit(ir, { filename, source, modifierRegistry: registry });
  return code;
}

// Probe A fixture: two scoped dynamic-name slots with DIFFERENT non-empty
// namePrefix values. Neither `:name` constant-folds (both have interpolation
// mid-template-literal), so both SlotDecls carry `name === ''` per 79-06's
// confirmed A1 resolution, while `namePrefix` diverges ('cell-' vs 'row-').
const TWO_DYNAMIC_FAMILIES_SRC = `<rozie name="TwoDynamicFamilies">
<props>
{ a: { type: String, default: '' }, b: { type: String, default: '' } }
</props>
<template>
<div>
  <slot :name="\`cell-\${$props.a}\`" :value="$props.a">
    <span>{{ $props.a }}</span>
  </slot>
  <slot :name="\`row-\${$props.b}\`" :value="$props.b">
    <span>{{ $props.b }}</span>
  </slot>
</div>
</template>
</rozie>`;

// Probe B fixture: one dynamic-name slot plus a genuine default <slot>. Both
// carry `name === ''` — the dynamic slot because it never constant-folds, the
// default slot because that IS its authored identity.
const DYNAMIC_PLUS_DEFAULT_SRC = `<rozie name="DynamicPlusDefault">
<props>
{ a: { type: String, default: '' } }
</props>
<template>
<div>
  <slot :name="\`cell-\${$props.a}\`" :value="$props.a">
    <span>{{ $props.a }}</span>
  </slot>
  <slot>
    <span>default content</span>
  </slot>
</div>
</template>
</rozie>`;

describe('Lit .name-keyed identity collision — compile probe (Phase 79 Plan 08 Task 1)', () => {
  it('PROBE A [CONFIRMED]: two dynamic-name families both carrying name === \'\' collapse to ONE presence-tracking member under emitSlotDecl\'s dedup', () => {
    const code = compileToLit(TWO_DYNAMIC_FAMILIES_SRC, 'TwoDynamicFamilies.rozie');
    const hasSlotMemberCount = (code.match(/@state\(\) private _hasSlot\w+/g) ?? []).length;
    // OBSERVED (pre-fix): 1, not 2. The two dynamic families collide on the
    // shared `name === ''` sentinel and `emitSlotDecl.ts`'s `seenSlotNames`
    // dedup keeps only the first occurrence.
    expect(hasSlotMemberCount).toBe(1);
  });

  it('PROBE B [CONFIRMED]: one dynamic-name slot plus a genuine default slot spuriously trips shouldDistributeSlots\'s duplicate-name gate', () => {
    const code = compileToLit(DYNAMIC_PLUS_DEFAULT_SRC, 'DynamicPlusDefault.rozie');
    // OBSERVED (pre-fix): true. Neither slot has `inLoop === true` and there
    // is no genuine repeated STATIC name — the gate over-fires purely because
    // both SlotDecls share the empty-string sentinel.
    expect(code).toContain('static shadowRootOptions');
    expect(code).toContain("slotAssignment: 'manual'");
    expect(code).toContain('new RozieSlotDistributor(this)');
  });
});
