// Phase 06.2 P1 Task 4 — emit-side diagnostic tests.
// Implementation under test:
//   - parseComponents emits ROZ921 (NON_ROZIE_IMPORT_PATH).
//   - lowerComponents emits ROZ923 (DUPLICATE_COMPONENT_IMPORT_PATH).
//   - lowerTemplate emits ROZ920 (UNKNOWN_COMPONENT) with did-you-mean,
//     ROZ922 (LOWERCASE_LIKELY_TYPO), ROZ924 (UNUSED_COMPONENT_ENTRY),
//     ROZ925..928 (escape-hatch sub-codes per D-124).
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

function lowerSource(src: string, filename = 'fixture.rozie') {
  const result = parse(src, { filename });
  if (!result.ast) {
    throw new Error(`parse() returned null AST for ${filename}: ${result.diagnostics.map((d) => d.code).join(', ')}`);
  }
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  return {
    ir: lowered.ir,
    diagnostics: [...result.diagnostics, ...lowered.diagnostics],
  };
}

describe('diagnostics-roz920 — UNKNOWN_COMPONENT (Phase 06.2 P1 Task 4)', () => {
  it('emits exactly one ROZ920 for an unknown PascalCase tag', () => {
    const src = `<rozie name="Foo">
<template>
  <UnknownTag />
</template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r920 = diagnostics.filter((d) => d.code === 'ROZ920');
    expect(r920.length).toBe(1);
    expect(r920[0]!.severity).toBe('error');
    expect(r920[0]!.message).toMatch(/Unknown component <UnknownTag>/);
  });

  it('emits ROZ920 with did-you-mean hint when a near-match is declared', () => {
    const src = `<rozie name="Card">
<components>{ CardHeader: "./CardHeader.rozie" }</components>
<template>
  <CardHeadr />
</template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Card.rozie');
    const r920 = diagnostics.find((d) => d.code === 'ROZ920');
    expect(r920).toBeDefined();
    expect(r920!.hint).toMatch(/Did you mean <CardHeader>\?/);
  });
});

describe('diagnostics-roz921 — NON_ROZIE_IMPORT_PATH (Phase 06.2 P1 Task 4)', () => {
  it('emits ROZ921 for a non-`.rozie` extension', () => {
    const src = `<rozie name="Foo">
<components>{ Foo: "./Foo.tsx" }</components>
<template><div /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r921 = diagnostics.filter((d) => d.code === 'ROZ921');
    expect(r921.length).toBeGreaterThanOrEqual(1);
    expect(r921[0]!.severity).toBe('error');
    expect(r921[0]!.message).toMatch(/'\.\/Foo\.tsx'/);
  });

  it('emits ROZ921 for non-StringLiteral values', () => {
    const src = `<rozie name="Foo">
<components>{ Modal: SomeIdent }</components>
<template><div /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    expect(diagnostics.some((d) => d.code === 'ROZ921')).toBe(true);
  });
});

describe('diagnostics-roz922 — LOWERCASE_LIKELY_TYPO (Phase 06.2 P1 Task 4)', () => {
  it('emits ROZ922 (warning) when a lowercase variant of a declared component appears', () => {
    const src = `<rozie name="Foo">
<components>{ Counter: "./Counter.rozie" }</components>
<template>
  <counter />
</template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r922 = diagnostics.find((d) => d.code === 'ROZ922');
    expect(r922).toBeDefined();
    expect(r922!.severity).toBe('warning');
    expect(r922!.message).toMatch(/<counter>/);
    expect(r922!.message).toMatch(/<Counter>/);
  });
});

describe('diagnostics-roz923 — DUPLICATE_COMPONENT_IMPORT_PATH (Phase 06.2 P1 Task 4)', () => {
  it('emits ROZ923 (warning) when two entries point at the same .rozie path', () => {
    const src = `<rozie name="Foo">
<components>{ A: "./X.rozie", B: "./X.rozie" }</components>
<template><A /><B /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r923 = diagnostics.find((d) => d.code === 'ROZ923');
    expect(r923).toBeDefined();
    expect(r923!.severity).toBe('warning');
    expect(r923!.message).toMatch(/'A'.*'B'.*'\.\/X\.rozie'/);
  });
});

describe('diagnostics-roz924 — UNUSED_COMPONENT_ENTRY (Phase 06.2 P1 Task 4)', () => {
  it('emits ROZ924 (warning) for a declared but never-used <components> entry', () => {
    const src = `<rozie name="Foo">
<components>{ UnusedComp: "./Foo.rozie" }</components>
<template><div /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r924 = diagnostics.find((d) => d.code === 'ROZ924');
    expect(r924).toBeDefined();
    expect(r924!.severity).toBe('warning');
    expect(r924!.message).toMatch(/UnusedComp/);
  });

  it('does NOT emit ROZ924 when the entry is referenced', () => {
    const src = `<rozie name="Foo">
<components>{ Bar: "./Bar.rozie" }</components>
<template><Bar /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    expect(diagnostics.find((d) => d.code === 'ROZ924')).toBeUndefined();
  });
});

describe('diagnostics-escape-hatch — ROZ925..928 (Phase 06.2 P1 Task 4 / D-124)', () => {
  it('emits ROZ925 (NOT ROZ920) for <Suspense> with React-specific hint', () => {
    const src = `<rozie name="Foo">
<template><Suspense /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r925 = diagnostics.find((d) => d.code === 'ROZ925');
    expect(r925).toBeDefined();
    expect(r925!.severity).toBe('error');
    expect(r925!.hint).toMatch(/React framework directly/);
    // ROZ920 must NOT also fire for the same tag — the escape-hatch sub-code
    // takes precedence per D-124.
    expect(diagnostics.find((d) => d.code === 'ROZ920')).toBeUndefined();
  });

  it('emits ROZ926 for <Teleport> with Vue-specific hint', () => {
    const src = `<rozie name="Foo">
<template><Teleport /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r926 = diagnostics.find((d) => d.code === 'ROZ926');
    expect(r926).toBeDefined();
    expect(r926!.hint).toMatch(/Vue framework directly/);
  });

  it('emits ROZ927 for <ng-container> with Angular-specific hint', () => {
    const src = `<rozie name="Foo">
<template><ng-container /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r927 = diagnostics.find((d) => d.code === 'ROZ927');
    expect(r927).toBeDefined();
    expect(r927!.hint).toMatch(/Angular framework directly/);
  });

  it('emits ROZ928 for <svelte:fragment> with Svelte-specific hint', () => {
    const src = `<rozie name="Foo">
<template><svelte:fragment /></template>
</rozie>`;
    const { diagnostics } = lowerSource(src, 'Foo.rozie');
    const r928 = diagnostics.find((d) => d.code === 'ROZ928');
    expect(r928).toBeDefined();
    expect(r928!.hint).toMatch(/Svelte framework directly/);
  });
});
