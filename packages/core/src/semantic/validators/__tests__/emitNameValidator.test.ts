// Quick 260601-l2u — ROZ122 empty/whitespace-only $emit event-name validator.
//
// Proves: `$emit('')` / `$emit('   ')` emit exactly one ROZ122 (error) in each
// of the three expression contexts (<script> / <template> handler / <listeners>);
// `$emit('change')` and dynamic `$emit(name)` / `$emit()` produce ZERO ROZ122
// (no false positive); compile() never throws and surfaces ROZ122 in
// result.diagnostics (react + angular); and the D-08 sweep regression — an
// empty-string $emit colliding with an empty-string $expose key co-fires ROZ121
// + ROZ122 without throwing (the 878271ad guard coexists with the new code).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'EmitProbe.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

function byCode(diags: Diagnostic[], code: string) {
  return diags.filter((d) => d.code === code);
}

/** Default template is an inert <button />; pass `template` to override. */
const wrap = (
  script: string,
  template = `<button />`,
) => `<rozie name="EmitProbe">
<script>
${script}
</script>
<template>${template}</template>
</rozie>`;

/** Builder with a <listeners> block whose handler calls into <script>. */
const wrapWithListeners = (
  script: string,
  listeners: string,
) => `<rozie name="EmitProbe">
<script>
${script}
</script>
<listeners>${listeners}</listeners>
<template><button /></template>
</rozie>`;

