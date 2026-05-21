// Phase 11 Plan 01 Task 2 — lowerTemplate r-match construct.
//
// Covers:
//   - getMatchDirective recognition + the match-grouping branch in lowerNodeList
//   - one folded TemplateMatchIR per r-match host (D-01)
//   - branch-test folding: `discriminant === caseValue`, comma `===`-OR chains,
//     literal-true bare predicate, literal-false negated predicate
//   - hostElement for a real-element host; undefined for <template r-match>
//   - D-03 hoist classification: Identifier/MemberExpression → 'inline';
//     CallExpression → 'hoist' with a per-component-unique tempName
//   - all seven ROZ953-959 diagnostics, collected-not-thrown
//
// WAVE 1 RED STATE: getMatchDirective + the match-grouping branch do not yet
// exist in lowerTemplate.ts. Every assertion below fails until Wave 2 lands the
// implementation.
import { describe, it, expect } from 'vitest';
import _generate from '@babel/generator';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';
import type { Expression } from '@babel/types';

// @babel/generator ships a CJS default export some ESM resolvers wrap.
type GenerateFn = typeof import('@babel/generator').default;
const generate: GenerateFn =
  typeof _generate === 'function'
    ? _generate
    : (_generate as unknown as { default: GenerateFn }).default;

function exprText(expr: Expression | null): string {
  if (expr === null) return '<null>';
  return generate(expr).code;
}

interface MatchBranch {
  test: Expression | null;
  deps: unknown[];
  body: unknown[];
  sourceLoc: unknown;
}
interface MatchNode {
  type: 'TemplateMatch';
  discriminant: Expression;
  discriminantMode: 'inline' | 'hoist';
  tempName?: string;
  branches: MatchBranch[];
  hostElement?: unknown;
  sourceLoc: unknown;
}

function lowerSource(src: string): {
  diagnostics: Diagnostic[];
  matches: MatchNode[];
} {
  const result = parse(src, { filename: 'match.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  const { ir, diagnostics } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  const matches = collectByType<MatchNode>(ir?.template ?? null, 'TemplateMatch');
  return { diagnostics, matches };
}

function collectByType<T extends { type: string }>(
  root: unknown,
  typeTag: string,
): T[] {
  const out: T[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === typeTag) out.push(n as unknown as T);
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) {
        for (const item of value) visit(item);
      } else if (value && typeof value === 'object') {
        visit(value);
      }
    }
  };
  visit(root);
  return out;
}

function rozie(template: string): string {
  return `<rozie name="MatchHost">\n<template>\n${template}\n</template>\n</rozie>\n`;
}

