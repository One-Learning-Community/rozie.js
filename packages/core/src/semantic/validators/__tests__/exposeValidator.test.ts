// Phase 21 Plan 21-01 Task 2 — $expose methods-only validator (ROZ115–ROZ120).
//
// Proves: the 6 malformed forms each emit their distinct code with a renderable
// code-frame; clean shorthand / explicit / inline-arrow forms validate silently;
// $expose({ someComputed }) → ROZ118; <data expose> → ROZ202 (reserved-sigil
// lockstep); every diagnostic is severity 'error'; compile() never throws (D-08).
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import { RESERVED_SIGILS } from '../reservedIdentifierValidator.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'ExposeProbe.rozie') {
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

const wrap = (script: string, data = `{ value: '' }`) => `<rozie name="ExposeProbe">
<data>${data}</data>
<script>
${script}
</script>
<template><input ref="field" /></template>
</rozie>`;

describe('$expose validator — reserved-sigil lockstep', () => {
  it("'$expose' is registered in RESERVED_SIGILS", () => {
    expect(RESERVED_SIGILS.has('$expose')).toBe(true);
  });

  it('a <data> field named `$expose` triggers ROZ202 (sigil collision)', () => {
    // The sigil itself ($-prefixed) as a data key.
    const src = `<rozie name="P">
<data>{ "$expose": '' }</data>
<template><div /></template>
</rozie>`;
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ202').length).toBeGreaterThanOrEqual(1);
  });
});

describe('$expose validator — the 6 malformed forms (ROZ115–ROZ120)', () => {
  it('ROZ115 — $expose(x) non-object argument (exactly one, with code-frame)', () => {
    const src = wrap(`const x = 1\n$expose(x)`);
    const diags = diagnose(src);
    const hits = byCode(diags, 'ROZ115');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    const frame = renderDiagnostic(hits[0]!, src);
    expect(frame).toContain('ROZ115');
  });

  it('ROZ116 — $expose({ ...o }) spread (exactly one)', () => {
    const src = wrap(`const o = {}\n$expose({ ...o })`);
    const hits = byCode(diagnose(src), 'ROZ116');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ117 — $expose({ [k]: v }) computed key (exactly one)', () => {
    const src = wrap(`const k = 'reset'\nfunction reset() {}\n$expose({ [k]: reset })`);
    const hits = byCode(diagnose(src), 'ROZ117');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ118 — $expose({ a: 1 }) literal value', () => {
    const hits = byCode(diagnose(wrap(`$expose({ a: 1 })`)), 'ROZ118');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ118 — $expose({ a: notInScope }) identifier not resolving to a function', () => {
    const hits = byCode(diagnose(wrap(`$expose({ a: notInScope })`)), 'ROZ118');
    expect(hits.length).toBe(1);
  });

  it('ROZ118 — $expose({ someComputed }) a $computed-bound value (reactive, not a function)', () => {
    const src = wrap(`const someComputed = $computed(() => $data.value)\n$expose({ someComputed })`);
    const hits = byCode(diagnose(src), 'ROZ118');
    expect(hits.length).toBe(1);
  });

  it('ROZ119 — two top-level $expose(...) calls (one ROZ119 on the second)', () => {
    const src = wrap(`function reset() {}\nfunction focus() {}\n$expose({ reset })\n$expose({ focus })`);
    const hits = byCode(diagnose(src), 'ROZ119');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ120 — $expose(...) nested inside a function (one ROZ120)', () => {
    const src = wrap(`function reset() {}\nfunction setup() { $expose({ reset }) }`);
    const hits = byCode(diagnose(src), 'ROZ120');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });
});

describe('$expose validator — clean forms validate silently', () => {
  it('shorthand { clear, open } → zero ROZ115-120', () => {
    const src = wrap(`function clear() {}\nfunction open() {}\n$expose({ clear, open })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('explicit { clear: clear } → zero diagnostics', () => {
    const src = wrap(`function clear() {}\n$expose({ clear: clear })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('inline arrow getter { getValue: () => $data.value } → zero diagnostics', () => {
    const src = wrap(`$expose({ getValue: () => $data.value })`);
    const diags = diagnose(src);
    for (const code of ['ROZ115', 'ROZ116', 'ROZ117', 'ROZ118', 'ROZ119', 'ROZ120']) {
      expect(byCode(diags, code), code).toEqual([]);
    }
  });

  it('arrow-const reference { reset } where reset = () => ... → zero diagnostics', () => {
    const src = wrap(`const reset = () => { $data.value = '' }\n$expose({ reset })`);
    const diags = diagnose(src);
    expect(byCode(diags, 'ROZ118')).toEqual([]);
  });
});

describe('$expose validator — compile() never throws (D-08)', () => {
  const malformed = [
    `const x = 1\n$expose(x)`,
    `const o = {}\n$expose({ ...o })`,
    `const k = 'a'\nfunction reset() {}\n$expose({ [k]: reset })`,
    `$expose({ a: 1 })`,
    `function reset() {}\n$expose({ reset })\n$expose({ reset })`,
    `function reset() {}\nfunction setup() { $expose({ reset }) }`,
  ];

  for (const target of ['react', 'vue'] as const) {
    for (const [i, script] of malformed.entries()) {
      it(`malformed form #${i + 1} compiles to ${target} without throwing`, () => {
        const src = wrap(script);
        expect(() => compile(src, { target })).not.toThrow();
        const result = compile(src, { target });
        // Each malformed form yields at least one error diagnostic.
        expect(result.diagnostics.some((d) => d.severity === 'error')).toBe(true);
      });
    }
  }
});
