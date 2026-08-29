// Quick 260829-cd4 (RED-first) — pins the three `$portals` failure shapes
// from `.planning/notes/class-a-sigil-scoping.md` §1 on the React target:
//
//   Probe A — top-level helper reads `$portals.body(...)`, called from `$onMount`.
//   Probe B — top-level helper reads `$portals.body(...)`, NO `$onMount` at all
//             (today the closure is emitted NOWHERE on React — it is attached
//             unconditionally to the first mount-phase hook, so with no hook
//             it is silently dropped).
//   Probe C — a top-level `$watch` whose CALLBACK reads `$portals.body(...)`,
//             no other lifecycle hook (the shape driving most corpus
//             workarounds — NOT scoped to `$onMount`).
//
// Assertion per probe: the `const portals = {` object declaration is PRESENT
// in the emitted output, and (when any `useEffect(` exists in the output) its
// index precedes the first `useEffect(` — i.e. it lives in the hook section,
// not inside a lifecycle-hook body. Probe B has no `useEffect(` at all
// pre-fix (the whole closure is dropped); post-fix a dispose-only effect is
// synthesized, so the general assertion holds for all three probes once the
// emitter is fixed.
//
// PASSING CONTROL (must stay green before AND after): `examples/PortalList.rozie`
// — NOT `PortalOverlay.rozie`, which the plan text names but which only uses
// the unrelated element-level `r-portal` teleport directive (`portalOverlay.test.ts`
// proves it never pulls in `createRoot`/`flushSync` at all). `PortalList.rozie`
// is the fixture that actually exercises `$portals.item(...)` from `$onMount`
// (verified 2026-08-29 by grepping `examples/` for the literal `$portals`
// sigil — see Task 1 STOP-condition notes in the quick's SUMMARY).
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../emitReact.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../../..');

function compileSource(src: string, filename: string): { code: string; ir: IRComponent } {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.code).join(', ')}`,
    );
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lowerToIR() returned null IR');
  const ir: IRComponent = lowered.ir;
  const { code, diagnostics } = emitReact(ir, { filename, source: src });
  expect(
    diagnostics.filter((d) => d.severity === 'error'),
    `unexpected emit errors: ${JSON.stringify(diagnostics)}`,
  ).toEqual([]);
  return { code, ir };
}

function compileFixture(filename: string): { code: string; ir: IRComponent } {
  const full = resolve(REPO_ROOT, filename);
  const src = readFileSync(full, 'utf8');
  return compileSource(src, full);
}

const PROBE_A = `<rozie name="ProbeA">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
function mountBody(host) { return $portals.body(host, {}) }
$onMount(() => { mountBody($refs.hostEl) })
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

const PROBE_B = `<rozie name="ProbeB">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
function mountBody(host) { return $portals.body(host, {}) }
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

const PROBE_C = `<rozie name="ProbeC">
<props>{ n: { type: Number, default: 0 } }</props>
<script>
let h = null
$watch(() => $props.n, (v) => { h = $portals.body($refs.hostEl, {}) })
</script>
<template>
<div ref="hostEl"></div>
<slot name="body" portal reactive />
</template>
</rozie>`;

/**
 * Shared assertion: `const portals = {` is PRESENT, and — when the output
 * contains at least one `useEffect(` — its index precedes the first one
 * (component/hook scope, not a lifecycle-hook body). Probe B pre-fix has NO
 * `useEffect(` at all (the whole closure is dropped), so the useEffect
 * comparison is conditional rather than an unconditional index diff.
 */
function assertPortalsAtHookScope(code: string, label: string): void {
  const portalsIdx = code.indexOf('const portals = {');
  expect(portalsIdx, `${label}: expected "const portals = {" to be present`).toBeGreaterThanOrEqual(
    0,
  );
  const firstEffectIdx = code.indexOf('useEffect(');
  if (firstEffectIdx !== -1) {
    expect(
      portalsIdx,
      `${label}: expected portals decl (index ${portalsIdx}) before first useEffect (index ${firstEffectIdx})`,
    ).toBeLessThan(firstEffectIdx);
  }
}

describe('React — $portals closure at component scope (quick 260829-cd4)', () => {
  it('Probe A — top-level helper called from $onMount', () => {
    const { code } = compileSource(PROBE_A, 'ProbeA.rozie');
    assertPortalsAtHookScope(code, 'Probe A');
  });

  it('Probe B — top-level helper, NO $onMount at all (today: dropped entirely)', () => {
    const { code } = compileSource(PROBE_B, 'ProbeB.rozie');
    assertPortalsAtHookScope(code, 'Probe B');
  });

  it('Probe C — $watch body reads $portals, no other lifecycle hook', () => {
    const { code } = compileSource(PROBE_C, 'ProbeC.rozie');
    assertPortalsAtHookScope(code, 'Probe C');
  });

  it('PASSING CONTROL — PortalList.rozie: in-$onMount $portals.item(...) still resolves', () => {
    const { code } = compileFixture('examples/PortalList.rozie');
    expect(code).toContain('const portals = {');
    expect(code).toContain('portals.item(');
    expect(code).toContain('useEffect(');
  });
});