describe('emitNameValidator — <script> context (ROZ122)', () => {
  it("$emit('', payload) → exactly one ROZ122, severity error, frame contains ROZ122", () => {
    const src = wrap(`function fire() { $emit('', 1) }`);
    const hits = byCode(diagnose(src), 'ROZ122');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ122');
  });

  it("$emit('   ', x) whitespace-only → exactly one ROZ122", () => {
    const src = wrap(`function fire() { $emit('   ', x) }`);
    const hits = byCode(diagnose(src), 'ROZ122');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it("$emit('change', x) → zero ROZ122", () => {
    const src = wrap(`function fire() { $emit('change', x) }`);
    expect(byCode(diagnose(src), 'ROZ122')).toEqual([]);
  });

  it('dynamic name $emit(name) → zero ROZ122 (out of scope, no false positive)', () => {
    const src = wrap(`function fire(name) { $emit(name) }`);
    expect(byCode(diagnose(src), 'ROZ122')).toEqual([]);
  });

  it('$emit() with no args → zero ROZ122 (no crash, no false positive)', () => {
    const src = wrap(`function fire() { $emit() }`);
    expect(byCode(diagnose(src), 'ROZ122')).toEqual([]);
  });
});

describe('emitNameValidator — <template> context (ROZ122)', () => {
  it('@click="$emit(\'\')" → exactly one ROZ122', () => {
    const src = wrap(``, `<button @click="$emit('')">x</button>`);
    const hits = byCode(diagnose(src), 'ROZ122');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('@click="$emit(\'clicked\')" → zero ROZ122', () => {
    const src = wrap(``, `<button @click="$emit('clicked')">x</button>`);
    expect(byCode(diagnose(src), 'ROZ122')).toEqual([]);
  });
});

describe('emitNameValidator — <listeners> context (ROZ122)', () => {
  it("listeners handler calling $emit('') → ROZ122", () => {
    const src = wrapWithListeners(
      `const onResize = () => { $emit('') }`,
      `<listener :target="window" @resize="onResize" />`,
    );
    // The handler reference itself is in <script>; the inline form below puts the
    // $emit call directly in the listeners-context expression tree.
    const inlineSrc = wrapWithListeners(
      ``,
      `<listener :target="window" @resize="$emit('')" />`,
    );
    const inlineHits = byCode(diagnose(inlineSrc), 'ROZ122');
    expect(inlineHits.length).toBe(1);
    expect(inlineHits[0]!.severity).toBe('error');
    // The script-defined handler form trips ROZ122 via the <script> walk.
    expect(byCode(diagnose(src), 'ROZ122').length).toBe(1);
  });
});

describe('emitNameValidator — compile() surfaces ROZ122, never throws (D-08)', () => {
  for (const target of ['react', 'angular'] as const) {
    it(`compile() to ${target} never throws on $emit('') and surfaces ROZ122`, () => {
      const src = wrap(`function fire() { $emit('', 1) }`);
      expect(() => compile(src, { target })).not.toThrow();
      const result = compile(src, { target });
      expect(result.diagnostics.some((d) => d.code === 'ROZ122')).toBe(true);
    });
  }
});

describe('emitNameValidator — D-08 coexistence with ROZ121 (878271ad)', () => {
  it("$emit('') + $expose({ '': fn }) → both ROZ121 AND ROZ122, compile() does not throw", () => {
    const src = wrap(
      `function doNothing() {}\nfunction fire() { $emit('', 1); }\n$expose({ '': doNothing })`,
    );
    expect(() => compile(src, { target: 'angular' })).not.toThrow();
    const result = compile(src, { target: 'angular' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ121')).toBe(true);
    expect(result.diagnostics.some((d) => d.code === 'ROZ122')).toBe(true);
  });
});

// Spike-012 R9 — ROZ145 EMIT_MULTIPLE_POSITIONAL_ARGS.
//
// `$emit('change', a, b)` (2+ positional payload args — idiomatic multi-arg Vue
// emit) is not portable: Lit's CustomEvent has one `detail` (silently drops every
// arg past the first) and Angular's `output().emit(value)` takes one value. React/
// Vue/Svelte/Solid pass all args, so the break is SILENT on 2/6 targets. Pack the
// payload into a single object/array — the shape every shipped `.rozie` already
// uses. The check shares emitNameValidator's three-context $emit-call walk.
describe('emitNameValidator — multi-positional-arg $emit (ROZ145)', () => {
  const FLAGGED_SCRIPT: Array<[string, string]> = [
    ['two positional args', `function fire() { $emit('change', 1, 2) }`],
    ['three positional args', `function fire() { $emit('change', 1, 2, 3) }`],
    ['two dynamic args', `function fire(a, b) { $emit('change', a, b) }`],
  ];
  for (const [label, script] of FLAGGED_SCRIPT) {
    it(`flags ${label} in <script> with exactly one ROZ145 (error)`, () => {
      const hits = byCode(diagnose(wrap(script)), 'ROZ145');
      expect(hits.length, JSON.stringify(hits)).toBe(1);
      expect(hits[0]!.severity).toBe('error');
    });
  }

  const CLEAN_SCRIPT: Array<[string, string]> = [
    ['zero payload args', `function fire() { $emit('close') }`],
    ['one positional payload', `function fire() { $emit('change', 1) }`],
    ['one object payload (the portable form)', `function fire() { $emit('change', { a: 1, b: 2 }) }`],
    ['one array payload', `function fire() { $emit('change', [1, 2]) }`],
  ];
  for (const [label, script] of CLEAN_SCRIPT) {
    it(`does NOT flag ${label}`, () => {
      expect(byCode(diagnose(wrap(script)), 'ROZ145').length).toBe(0);
    });
  }

  it('fires in a template @event handler', () => {
    const src = wrap(`function noop() {}`, `<button @click="$emit('change', 1, 2)">go</button>`);
    expect(byCode(diagnose(src), 'ROZ145').length).toBe(1);
  });

  it('fires in a <listeners> handler', () => {
    const src = wrapWithListeners(``, `<listener :target="window" @resize="$emit('change', 1, 2)" />`);
    expect(byCode(diagnose(src), 'ROZ145').length).toBe(1);
  });

  it('compile() to lit surfaces ROZ145 and does not throw', () => {
    const src = wrap(`function fire() { $emit('change', 1, 2) }`);
    expect(() => compile(src, { target: 'lit' })).not.toThrow();
    expect(compile(src, { target: 'lit' }).diagnostics.some((d) => d.code === 'ROZ145')).toBe(true);
  });
});
