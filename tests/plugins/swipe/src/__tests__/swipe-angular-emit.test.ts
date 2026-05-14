// Phase 07.1 Plan 03 — MOD-05 dogfood: swipe modifier compiles via the Phase 5
// emitAngular target WITHOUT any change to @rozie/core.
//
// Sibling to swipe-vue-emit.test.ts / swipe-react-emit.test.ts — the same
// registerModifier API + the same swipeModifier ModifierImpl produces working
// Angular output. Proves D-22b SemVer stability of the public extension surface
// across the Angular target.
import { describe, expect, it } from 'vitest';
import { parse } from '@rozie/core';
import { lowerToIR } from '@rozie/core';
import { ModifierRegistry, registerBuiltins } from '@rozie/core';
import { emitAngular } from '@rozie/target-angular';
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
  const result = emitAngular(lowered.ir, { source, filename, modifierRegistry: registry });
  return result;
}

describe('MOD-05 — swipe compiles via Phase 5 emitAngular (D-22b SemVer proof)', () => {
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
    // The inlineGuard code (swipeModifier.angular() hook) is spliced into the
    // synthesized Angular event handler. The directional comment marker proves
    // the swipe modifier's angular() hook fired and the inlineGuard path ran.
    expect(result.code).toContain('swipe left guard');
    expect(result.code).toContain('clientX');
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
    const errors = lowered.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
    const msgs = errors.map((d) => d.message).join(' ');
    expect(msgs).toMatch(/swipe modifier expects one argument/);
  });
});
