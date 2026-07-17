/**
 * Quick 260717-8zb (Task 2 Item 3) — VERIFY-FIRST finding: typed `$refs.X`/
 * `$el` declarators.
 *
 * CommandPalette.rozie carried a workaround note claiming a directly-typed
 * bare assignment of `$el`/`$refs.<name>` (`const panel: any = $refs.panel`)
 * compiles to a LITERAL, un-lowered `$refs.panel` (or `$refs.__rozieRoot`) on
 * the Svelte target — supposedly because the `: any` type annotation
 * suppresses the deconflict/lowering pass.
 *
 * Empirically verified FALSE via a battery of probes (typed/untyped,
 * self-shadow/non-self-shadow local name, nested-function/top-level-Program
 * scope, `$refs.X` and `$el`): every shape lowers correctly to the real
 * Svelte `bind:this` ref binding, with the type annotation preserved intact
 * on the emitted declarator. The `isInTypePosition` guard in rewriteScript.ts
 * correctly scopes to TS type-annotation ANCESTRY — a declarator's own
 * `id.typeAnnotation` is a SIBLING of its `init`, never an ancestor, so it
 * never suppresses the init's MemberExpression/Identifier rewrite.
 *
 * This suite is a PERMANENT regression guard (not a red-then-green fix —
 * there was no reproducible bug to fix), locking the already-correct
 * behavior so a future refactor cannot silently reintroduce the gap the
 * workaround wrongly believed still existed.
 */
import { describe, it, expect } from 'vitest';
import { compile } from '../../../../core/src/compile.js';

function svelteCode(source: string): string {
  const result = compile(source, { target: 'svelte', filename: 'X.rozie', types: true });
  const errs = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errs).toEqual([]);
  return result.code;
}

describe('Svelte typed $refs/$el declarator lowering (Task 2 Item 3 finding)', () => {
  it('a typed self-shadow declarator (`const panel: any = $refs.panel`) lowers to the real ref binding', () => {
    const code = svelteCode(`<rozie name="X">
<script lang="ts">
const doThing = () => {
  const panel: any = $refs.panel
  return panel ? panel.querySelector('.x') : null
}
</script>
<template>
<div ref="panel" @click="doThing()">content</div>
</template>
</rozie>`);
    // Self-shadow deconflict renames the local `panel$local`, RHS lowered to
    // the bare Svelte ref local `panel` — type annotation preserved.
    expect(code).toMatch(/const panel\$local: any = panel;/);
    expect(code).not.toContain('$refs.panel');
  });

  it('a typed NON-self-shadow declarator (`const differentName: any = $refs.frame`) lowers to the real ref binding', () => {
    const code = svelteCode(`<rozie name="X">
<script lang="ts">
const differentName: any = $refs.frame
</script>
<template>
<div><div ref="frame">content</div></div>
</template>
</rozie>`);
    expect(code).toMatch(/const differentName: any = frame;/);
    expect(code).not.toContain('$refs.frame');
  });

  it('a typed `$el` declarator (`const root: any = $el`) lowers to the synthesized __rozieRoot ref binding', () => {
    const code = svelteCode(`<rozie name="X">
<script lang="ts">
const root: any = $el
</script>
<template>
<div>content</div>
</template>
</rozie>`);
    expect(code).toMatch(/const root: any = __rozieRoot;/);
    expect(code).not.toContain('$el');
    expect(code).not.toContain('$refs.__rozieRoot');
  });

  it('an UNTYPED declarator lowers identically (parity baseline)', () => {
    const code = svelteCode(`<rozie name="X">
<script>
const root = $el
</script>
<template>
<div>content</div>
</template>
</rozie>`);
    expect(code).toMatch(/const root = __rozieRoot;/);
  });
});
