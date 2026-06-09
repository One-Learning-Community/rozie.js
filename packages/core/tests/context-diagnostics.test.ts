// Phase 36 Plan 36-01 Task 3 — $provide/$inject diagnostics (ROZ129–ROZ132).
//
// Mirrors the exposeValidator test shape: each malformed form emits exactly its
// ROZ code with a code-frame-able loc; a well-formed ThemeProvider/ThemeButton
// fixture emits NONE. Collected-not-thrown (D-08): analyzeAST never throws on
// malformed $provide/$inject.
import { describe, it, expect } from 'vitest';
import { parse } from '../src/parse.js';
import { analyzeAST } from '../src/semantic/analyze.js';

function analyzeSource(source: string, filename = 'ContextDiag.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast);
}

function codesOf(diags: { code: string }[], code: string) {
  return diags.filter((d) => d.code === code);
}

const provider = (script: string) => `<rozie name="P">
<data>{ color: 'red' }</data>
<script>
${script}
</script>
<template><div><slot /></div></template>
</rozie>`;

const consumer = (script: string) => `<rozie name="C">
<script>
${script}
</script>
<template><button>x</button></template>
</rozie>`;

describe('runContextValidator — ROZ129 INVALID_PROVIDE_KEY', () => {
  it('$provide(someVar, v) → ROZ129', () => {
    const { diagnostics } = analyzeSource(
      provider(`const key = 'theme'
$provide(key, { color: $data.color })`),
    );
    const hits = codesOf(diagnostics, 'ROZ129');
    expect(hits.length, JSON.stringify(diagnostics)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.loc.end).toBeGreaterThan(hits[0]!.loc.start);
  });

  it('a string-literal $provide key → NO ROZ129', () => {
    const { diagnostics } = analyzeSource(
      provider(`$provide('theme', { color: $data.color })`),
    );
    expect(codesOf(diagnostics, 'ROZ129')).toEqual([]);
  });
});

describe('runContextValidator — ROZ130 INVALID_INJECT_KEY', () => {
  it('$inject(123) → ROZ130', () => {
    const { diagnostics } = analyzeSource(consumer(`const t = $inject(123)`));
    const hits = codesOf(diagnostics, 'ROZ130');
    expect(hits.length, JSON.stringify(diagnostics)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('a string-literal $inject key → NO ROZ130', () => {
    const { diagnostics } = analyzeSource(consumer(`const t = $inject('theme')`));
    expect(codesOf(diagnostics, 'ROZ130')).toEqual([]);
  });
});

describe('runContextValidator — ROZ131 PROVIDE_NOT_STATEMENT', () => {
  it('$provide(...) in expression position (assigned) → ROZ131', () => {
    const { diagnostics } = analyzeSource(
      provider(`const r = $provide('theme', { color: $data.color })`),
    );
    const hits = codesOf(diagnostics, 'ROZ131');
    expect(hits.length, JSON.stringify(diagnostics)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('a statement-position $provide → NO ROZ131', () => {
    const { diagnostics } = analyzeSource(
      provider(`$provide('theme', { color: $data.color })`),
    );
    expect(codesOf(diagnostics, 'ROZ131')).toEqual([]);
  });
});

describe('runContextValidator — ROZ132 INJECT_UNBOUND', () => {
  it('$inject(...) as a bare statement (not bound to a const) → ROZ132', () => {
    const { diagnostics } = analyzeSource(consumer(`$inject('theme')`));
    const hits = codesOf(diagnostics, 'ROZ132');
    expect(hits.length, JSON.stringify(diagnostics)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('$inject(...) bound to a `let` (not const) → ROZ132', () => {
    const { diagnostics } = analyzeSource(consumer(`let t = $inject('theme')`));
    expect(codesOf(diagnostics, 'ROZ132').length).toBe(1);
  });

  it('const x = $inject(...) → NO ROZ132', () => {
    const { diagnostics } = analyzeSource(consumer(`const theme = $inject('theme')`));
    expect(codesOf(diagnostics, 'ROZ132')).toEqual([]);
  });
});

describe('runContextValidator — clean canonical fixture emits no context diagnostics', () => {
  const CONTEXT_CODES = ['ROZ129', 'ROZ130', 'ROZ131', 'ROZ132'];

  it('well-formed ThemeProvider emits none of ROZ129–132', () => {
    const { diagnostics } = analyzeSource(
      provider(`function cycle() { $data.color = 'green' }
$provide('theme', { get color() { return $data.color }, cycle })`),
      'ThemeProvider.rozie',
    );
    for (const code of CONTEXT_CODES) {
      expect(codesOf(diagnostics, code), `unexpected ${code}`).toEqual([]);
    }
  });

  it('well-formed ThemeButton emits none of ROZ129–132', () => {
    const { diagnostics } = analyzeSource(
      consumer(`const theme = $inject('theme')`),
      'ThemeButton.rozie',
    );
    for (const code of CONTEXT_CODES) {
      expect(codesOf(diagnostics, code), `unexpected ${code}`).toEqual([]);
    }
  });

  it('a component with neither $provide nor $inject emits none of ROZ129–132', () => {
    const { diagnostics } = analyzeSource(consumer(`const x = 1`));
    for (const code of CONTEXT_CODES) {
      expect(codesOf(diagnostics, code)).toEqual([]);
    }
  });
});

describe('runContextValidator — collected-not-thrown (D-08)', () => {
  it('analyzeAST never throws on malformed $provide/$inject', () => {
    expect(() =>
      analyzeSource(
        provider(`const r = $provide(123)
$inject(456)`),
      ),
    ).not.toThrow();
  });
});
