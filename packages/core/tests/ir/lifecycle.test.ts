// Phase 2 Plan 02-05 Task 2 — D-19 LifecycleHook IR pairing tests.
//
// REACT-04 + REACT-05 + D-19: Each $onMount/$onUnmount/$onUpdate produces ONE
// LifecycleHook IR node. Pairing happens at IR-lowering time:
//   1. Cleanup-return extraction — $onMount(() => { ...; return fn })
//   2. Adjacent $onMount(setup) + $onUnmount(cleanup) — Modal.rozie's
//      lockScroll/unlockScroll pattern (T-2-05-05 conservative pairing).
//   3. Async detection — $onMount(async () => { return cleanup }) emits ROZ105.
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as t from '@babel/types';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function lowerExample(name: string) {
  const src = loadExample(name);
  const result = parse(src, { filename: `${name}.rozie` });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${name}.rozie`);
  }
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

describe('LifecycleHook IR — Plan 02-05 (D-19 pairing)', () => {
  it('Modal.rozie produces LifecycleHook[] of length 2 (paired): pair 0 = mount with cleanup, pair 1 = mount no cleanup', () => {
    const { ir, diagnostics } = lowerExample('Modal');
    expect(ir).not.toBeNull();
    // No ROZ-error diagnostics expected for the canonical example.
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const lifecycle = ir!.lifecycle;
    expect(lifecycle).toHaveLength(2);

    // Pair 0: $onMount(lockScroll) + $onUnmount(unlockScroll) merged via T-2-05-05 rule.
    const pair0 = lifecycle[0]!;
    expect(pair0.phase).toBe('mount');
    // Identifier-style setup
    expect(t.isIdentifier(pair0.setup)).toBe(true);
    if (t.isIdentifier(pair0.setup)) {
      expect(pair0.setup.name).toBe('lockScroll');
    }
    expect(pair0.cleanup).toBeDefined();
    expect(t.isIdentifier(pair0.cleanup!)).toBe(true);
    if (pair0.cleanup && t.isIdentifier(pair0.cleanup)) {
      expect(pair0.cleanup.name).toBe('unlockScroll');
    }

    // Pair 1: $onMount(() => { $refs.dialogEl?.focus() }) — arrow body, no cleanup.
    const pair1 = lifecycle[1]!;
    expect(pair1.phase).toBe('mount');
    expect(pair1.cleanup).toBeUndefined();
  });

  it('SearchInput.rozie produces LifecycleHook[] of length 1 with cleanup-return extracted', () => {
    const { ir, diagnostics } = lowerExample('SearchInput');
    expect(ir).not.toBeNull();
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const lifecycle = ir!.lifecycle;
    expect(lifecycle).toHaveLength(1);

    const hook = lifecycle[0]!;
    expect(hook.phase).toBe('mount');
    expect(hook.cleanup).toBeDefined();
    // Cleanup is a function expression (the teardown returned from the body).
    expect(
      t.isArrowFunctionExpression(hook.cleanup!) || t.isFunctionExpression(hook.cleanup!),
    ).toBe(true);
    // Setup is a BlockStatement WITHOUT the trailing ReturnStatement.
    expect(t.isBlockStatement(hook.setup)).toBe(true);
    if (t.isBlockStatement(hook.setup)) {
      const lastStmt = hook.setup.body[hook.setup.body.length - 1];
      // The trailing ReturnStatement must have been removed.
      expect(lastStmt && t.isReturnStatement(lastStmt)).toBe(false);
    }
  });

  it('Dropdown.rozie produces LifecycleHook[] of length 2 (both mount, no cleanup, source order)', () => {
    const { ir, diagnostics } = lowerExample('Dropdown');
    expect(ir).not.toBeNull();
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);

    const lifecycle = ir!.lifecycle;
    expect(lifecycle).toHaveLength(2);
    expect(lifecycle[0]!.phase).toBe('mount');
    expect(lifecycle[1]!.phase).toBe('mount');
    expect(lifecycle[0]!.cleanup).toBeUndefined();
    expect(lifecycle[1]!.cleanup).toBeUndefined();
  });

  it('Counter.rozie + TodoList.rozie produce LifecycleHook[] of length 0', () => {
    const counter = lowerExample('Counter');
    const todoList = lowerExample('TodoList');
    expect(counter.ir!.lifecycle).toHaveLength(0);
    expect(todoList.ir!.lifecycle).toHaveLength(0);
  });

  it('Synthetic $onMount(async () => { return cleanup }) emits ROZ105 warning, cleanup === undefined (Pitfall 2)', () => {
    const synthSrc = `<rozie name="AsyncCleanup">
<script>
$onMount(async () => {
  return () => { /* teardown */ }
})
</script>
<template><div /></template>
</rozie>`;
    const result = parse(synthSrc, { filename: 'AsyncCleanup.rozie' });
    expect(result.ast).not.toBeNull();
    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });

    const lifecycle = lowered.ir!.lifecycle;
    expect(lifecycle).toHaveLength(1);
    expect(lifecycle[0]!.phase).toBe('mount');
    expect(lifecycle[0]!.cleanup).toBeUndefined();

    // ROZ105 must be emitted as a warning.
    const roz105 = lowered.diagnostics.find((d) => d.code === 'ROZ105');
    expect(roz105).toBeDefined();
    expect(roz105!.severity).toBe('warning');
  });

  it('WR-01 regression: $onMount(async () => { return cleanup }) emits EXACTLY ONE ROZ105 from lowerToIR (no duplicate from analyzeAST)', () => {
    // This test guards against the double-emission bug fixed in WR-01.
    // Previously unknownRefValidator.checkLifecycleSiting also emitted ROZ105,
    // resulting in two diagnostics for the same source pattern.
    // The fix removes the emission from the validator; lowerScript is the sole source.
    const src = `<rozie name="AsyncOnce">
<script>
$onMount(async () => {
  return () => { console.log('teardown') }
})
</script>
<template><div /></template>
</rozie>`;
    const result = parse(src, { filename: 'AsyncOnce.rozie' });
    expect(result.ast).not.toBeNull();
    const lowered = lowerToIR(result.ast!, { modifierRegistry: createDefaultRegistry() });

    const roz105All = lowered.diagnostics.filter((d) => d.code === 'ROZ105');
    expect(
      roz105All,
      `Expected exactly 1 ROZ105 diagnostic but got ${roz105All.length}: ${JSON.stringify(roz105All)}`,
    ).toHaveLength(1);
  });
});
