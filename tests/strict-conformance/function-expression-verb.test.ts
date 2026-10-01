/**
 * Function-expression script verbs on Lit (companion of
 * tests/angular-typecheck/function-expression-verb.test.ts): a top-level
 * `const half = function (by) { return $data.total / by }` becomes a class
 * field and must be an arrow so its rewritten `this.total` is lexical
 * (TS2683 under strict otherwise; `this` lost when called detached).
 */
import { describe, it, expect } from 'vitest';
import { compile } from '@rozie/core';
import { typecheckCompiled, totalErrors } from './strict-conformance.harness.js';

const SRC = `<rozie name="FnExpr">
<data>
{ total: 8 }
</data>
<script>
const half = function (by) {
  return $data.total / by
}
$expose({ half })
</script>
<template>
  <span>{{ half(2) }}</span>
</template>
</rozie>`;

describe('function-expression script verbs — Lit', () => {
  it('lifted as an arrow field; strict tsc clean', () => {
    const { code, diagnostics } = compile(SRC, { target: 'lit', filename: 'FnExpr.rozie', sourceMap: false });
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(code).toMatch(/\n\s+half = \(by: any\) => \{/);
    const { raw, inventory } = typecheckCompiled({
      target: 'lit',
      files: { 'FnExpr.ts': code },
      nodeModulesFrom: 'packages/ui/combobox/packages/lit',
    });
    expect(totalErrors(inventory), raw).toBe(0);
  });
});
