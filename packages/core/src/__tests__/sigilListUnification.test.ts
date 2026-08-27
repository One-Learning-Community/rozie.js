// Phase 85 Plan 03 (REQ-V9) — the standing drift guard for Rozie's sigil
// name set.
//
// Before this plan, `$snapshot` and `$classSelector` were real, shipped,
// dogfooded sigils (`packages/ui/sortable-list/src/SortableList.rozie` uses
// `$classSelector('grip')` today) that lived ONLY in the dependency
// collector's `STABLE_IDENTIFIERS` set (`reactivity/computeDeps.ts`) —
// absent from `RESERVED_SIGILS` (`semantic/validators/
// reservedIdentifierValidator.ts`), the list the compiler's ROZ202 collision
// validator actually enforces. A `<data>` field or `r-for` alias named
// `$snapshot`/`$classSelector` compiled clean instead of erroring — exactly
// the drift REQ-V9 names, and (per the Volar language-server work in
// Plans 85-01/85-02) the reason the language server's ambient sigil preamble
// had to hand-fork the same two names to type-check at all.
//
// This suite asserts, in both directions, that the fix holds:
//   1. RESERVED_SIGILS now contains both names.
//   2. Both names fire the ROZ202 collision in the two positions the
//      validator checks (a <data> field name, an r-for loop alias).
//   3. The hint string and the ROZ202 code-table doc comment (codes.ts) both
//      enumerate EXACTLY the runtime RESERVED_SIGILS set — a hand-typed
//      sentence disagreeing with the Set is the SAME class of drift this
//      plan closes, just at the documentation layer instead of the
//      compiler-behavior layer.
//   4. computeDeps.ts's STABLE_SIGIL_NAMES (composed FROM RESERVED_SIGILS,
//      not re-listed) still contains every name in its own intended
//      allowlist — i.e. the compose-by-filter step dropped nothing.
//   5. The dependency-collector's stable-identifier behavior for both sigils
//      is UNCHANGED: neither appears in a closure dep, so neither could leak
//      into a React `useEffect`/`useMemo` dependency array.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseExpression } from '@babel/parser';
import { parse } from '../parse.js';
import { analyzeAST } from '../semantic/analyze.js';
import { collectAllDeclarations } from '../semantic/bindings.js';
import { RozieErrorCode } from '../diagnostics/codes.js';
import type { Diagnostic } from '../diagnostics/Diagnostic.js';
import { RESERVED_SIGILS } from '../semantic/validators/reservedIdentifierValidator.js';
import {
  STABLE_SIGIL_ALLOWLIST,
  STABLE_SIGIL_NAMES,
  computeExpressionDeps,
} from '../reactivity/computeDeps.js';

const NEW_SIGILS = ['$snapshot', '$classSelector'] as const;

/** Run parse → analyzeAST and return the collected diagnostics. */
function analyzeSource(source: string, filename = 'sigil-unify.rozie'): Diagnostic[] {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast).diagnostics;
}

const roz202 = (diags: Diagnostic[]) =>
  diags.filter((d) => d.code === RozieErrorCode.RESERVED_IDENTIFIER_COLLISION);

