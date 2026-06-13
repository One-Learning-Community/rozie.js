// Phase 45 Plan 45-01 Task 1 — `$clone` call-form sigil registration.
//
// `$clone(x)` is a target-rewritten deep-clone call-form sigil (parallel to
// `$snapshot`). Task 1 registers it in two core sets:
//   - STABLE_IDENTIFIERS (computeDeps) → the bare `$clone` call identifier is
//     NEVER collected as a dependency, so it never leaks into a React/Solid
//     useEffect/useMemo dep array (the documented $snapshot/$classSelector
//     failure mode). Dep tracking still happens on the ARGUMENT.
//   - RESERVED_SIGILS + RESERVED_SIGIL_LIST (reservedIdentifierValidator) →
//     a <data> field or r-for loop var named `$clone` is a ROZ202 collision.
//
// `$clone` is a CallExpression callee, never a bare object accessor, so it is
// deliberately NOT in BARE_SIGILS (bareSigilValidator).
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { parse } from '../../../parse.js';
import { analyzeAST } from '../../analyze.js';
import { collectAllDeclarations } from '../../bindings.js';
import { computeExpressionDeps } from '../../../reactivity/computeDeps.js';
import { RozieErrorCode } from '../../../diagnostics/codes.js';
import type { Diagnostic } from '../../../diagnostics/Diagnostic.js';
import { RESERVED_SIGILS } from '../reservedIdentifierValidator.js';

/** Run parse → analyzeAST and return the collected diagnostics. */
function analyzeSource(source: string, filename = 'clone.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

const roz202 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.RESERVED_IDENTIFIER_COLLISION);

describe('$clone call-form sigil registration (Phase 45 D-01)', () => {
  it('is a registered reserved sigil', () => {
    expect(RESERVED_SIGILS.has('$clone')).toBe(true);
  });

  it('the bare $clone identifier is NOT collected as a dependency from $clone($data.x)', () => {
    // Build a BindingsTable in which `x` is a known <data> field so the
    // argument read resolves to a `data` SignalRef.
    const source = `<rozie name="CloneDepProbe">
<data>{ x: 0 }</data>
<template><div></div></template>
</rozie>`;
    const { ast } = parse(source, { filename: 'CloneDepProbe.rozie' });
    if (!ast) throw new Error('parse failed');
    const bindings = collectAllDeclarations(ast);

    const expr = parseExpression('$clone($data.x)', { sourceType: 'module' });
    const deps = computeExpressionDeps(expr, bindings);

    // `$clone` is STABLE — it must NOT appear as a closure dependency.
    const cloneClosure = deps.filter(
      (d) => d.scope === 'closure' && d.identifier === '$clone',
    );
    expect(
      cloneClosure,
      `$clone must be in STABLE_IDENTIFIERS so it never enters a dep array; got ${JSON.stringify(deps)}`,
    ).toEqual([]);

    // The ARGUMENT's reactive read IS still tracked (dep tracking happens on
    // the argument, not the sigil).
    const dataDep = deps.filter(
      (d) => d.scope === 'data' && d.path[0] === 'x',
    );
    expect(
      dataDep.length,
      `the $data.x argument read should still be tracked; got ${JSON.stringify(deps)}`,
    ).toBe(1);
  });

  it('a <data> field named $clone produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<data>{ $clone: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('$clone');
  });

  it('an r-for loop alias named $clone produces the ROZ202 reserved-sigil collision', () => {
    const source = `<rozie name="X">
<template>
<ul><li r-for="$clone in items" :key="$clone">x</li></ul>
</template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });
});
