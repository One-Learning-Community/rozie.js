/**
 * Quick 260806-w00 SEAM 4, Task 2 — two coupled cleanups filed alongside seam 3
 * (`9acd7737`):
 *
 * LC-01 (`react-identifier-lifecycle-helper-stale-cleanup`) — the Identifier
 * lifecycle form (`$onUnmount(H)` / `$onMount(setup, H)` with H a plain
 * top-level helper reference) never reaches seam 3's AST rewrite: the
 * lifecycle loop synthesizes the invocation as a STRING from
 * `<node>.name`, so there is no AST body to walk. The `[]` deps freeze the
 * returned cleanup closure at render #1, so at TEARDOWN React invokes the
 * mount-time instance of `H`, which closes over render #1's props/state.
 * `$onMount(H)` is provably identity-safe (it runs DURING mount, when the
 * first-render instance IS current) and must NOT be touched.
 *
 * DIR-01 (`react-mount-directive-predicate-imprecision`) — seam 3 contained
 * (but did not close) an imprecise IR-derived model of what
 * `react-hooks/exhaustive-deps` actually flags, re-deriving the directive
 * from the EMITTED BODY only for hooks seam 3 touched. This task drops that
 * bound so body-derivation is the default for every mount hook.
 *
 * Harness copied from `mountHelperCallRefRewrite.test.ts` /
 * `mountHelperValuePositionRewrite.test.ts`.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitReact } from '../../emitReact.js';

function compile(rozieSrc: string): string {
  const { ast } = parse(rozieSrc, { filename: 'Test.rozie' });
  if (!ast) throw new Error('parse() returned null');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lowerToIR() returned null');
  const result = emitReact(ir, { filename: 'Test.rozie', source: rozieSrc });
  return result.code;
}

describe('emitScript (React) — Identifier-form lifecycle cleanup routes through a synced ref (LC-01) + directive derivation is the default (DIR-01) — Quick 260806-w00 seam 4 Task 2', () => {
  // --- L1 (RED, LC-01) — standalone $onUnmount(H) ---------------------------
  const SRC_STANDALONE_UNMOUNT = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const cleanup1 = () => { use($props.gain); };
$onUnmount(cleanup1);
</script>
<template><div>hi</div></template>
</rozie>`;

  it('L1 (RED) — a standalone $onUnmount(H) emits the ref-indirected invocation inside the returned cleanup', () => {
    const code = compile(SRC_STANDALONE_UNMOUNT);
    // A matching synced-ref declaration exists.
    expect(code).toContain('const _cleanup1Ref = useRef(cleanup1);');
    expect(code).toContain('_cleanup1Ref.current = cleanup1;');
    // The returned cleanup invokes the CURRENT instance via the ref, not the
    // mount-time bare identifier.
    expect(code).toMatch(/return\s*\(\s*\)\s*=>\s*\{\s*_cleanup1Ref\.current\(\);\s*\}/);
    expect(code).not.toMatch(/return\s*\(\s*\)\s*=>\s*\{\s*cleanup1\(\);\s*\}/);
  });

  it('snapshot — SRC_STANDALONE_UNMOUNT', () => {
    expect(compile(SRC_STANDALONE_UNMOUNT)).toMatchSnapshot();
  });

  // --- L2 (GREEN GUARD, LC-01 explicit non-goal) — $onMount(H) is safe -----
  const SRC_MOUNT_IDENTIFIER = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const setup1 = () => { use($props.gain); };
$onMount(setup1);
</script>
<template><div>hi</div></template>
</rozie>`;

  it('L2 (GREEN GUARD) — $onMount(H) is byte-identical to the pre-fix emit; $onMount(H) is provably identity-safe (executes DURING mount)', () => {
    const code = compile(SRC_MOUNT_IDENTIFIER);
    expect(code).toContain('setup1();');
    expect(code).not.toContain('_setup1Ref');
  });

  it('snapshot — SRC_MOUNT_IDENTIFIER', () => {
    expect(compile(SRC_MOUNT_IDENTIFIER)).toMatchSnapshot();
  });

  // --- L3 (RED, LC-01) — paired $onMount(setup, cleanup), cleanup identifier
  const SRC_PAIRED_CLEANUP_IDENTIFIER = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const setup3 = () => { seed(1); };
const cleanup3 = () => { use($props.gain); };
$onMount(() => {
  setup3();
  return cleanup3;
});
</script>
<template><div>hi</div></template>
</rozie>`;

  it('L3 (RED) — the identifier-form cleanup of a paired $onMount(setup, cleanup) gets the same ref-indirected treatment', () => {
    const code = compile(SRC_PAIRED_CLEANUP_IDENTIFIER);
    expect(code).toContain('const _cleanup3Ref = useRef(cleanup3);');
    expect(code).toContain('_cleanup3Ref.current = cleanup3;');
    expect(code).toContain('return () => _cleanup3Ref.current();');
    expect(code).not.toContain('return () => cleanup3();');
    // The SETUP identifier form is a DIFFERENT node (`setup3()` called inline,
    // not an Identifier lifecycle arg) — unaffected either way.
    expect(code).toContain('setup3();');
  });

  it('snapshot — SRC_PAIRED_CLEANUP_IDENTIFIER', () => {
    expect(compile(SRC_PAIRED_CLEANUP_IDENTIFIER)).toMatchSnapshot();
  });

  // --- L4 (GREEN GUARD) — empty dep array keeps the bare invocation --------
  const SRC_EMPTY_DEPS_UNMOUNT = `<rozie name="Test" inherit-attrs="false">
<props>{ gain: { type: Number, default: 1 } }</props>
<script>
const cleanup4 = () => { seed(2); };
$onUnmount(cleanup4);
</script>
<template><div>hi</div></template>
</rozie>`;

  it('L4 (GREEN GUARD) — an identifier-form lifecycle argument whose helper has an empty rendered dep array keeps its bare invocation', () => {
    const code = compile(SRC_EMPTY_DEPS_UNMOUNT);
    // `cleanup4` reads nothing reactive → `useCallback(fn, [])` → stable
    // identity by construction → not in `eligibleMountHelpers` → bare call.
    expect(code).toMatch(/return\s*\(\s*\)\s*=>\s*\{\s*cleanup4\(\);\s*\}/);
    expect(code).not.toContain('_cleanup4Ref');
  });

  it('snapshot — SRC_EMPTY_DEPS_UNMOUNT', () => {
    expect(compile(SRC_EMPTY_DEPS_UNMOUNT)).toMatchSnapshot();
  });

  // --- L5 (RED/GREEN, D-12 ordering) ----------------------------------------
  it('L5 (D-12) — the synced ref is declared BEFORE the effect that reads it (no TDZ / undeclared-ref read)', () => {
    const code = compile(SRC_STANDALONE_UNMOUNT);
    const declAt = code.indexOf('const _cleanup1Ref = useRef(cleanup1);');
    const readAt = code.indexOf('_cleanup1Ref.current();');
    expect(declAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(-1);
    expect(declAt).toBeLessThan(readAt);
  });

  // --- D1 (DIR-01) — body-derivation is now the default for EVERY mount hook
  const SRC_GLOBALS_ONLY = `<rozie name="Test" inherit-attrs="false">
<props>{ }</props>
<script>
$onMount(() => { console.log('hi'); window.scrollTo(0, 0); });
</script>
<template><div>hi</div></template>
</rozie>`;

  it('D1a — a mount hook that reads only globals emits NO eslint directive (untouched by any indirection pass)', () => {
    const code = compile(SRC_GLOBALS_ONLY);
    expect(code).not.toContain('eslint-disable-line react-hooks/exhaustive-deps');
  });

  it('snapshot — SRC_GLOBALS_ONLY', () => {
    expect(compile(SRC_GLOBALS_ONLY)).toMatchSnapshot();
  });

  // The OVER-approximation direction from the todo: a top-level FUNCTION
  // DECLARATION helper (`function cdnBase() {...}`, as opposed to an arrow
  // wrapped in `useCallback`) is treated as STATIC by
  // `react-hooks/exhaustive-deps` and is NOT flagged, despite being a
  // `closure`-scope `SignalRef` the IR-derived OLD model can't distinguish
  // from a `useCallback`-wrapped helper. `cdnBase` reads nothing reactive, so
  // it is NOT in `eligibleMountHelpers` (D-02 parity: `deps === '[]'`) —
  // neither seam 3's CALL rewrite nor this seam's VALUE-position wrapper
  // touches this hook at all, isolating DIR-01's default-flip specifically.
  const SRC_FUNCDECL_HELPER_ONLY = `<rozie name="Test" inherit-attrs="false">
<props>{ }</props>
<script>
function cdnBase() { return 'https://cdn.example.com'; }
$onMount(() => { seed(cdnBase()); });
</script>
<template><div>hi</div></template>
</rozie>`;

  it('D1b (RED) — a mount hook whose ONLY closure read is a top-level FUNCTION-DECLARATION helper now emits NO directive (untouched by any indirection pass)', () => {
    const code = compile(SRC_FUNCDECL_HELPER_ONLY);
    // The OLD IR-derived model (`allHelperNames.has(d.identifier)`) can't
    // distinguish a function declaration from a useCallback-wrapped arrow,
    // so pre-DIR-01 it over-approximated here and added an eslint-disable
    // directive ESLint would flag as UNUSED (`reportUnusedDisableDirectives`).
    expect(code).toContain('function cdnBase()');
    expect(code).not.toContain('_cdnBaseRef');
    expect(code).not.toContain('eslint-disable-line react-hooks/exhaustive-deps');
  });

  it('snapshot — SRC_FUNCDECL_HELPER_ONLY', () => {
    expect(compile(SRC_FUNCDECL_HELPER_ONLY)).toMatchSnapshot();
  });
});
