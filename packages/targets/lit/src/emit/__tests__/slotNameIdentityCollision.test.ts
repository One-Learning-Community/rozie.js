/**
 * slotNameIdentityCollision.test.ts — Phase 79 Plan 08 Tasks 1 & 2.
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
 * behaviour rather than hand-construct an IRComponent.
 *
 * ============================================================================
 * TASK 1 PROBE OUTCOME (recorded BEFORE any fix): CONFIRMED (both)
 * ============================================================================
 *
 * Probe assertion A (pre-fix observation): a producer with two scoped
 * dynamic-name slots carrying DIFFERENT non-empty `namePrefix` values
 * ('cell-' and 'row-') emitted exactly ONE `@state() private _hasSlot`
 * presence-tracking member, not two — the second dynamic family's
 * presence-tracking fields (and its slotchange wiring) were silently
 * dropped by the `seenSlotNames` dedup, because both SlotDecls carried
 * `name === ''` and `slotFieldSuffix('')` folded both to the identical
 * `Default` suffix.
 *
 * Probe assertion B (pre-fix observation): a producer with one dynamic-name
 * slot PLUS a genuine default `<slot>` (both `name === ''`) tripped
 * `shouldDistributeSlots` (it returned `true`), forcing manual
 * slot-assignment mode even though nothing about the component
 * structurally needed it (no `r-for` nesting, no genuinely repeated static
 * name).
 *
 * Disposition: Task 2 was NOT skipped. `slotIdentityKey.ts` now replaces the
 * bare-`.name` key at both call sites with a disambiguator derived from
 * `namePrefix` (or declaration ordinal when no prefix is derivable), and
 * `slotFieldSuffix` is re-derived from that same identity so the two
 * dynamic families mint distinct class-member identifiers. The two probe
 * assertions below are now INVERTED to assert the FIXED behaviour — the
 * pre-fix observation is preserved verbatim above so the record of what was
 * broken survives.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../../emitLit.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = resolve(HERE, '../../../../../../examples');

function compileToLit(source: string, filename: string): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error(`parse() returned null for ${filename}`);
  const registry = createDefaultRegistry();
  const { ir } = lowerToIR(ast, { modifierRegistry: registry });
  if (!ir) throw new Error(`lowerToIR() returned null for ${filename}`);
  const { code } = emitLit(ir, { filename, source, modifierRegistry: registry });
  return code;
}

function compileExample(name: string): string {
  const path = resolve(EXAMPLES, `${name}.rozie`);
  return compileToLit(readFileSync(path, 'utf8'), `${name}.rozie`);
}

// Probe A / Behaviour 1 fixture: two scoped dynamic-name slots with
// DIFFERENT non-empty namePrefix values. Neither `:name` constant-folds
// (both have interpolation mid-template-literal), so both SlotDecls carry
// `name === ''` per 79-06's confirmed A1 resolution, while `namePrefix`
// diverges ('cell-' vs 'row-').
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

// Probe B / Behaviour 3 fixture: one dynamic-name slot plus a genuine
// default <slot>. Both carry `name === ''` — the dynamic slot because it
// never constant-folds, the default slot because that IS its authored
// identity.
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

// Behaviour 2 fixture: two dynamic-name slots whose `:name` is a bare
// member expression (not a TemplateLiteral at all), so NEITHER derives a
// `namePrefix` (ROZ094's no-static-prefix warning case). Both are still
// disambiguated — by declaration ordinal, not by `namePrefix`.
const TWO_NO_PREFIX_DYNAMIC_SRC = `<rozie name="TwoNoPrefixDynamic">
<data>
{ a: 'x', b: 'y' }
</data>
<template>
<div>
  <slot :name="$data.a" :value="$data.a">
    <span>{{ $data.a }}</span>
  </slot>
  <slot :name="$data.b" :value="$data.b">
    <span>{{ $data.b }}</span>
  </slot>
</div>
</template>
</rozie>`;

// Behaviour 4 fixture: two genuinely same-named STATIC slots — the
// pre-existing dedup/gate behaviour this collision fix must NOT disturb.
const TWO_SAME_NAMED_STATIC_SRC = `<rozie name="DuplicateNamedSlots">
<template>
<div>
  <header><slot name="x"></slot></header>
  <footer><slot name="x"></slot></footer>
</div>
</template>
</rozie>`;

describe('Lit .name-keyed identity collision — compile probe + fix (Phase 79 Plan 08)', () => {
  it('PROBE A [FIXED]: two dynamic-name families with distinct namePrefix each get their own presence-tracking member, with distinct identifiers', () => {
    const code = compileToLit(TWO_DYNAMIC_FAMILIES_SRC, 'TwoDynamicFamilies.rozie');
    const hasSlotMembers = code.match(/@state\(\) private _hasSlot(\w+)/g) ?? [];
    // FIXED: 2, not 1 (see pre-fix observation above).
    expect(hasSlotMembers.length).toBe(2);
    const identifiers = new Set(hasSlotMembers);
    expect(identifiers.size).toBe(2);
    expect(code).toContain('_hasSlotDynamicCell');
    expect(code).toContain('_hasSlotDynamicRow');
  });

  it('Behaviour 2: two no-prefix dynamic-name slots are disambiguated by declaration ordinal', () => {
    const code = compileToLit(TWO_NO_PREFIX_DYNAMIC_SRC, 'TwoNoPrefixDynamic.rozie');
    const hasSlotMembers = code.match(/@state\(\) private _hasSlot(\w+)/g) ?? [];
    expect(hasSlotMembers.length).toBe(2);
    expect(code).toContain('_hasSlotDynamic0');
    expect(code).toContain('_hasSlotDynamic1');
  });

  it('PROBE B [FIXED]: one dynamic-name slot plus a genuine default slot does NOT spuriously trip shouldDistributeSlots', () => {
    const code = compileToLit(DYNAMIC_PLUS_DEFAULT_SRC, 'DynamicPlusDefault.rozie');
    // FIXED: the gate stays closed (see pre-fix observation above, where it
    // returned true and forced manual slot assignment).
    expect(code).not.toContain('slotAssignment');
    expect(code).not.toContain('RozieSlotDistributor');
    expect(code).not.toContain('static shadowRootOptions');
  });

  it('Behaviour 4: two genuinely same-named static slots still dedupe to ONE member and still trip the distribute gate', () => {
    const code = compileToLit(TWO_SAME_NAMED_STATIC_SRC, 'DuplicateNamedSlots.rozie');
    const hasSlotMembers = code.match(/@state\(\) private _hasSlot(\w+)/g) ?? [];
    expect(hasSlotMembers.length).toBe(1);
    expect(code).toContain('static shadowRootOptions');
    expect(code).toContain("slotAssignment: 'manual'");
    expect(code).toContain('new RozieSlotDistributor(this)');
  });

  it('Behaviour 5: a component with only static slots is unaffected by the identity-key change (AC-1)', () => {
    // examples/Card.rozie: a single non-duplicated, non-looped, non-dynamic
    // slot. Structural negative control mirroring slotDistributor.test.ts's
    // existing byte-identity control for the SAME fixture — the gate stays
    // closed and the slot gets exactly one presence-tracking member keyed
    // on its bare static name, exactly as before this plan.
    const code = compileExample('Card');
    const hasSlotMembers = code.match(/@state\(\) private _hasSlot(\w+)/g) ?? [];
    expect(hasSlotMembers.length).toBe(1);
    expect(code).not.toContain('Dynamic');
    expect(code).not.toContain('slotAssignment');
    expect(code).not.toContain('RozieSlotDistributor');
  });
});

// ============================================================================
// Task 3: the `rozieSlots` record property — emitted EXACTLY ONCE per
// component, when any slot is scoped, portal, or dynamically named.
// ============================================================================

const SCOPED_SLOT_ONLY_SRC = `<rozie name="ScopedSlotOnly">
<template>
<div>
  <slot :value="1">
    <span>fallback</span>
  </slot>
</div>
</template>
</rozie>`;

const PORTAL_SLOT_ONLY_SRC = `<rozie name="PortalSlotOnly">
<template>
<div>
  <slot name="row" portal :params="['item']" />
</div>
</template>
</rozie>`;

const SEVERAL_SLOT_KINDS_SRC = `<rozie name="SeveralSlotKinds">
<props>
{ a: { type: String, default: '' } }
</props>
<template>
<div>
  <slot :value="1"><span>scoped fallback</span></slot>
  <slot name="row" portal :params="['item']" />
  <slot :name="\`cell-\${$props.a}\`" :value="$props.a"><span>{{ $props.a }}</span></slot>
</div>
</template>
</rozie>`;

function countRozieSlotsDeclarations(code: string): number {
  return (code.match(/@property\(\{ attribute: false \}\) rozieSlots\?:/g) ?? []).length;
}

describe('Lit rozieSlots record property — exactly once per qualifying component (Phase 79 Plan 08 Task 3)', () => {
  it('a component with at least one SCOPED slot emits exactly one rozieSlots declaration', () => {
    const code = compileToLit(SCOPED_SLOT_ONLY_SRC, 'ScopedSlotOnly.rozie');
    expect(countRozieSlotsDeclarations(code)).toBe(1);
  });

  it('a component with at least one PORTAL slot emits exactly one rozieSlots declaration', () => {
    const code = compileToLit(PORTAL_SLOT_ONLY_SRC, 'PortalSlotOnly.rozie');
    expect(countRozieSlotsDeclarations(code)).toBe(1);
  });

  it('a component with at least one DYNAMICALLY-NAMED slot emits exactly one rozieSlots declaration', () => {
    const code = compileToLit(DYNAMIC_PLUS_DEFAULT_SRC, 'DynamicPlusDefault.rozie');
    expect(countRozieSlotsDeclarations(code)).toBe(1);
  });

  it('a component with SEVERAL qualifying slots at once still emits exactly one rozieSlots declaration (per-component, not per-slot)', () => {
    const code = compileToLit(SEVERAL_SLOT_KINDS_SRC, 'SeveralSlotKinds.rozie');
    expect(countRozieSlotsDeclarations(code)).toBe(1);
  });

  it('a component with NONE of those (only static, paramless, non-portal slots) emits ZERO rozieSlots declarations, and its full output is byte-identical to pre-phase', () => {
    const code = compileExample('Card');
    expect(countRozieSlotsDeclarations(code)).toBe(0);
    expect(code).not.toContain('rozieSlots');
    // Full string equality against the checked-in pre-Phase-79 dist-parity
    // fixture — the actual byte-identical baseline, not an approximation.
    const expected = readFileSync(
      resolve(HERE, '../../../../../../tests/dist-parity/fixtures/Card.lit.ts'),
      'utf8',
    );
    expect(code).toBe(expected);
  });

  it('the declaration disables attribute deserialization and types the field as an optional record from string to a scope-taking function returning unknown', () => {
    const code = compileToLit(SCOPED_SLOT_ONLY_SRC, 'ScopedSlotOnly.rozie');
    expect(code).toContain(
      '@property({ attribute: false }) rozieSlots?: Record<string, (scope: any) => unknown>;',
    );
  });
});
