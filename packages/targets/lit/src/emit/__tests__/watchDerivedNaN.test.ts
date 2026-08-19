/**
 * IN-02 (Quick 260803-ibt) — Lit derived-`$watch` NaN comparison parity with
 * React.
 *
 * Both Lit derived-watch branches (`emitScript.ts` — the eager/`immediate`
 * branch and the lazy/default branch) compare `__watchVal` against the
 * stored previous value with strict `!==`. `NaN !== NaN` is always `true`,
 * so a NaN-valued derived getter re-fires the watch callback on EVERY cycle
 * where the base prop's `@property` setter ran, even though the derived
 * value never actually changed. React's dep-array comparison uses
 * `Object.is`, which correctly treats `NaN` as equal to itself and
 * suppresses the re-fire. Fix: `!Object.is(__watchVal, this.<prevField>)`
 * in both Lit branches.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../../emitLit.js';

function irFor(rozieSrc: string) {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  return ir;
}

function compile(rozieSrc: string): string {
  const result = emitLit(irFor(rozieSrc), { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

const LAZY_SRC = `<rozie name="Test">
<props>
  { xs: { type: Array, default: () => [] } }
</props>
<template>
  <div></div>
</template>
<script>
$watch(() => $props.xs.length, () => {
  console.log('changed')
})
</script>
</rozie>`;

const EAGER_SRC = `<rozie name="Test">
<props>
  { xs: { type: Array, default: () => [] } }
</props>
<template>
  <div></div>
</template>
<script>
$watch(() => $props.xs.length, () => {
  console.log('changed')
}, { immediate: true })
</script>
</rozie>`;

describe('emitScript (Lit) — derived-getter $watch NaN parity with React (Quick 260803-ibt IN-02)', () => {
  it('lazy (default) branch — the value-diff uses Object.is, not strict !==, so a NaN-valued getter does not re-fire every cycle', () => {
    const code = compile(LAZY_SRC);
    expect(code).toMatch(/!Object\.is\(__watchVal, this\.__rozieWatchPrev_\d+\)/);
    // The bare strict-inequality form must be GONE from this watcher's
    // value-diff comparison.
    expect(code).not.toMatch(/__watchVal !== this\.__rozieWatchPrev_\d+/);
  });

  it('eager (immediate: true) branch — same Object.is parity', () => {
    const code = compile(EAGER_SRC);
    expect(code).toMatch(/!Object\.is\(__watchVal, this\.__rozieWatchPrev_\d+\)/);
    expect(code).not.toMatch(/__watchVal !== this\.__rozieWatchPrev_\d+/);
  });
});
