/**
 * Quick 260802-v1v Task 8 — SEAM 2 RED: a derived-getter `$watch` lowers to
 * an identity dep instead of the derived value on React.
 *
 * `emitScript.ts:2905` (renderDepArray call site) throws away the ALREADY-
 * RENDERED getter text (`renderGetterExpression`, computed ~20 lines above at
 * :2897 for the param rebind) and instead calls
 * `renderDepArray(wh.getterDeps, …)`, whose `props` case
 * (`renderDepArray.ts:43-52`) path-narrows `props.xs.length` to the ROOT
 * identifier `props.xs` — an IDENTITY dep. `$watch(() => $props.xs.length, …)`
 * — the exact `Carousel.rozie:464` shape (`$props.slides.length`) — should
 * fire when the LENGTH changes, but the emitted `useEffect` dep array only
 * re-runs when the `xs` ARRAY REFERENCE changes, which (with a stable prop
 * array reference across a length-preserving mutation, or conversely a
 * fresh-reference no-op reassignment) desyncs from the actual watched value.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../../../../core/src/parse.js';
import { lowerToIR } from '../../../../../core/src/ir/lower.js';
import { createDefaultRegistry } from '../../../../../core/src/modifiers/registerBuiltins.js';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

describe('emitScript (React) — derived-getter $watch dep array (Quick 260802-v1v seam 2)', () => {
  it('RED — a member-chain getter ($props.xs.length) deps on the derived expression, not the root prop', () => {
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

    // RED (seam 2 target): dep array must be the derived length read, not
    // the root prop identity.
    expect(code).toContain('}, [props.xs.length]);');
    expect(code).not.toContain('}, [props.xs]);');
  });

  it('guard — a call-getter watcher keeps its current identity-dep shape (260519 linechart-watch-recreate)', () => {
    const src = `<rozie name="Test">
<props>
  { xs: { type: Array, default: () => [] } }
</props>
<template>
  <div></div>
</template>
<script>
function buildConfig() { return { n: $props.xs.length }; }
$watch(() => buildConfig(), () => {
  console.log('changed')
})
</script>
</rozie>`;
    const code = compile(src);
    // A CallExpression getter is NOT in the proven member-chain shape; must
    // keep the existing renderDepArray path (byte-unchanged) -- the closure
    // dep on the helper's OWN identity (`buildConfig`), never the derived
    // `props.xs.length` read inside its body.
    expect(code).toContain('}, [buildConfig]);');
  });

  it('guard — $computed dep arrays are byte-unchanged (S3 tripwire: renderDepArray is shared)', () => {
    const src = `<rozie name="Test">
<props>
  { xs: { type: Array, default: () => [] } }
</props>
<data>
{ n: 1 }
</data>
<template>
  <div>{{ doubled }}</div>
</template>
<script>
const doubled = $computed(() => $props.xs.length * 2)
</script>
</rozie>`;
    const code = compile(src);
    // A $computed over the SAME member-chain shape must still path-narrow to
    // the root prop identity — computed deps are OUT of this seam's shape.
    expect(code).toContain('[props.xs]');
    expect(code).not.toContain('[props.xs.length]');
  });

  it('guard — $onMount lifecycle dep arrays are byte-unchanged (S3 tripwire)', () => {
    const src = `<rozie name="Test">
<props>
  { xs: { type: Array, default: () => [] } }
</props>
<template>
  <div></div>
</template>
<script>
$onMount(() => {
  console.log($props.xs.length)
})
</script>
</rozie>`;
    const code = compile(src);
    // $onMount has no getter/dep-array concept the same way $watch does in
    // this codebase (it runs once on mount) -- this guard just proves the
    // DERIVED-GETTER DEP-ARRAY fix did not accidentally touch lifecycle-hook
    // emission at all: the mount hook still emits a `[]`-dep useEffect, and no
    // `props.xs.length` dep array appears anywhere.
    expect(code).toContain('useEffect(() => {');
    expect(code).toContain('}, []);');
    expect(code).not.toContain('}, [props.xs.length]);');

    // Quick 260803-swj seam 2 — the READ SHAPE inside the mount body moved,
    // deliberately and by a LATER seam: a declared, non-model prop read inside
    // a mount-phase body is now mirrored through a synced ref, because a mount
    // hook's `[]` dep array otherwise freezes every closure created in it at
    // the first-render value. This particular read is SYNCHRONOUS and top
    // level, so it is behaviourally identical before and after
    // (`_xsRef.current` at mount time IS the first-render value) — only the
    // emitted bytes move. The original assertion here
    // (`console.log(props.xs.length)`) predated that seam.
    expect(code).toContain('const _xsRef = useRef(props.xs);');
    expect(code).toContain('console.log(_xsRef.current.length)');
  });
});
