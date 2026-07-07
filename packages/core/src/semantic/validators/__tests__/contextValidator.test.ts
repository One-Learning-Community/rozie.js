// ROZ132 cast-blindness fix — `$provide`/`$inject` context validator
// (ROZ129–ROZ134), focused on the `$inject` binding-shape check.
//
// Proves: a `const x = $inject('key')` bound through a TS wrapper (`as T`,
// `!`, `satisfies T`, angle-cast `<T>`, or a chained `as A as B`) does NOT
// raise ROZ132 — the value IS still bound to a const; only a type-only
// wrapper sits around the call. A genuinely unbound `$inject(...)` (a bare
// statement, or assigned to `let`) still raises ROZ132.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';

function diagnose(source: string, filename = 'InjectProbe.rozie') {
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

const wrap = (script: string) => `<rozie name="InjectProbe">
<script lang="ts">
${script}
</script>
<template><div>{{ theme }}</div></template>
</rozie>`;

describe('$inject validator — ROZ132 cast-blindness fix', () => {
  it('bare `const theme = $inject(...)` is clean (no ROZ132)', () => {
    const diags = diagnose(wrap(`const theme = $inject('theme')`));
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('`const theme = $inject(...) as T` does NOT raise ROZ132', () => {
    const diags = diagnose(
      wrap(`const theme = $inject('theme') as { color: string }`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('`const theme = $inject(...)!` (non-null) does NOT raise ROZ132', () => {
    const diags = diagnose(wrap(`const theme = $inject('theme')!`));
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('`const theme = $inject(...) satisfies T` does NOT raise ROZ132', () => {
    const diags = diagnose(
      wrap(`const theme = $inject('theme') satisfies unknown`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('angle-cast `const theme = <T>$inject(...)` does NOT raise ROZ132', () => {
    const diags = diagnose(
      wrap(`const theme = <{ color: string }>$inject('theme')`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('chained `const theme = $inject(...) as A as B` does NOT raise ROZ132', () => {
    const diags = diagnose(
      wrap(`const theme = $inject('theme') as unknown as { color: string }`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('parenthesized `const theme = ($inject(...))` is clean (no ROZ132)', () => {
    const diags = diagnose(wrap(`const theme = ($inject('theme'))`));
    expect(byCode(diags, 'ROZ132').length).toBe(0);
  });

  it('a bare unbound `$inject(...)` statement STILL raises ROZ132', () => {
    const diags = diagnose(wrap(`$inject('theme')`));
    const hits = byCode(diags, 'ROZ132');
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('`let theme = $inject(...)` (non-const) STILL raises ROZ132', () => {
    const diags = diagnose(wrap(`let theme = $inject('theme')`));
    expect(byCode(diags, 'ROZ132').length).toBe(1);
  });

  it('a cast-wrapped `$inject(...)` assigned to `let` STILL raises ROZ132', () => {
    const diags = diagnose(
      wrap(`let theme = $inject('theme') as { color: string }`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(1);
  });

  it('a cast-wrapped `$inject(...)` mixed with another declarator raises ROZ134, not ROZ132', () => {
    const diags = diagnose(
      wrap(`const theme = $inject('theme') as { color: string }, other = 5`),
    );
    expect(byCode(diags, 'ROZ132').length).toBe(0);
    expect(byCode(diags, 'ROZ134').length).toBe(1);
  });
});