describe('lowerTemplate r-match — IR shape (Phase 11 R1)', () => {
  it('lowers a <template r-match> + r-case/r-default into exactly one TemplateMatchIR', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="1">one</a>
  <b r-case="2">two</b>
  <c r-default>other</c>
</template>`),
    );
    expect(matches.length).toBe(1);
    expect(matches[0]!.type).toBe('TemplateMatch');
    expect(matches[0]!.branches.length).toBe(3);
  });

  it('folds normal r-case tests to `discriminant === caseValue` and r-default to null', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="1">one</a>
  <b r-case="2">two</b>
  <c r-default>other</c>
</template>`),
    );
    const branches = matches[0]!.branches;
    expect(exprText(branches[0]!.test)).toBe('status === 1');
    expect(exprText(branches[1]!.test)).toBe('status === 2');
    expect(branches[2]!.test).toBeNull();
  });

  it('a <template r-match> host leaves hostElement undefined', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="1">one</a>
</template>`),
    );
    expect(matches[0]!.hostElement).toBeUndefined();
  });

  it('a real-element host (<div r-match>) sets hostElement to the lowered <div>', () => {
    const { matches } = lowerSource(
      rozie(`
<div r-match="status">
  <a r-case="1">one</a>
</div>`),
    );
    const host = matches[0]!.hostElement as { type: string; tagName: string } | undefined;
    expect(host).toBeDefined();
    expect(host!.type).toBe('TemplateElement');
    expect(host!.tagName).toBe('div');
  });
});

describe('lowerTemplate r-match — comma alternatives (Phase 11 R3)', () => {
  it('folds a comma r-case to a ===-OR chain, never .includes()', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="'max', 'min'">extremum</a>
  <b r-default>mid</b>
</template>`),
    );
    const folded = exprText(matches[0]!.branches[0]!.test);
    expect(folded).toBe("status === 'max' || status === 'min'");
    expect(folded).not.toContain('.includes(');
  });

  it('a call-expression r-case value is a single case, not a comma alternative', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="formatKey(a, b)">x</a>
</template>`),
    );
    // formatKey(a, b) parses to a CallExpression, NOT a top-level SequenceExpression.
    expect(exprText(matches[0]!.branches[0]!.test)).toBe('status === formatKey(a, b)');
  });
});

describe('lowerTemplate r-match — literal-boolean discriminant (Phase 11 R4)', () => {
  it('r-match="true" folds each r-case to the bare predicate', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="true">
  <a r-case="isReady">ready</a>
  <b r-default>waiting</b>
</template>`),
    );
    const folded = exprText(matches[0]!.branches[0]!.test);
    expect(folded).toBe('isReady');
    expect(folded).not.toContain('true ===');
  });

  it('r-match="false" folds each r-case to the negated predicate', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="false">
  <a r-case="isReady">a</a>
  <b r-default>b</b>
</template>`),
    );
    const folded = exprText(matches[0]!.branches[0]!.test);
    expect(folded).toBe('!isReady');
    expect(folded).not.toContain('false ===');
  });
});

describe('lowerTemplate r-match — hoist classification (Phase 11 R5 / D-03)', () => {
  it('an Identifier discriminant is discriminantMode "inline" with no tempName', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="status">
  <a r-case="1">one</a>
</template>`),
    );
    expect(matches[0]!.discriminantMode).toBe('inline');
    expect(matches[0]!.tempName).toBeUndefined();
  });

  it('a MemberExpression discriminant is discriminantMode "inline"', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="column.key">
  <a r-case="'status'">x</a>
</template>`),
    );
    expect(matches[0]!.discriminantMode).toBe('inline');
    expect(matches[0]!.tempName).toBeUndefined();
  });

  it('a CallExpression discriminant is discriminantMode "hoist" with a tempName', () => {
    const { matches } = lowerSource(
      rozie(`
<template r-match="resolve()">
  <a r-case="1">one</a>
</template>`),
    );
    expect(matches[0]!.discriminantMode).toBe('hoist');
    expect(matches[0]!.tempName).toMatch(/^__rozieMatch_\d+$/);
    // The folded branch test references the temp, not the call.
    expect(exprText(matches[0]!.branches[0]!.test)).toBe(
      `${matches[0]!.tempName} === 1`,
    );
  });

  it('two hoisting matches in one component get distinct temp names', () => {
    const { matches } = lowerSource(
      rozie(`
<div>
  <template r-match="resolveA()">
    <a r-case="1">a</a>
  </template>
  <template r-match="resolveB()">
    <b r-case="2">b</b>
  </template>
</div>`),
    );
    expect(matches.length).toBe(2);
    const names = matches.map((m) => m.tempName);
    expect(names[0]).toBeDefined();
    expect(names[1]).toBeDefined();
    expect(names[0]).not.toBe(names[1]);
  });
});

describe('lowerTemplate r-match — diagnostics ROZ953-959 (Phase 11 R6/R7)', () => {
  function diagsFor(template: string): Diagnostic[] {
    return lowerSource(rozie(template)).diagnostics;
  }
  function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
    return diags.filter((d) => d.code === code);
  }

  it('ROZ953 — r-match with no value', () => {
    const hits = byCode(
      diagsFor(`<template r-match><a r-case="1">x</a></template>`),
      'ROZ953',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ954 — r-match host child that is neither r-case nor r-default', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-case="1">one</a>
  <span>stray</span>
</template>`),
      'ROZ954',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ955 — valueless r-case', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-case>one</a>
</template>`),
      'ROZ955',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ956 — r-case + r-for on the same element', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-case="1" r-for="x in xs">one</a>
</template>`),
      'ROZ956',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ957 — r-default not the last branch', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-default>fallback</a>
  <b r-case="1">one</b>
</template>`),
      'ROZ957',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ958 — more than one r-default', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-case="1">one</a>
  <b r-default>first</b>
  <c r-default>second</c>
</template>`),
      'ROZ958',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  it('ROZ959 — duplicate literal r-case value (warning, first wins)', () => {
    const hits = byCode(
      diagsFor(`
<template r-match="status">
  <a r-case="1">one</a>
  <b r-case="1">dup</b>
  <c r-default>other</c>
</template>`),
      'ROZ959',
    );
    expect(hits.length).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
  });

  it('a well-formed r-match emits no ROZ953-959 diagnostics', () => {
    const diags = diagsFor(`
<template r-match="status">
  <a r-case="1">one</a>
  <b r-case="2, 3">others</b>
  <c r-default>fallback</c>
</template>`);
    const matchCodes = diags.filter((d) => /^ROZ95[3-9]$/.test(d.code));
    expect(matchCodes).toEqual([]);
  });
});
