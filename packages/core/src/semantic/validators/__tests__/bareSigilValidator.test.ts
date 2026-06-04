// Phase 26 Plan 02 — ROZ978 bare whole-object sigil validator (D-10).
//
// Proves: a bare `$props` / `$data` / `$refs` / `$slots` whole-object identifier
// emits exactly one ROZ978 (error) + the verbatim member-access hint, across the
// three expression contexts (<template> interpolation/binding, <script>,
// <listeners>) — fires once, independent of target. Negatives: member access
// (`$data.columns`) and `$attrs`/`$listeners` whole-object fallthrough produce
// ZERO ROZ978. compile() surfaces ROZ978 and emits no target output (D-10) —
// these fixtures emit nothing → no VR/snapshot.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { compile } from '../../../compile.js';
import { renderDiagnostic } from '../../../diagnostics/frame.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'BareSigilProbe.rozie') {
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
  template = `<button />`,
  script = ``,
) => `<rozie name="BareSigilProbe">
${script ? `<script>\n${script}\n</script>\n` : ''}<template>${template}</template>
</rozie>`;

/** Builder with a <listeners> block. */
const wrapWithListeners = (
  listeners: string,
  script = ``,
) => `<rozie name="BareSigilProbe">
${script ? `<script>\n${script}\n</script>\n` : ''}<listeners>${listeners}</listeners>
<template><button /></template>
</rozie>`;

const HINT_FRAGMENT = 'renders as JSON automatically';

describe('bareSigilValidator — template interpolation (ROZ978)', () => {
  for (const sigil of ['$data', '$props', '$refs', '$slots'] as const) {
    it(`{{ ${sigil} }} → exactly one ROZ978, severity error, with member hint`, () => {
      const src = wrap(`<span>{{ ${sigil} }}</span>`);
      const hits = byCode(diagnose(src), 'ROZ978');
      expect(hits.length).toBe(1);
      expect(hits[0]!.severity).toBe('error');
      expect(hits[0]!.hint ?? '').toContain(HINT_FRAGMENT);
      const frame = renderDiagnostic(hits[0]!, src);
      expect(frame).toContain('ROZ978');
    });
  }

  it('bare $refs in an attribute binding → ROZ978', () => {
    const src = wrap(`<button :data-x="$refs">x</button>`);
    const hits = byCode(diagnose(src), 'ROZ978');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('bare $slots in an attribute binding → ROZ978', () => {
    const src = wrap(`<button :data-y="$slots">x</button>`);
    expect(byCode(diagnose(src), 'ROZ978').length).toBe(1);
  });
});

describe('bareSigilValidator — member access unaffected (negatives)', () => {
  it('{{ $data.columns }} → zero ROZ978 (member access)', () => {
    const src = wrap(`<span>{{ $data.columns }}</span>`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });

  it('{{ $props.label }} → zero ROZ978', () => {
    const src = wrap(`<span>{{ $props.label }}</span>`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });

  it('{{ $refs?.el }} optional member → zero ROZ978', () => {
    const src = wrap(`<span>{{ $refs?.el }}</span>`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });
});

describe('bareSigilValidator — $attrs/$listeners fallthrough carve-out (D-04)', () => {
  it('bare $attrs in a binding → zero ROZ978 (legitimate fallthrough)', () => {
    const src = wrap(`<button r-bind="$attrs">x</button>`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });

  it('bare $listeners in an r-on → zero ROZ978 (legitimate fallthrough)', () => {
    const src = wrap(`<button r-on="$listeners">x</button>`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });
});

describe('bareSigilValidator — <script> scope (D-05)', () => {
  it('bare $data in a <script> expression → ROZ978', () => {
    const src = wrap(`<button />`, `function dump() { return $data; }`);
    const hits = byCode(diagnose(src), 'ROZ978');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('$data.columns in a <script> expression → zero ROZ978 (member access)', () => {
    const src = wrap(`<button />`, `function read() { return $data.columns; }`);
    expect(byCode(diagnose(src), 'ROZ978')).toEqual([]);
  });
});

describe('bareSigilValidator — <listeners> scope (D-05)', () => {
  it('bare $data inside a listeners handler → ROZ978', () => {
    const src = wrapWithListeners(
      `<listener :target="window" @resize="log($data)" />`,
    );
    const hits = byCode(diagnose(src), 'ROZ978');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });
});

describe('bareSigilValidator — compile() surfaces ROZ978 + no output (D-10)', () => {
  for (const target of ['react', 'angular', 'svelte', 'solid', 'lit', 'vue'] as const) {
    it(`compile() to ${target}: {{ $data }} → ROZ978, no target output, never throws`, () => {
      const src = wrap(`<span>{{ $data }}</span>`);
      expect(() => compile(src, { target })).not.toThrow();
      const result = compile(src, { target });
      expect(result.diagnostics.some((d) => d.code === 'ROZ978')).toBe(true);
      // Error diagnostic → compile() returns empty code (no target output).
      expect(result.code).toBe('');
    });
  }

  it('{{ $props }} compiles to ROZ978 + empty code (react)', () => {
    const src = wrap(`<span>{{ $props }}</span>`);
    const result = compile(src, { target: 'react' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ978')).toBe(true);
    expect(result.code).toBe('');
  });

  it('{{ $data.columns }} compiles WITHOUT ROZ978 and emits output (react)', () => {
    const src = `<rozie name="BareSigilProbe">
<data>{ columns: [] }</data>
<template><span>{{ $data.columns }}</span></template>
</rozie>`;
    const result = compile(src, { target: 'react' });
    expect(result.diagnostics.some((d) => d.code === 'ROZ978')).toBe(false);
    expect(result.code.length).toBeGreaterThan(0);
  });
});
