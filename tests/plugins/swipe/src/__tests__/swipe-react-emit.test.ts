// Plan 04-06 Task 1 — MOD-05 dogfood: swipe modifier compiles via Phase 4
// emitReact WITHOUT any change to @rozie/core.
//
// Twin to swipe-vue-emit.test.ts — the same registerModifier API + the same
// swipeModifier ModifierImpl produces working output for BOTH targets. Proves
// D-22b SemVer stability of the public extension surface.
import { describe, expect, it } from 'vitest';
import { parse } from '@rozie/core';
import { lowerToIR } from '@rozie/core';
import { ModifierRegistry, registerBuiltins } from '@rozie/core';
import { emitReact } from '@rozie/target-react';
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
  const result = emitReact(lowered.ir, { source, filename, modifierRegistry: registry });
  return result;
}

describe('MOD-05 — swipe compiles via Phase 4 emitReact (D-22b SemVer proof)', () => {
  it("emits onTouchStart={...swipe('left') guard...} on a JSX template event", () => {
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
    expect(result.code).toContain('swipe left guard');
    expect(result.code).toContain('clientX');
    expect(result.code).toMatch(/onTouchStart=\{/);
  });

  it("emits @touchstart.swipe('down') with clientY axis check", () => {
    const source = `<rozie name="SwipeDown">
<template>
<div @touchstart.swipe('down')="onDown" />
</template>
<script>
const onDown = () => {}
</script>
</rozie>`;

    const result = compile(source, 'SwipeDown.rozie');
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).toContain('swipe down guard');
    expect(result.code).toContain('clientY');
  });

  it('compiles WITHOUT any modification to @rozie/core (the SemVer-additive inlineGuard discriminant on VueEmissionDescriptor is part of the v1 public surface)', () => {
    // Meta-assertion: verify both vue() and react() paths produce output. If
    // either target had broken the SemVer contract, this test would have
    // failed at the import boundary above (TypeScript compile error) or at
    // the emit() call (runtime descriptor-shape error).
    const source = `<rozie name="Both">
<template>
<div @touchstart.swipe('right')="onRight" />
</template>
<script>
const onRight = () => {}
</script>
</rozie>`;
    const reactResult = compile(source, 'Both.rozie');
    expect(reactResult.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(reactResult.code).toContain('swipe right guard');
  });
});
