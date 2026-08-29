/**
 * transitiveEscapeConstStability.test.ts — Quick 260829-j18 Task 1 (RED-first).
 *
 * React's `useMemo` stabilization of an escaping top-level `const` is
 * discovered by `escapingHelperNames` — today a ONE-LEVEL, NON-TRANSITIVE
 * scan of `Listener.deps` and `LifecycleHook.setupDeps` (per Phase 2 D-21:
 * the IR deliberately does NOT recurse into a referenced declaration's
 * body). A `new X()` an effect reaches only THROUGH a top-level helper is
 * invisible to that one-level scan and never gets `useMemo` — a fresh
 * instance every render. CodeMirror's ten CM6 `Compartment` instances are
 * the corpus shape that exposed this (quick 260829-j18 objective).
 *
 * This file pins the transitive-closure fix at the emitter level
 * (`computeEscapingNames`, quick 260829-j18 Task 3), NOT in
 * `packages/core/src/reactivity/computeDeps.ts` — core's non-transitivity is
 * a deliberate, unrelated contract (D-21) and stays untouched.
 *
 * House style follows `pureLiteralConstStability.test.ts` verbatim: import
 * `emitScript` directly (NOT via a `compile()`/`emitReact()` call — `@rozie/
 * core` inlines each target emitter at ITS OWN build time, so a
 * `compile()`-based fixture stays stale until core rebuilds; see
 * `emitPortals.test.ts` / `portalComponentScope.test.ts` for the same
 * precedent), match each binder BY NAME, and inspect only its own
 * declaration line — never the whole emitted section
 * (`feedback_snapshot_tests_cement_bugs`).
 *
 * Probe initializers are chosen per F-09: a `new`-expression on an IMPORTED
 * class, consumed through a NON-mutating method (`.of(...)`). No existing
 * pass claims this shape today —
 *   - `collectPureLiteralBinders` explicitly excludes `NewExpression` inits;
 *   - `collectMutatedInstanceBinders` requires a MUTATING method call
 *     (`.add`/`.set`/`.push`/…— `.of()` is not one).
 * So every RED failure below is attributable to the escaping-set gap alone,
 * not to some other stabilization pass silently already covering it.
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
  if (!result.ast) {
    throw new Error(`parse failed: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(src: string): {
  userArrowsSection: string;
  hasUseMemoImport: boolean;
  hasUseCallbackImport: boolean;
} {
  const ir = lower(src);
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  const { userArrowsSection } = emitScript(ir, collectors);
  return {
    userArrowsSection,
    hasUseMemoImport: collectors.react.has('useMemo'),
    hasUseCallbackImport: collectors.react.has('useCallback'),
  };
}

/** The FIRST LINE of a top-level `const NAME` declaration in `section`. */
function declarationLine(section: string, name: string): string {
  const re = new RegExp(`^const ${name}(?:[:\\s].*|)$`, 'm');
  const m = section.match(re);
  if (!m) {
    throw new Error(`No top-level declaration found for '${name}' in:\n${section}`);
  }
  return m[0];
}

/** Parses the dep-array literal off a rendered `useMemo(..., [...])` line. */
function depArrayOf(line: string): string[] {
  const m = line.match(/useMemo\([\s\S]*,\s*\[([^\]]*)\]\)/);
  if (!m) throw new Error(`No useMemo(...) dep array found in: ${line}`);
  const inner = m[1]!.trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => s.trim());
}

