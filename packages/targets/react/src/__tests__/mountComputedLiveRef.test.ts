/**
 * mountComputedLiveRef.test.ts — Quick 260829-8lz: React routes mount-frozen
 * `$computed` reads through a live ref.
 *
 * PREMISE RE-AIM (read this first). The task brief's premise — "a top-level
 * `<script>` helper read from a `$onMount`-registered effect is frozen" — was
 * measured to be HALF WRONG. That class was already closed on 2026-08-04 by
 * `9acd77378` (quick 260803-w7b seam 3, extended by 260806-w00 seam 4). The
 * FlowCanvas.rozie comment the brief quoted was authored in `982274e8c`
 * (2026-06-11), eight weeks BEFORE the fix that closed it — its "ZERO emitter
 * change" line is stale. CONTROL B below pins that closed class as a passing
 * regression guard, precisely because the brief's premise was wrong about it.
 *
 * THE ACTUALLY-OPEN CLASS is `ir.computed`. A `$computed` value lowers to
 * `const C = useMemo(() => ..., deps)` — a plain destructured const. A
 * `$onMount` hook lowers to `useEffect(() => {...}, [])` by contract (the
 * `depsArr` ternary, "Bug B fix 260519 linechart-watch-recreate") — mount-once,
 * NEVER re-created. A long-lived callback registered inside that effect and
 * reading `C` bare therefore captures the FIRST render's value forever, even
 * though React re-runs the `useMemo` on every dependency change. The other
 * five targets read a computed through a live accessor (`.value` / signal
 * call / getter) that a mount-once closure still resolves freshly — only
 * React destructures a frozen plain value.
 *
 * `emitScript.ts` explicitly EXCLUDED `ir.computed` from the mount-scope
 * live-ref family with the stated reason "a `useMemo` value is recomputed by
 * React and a fresh closure already sees it." That is TRUE for a closure
 * React RE-CREATES (an `$onUpdate` hook, CONTROL A below) and FALSE for a
 * `[]`-dep mount-once closure, which is never re-created and therefore never
 * observes a recomputed `useMemo`. That is the bug this fixture pins.
 *
 * TDZ HAZARD (T-2608298LZ-01): `ir.computed`'s `useMemo` declarations are
 * emitted in section 5e, AFTER the model/state ref-decl block (5b-bis). A
 * computed's live-ref pair must NOT join `actuallyRewrittenModelProps` (which
 * drives 5b-bis) — that would emit `const _doubledRef = useRef(doubled);`
 * while `const doubled = useMemo(...)` is still in its temporal dead zone, a
 * render-time ReferenceError for every consumer. The ordering assertion below
 * pins this with string indices, not just a comment.
 *
 * Harness copied verbatim from `mount-reactive-state-ref.test.ts:31-56`.
 */

import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitScript } from '../emit/emitScript.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

