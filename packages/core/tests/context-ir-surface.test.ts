// Phase 36 Plan 36-01 Task 2 — $provide/$inject IR surface gate.
//
// This is the Wave-0 IR-surface test (mirrors the rete/portals surface test):
// it asserts the framework-neutral spine (collector → BindingsTable → ir.provides
// / ir.injects) BEFORE any per-target emit wave consumes it. Every downstream
// emitter wave (A-E) depends on a populated, `[]`-when-empty IR surface.
//
//   - collectScriptDecls populates bindings.provides (key + valueExpr) and
//     bindings.injects (key + localBinding + optional fallback).
//   - lowerToIR threads ir.provides (ProvideDecl) and ir.injects (InjectDecl).
//   - A component with neither $provide nor $inject → ir.provides === [] and
//     ir.injects === [] (the D-5 byte-identity discipline).
import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';
import { collectAllDeclarations } from '../src/semantic/bindings.js';
import { lowerToIR } from '../src/ir/lower.js';
import { createDefaultRegistry } from '../src/modifiers/registerBuiltins.js';

function parseAst(source: string, filename = 'ContextProbe.rozie') {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

function bindingsFor(source: string) {
  return collectAllDeclarations(parseAst(source));
}

function lowerFor(source: string) {
  return lowerToIR(parseAst(source), { modifierRegistry: createDefaultRegistry() });
}

// A provider component: $provide('theme', value).
const provider = (script: string) => `<rozie name="ThemeProvider">
<data>{ color: 'red' }</data>
<script>
${script}
</script>
<template><div><slot /></div></template>
</rozie>`;

// A consumer component: const theme = $inject('theme').
const consumer = (script: string) => `<rozie name="ThemeButton">
<script>
${script}
</script>
<template><button>x</button></template>
</rozie>`;

describe('collectScriptDecls — $provide / $inject extraction', () => {
  it("$provide('theme', { ... }) → bindings.provides has key 'theme' + valueExpr", () => {
    const b = bindingsFor(
      provider(`$provide('theme', { get color() { return $data.color } })`),
    );
    expect(b.provides.length).toBe(1);
    expect(b.provides[0]!.key).toBe('theme');
    expect(b.provides[0]!.valueExpr).toBeDefined();
    expect(b.provides[0]!.valueExpr.type).toBe('ObjectExpression');
    expect(b.provides[0]!.sourceLoc.start).toBeGreaterThan(0);
    expect(b.provides[0]!.sourceLoc.end).toBeGreaterThan(b.provides[0]!.sourceLoc.start);
  });

  it("const theme = $inject('theme') → bindings.injects has key + localBinding 'theme'", () => {
    const b = bindingsFor(consumer(`const theme = $inject('theme')`));
    expect(b.injects.length).toBe(1);
    expect(b.injects[0]!.key).toBe('theme');
    expect(b.injects[0]!.localBinding).toBe('theme');
    expect(b.injects[0]!.fallbackExpr).toBeUndefined();
  });

  it("const t = $inject('theme', fallback) → carries the fallback expression", () => {
    const b = bindingsFor(consumer(`const t = $inject('theme', { color: 'gray' })`));
    expect(b.injects.length).toBe(1);
    expect(b.injects[0]!.localBinding).toBe('t');
    expect(b.injects[0]!.fallbackExpr).toBeDefined();
    expect(b.injects[0]!.fallbackExpr!.type).toBe('ObjectExpression');
  });

  it('multiple distinct $provide keys are ALL collected (not single-$expose gated)', () => {
    const b = bindingsFor(
      provider(`$provide('theme', { color: $data.color })
$provide('locale', { lang: 'en' })`),
    );
    expect(b.provides.map((p) => p.key)).toEqual(['theme', 'locale']);
  });

  it('records every $provide/$inject call site for the validator', () => {
    const b = bindingsFor(
      provider(`$provide('theme', { color: $data.color })`),
    );
    expect(b.provideCalls.length).toBe(1);
    expect(b.provideCalls[0]!.isStatement).toBe(true);

    const c = bindingsFor(consumer(`const theme = $inject('theme')`));
    expect(c.injectCalls.length).toBe(1);
    expect(c.injectCalls[0]!.boundToConst).toBe(true);
  });

  it('no $provide / $inject → bindings.provides === [] and bindings.injects === []', () => {
    const b = bindingsFor(consumer(`const x = 1`));
    expect(b.provides).toEqual([]);
    expect(b.injects).toEqual([]);
    expect(b.provideCalls).toEqual([]);
    expect(b.injectCalls).toEqual([]);
  });
});

describe('lowerToIR — ir.provides / ir.injects threading', () => {
  it("provider → ir.provides[0] is a ProvideDecl with key 'theme'", () => {
    const { ir } = lowerFor(
      provider(`$provide('theme', { get color() { return $data.color } })`),
    );
    expect(ir).not.toBeNull();
    expect(ir!.provides.length).toBe(1);
    expect(ir!.provides[0]!.type).toBe('ProvideDecl');
    expect(ir!.provides[0]!.key).toBe('theme');
    expect(ir!.provides[0]!.valueExpr).toBeDefined();
  });

  it("consumer → ir.injects[0] is an InjectDecl with key + localBinding", () => {
    const { ir } = lowerFor(consumer(`const theme = $inject('theme')`));
    expect(ir!.injects.length).toBe(1);
    expect(ir!.injects[0]!.type).toBe('InjectDecl');
    expect(ir!.injects[0]!.key).toBe('theme');
    expect(ir!.injects[0]!.localBinding).toBe('theme');
  });

  it('component with neither → ir.provides === [] and ir.injects === [] (D-5)', () => {
    const { ir } = lowerFor(consumer(`const x = 1`));
    expect(ir!.provides).toEqual([]);
    expect(ir!.injects).toEqual([]);
  });

  it('empty-script fallback (no <script> block) → both arrays === []', () => {
    const src = `<rozie name="NoScript">
<data>{ value: '' }</data>
<template><input /></template>
</rozie>`;
    const { ir } = lowerToIR(parseAst(src, 'NoScript.rozie'), {
      modifierRegistry: createDefaultRegistry(),
    });
    expect(ir!.provides).toEqual([]);
    expect(ir!.injects).toEqual([]);
  });
});
