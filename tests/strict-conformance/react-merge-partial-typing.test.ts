/**
 * Typed-surface P3 review minor — every React `mergeListeners(...)` events
 * partial gives its handler arrows the SAME contextual `$event` typing they
 * would have as JSX props (`satisfies <element props> & Record<string, unknown>`),
 * not just the forced all-fire case. Pre-fix, the listeners-only / manual
 * `r-on` merge shape emitted `mergeListeners({ onClick: ($event) => … }, …)`
 * with an untyped `$event` — TS7006 under a strict (noImplicitAny) consumer.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const MANUAL_LISTENERS = `<rozie name="ManualListeners" inherit-attrs="false" inherit-listeners="false">
<script>
function fire(e) {
  $emit('press', e)
}
</script>
<template>
  <button r-on="$listeners" class="b" @click="fire($event)">x</button>
</template>
</rozie>
`;

describe('REACT-MERGE-PARTIAL-TYPING — merge-partial handlers are contextually typed', () => {
  it('react: manual r-on="$listeners" + local @click is strict-clean', () => {
    const { code, diagnostics } = compile(MANUAL_LISTENERS, {
      target: 'react',
      filename: 'ManualListeners.rozie',
      sourceMap: false,
    });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    // Premise: the pre-existing (non-forced) merge path — no pickListeners.
    expect(code).toContain('mergeListeners(');
    expect(code).not.toContain('pickListeners');
    const { raw, inventory } = typecheckCompiled({
      target: 'react',
      files: { 'ManualListeners.tsx': code },
      nodeModulesFrom: 'packages/ui/combobox/packages/react',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
});
