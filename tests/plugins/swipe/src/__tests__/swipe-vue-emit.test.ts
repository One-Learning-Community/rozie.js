// Plan 04-06 Task 1 — MOD-05 dogfood: swipe modifier compiles via Phase 3
// emitVue WITHOUT any change to @rozie/core (the SemVer-additive inlineGuard
// extension to VueEmissionDescriptor in Plan 04-06 is itself part of the
// public surface — no compiler-internal changes are required).
//
// This is the marquee D-22b proof: a third-party modifier shipped from outside
// @rozie/core compiles correctly across BOTH Phase 3 emitVue AND Phase 4
// emitReact via the public registerModifier API alone.
import { describe, expect, it } from 'vitest';
import { parse } from '@rozie/core';
import { lowerToIR } from '@rozie/core';
import { ModifierRegistry, registerBuiltins } from '@rozie/core';
import { emitVue } from '@rozie/target-vue';
import { swipeModifier } from '../index.js';

function buildRegistry(): ModifierRegistry {
  const registry = new ModifierRegistry();
  registerBuiltins(registry);
  registry.register(swipeModifier);
  return registry;
}

function compile(source: string, filename: string) {
  const registry = buildRegistry();
  const parseResult = parse(source, { filename });
  expect(parseResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (!parseResult.ast) throw new Error('parse() returned null AST');
  const lowered = lowerToIR(parseResult.ast, { modifierRegistry: registry });
  expect(lowered.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const result = emitVue(lowered.ir, { source, filename, modifierRegistry: registry });
  return result;
}

describe('MOD-05 — swipe compiles via Phase 3 emitVue (D-22b SemVer proof)', () => {
  it("emits @touchstart.swipe('left') on a template event WITHOUT @rozie/core changes", () => {
    const source = `<rozie name="Swipeable">
<template>
<div @touchstart.swipe('left')="$data.swiped = true" />
</template>
<data>
{ swiped: false }
</data>
</rozie>`;

    const result = compile(source, 'Swipeable.rozie');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // The inlineGuard code is embedded into the @touchstart synthesized arrow.
    // We assert the directional comment marker is present (proves the swipe
    // modifier's vue() hook fired and the Phase 3 emitTemplateEvent inlineGuard
    // path executed — Plan 04-06 amendment).
    expect(result.code).toContain('swipe left guard');
    // The synthesized arrow should pass through `e` to inline guard checks.
    expect(result.code).toContain('clientX');
    expect(result.code).toMatch(/@touchstart="\(e\) =>/);
  });

  it("emits @touchstart.swipe('up') with a clientY axis check", () => {
    const source = `<rozie name="SwipeUp">
<template>
<div @touchstart.swipe('up')="onUp" />
</template>
<script>
const onUp = () => {}
</script>
</rozie>`;

    const result = compile(source, 'SwipeUp.rozie');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('swipe up guard');
    expect(result.code).toContain('clientY');
  });

  it('rejects unknown direction with a diagnostic (D-08 collected-not-thrown)', () => {
    const source = `<rozie name="SwipeBad">
<template>
<div @touchstart.swipe('diagonal')="onSwipe" />
</template>
<script>
const onSwipe = () => {}
</script>
</rozie>`;

    const registry = buildRegistry();
    const parseResult = parse(source, { filename: 'SwipeBad.rozie' });
    if (!parseResult.ast) throw new Error('parse() returned null AST');
    const lowered = lowerToIR(parseResult.ast, { modifierRegistry: registry });
    // The error is raised at lower-time (when resolve() runs). We assert there's
    // at least one error diagnostic — the exact code/message is internal.
    const errors = lowered.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    const msgs = errors.map((d) => d.message).join(' ');
    expect(msgs).toMatch(/swipe modifier expects one argument/);
  });
});
