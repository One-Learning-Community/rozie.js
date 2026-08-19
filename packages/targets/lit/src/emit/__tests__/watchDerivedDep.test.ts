/**
 * Quick 260802-v1v Task 8 — SEAM 2 RED: a derived-getter `$watch` fires on
 * base-prop IDENTITY instead of the derived VALUE on Lit.
 *
 * `emitScript.ts:1401-1436` (the props-route branch) computes `__watchVal`
 * from the rewritten getter (`getterCode`) but only ever PASSES it to the
 * callback — nothing diffs it. The firing condition is solely
 * `changedProperties.has('xs')` (`classifyWatcherRoute` path-narrows
 * `$props.xs.length` to the root prop name `xs`, mirroring React's
 * `renderDepArray` narrowing) — an IDENTITY gate, not a value-change gate.
 * `$watch(() => $props.xs.length, …)` — the `Carousel.rozie:464` shape
 * (`$props.slides.length`) — should fire when the LENGTH changes, not
 * merely when Lit's `@property` setter runs for `xs`.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitAngular } from '../../../../angular/src/emitAngular.js';
import { emitSolid } from '../../../../solid/src/emitSolid.js';
import { emitSvelte } from '../../../../svelte/src/emitSvelte.js';
import { emitVue } from '../../../../vue/src/emitVue.js';
import { emitLit } from '../../emitLit.js';

const CONTROL_SRC = `<rozie name="Test">
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

describe('emitScript (Lit) — derived-getter $watch fire condition (Quick 260802-v1v seam 2)', () => {
  it('RED — a member-chain getter ($props.xs.length) must diff __watchVal against a stored previous value, not gate solely on changedProperties', () => {
    const src = `<rozie name="Test">
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
    const code = compile(src);

    // RED (seam 2 target): the current emit is a bare
    // `if (this.__rozieFirstUpdateDone && (changedProperties.has('xs'))) { const __watchVal = (...)(); (...)(); }`
    // with NO value-diff of __watchVal against a stored previous value.
    // Assert a stored-previous-value comparison exists in the updated()
    // branch for this watcher.
    //
    // Quick 260803-ibt IN-02 — the comparator is `Object.is`, not strict
    // `!==` (NaN-parity with React's dep-array comparison; see the
    // sibling `watchDerivedNaN.test.ts` for the dedicated fixture). This
    // assertion was reblessed to match that fix — it still pins "a
    // stored-previous-value comparison exists", just via the new operator.
    expect(code).toMatch(/!Object\.is\(__watchVal, this\.__\w*[Pp]rev\w*\)/);
  });

  it('guard — vue/svelte/solid/angular emit a getter-valued watch (cross-target parity control)', () => {
    // Cross-target control per task B's docket verification
    // (vue/src/Carousel.vue:416 watches the .length getter directly and
    // fires correctly). If any of these four is ALSO identity-shaped for
    // this getter, the docket's parity claim is wrong -> S1 for that
    // target, re-scope.
    const vueCode = emitVue(irFor(CONTROL_SRC), {
      filename: 'Test.rozie',
      source: CONTROL_SRC,
    }).code;
    // Vue's watch(getter, cb) passes the REWRITTEN GETTER FUNCTION literally
    // -- Vue's own reactivity system tracks whatever the getter reads, so
    // the derived `.length` read is watched directly (no narrowing).
    expect(vueCode).toMatch(/watch\(\(\)\s*=>\s*props\.xs\.length/);

    const svelteCode = emitSvelte(irFor(CONTROL_SRC), {
      filename: 'Test.rozie',
      source: CONTROL_SRC,
    }).code;
    // Svelte 5 runes: $effect tracks whatever reactive reads occur INSIDE its
    // body -- the derived `.length` read must appear inside the effect body.
    expect(svelteCode).toContain('xs.length');

    const solidCode = emitSolid(irFor(CONTROL_SRC), {
      filename: 'Test.rozie',
      source: CONTROL_SRC,
    }).code;
    // Solid's createEffect fine-grained-tracks whatever signal reads occur
    // inside its body -- same shape as Svelte.
    expect(solidCode).toContain('.xs.length');

    const angularCode = emitAngular(irFor(CONTROL_SRC), {
      filename: 'Test.rozie',
      source: CONTROL_SRC,
    }).code;
    // Angular's effect() tracks whatever signal reads occur inside its body.
    expect(angularCode).toContain('.length');
  });
});
