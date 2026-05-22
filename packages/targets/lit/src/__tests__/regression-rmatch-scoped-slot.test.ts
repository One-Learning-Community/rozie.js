/**
 * regression-rmatch-scoped-slot — `r-match` inside a Lit consumer-side
 * scoped slot filler.
 *
 * RATIONALE / why this gap existed:
 *   The Lit consumer-side slot-filler emit (`emitSlotFiller.ts`) routes
 *   destructured scoped fills through a `.<slot>=${(scope) => html`…`}`
 *   function-prop. Because the closure parameter is a bare `scope` (not a
 *   destructure pattern), the fill body's bare param references — `column`,
 *   `value`, … — must be pre-rewritten to `scope.<name>` MemberExpressions
 *   by `rewriteScopedParamRefsToScope`, a `switch (node.type)` walk over the
 *   IR.
 *
 *   That walk had a `case` for every TemplateNode kind EXCEPT the Phase 11
 *   `TemplateMatch` node (`r-match` / `r-case` / `r-default`). The switch
 *   has no `default`, so an `r-match`-bodied filler fell through silently:
 *   the branch tests + bodies kept bare `column` / `value` identifiers,
 *   which throw `ReferenceError` at runtime — the whole Lit component fails
 *   to render. It regressed when `TableDemo`'s `#cell` slot was converted to
 *   `r-match`; the cross-target VR matrix caught it as `Table · lit`.
 *
 *   This spec compiles the real `TableDemo.rozie` (whose `#cell` fill is an
 *   `r-match` switching on the scoped `column.key`) to Lit and asserts the
 *   param references reached `scope.<name>`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { compile } from '../../../../core/src/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileTableDemoLit(): string {
  // Absolute filename so the `<components>` import `../Table.rozie` resolves.
  const filename = resolve(ROOT, 'examples/demos/TableDemo.rozie');
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { target: 'lit', filename });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors, errors.map((d) => `${d.code}: ${d.message}`).join('\n')).toEqual([]);
  return result.code;
}

describe('r-match inside a Lit scoped slot filler — scope-param rewrite', () => {
  it('rewrites r-match branch-test param refs to `scope.<name>`', () => {
    const code = compileTableDemoLit();
    // The `#cell` fill is `<template r-match="column.key">`; `column` is a
    // destructured scope param, so the discriminant folded into each branch
    // test must read `scope.column.key`.
    expect(code).toMatch(/scope\.column\.key/);
  });

  it('rewrites r-match branch-body param refs to `scope.<name>`', () => {
    const code = compileTableDemoLit();
    // The branch bodies interpolate `{{ value }}` — another scope param.
    expect(code).toMatch(/scope\.value/);
  });

  it('leaves no bare scope-param identifier in the cell filler', () => {
    const code = compileTableDemoLit();
    // Pre-fix the filler emitted `${column.key === …}` / `${value}` — bare
    // identifiers with no binding. The closure parameter is `scope`, so a
    // bare `column`/`value` reference is the bug signature.
    expect(code).not.toMatch(/\$\{column\b/);
    expect(code).not.toMatch(/`badge badge-\$\{value\}`/);
  });

  it('emits a Lit module that parses cleanly via @babel/parser', () => {
    const code = compileTableDemoLit();
    expect(() =>
      babelParse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      }),
    ).not.toThrow();
  });
});
