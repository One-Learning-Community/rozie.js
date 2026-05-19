// $snapshot(x) — cross-target lowering gate.
//
// Wrapper authors writing engine-library ports (Chart.js, Flatpickr, etc.)
// occasionally need to hand a reactive value to untyped JS that mutates
// property descriptors. Svelte 5's `$state` proxy crashes with
// `state_descriptors_fixed` in that case; Vue/React/Solid/Angular/Lit hand
// back plain values at read time so no unwrap is needed.
//
// `$snapshot(x)` is the cross-target primitive:
//   - target-svelte:  `$snapshot(x)` → `$state.snapshot(x)`
//   - all 5 others:   `$snapshot(x)` → `x` (identity passthrough)
//
// Authors mark the engine boundary once; the compiler routes correctly.
import { describe, expect, it } from 'vitest';
import { compile, type CompileTarget } from '../src/compile.js';

const TARGETS: CompileTarget[] = [
  'vue',
  'react',
  'svelte',
  'angular',
  'solid',
  'lit',
];

const SRC = `<rozie name="WidgetWrapper">
<props>
{
  data: { type: Object, default: () => ({}) },
}
</props>
<script>
let instance = null

const buildConfig = () => ({
  payload: $snapshot($props.data),
})

$onMount(() => {
  instance = buildConfig()
  return () => { instance = null }
})

$watch(() => $props.data, (v) => {
  if (!instance) return
  instance.payload = $snapshot(v)
})
</script>
<template><div></div></template>
</rozie>`;

describe('$snapshot — cross-target lowering', () => {
  describe('every target compiles a wrapper that uses $snapshot()', () => {
    it.each(TARGETS)(
      'compiles to %s with zero errors',
      (target) => {
        const result = compile(SRC, { target, filename: 'WidgetWrapper.rozie' });
        const errors = result.diagnostics.filter((d) => d.severity === 'error');
        expect(errors).toEqual([]);
        expect(result.code.length).toBeGreaterThan(0);
      },
    );
  });

  describe('Svelte target rewrites $snapshot(x) → $state.snapshot(x)', () => {
    it('preserves the snapshot call as a member-call on $state', () => {
      const result = compile(SRC, {
        target: 'svelte',
        filename: 'WidgetWrapper.rozie',
      });
      // Two occurrences expected: one in buildConfig() (reads $props.data) and
      // one in the $watch callback (reads the watcher's `v` parameter).
      const matches = result.code.match(/\$state\.snapshot\(/g) ?? [];
      expect(matches.length).toBe(2);
      // No bare `$snapshot(` should survive into the emitted code — that
      // would mean the rewrite missed a call site.
      expect(result.code).not.toMatch(/[^.]\$snapshot\(/);
    });
  });

  describe('non-Svelte targets collapse $snapshot(x) to identity', () => {
    it.each(TARGETS.filter((t) => t !== 'svelte'))(
      '%s emits no $snapshot residue and no $state.snapshot call',
      (target) => {
        const result = compile(SRC, { target, filename: 'WidgetWrapper.rozie' });
        // No `$snapshot(` in emitted code — rewrite collapsed all callsites
        // to the bare argument.
        expect(result.code).not.toMatch(/\$snapshot\(/);
        // And no `$state.snapshot(` either — that's a Svelte-only idiom.
        expect(result.code).not.toMatch(/\$state\.snapshot\(/);
      },
    );
  });
});