function lower(src: string): IRComponent {
  const result = parse(src, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(src: string): {
  hookSection: string;
  lifecycleEffectsSection: string;
  userArrowsSection: string;
} {
  const ir = lower(src);
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const { hookSection, lifecycleEffectsSection, userArrowsSection } = emitScript(ir, collectors);
  return { hookSection, lifecycleEffectsSection, userArrowsSection };
}

// POSITIVE + CONTROL A share one source: a `$computed` read bare from a
// `$onMount`-registered callback (the freeze) and a sibling `$onUpdate` that
// reads the SAME computed (the negative control — a real dep array means
// React re-creates that closure on change, so nothing is frozen there).
const POSITIVE_SRC = `<rozie name="MountComputedProbe">
<data>
{
  tick: 0,
}
</data>
<script>
const doubled = $computed(() => $data.tick * 2)
let observer = null
$onMount(() => {
  observer = () => doubled
})
$onUpdate(() => {
  console.log(doubled)
})
</script>
<template><div>{{ doubled }}</div></template>
</rozie>`;

// CONTROL B — the ALREADY-CLOSED seam-3/seam-4 helper class (regression pin).
// A top-level helper reading `$data`, called AND passed as a value from the
// same mount body.
const HELPER_MOUNT_SRC = `<rozie name="HelperMountProbe">
<data>
{
  reg: {},
}
</data>
<script>
const typeOf = (key) => { const r = $data.reg; return r[key] || null }
let engine = null
$onMount(() => {
  engine = { addPipe(fn) { this.pipe = fn }, on(evt, fn) { this.h = fn } }
  engine.addPipe((ctx) => typeOf(ctx.key))
  engine.on('x', typeOf)
})
</script>
<template><div>hi</div></template>
</rozie>`;

// CONTROL C — a mount body that locally shadows the computed's name.
const SHADOW_SRC = `<rozie name="ShadowComputedProbe">
<data>
{
  tick: 0,
}
</data>
<script>
const doubled = $computed(() => $data.tick * 2)
$onMount(() => {
  const doubled = 99
  console.log(doubled)
})
</script>
<template><div>{{ doubled }}</div></template>
</rozie>`;

// CONTROL D — the computed is read only from the template, never a lifecycle
// body.
const TEMPLATE_ONLY_SRC = `<rozie name="TemplateOnlyComputedProbe">
<data>
{
  tick: 0,
}
</data>
<script>
const doubled = $computed(() => $data.tick * 2)
$onMount(() => {
  console.log('mounted')
})
</script>
<template><div>{{ doubled }}</div></template>
</rozie>`;

describe('React mount-phase $computed live ref (Quick 260829-8lz)', () => {
  it('POSITIVE — routes a mount-body bare `$computed` read through a deferred _<C>Ref (declared after useMemo)', () => {
    const { hookSection, lifecycleEffectsSection } = emit(POSITIVE_SRC);

    // The synced ref for a computed name must land AFTER the `useMemo` decl
    // it references — emitting it before is a TDZ ReferenceError at render
    // (T-2608298LZ-01).
    expect(hookSection).toContain('const _doubledRef = useRef(doubled);\n_doubledRef.current = doubled;');
    const useMemoIdx = hookSection.indexOf('const doubled = useMemo(');
    const refIdx = hookSection.indexOf('const _doubledRef = useRef(doubled);');
    expect(useMemoIdx).toBeGreaterThanOrEqual(0);
    expect(refIdx).toBeGreaterThan(useMemoIdx);

    // The mount closure reads the live ref, not the frozen `useMemo` const.
    expect(lifecycleEffectsSection).toContain('observer.current = () => _doubledRef.current;');
    expect(lifecycleEffectsSection).not.toContain('observer.current = () => doubled;');
  });

  it('POSITIVE, directive — the mount effect drops its exhaustive-deps disable directive once its only flaggable dep is indirected', () => {
    const { lifecycleEffectsSection } = emit(POSITIVE_SRC);
    // Pre-fix the mount `[]` effect carries a directive because its body reads
    // the bare `doubled` computed (a genuine exhaustive-deps violation).
    // Post-fix the body reads `_doubledRef.current` (ref reads are exempt from
    // the rule, D-21b), so the body-derived `mountHasFlaggableDep` predicate
    // (which strips `_<X>Ref\.current` before testing) flips off unaided.
    expect(lifecycleEffectsSection).not.toContain(
      '// eslint-disable-line react-hooks/exhaustive-deps',
    );
  });

  it('CONTROL A — a non-mount ($onUpdate) hook keeps its bare computed read and real dep array, byte-identical', () => {
    const { lifecycleEffectsSection } = emit(POSITIVE_SRC);
    // `$onUpdate` re-creates its closure whenever a real dep changes, so
    // there is nothing frozen to fix — indirecting it would only add bytes.
    expect(lifecycleEffectsSection).toContain('console.log(doubled);');
    expect(lifecycleEffectsSection).toContain('}, [console, doubled]);');
  });

  it('CONTROL B — the already-closed seam-3/seam-4 helper class stays live (regression pin for the brief\'s WRONG premise)', () => {
    const { lifecycleEffectsSection, userArrowsSection } = emit(HELPER_MOUNT_SRC);
    // The helper call is routed through the synced ref (seam 3, `9acd77378`).
    // (Helper ref decls emit directly into lifecycleEffectsSection, ahead of
    // the useEffect block — a DIFFERENT placement from the computed/state
    // refs this quick adds to hookSection's 5b-bis/5e-bis sections.)
    expect(userArrowsSection).toContain('const typeOf = useCallback(');
    expect(lifecycleEffectsSection).toContain(
      'const _typeOfRef = useRef(typeOf);\n_typeOfRef.current = typeOf;',
    );
    expect(lifecycleEffectsSection).toContain('engine.current.addPipe((ctx: any) => _typeOfRef.current(ctx.key));');
    // The value-position reference is routed through the stable wrapper
    // (seam 4, 260806-w00).
    expect(lifecycleEffectsSection).toContain(
      'const _typeOfStable: typeof _typeOfRef.current = (...args) => _typeOfRef.current(...args);',
    );
    expect(lifecycleEffectsSection).toContain("engine.current.on('x', _typeOfStable);");
  });

  it('CONTROL C — a computed name locally shadowed inside the mount body is NOT rewritten', () => {
    const { hookSection, lifecycleEffectsSection } = emit(SHADOW_SRC);
    expect(hookSection).not.toContain('_doubledRef');
    expect(lifecycleEffectsSection).toContain('const doubled = 99;');
    expect(lifecycleEffectsSection).toContain('console.log(doubled);');
    expect(lifecycleEffectsSection).not.toContain('_doubledRef.current');
  });

  it('CONTROL D — a computed read only from the template (never a lifecycle body) emits no _<C>Ref', () => {
    const { hookSection } = emit(TEMPLATE_ONLY_SRC);
    expect(hookSection).not.toContain('_doubledRef');
  });
});