// ---------------------------------------------------------------------------
// RED 1 — the CodeMirror shape: one hop, $onMount seed.
// ---------------------------------------------------------------------------
const RED_1_SRC = `<rozie name="Red1">
<script>
import { Compartment } from './fake-cm6'
const gutterCompartment = new Compartment()
function buildState() { return gutterCompartment.of([]) }
$onMount(() => { buildState() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// RED 2 — fixpoint, two hops: outer() -> inner() -> the const. Only `outer`
// is directly seeded (called from $onMount); `inner` is reached only through
// `outer`'s body, and the const is reached only through `inner`'s body.
// ---------------------------------------------------------------------------
const RED_2_SRC = `<rozie name="Red2">
<script>
import { Compartment } from './fake-cm6'
const decoCompartment = new Compartment()
function inner() { return decoCompartment.of([]) }
function outer() { return inner() }
$onMount(() => { outer() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// RED 3 — same shape, rooted in a <listeners> entry instead of $onMount.
// Proves both seed sources (Listener.deps AND LifecycleHook.setupDeps) feed
// the transitive expansion, not just the lifecycle one.
// ---------------------------------------------------------------------------
const RED_3_SRC = `<rozie name="Red3">
<script>
import { Compartment } from './fake-cm6'
const themeCompartment = new Compartment()
function rebuildTheme() { return themeCompartment.of([]) }
</script>
<listeners>
  <listener :target="window" @resize="rebuildTheme" r-if="true" />
</listeners>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL A — freshness ($data): the transitively-reached const's own
// initializer reads a $data key. The wrap must NOT collapse to []; that
// would freeze a live value into the component forever (the over-fire
// failure mode T-j18-01 names).
// ---------------------------------------------------------------------------
const CONTROL_A_SRC = `<rozie name="ControlA">
<data>{ level: 1 }</data>
<script>
import { Compartment } from './fake-cm6'
const levelCompartment = new Compartment($data.level)
function useLevel() { return levelCompartment.of([]) }
$onMount(() => { useLevel() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL B — freshness (prop): same shape, initializer reads a declared
// (non-model) prop.
// ---------------------------------------------------------------------------
const CONTROL_B_SRC = `<rozie name="ControlB">
<props>{ tabSize: { type: Number, default: 2 } }</props>
<script>
import { Compartment } from './fake-cm6'
const tabCompartment = new Compartment($props.tabSize)
function useTab() { return tabCompartment.of([]) }
$onMount(() => { useTab() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL C — no-fire (unreached helper): a top-level const referenced only
// by a helper that NO effect and NO listener calls. The expansion is rooted
// in the existing escape seed, not applied to every helper body in the file.
// ---------------------------------------------------------------------------
const CONTROL_C_SRC = `<rozie name="ControlC">
<script>
import { Compartment } from './fake-cm6'
const unreachedCompartment = new Compartment()
function neverCalled() { return unreachedCompartment.of([]) }
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL D — no-fire (shadowing): the escaping helper's body declares a
// LOCAL binding with the SAME name as a top-level const. The outer const
// must never be pulled into the escaping set through a shadowed reference.
// ---------------------------------------------------------------------------
const CONTROL_D_SRC = `<rozie name="ControlD">
<script>
import { Compartment } from './fake-cm6'
const shadowedCompartment = new Compartment()
function useShadow() {
  const shadowedCompartment = 5
  return shadowedCompartment
}
$onMount(() => { useShadow() })
</script>
<template><div></div></template>
</rozie>`;

// ---------------------------------------------------------------------------
// CONTROL E — helper form is untouched (F-06 narrowness pin, RED 1's own
// output): the intermediate helper `buildState` must stay a plain hoisted
// `function` declaration, never a `useCallback`-wrapped const, as a
// side-effect of the transitive walk reading through its body.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// CONTROL F — mutated-instance precedence: a const that is BOTH
// transitively reached AND member-mutated must keep
// `tryWrapMutatedInstanceUseMemo`'s stable `[]` identity (it runs FIRST in
// the wrap-pass loop, per F-05), never the reactive-keyed array
// `tryWrapEscapingConstUseMemo` would otherwise compute.
// ---------------------------------------------------------------------------
const CONTROL_F_SRC = `<rozie name="ControlF">
<data>{ level: 1 }</data>
<script>
const scratch = new Set()
function useScratch() {
  scratch.add($data.level)
  return scratch.has(1)
}
$onMount(() => { useScratch() })
</script>
<template><div></div></template>
</rozie>`;

describe('React transitive escaping-const stabilization (quick 260829-j18)', () => {
  it('RED 1 — a const reached one hop through a top-level helper called from $onMount is useMemo-wrapped', () => {
    const { userArrowsSection } = emit(RED_1_SRC);
    const line = declarationLine(userArrowsSection, 'gutterCompartment');
    expect(line, `RED 1: expected gutterCompartment to be useMemo-wrapped, got: ${line}`).toContain(
      'useMemo(',
    );
  });

  it('RED 2 — the transitive closure iterates to a fixpoint through a two-hop helper chain', () => {
    const { userArrowsSection } = emit(RED_2_SRC);
    const line = declarationLine(userArrowsSection, 'decoCompartment');
    expect(line, `RED 2: expected decoCompartment to be useMemo-wrapped, got: ${line}`).toContain(
      'useMemo(',
    );
  });

  it('RED 3 — the expansion is also seeded from a <listeners> entry, not just $onMount', () => {
    const { userArrowsSection } = emit(RED_3_SRC);
    const line = declarationLine(userArrowsSection, 'themeCompartment');
    expect(
      line,
      `RED 3: expected themeCompartment to be useMemo-wrapped, got: ${line}`,
    ).toContain('useMemo(');
  });

  it('CONTROL A — a transitively-reached const reading $data keeps a non-empty, correctly-keyed dep array', () => {
    const { userArrowsSection } = emit(CONTROL_A_SRC);
    const line = declarationLine(userArrowsSection, 'levelCompartment');
    expect(line).toContain('useMemo(');
    expect(depArrayOf(line)).toEqual(['level']);
  });

  it('CONTROL B — a transitively-reached const reading a prop keeps a non-empty, correctly-keyed dep array', () => {
    const { userArrowsSection } = emit(CONTROL_B_SRC);
    const line = declarationLine(userArrowsSection, 'tabCompartment');
    expect(line).toContain('useMemo(');
    expect(depArrayOf(line)).toEqual(['props.tabSize']);
  });

  it('CONTROL C — a const reached only by a helper nothing calls stays bare', () => {
    const { userArrowsSection } = emit(CONTROL_C_SRC);
    const line = declarationLine(userArrowsSection, 'unreachedCompartment');
    expect(
      line,
      `CONTROL C: expected unreachedCompartment to stay unwrapped, got: ${line}`,
    ).not.toContain('useMemo(');
  });

  it('CONTROL D — a shadowed same-name local inside the helper body does not pull the outer const in', () => {
    const { userArrowsSection } = emit(CONTROL_D_SRC);
    const line = declarationLine(userArrowsSection, 'shadowedCompartment');
    expect(
      line,
      `CONTROL D: expected shadowedCompartment to stay unwrapped, got: ${line}`,
    ).not.toContain('useMemo(');
  });

  it('CONTROL E — the intermediate helper (RED 1) stays a plain hoisted function, never useCallback', () => {
    const { userArrowsSection } = emit(RED_1_SRC);
    expect(userArrowsSection).toMatch(/^function buildState\(\)/m);
    expect(userArrowsSection).not.toMatch(/buildState\s*=\s*useCallback/);
  });

  it('CONTROL F — a transitively-reached, member-mutated const keeps the mutated-instance [] identity', () => {
    const { userArrowsSection } = emit(CONTROL_F_SRC);
    const line = declarationLine(userArrowsSection, 'scratch');
    expect(line).toContain('useMemo(');
    expect(depArrayOf(line)).toEqual([]);
  });
});
