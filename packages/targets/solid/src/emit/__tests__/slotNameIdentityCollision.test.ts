/**
 * slotNameIdentityCollision.test.ts — Phase 79 Plan 12 Task 0b (Solid).
 *
 * See the React sibling file for the full bug-class background. This probe
 * asks the SAME question of Solid: does a producer declaring MORE THAN ONE
 * dynamic-name slot expose a `findSlotDecl`-by-name collision, where the
 * FIRST `''`-named `SlotDecl` gets consulted for a decision that should be
 * scoped to the invocation actually being emitted?
 *
 * ============================================================================
 * PROBE OUTCOME: NOT REPRODUCED
 * ============================================================================
 *
 * Solid's dynamic-name branch (`emitSlotInvocation.ts`'s `node.dynamicNameExpr
 * !== undefined` guard, added by 79-10 as a structurally NEW branch — Solid's
 * genuine default-slot path has no merge concept at all) never calls
 * `findSlotDecl` and never reads `slot.params`. It branches purely on
 * `node.args.length` — the INVOCATION's own argument list — for both the
 * record key AND the params decision. There is no `slot` variable in scope
 * for this branch at all. Two dynamic-name slots with differing param arity
 * (one with `:value`, one without) each independently and correctly reflect
 * their OWN arity, proven below. No production file is modified for this
 * task on Solid.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitSolid } from '../../emitSolid.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) {
    throw new Error(`parse failed: ${JSON.stringify(result.diagnostics)}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) {
    throw new Error(`lower failed: ${JSON.stringify(lowered.diagnostics)}`);
  }
  return lowered.ir;
}

// Two independent dynamic-name slots with DIFFERING param arity — the first
// declares a scope param (`:value`), the second declares none. If Solid's
// dispatch consulted `findSlotDecl('', ir)` (always returning the FIRST ''
// match) the way React's pre-fix code did, the second slot would either be
// force-called with a param object it never declared, or the first slot's
// param would be silently dropped.
const MIXED_ARITY_SRC = `<rozie name="MixedAritySolid">
<data>
{ a: 'x', b: 'y' }
</data>
<template>
<div>
  <slot :name="$data.a" :value="1"></slot>
  <slot :name="$data.b"></slot>
</div>
</template>
</rozie>`;

const MIXED_ARITY_REVERSED_SRC = `<rozie name="MixedAritySolidRev">
<data>
{ a: 'x', b: 'y' }
</data>
<template>
<div>
  <slot :name="$data.a"></slot>
  <slot :name="$data.b" :value="1"></slot>
</div>
</template>
</rozie>`;

describe('Solid .name-keyed identity collision probe — multi-dynamic-slot (Phase 79 Plan 12 Task 0b)', () => {
  it('NOT REPRODUCED: a zero-param dynamic slot AFTER a with-params dynamic slot still calls zero-arg', () => {
    const ir = lowerInline(MIXED_ARITY_SRC);
    const { code } = emitSolid(ir, { filename: 'MixedAritySolid.rozie' });
    // The first (params) slot correctly receives its param object.
    expect(code).toContain('_props.slots?.[a()]?.({ value: 1 })');
    // The second (zero-param) slot is NOT forced into a `?.({})` call just
    // because the first '' decl in ir.slots happens to have params.
    expect(code).toContain('_props.slots?.[b()]?.()');
    expect(code).not.toContain('_props.slots?.[b()]?.({})');
  });

  it('NOT REPRODUCED: a with-params dynamic slot AFTER a zero-param dynamic slot still receives its own param', () => {
    const ir = lowerInline(MIXED_ARITY_REVERSED_SRC);
    const { code } = emitSolid(ir, { filename: 'MixedAritySolidRev.rozie' });
    // The first (zero-param) slot is unaffected.
    expect(code).toContain('_props.slots?.[a()]?.()');
    // The second slot's OWN param is not silently dropped just because the
    // first '' decl in ir.slots happens to have zero params.
    expect(code).toContain('_props.slots?.[b()]?.({ value: 1 })');
  });
});