describe('RESERVED_SIGILS — $snapshot / $classSelector unification (REQ-V9)', () => {
  it('both newly-added sigils are members of RESERVED_SIGILS', () => {
    for (const name of NEW_SIGILS) {
      expect(RESERVED_SIGILS.has(name), `RESERVED_SIGILS should contain ${name}`).toBe(true);
    }
  });

  it.each(NEW_SIGILS)('a <data> field named %s produces the ROZ202 reserved-sigil collision', (name) => {
    const source = `<rozie name="X">
<data>{ ${name}: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain(name);
    expect(hits[0]!.message).toContain('<data> field name');
  });

  it.each(NEW_SIGILS)('an r-for loop alias named %s produces the ROZ202 reserved-sigil collision', (name) => {
    const source = `<rozie name="X">
<template>
<ul><li r-for="${name} in items" :key="${name}">x</li></ul>
</template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });

  it('the hint string enumerates EXACTLY the runtime RESERVED_SIGILS set', () => {
    const source = `<rozie name="X">
<data>{ $snapshot: 0 }</data>
<template><div></div></template>
</rozie>`;
    const hits = roz202(analyzeSource(source));
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    const hint = hits[0]!.hint;
    expect(hint, 'ROZ202 diagnostic must carry a hint').toBeTruthy();
    const match = hint!.match(/reserves (.+) as built-in accessors/);
    expect(match, `could not parse the sigil list out of the hint: ${hint}`).not.toBeNull();
    const hintNames = new Set(
      match![1]!
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    expect(hintNames).toEqual(new Set(RESERVED_SIGILS));
  });

  it('the ROZ202 code-table doc comment in codes.ts enumerates EXACTLY the runtime RESERVED_SIGILS set', () => {
    const codesPath = fileURLToPath(new URL('../diagnostics/codes.ts', import.meta.url));
    const codesSrc = readFileSync(codesPath, 'utf8');
    const line = codesSrc
      .split('\n')
      .find((l) => l.includes("RESERVED_IDENTIFIER_COLLISION: 'ROZ202'"));
    expect(line, 'RESERVED_IDENTIFIER_COLLISION entry not found in codes.ts').toBeTruthy();
    const match = line!.match(/named ([^.]+)\./);
    expect(
      match,
      `could not parse the sigil list out of the ROZ202 code-table comment: ${line}`,
    ).not.toBeNull();
    const codeTableNames = new Set(
      match![1]!
        .split('/')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    expect(codeTableNames).toEqual(new Set(RESERVED_SIGILS));
  });

  it('computeDeps.ts composes STABLE_SIGIL_NAMES from RESERVED_SIGILS without silently dropping a name', () => {
    // If a name in the allowlist ever fell out of RESERVED_SIGILS, the
    // filter step in computeDeps.ts would silently shrink STABLE_SIGIL_NAMES
    // at runtime with no error — reproducing the exact class of drift REQ-V9
    // closes. This assertion is the canary.
    expect(STABLE_SIGIL_NAMES).toEqual(STABLE_SIGIL_ALLOWLIST);
    for (const name of STABLE_SIGIL_ALLOWLIST) {
      expect(RESERVED_SIGILS.has(name), `${name} must be in RESERVED_SIGILS`).toBe(true);
    }
    for (const name of NEW_SIGILS) {
      expect(STABLE_SIGIL_NAMES).toContain(name);
    }
  });

  describe('dependency-collector behavior for both sigils is unchanged', () => {
    function dataXBindings() {
      const source = `<rozie name="SigilDepProbe">
<data>{ x: 0 }</data>
<template><div></div></template>
</rozie>`;
      const { ast } = parse(source, { filename: 'SigilDepProbe.rozie' });
      if (!ast) throw new Error('parse failed');
      return collectAllDeclarations(ast);
    }

    it('$snapshot($data.x) tracks the $data.x argument read but NOT a bare $snapshot closure dep', () => {
      const bindings = dataXBindings();
      const expr = parseExpression('$snapshot($data.x)', { sourceType: 'module' });
      const deps = computeExpressionDeps(expr, bindings);

      const snapshotClosure = deps.filter(
        (d) => d.scope === 'closure' && d.identifier === '$snapshot',
      );
      expect(
        snapshotClosure,
        `$snapshot must never enter a dep array; got ${JSON.stringify(deps)}`,
      ).toEqual([]);

      const dataDep = deps.filter((d) => d.scope === 'data' && d.path[0] === 'x');
      expect(dataDep.length, `the $data.x argument read should still be tracked; got ${JSON.stringify(deps)}`).toBe(
        1,
      );
    });

    it('$classSelector(...) never appears as a closure dep', () => {
      const bindings = dataXBindings();
      const expr = parseExpression("$classSelector('grip')", { sourceType: 'module' });
      const deps = computeExpressionDeps(expr, bindings);

      const classSelectorClosure = deps.filter(
        (d) => d.scope === 'closure' && d.identifier === '$classSelector',
      );
      expect(
        classSelectorClosure,
        `$classSelector must never enter a dep array; got ${JSON.stringify(deps)}`,
      ).toEqual([]);
    });
  });
});
