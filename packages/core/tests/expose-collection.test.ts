// Phase 21 Plan 21-01 Task 1 — $expose collection + ir.expose threading.
//
// Covers the framework-neutral spine (collector → BindingsTable → ir.expose):
//   - collectScriptDecls populates bindings.expose (canonical names, source
//     order) for shorthand AND explicit forms.
//   - bindings.exposeCalls records every call site with atTopLevel flags
//     (canonical top-level call true; nested call false).
//   - lowerToIR threads ir.expose with {name, sourceLoc} objects, source order
//     preserved, NOT Set-deduped.
//   - No $expose → ir.expose === [] (and the empty-script fallback path too).
//   - Prototype-pollution keys (__proto__/constructor/prototype) are filtered.
//
// Collectors stay SILENT — these tests assert extraction only; the validator
// (Task 2) owns all malformed-form diagnostics.
import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';
import { collectAllDeclarations } from '../src/semantic/bindings.js';
import { lowerToIR } from '../src/ir/lower.js';
import { createDefaultRegistry } from '../src/modifiers/registerBuiltins.js';

function parseAst(source: string, filename = 'ExposeProbe.rozie') {
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

const wrap = (script: string) => `<rozie name="ExposeProbe">
<data>{ value: '' }</data>
<script>
${script}
</script>
<template><input ref="field" /></template>
</rozie>`;

describe('collectScriptDecls — $expose extraction', () => {
  it('shorthand $expose({ reset, focus }) → bindings.expose names in source order', () => {
    const b = bindingsFor(
      wrap(`function reset() { $data.value = '' }
function focus() { $refs.field.focus() }
$expose({ reset, focus })`),
    );
    expect(b.expose.map((e) => e.name)).toEqual(['reset', 'focus']);
    // Each entry carries an accurate byte-offset loc.
    for (const e of b.expose) {
      expect(e.sourceLoc.start).toBeGreaterThan(0);
      expect(e.sourceLoc.end).toBeGreaterThan(e.sourceLoc.start);
    }
  });

  it('explicit form $expose({ reset: reset }) → name "reset"', () => {
    const b = bindingsFor(
      wrap(`function reset() { $data.value = '' }
$expose({ reset: reset })`),
    );
    expect(b.expose.map((e) => e.name)).toEqual(['reset']);
  });

  it('records the canonical top-level call (atTopLevel:true) in exposeCalls', () => {
    const b = bindingsFor(
      wrap(`function reset() {}
$expose({ reset })`),
    );
    expect(b.exposeCalls.length).toBe(1);
    expect(b.exposeCalls[0]!.atTopLevel).toBe(true);
  });

  it('records a nested $expose call (atTopLevel:false) for the validator', () => {
    const b = bindingsFor(
      wrap(`function reset() {}
function setup() { $expose({ reset }) }`),
    );
    // The nested call is recorded but contributes NO canonical names.
    expect(b.expose).toEqual([]);
    expect(b.exposeCalls.length).toBe(1);
    expect(b.exposeCalls[0]!.atTopLevel).toBe(false);
  });

  it('records BOTH a top-level and a nested call (duplicate + nested checks)', () => {
    const b = bindingsFor(
      wrap(`function reset() {}
function focus() {}
$expose({ reset })
function setup() { $expose({ focus }) }`),
    );
    // Canonical names come from the FIRST top-level call only.
    expect(b.expose.map((e) => e.name)).toEqual(['reset']);
    expect(b.exposeCalls.length).toBe(2);
    const flags = b.exposeCalls.map((c) => c.atTopLevel).sort();
    expect(flags).toEqual([false, true]);
  });

  it('records two top-level calls (duplicate detection feed)', () => {
    const b = bindingsFor(
      wrap(`function reset() {}
function focus() {}
$expose({ reset })
$expose({ focus })`),
    );
    expect(b.exposeCalls.length).toBe(2);
    expect(b.exposeCalls.every((c) => c.atTopLevel)).toBe(true);
  });

  it('filters prototype-pollution keys (__proto__/constructor/prototype)', () => {
    const b = bindingsFor(
      wrap(`function reset() {}
$expose({ __proto__: reset, constructor: reset, prototype: reset, reset })`),
    );
    expect(b.expose.map((e) => e.name)).toEqual(['reset']);
  });

  it('no $expose → bindings.expose === [] and exposeCalls === []', () => {
    const b = bindingsFor(wrap(`function reset() {}`));
    expect(b.expose).toEqual([]);
    expect(b.exposeCalls).toEqual([]);
  });
});

describe('lowerToIR — ir.expose threading', () => {
  it('$expose({ a, b }) → ir.expose names ["a","b"] in source order', () => {
    const { ir } = lowerFor(
      wrap(`function a() {}
function b() {}
$expose({ a, b })`),
    );
    expect(ir).not.toBeNull();
    expect(ir!.expose.map((e) => e.name)).toEqual(['a', 'b']);
    // Each is a full ExposedMethod object (not a deduped Set of strings).
    for (const e of ir!.expose) {
      expect(e.type).toBe('ExposedMethod');
      expect(e.sourceLoc.start).toBeGreaterThan(0);
    }
  });

  it('source order preserved, NOT Set-deduped (distinct sourceLocs survive)', () => {
    const { ir } = lowerFor(
      wrap(`function focus() {}
function reset() {}
$expose({ focus, reset })`),
    );
    expect(ir!.expose.map((e) => e.name)).toEqual(['focus', 'reset']);
    expect(ir!.expose[0]!.sourceLoc.start).not.toBe(ir!.expose[1]!.sourceLoc.start);
  });

  it('no $expose → ir.expose === []', () => {
    const { ir } = lowerFor(wrap(`function reset() {}`));
    expect(ir!.expose).toEqual([]);
  });

  it('empty-script fallback (no <script> block) → ir.expose === []', () => {
    const src = `<rozie name="NoScript">
<data>{ value: '' }</data>
<template><input ref="field" /></template>
</rozie>`;
    const { ir } = lowerToIR(parseAst(src, 'NoScript.rozie'), {
      modifierRegistry: createDefaultRegistry(),
    });
    expect(ir!.expose).toEqual([]);
  });
});
