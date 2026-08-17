/**
 * slotNameIdentityCollision.test.ts — Phase 79 Plan 12 Task 0b (React).
 *
 * 79-10's Known Gaps flagged, at "theoretical (no existing fixture exposes
 * it)" confidence: React/Solid's `findSlotDecl(name, ir)` in
 * `emitSlotInvocation.ts` returns the FIRST `SlotDecl` whose `.name` matches —
 * and every dynamic-name slot on a producer shares the identical `''` sentinel
 * (79-06's Assumption A1), so a producer declaring MORE THAN ONE dynamic-name
 * slot risks `findSlotDecl('', ir)` always resolving to the FIRST one,
 * regardless of which invocation is actually being emitted.
 *
 * This bug class has since been CONFIRMED on two of four record-capable
 * targets after being probed exactly this way — Lit (`slotIdentityKey.ts`,
 * 79-08) and Svelte (`dynamicSlotOrdinal.ts`, 79-10). This file performs the
 * SAME probe against React's real compile path, per this plan's explicit
 * "probe first, fix only on reproduction" instruction.
 *
 * The KEY lookup itself (which record entry to READ at runtime) was already
 * fixed in 79-10 by sourcing the key from the INVOCATION node's own
 * `dynamicNameExpr` — so `props.slots?.[expr]` always reads the right value.
 * The bug this probe exposes is narrower and purely COMPILE-TIME:
 * `findSlotDecl` is also consulted for `hasParams` (which CALL SHAPE to
 * emit — zero-arg vs. with an argument object) — a wrong pick silently
 * drops or fabricates a params object at the render site, even though the
 * runtime key itself stays correct. (`SlotDecl.defaultContent` is always
 * `null` in the current lowering pipeline per `lowerSlots.ts` — "lifted
 * SEPARATELY" — so the analogous `defaultLifting`/`defaultFnName` mis-pick is
 * currently DEAD CODE for every real fixture; the invocation-side
 * `node.fallback` path, proven correct by the first test below, is what
 * actually renders declaration fallback content today.)
 *
 * ============================================================================
 * PROBE OUTCOME: CONFIRMED
 * ============================================================================
 *
 * Two independent dynamic-name slots with DIFFERING param arity: the
 * `hasParams` decision — sourced from `findSlotDecl('', ir)`, which always
 * returns the FIRST `''`-named SlotDecl — is shared by BOTH invocations
 * regardless of which slot is actually being emitted. Concretely (verified
 * empirically pre-fix):
 *   - a with-params slot declared BEFORE a zero-param slot forces the
 *     zero-param slot to be called with a param object it never declared
 *     (`?.({})` instead of `?.()`);
 *   - a zero-param slot declared BEFORE a with-params slot silently drops
 *     the with-params slot's own argument object entirely (called with NO
 *     arguments even though the invocation supplies one).
 * Fixed by reusing Svelte's `dynamicSlotOrdinal.ts` reasoning (79-10) — the
 * closer analog of the two existing precedents, because React's
 * `findSlotDecl` operates at the SAME per-invocation call site Svelte's
 * ordinal lookup does (matching a declaration from an invocation via
 * rewritten-expression TEXT comparison), unlike Lit's `slotIdentityKey.ts`,
 * which solves a DIFFERENT problem (declaration-time CLASS-MEMBER dedup, not
 * a per-invocation declaration lookup).
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../../emitReact.js';
import type { IRComponent } from '../../../../../core/src/ir/types.js';

/**
 * Recursive walker collecting the `sourceLoc.start` of every
 * `TemplateSlotInvocation` node carrying a `dynamicNameExpr`. Modelled on
 * `findFiller` in
 * `packages/targets/svelte/src/__tests__/slotDynamicNameRouting.test.ts`.
 */
function collectDynamicInvocationLocStarts(node: unknown, out: number[]): void {
  if (node === null || typeof node !== 'object') return;
  const n = node as {
    type?: string;
    dynamicNameExpr?: unknown;
    sourceLoc?: { start: number };
    children?: unknown[];
  };
  if (n.type === 'TemplateSlotInvocation' && n.dynamicNameExpr !== undefined && n.sourceLoc) {
    out.push(n.sourceLoc.start);
  }
  if (Array.isArray(n.children)) {
    for (const c of n.children) collectDynamicInvocationLocStarts(c, out);
  }
}

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

// Two independent dynamic-name slots, zero params each, with DISTINCT static
// text fallback content — isolates the invocation-side FALLBACK path (already
// correctly sourced per-invocation via `node.fallback`, never via `slot`)
// from the `hasParams` defect probed below.
const TWO_DYNAMIC_FALLBACKS_SRC = `<rozie name="TwoDynamicFallbacks">
<data>
{ a: 'x', b: 'y' }
</data>
<template>
<div>
  <slot :name="$data.a">AAA-FALLBACK</slot>
  <slot :name="$data.b">BBB-FALLBACK</slot>
</div>
</template>
</rozie>`;

// First slot HAS a param, second slot has NONE — the with-params slot is
// declared FIRST, so `findSlotDecl('', ir)` (pre-fix) always resolves to IT.
const MIXED_ARITY_SRC = `<rozie name="MixedArity">
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

// Reversed order — the ZERO-param slot is declared FIRST.
const MIXED_ARITY_REVERSED_SRC = `<rozie name="MixedArityRev">
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

