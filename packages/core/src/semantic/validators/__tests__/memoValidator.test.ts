// Quick 260717-8zb — ROZ146 `$memo(fn, keyFn)` misuse validator.
//
// `expandMemo` (lowerToIR, runs before analyzeAST) expands ONLY a well-formed
// top-level `const X = $memo(fnArrow, keyFnArrow)` (exactly two arrow-function
// args). Any `$memo(...)` call still present when analyzeAST runs is therefore
// a misuse, by construction — this validator flags it as ROZ146. The validator
// NEVER throws on malformed input (D-08) and never mutates the AST.
import { describe, it, expect } from 'vitest';
import { parse } from '../../../parse.js';
import { lowerToIR } from '../../../ir/lower.js';
import { createDefaultRegistry } from '../../../modifiers/registerBuiltins.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import type { RozieAST } from '../../../ast/types.js';

function parseOrThrow(source: string, filename = 'memo.rozie'): RozieAST {
  const { ast, diagnostics } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return ast;
}

/**
 * Route through the FULL `lowerToIR` chokepoint (not analyzeAST in isolation)
 * so `expandMemo` runs first — matching the real pipeline order the ROZ146
 * misuse contract depends on (expand valid shapes away; the validator only
 * ever sees what's left).
 */
function lowerDiagnostics(source: string): Diagnostic[] {
  const ast = parseOrThrow(source);
  const { diagnostics } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  return diagnostics;
}

const roz146 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.MEMO_MISUSE);

function component(script: string): string {
  return `<rozie name="X">
<data>{ x: 1 }</data>
<script>
${script}
</script>
<template><div>{{ x }}</div></template>
</rozie>`;
}

describe('memoValidator (ROZ146)', () => {
  it('does NOT fire for a well-formed top-level $memo (expandMemo already expanded it)', () => {
    const diags = lowerDiagnostics(
      component(`const filtered = $memo(() => $data.x + 1, () => [$data.x]);`),
    );
    expect(roz146(diags)).toHaveLength(0);
  });

  it('fires ROZ146 for a let-bound $memo (not a top-level const)', () => {
    const diags = lowerDiagnostics(
      component(`let filtered = $memo(() => $data.x + 1, () => [$data.x]);`),
    );
    expect(roz146(diags).length).toBeGreaterThan(0);
  });

  it('fires ROZ146 for a $memo call with the wrong arity', () => {
    const diags = lowerDiagnostics(component(`const filtered = $memo(() => $data.x + 1);`));
    expect(roz146(diags).length).toBeGreaterThan(0);
  });

  it('fires ROZ146 for a $memo call with non-arrow-function arguments', () => {
    const diags = lowerDiagnostics(
      component(`function fn() { return 1; }\nconst filtered = $memo(fn, () => []);`),
    );
    expect(roz146(diags).length).toBeGreaterThan(0);
  });

  it('fires ROZ146 for a $memo call nested inside a function body', () => {
    const diags = lowerDiagnostics(
      component(
        `function helper() { const inner = $memo(() => 1, () => []); return inner; }`,
      ),
    );
    expect(roz146(diags).length).toBeGreaterThan(0);
  });

  it('does not fire when there is no $memo call at all', () => {
    const diags = lowerDiagnostics(component(`const y = $data.x + 1;`));
    expect(roz146(diags)).toHaveLength(0);
  });
});
