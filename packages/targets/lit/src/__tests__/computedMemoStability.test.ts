/**
 * Quick 260828-sdw — reference-stability fixture for Lit `$computed`.
 *
 * Lit is the sole target of six that does not cache `$computed`: it emits a
 * bare `get X() { return {…}; }`, re-evaluated on every property access, so a
 * `$computed` returning an object or array yields a fresh reference on every
 * render. React (`useMemo`), Solid (`createMemo`), Vue/Angular (`computed`)
 * and Svelte (`$derived`) all memoize on the IR's already-resolved dep set.
 *
 * This fixture compiles a real `.rozie` probe to Lit, transpiles the emitted
 * TS with the project's standard Lit decorator settings
 * (`experimentalDecorators: true`, `useDefineForClassFields: false` — see
 * e.g. `packages/ui/rete/packages/lit/tsconfig.json`), writes it under this
 * package's own `node_modules` so its bare `lit` / `@lit-labs/preact-signals`
 * / `@rozie/runtime-lit` specifiers resolve, and exercises a REAL custom
 * element under happy-dom. This is deliberately not a snapshot test — per
 * project convention a snapshot cements whatever shape it captured; this
 * fixture asserts the runtime INVARIANT (object identity across renders)
 * directly.
 *
 * MUST FAIL against the unmodified (pre dep-keyed-memo) emitter. That
 * observation is the point of Task 1 — see the quick task's SUMMARY.md for
 * the verbatim RED output captured before any emitter edit.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { compile } from '@rozie/core';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP_DIR = resolve(HERE, '.tmp-computed-memo');
const OUT_FILE = resolve(TMP_DIR, 'MemoProbe.mjs');

const SOURCE = `<rozie name="MemoProbe">

<props>
{
  label: { type: String, default: 'hi' },
}
</props>

<data>
{
  tick: 0,
}
</data>

<script lang="ts">
const pure = $computed(() => ({ nested: () => 1 }));
const keyed = $computed(() => ({ label: $props.label }));
const dataKeyed = $computed(() => ({ tick: $data.tick }));

function bump(): void {
  $data.tick = $data.tick + 1;
}
</script>

<template>
<div>{{ $data.tick }}</div>
</template>

</rozie>
`;

interface MemoProbeElement extends HTMLElement {
  label: string;
  readonly pure: { nested: () => number };
  readonly keyed: { label: string };
  readonly dataKeyed: { tick: number };
  bump(): void;
  updateComplete: Promise<boolean>;
}

async function createProbe(): Promise<MemoProbeElement> {
  const el = document.createElement('rozie-memo-probe') as MemoProbeElement;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

describe('Lit $computed reference stability (quick 260828-sdw)', () => {
  beforeAll(async () => {
    const result = compile(SOURCE, { target: 'lit', filename: 'MemoProbe.rozie', sourceMap: false });
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.code).not.toBe('');

    const transpiled = ts.transpileModule(result.code, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    }).outputText;

    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(OUT_FILE, transpiled, 'utf8');

    // One-shot import — a custom-element tag can only be defined once per
    // realm, so the module (and its `customElements.define(...)` side
    // effect) is loaded exactly once here; each `it()` below creates a
    // fresh element instance via `createProbe()`.
    await import(pathToFileURL(OUT_FILE).href);
  });

  afterAll(() => {
    rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('Test 1 — a deps-empty computed returns the IDENTICAL reference across two reads', async () => {
    const el = await createProbe();
    expect(Object.is(el.pure, el.pure)).toBe(true);
  });

  it('Test 2 — a deps-empty computed survives an unrelated $data write plus a re-render', async () => {
    const el = await createProbe();
    const before = el.pure;
    el.bump();
    await el.updateComplete;
    expect(Object.is(before, el.pure)).toBe(true);
  });

  it('Test 3 — a props-keyed computed is stable while the prop is unchanged, and recomputes when it changes', async () => {
    const el = await createProbe();
    const before = el.keyed;

    el.bump();
    await el.updateComplete;
    expect(Object.is(before, el.keyed)).toBe(true);

    el.label = 'x';
    await el.updateComplete;
    expect(Object.is(before, el.keyed)).toBe(false);
    expect(el.keyed.label).toBe('x');
  });

  it('Test 4 — a data-keyed computed recomputes when its $data dep changes', async () => {
    const el = await createProbe();
    const before = el.dataKeyed;
    const beforeTick = before.tick;

    el.bump();
    await el.updateComplete;

    expect(Object.is(before, el.dataKeyed)).toBe(false);
    expect(el.dataKeyed.tick).toBe(beforeTick + 1);
  });

  it('Test 5 — subscription guard: the component still re-renders after a $data write once memoized', async () => {
    const el = await createProbe();
    el.bump();
    await el.updateComplete;
    expect(el.shadowRoot?.textContent).toContain('1');
  });
});