describe('React .name-keyed identity collision probe — multi-dynamic-slot (Phase 79 Plan 12 Task 0b)', () => {
  it("two dynamic-name slots each render their OWN declaration-side fallback, not the first slot's", () => {
    const ir = lowerInline(TWO_DYNAMIC_FALLBACKS_SRC);
    const { code } = emitReact(ir, { filename: 'TwoDynamicFallbacks.rozie' });
    // Both runtime expressions must appear (the 79-10 key fix already proven).
    expect(code).toContain('props.slots?.[a]');
    expect(code).toContain('props.slots?.[b]');
    // Each slot's OWN fallback text must appear, associated with its OWN key.
    expect(code).toContain('AAA-FALLBACK');
    expect(code).toContain('BBB-FALLBACK');
  });

  it('a zero-param dynamic slot declared AFTER a with-params dynamic slot is called with NO arguments, not `({})`', () => {
    const ir = lowerInline(MIXED_ARITY_SRC);
    const { code } = emitReact(ir, { filename: 'MixedArity.rozie' });
    // The with-params slot ('a') correctly receives its own param object.
    expect(code).toContain('(props.slots?.[a] as Function)({ value: 1 })');
    // The zero-param slot ('b') must be called with NO args — it must NOT be
    // forced into a param-object call just because 'a' (the FIRST '' decl in
    // ir.slots) happens to declare a param.
    expect(code).toContain('(props.slots?.[b] as Function)()');
    expect(code).not.toContain('(props.slots?.[b] as Function)({})');
  });

  it('a with-params dynamic slot declared AFTER a zero-param dynamic slot still receives its own param object', () => {
    const ir = lowerInline(MIXED_ARITY_REVERSED_SRC);
    const { code } = emitReact(ir, { filename: 'MixedArityRev.rozie' });
    // The zero-param slot ('a') is unaffected.
    expect(code).toContain('(props.slots?.[a] as Function)()');
    // The with-params slot ('b')'s OWN param must NOT be silently dropped
    // just because 'a' (the FIRST '' decl in ir.slots) has zero params.
    expect(code).toContain('(props.slots?.[b] as Function)({ value: 1 })');
  });
});

// Two independent dynamic-name slots binding the IDENTICAL source expression
// (`$data.col.key`) — the collision `dynamicNameExpr`-rewritten-TEXT
// disambiguation cannot resolve (WR-01, phase-79 code-review finding). Models
// a data table's per-column header/footer slots. With-params declared FIRST.
const IDENTICAL_EXPR_SRC = `<rozie name="IdenticalExprSlots">
<data>
{ col: { key: 'k' } }
</data>
<template>
<div>
  <slot :name="$data.col.key" :value="1"></slot>
  <slot :name="$data.col.key"></slot>
</div>
</template>
</rozie>`;

// Reversed order — the zero-param declaration comes FIRST.
const IDENTICAL_EXPR_REVERSED_SRC = `<rozie name="IdenticalExprSlotsRev">
<data>
{ col: { key: 'k' } }
</data>
<template>
<div>
  <slot :name="$data.col.key"></slot>
  <slot :name="$data.col.key" :value="1"></slot>
</div>
</template>
</rozie>`;

describe('React sourceLoc identity — IDENTICAL dynamicNameExpr text on two declarations (WR-01)', () => {
  it('with-params declared first: the second (zero-param) declaration still emits a zero-argument call, not `({})`', () => {
    const ir = lowerInline(IDENTICAL_EXPR_SRC);
    const { code } = emitReact(ir, { filename: 'IdenticalExprSlots.rozie' });
    // Both invocations share the identical runtime key text `col.key` and the
    // identical `props.slots?.[col.key]` prefix, so distinguish by counting
    // occurrences of each call SHAPE rather than a bare toContain.
    const paramCallCount = (code.match(/\(props\.slots\?\.\[col\.key\] as Function\)\(\{ value: 1 \}\)/g) ?? [])
      .length;
    const zeroArgCallCount = (code.match(/\(props\.slots\?\.\[col\.key\] as Function\)\(\)/g) ?? []).length;
    expect(paramCallCount).toBe(1);
    expect(zeroArgCallCount).toBe(1);
  });

  it('zero-param declared first: the with-params declaration (declared second) still receives its own param object', () => {
    const ir = lowerInline(IDENTICAL_EXPR_REVERSED_SRC);
    const { code } = emitReact(ir, { filename: 'IdenticalExprSlotsRev.rozie' });
    const paramCallCount = (code.match(/\(props\.slots\?\.\[col\.key\] as Function\)\(\{ value: 1 \}\)/g) ?? [])
      .length;
    const zeroArgCallCount = (code.match(/\(props\.slots\?\.\[col\.key\] as Function\)\(\)/g) ?? []).length;
    expect(paramCallCount).toBe(1);
    expect(zeroArgCallCount).toBe(1);
  });

  it('identity precondition: dynamic-name SlotDecl.sourceLoc.start values equal the set of dynamic TemplateSlotInvocation sourceLoc.start values, all distinct', () => {
    const ir = lowerInline(IDENTICAL_EXPR_SRC);
    const declLocs = ir.slots
      .filter((s) => s.dynamicNameExpr !== undefined)
      .map((s) => s.sourceLoc.start)
      .sort((a, b) => a - b);
    const invocationLocs: number[] = [];
    collectDynamicInvocationLocStarts(ir.template, invocationLocs);
    invocationLocs.sort((a, b) => a - b);
    expect(declLocs.length).toBe(2);
    expect(new Set(declLocs).size).toBe(declLocs.length);
    expect(invocationLocs).toEqual(declLocs);
  });
});
