/**
 * regression-rmatch-scoped-slot — `r-match` inside a Lit consumer-side
 * scoped slot filler.
 *
 * RATIONALE / why this gap existed:
 *   The Lit consumer-side slot-filler emit (`emitSlotFiller.ts`) routes
 *   destructured scoped fills through a `.<slot>=${(scope) => html`…`}`
 *   function-prop. Because the closure parameter is a bare `scope` (not a
 *   destructure pattern), the fill body's bare param references — `columnId`,
 *   `value`, … — must be pre-rewritten to `scope.<name>` MemberExpressions
 *   by `rewriteScopedParamRefsToScope`, a `switch (node.type)` walk over the
 *   IR.
 *
 *   That walk had a `case` for every TemplateNode kind EXCEPT the Phase 11
 *   `TemplateMatch` node (`r-match` / `r-case` / `r-default`). The switch
 *   has no `default`, so an `r-match`-bodied filler fell through silently:
 *   the branch tests + bodies kept bare `columnId` / `value` identifiers,
 *   which throw `ReferenceError` at runtime — the whole Lit component fails
 *   to render. It originally regressed when `TableDemo`'s `#cell` slot was
 *   converted to `r-match`, and the cross-target VR matrix caught it as
 *   `Table · lit`.
 *
 *   Phase 79-14 reworked `TableDemo.rozie`'s `#cell` fill away from the
 *   `r-match` ladder onto per-column dynamic-name slots (D-01/D-02), so this
 *   spec was repointed at `DataTableSuperDemo.rozie`'s `#filter` scoped
 *   slot — a real, already-shipped fixture whose `<template r-match="columnId">`
 *   discriminates on a destructured scope param (`columnId`) and interpolates
 *   another (`value`) inside the branches, exercising the identical code path.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as babelParse } from '@babel/parser';
import { compile } from '@rozie/core';
import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../../..');

function compileDataTableSuperDemoLit(): string {
  // Absolute filename so the fixture's `<components>` imports resolve.
  const filename = resolve(ROOT, 'examples/demos/DataTableSuperDemo.rozie');
  const source = readFileSync(filename, 'utf8');
  const result = compile(source, { target: 'lit', filename });
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  expect(errors, errors.map((d) => `${d.code}: ${d.message}`).join('\n')).toEqual([]);
  return result.code;
}

describe('r-match inside a Lit scoped slot filler — scope-param rewrite', () => {
  it('rewrites r-match branch-test param refs to `scope.<name>`', () => {
    const code = compileDataTableSuperDemoLit();
    // The `#filter` fill is `<template r-match="columnId">`; `columnId` is a
    // destructured scope param, so each branch test's discriminant must
    // read `scope.columnId`.
    expect(code).toMatch(/scope\.columnId === /);
  });

  it('rewrites r-match branch-body param refs to `scope.<name>`', () => {
    const code = compileDataTableSuperDemoLit();
    // The branch bodies bind `:value="value"` — another scope param.
    expect(code).toMatch(/\.value=\$\{scope\.value\}/);
  });

  it('leaves no bare scope-param identifier in the filter filler', () => {
    const code = compileDataTableSuperDemoLit();
    // Pre-fix the filler emitted `${columnId === …}` / `.value=${value}` —
    // bare identifiers with no binding. The closure parameter is `scope`,
    // so a bare `columnId`/`value` reference is the bug signature.
    expect(code).not.toMatch(/\$\{columnId\b/);
    expect(code).not.toMatch(/\.value=\$\{value\}/);
  });

  it('emits a Lit module that parses cleanly via @babel/parser', () => {
    const code = compileDataTableSuperDemoLit();
    expect(() =>
      babelParse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      }),
    ).not.toThrow();
  });
});
