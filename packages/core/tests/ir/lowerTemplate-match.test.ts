// Phase 11 — r-match construct IR shape (R1 + R8).
//
// `r-match`/`r-case`/`r-default` collapse into a single `TemplateMatch` IR
// node parallel to the existing `TemplateConditional`. This suite asserts
// the lowered IR shape:
//   - exactly one `TemplateMatch` node per `<template r-match>` block
//   - `branches[]` length matches the r-case + r-default count
//   - the r-default branch's `test` is `null`
//   - `discriminantMode` is `'inline'` for a member-expression discriminant,
//     `'hoist'` (with a `__rozieMatch_`-prefixed `tempName`) for a
//     CallExpression discriminant
//   - a comma r-case folds to a `LogicalExpression` (operator `||`)
//   - an r-match="true" r-case folds to a bare predicate, NOT a `===`
//     BinaryExpression
//   - R8: a real-element r-match host carries a defined `hostElement`
//   - R8: a `<template r-case>` multi-root branch body has > 1 node
//
// SEQUENCING NOTE: the `TemplateMatch` node + match-grouping branch ship in
// plan 11-01 (same wave). Until 11-01 merges, these `it()` cases are RED —
// expected and documented in 11-02-PLAN.md. The orchestrator re-runs this
// suite after the wave-1 worktrees merge.
//
// Harness copied from lowerTemplate-two-way.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';

function lowerSource(src: string) {
  const result = parse(src, { filename: 'match.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  return lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
}

type IRNodeWithType<T extends string> = { type: T } & Record<string, unknown>;

function collectByType<T extends string>(root: unknown, typeTag: T): IRNodeWithType<T>[] {
  const out: IRNodeWithType<T>[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n['type'] === typeTag) out.push(n as IRNodeWithType<T>);
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

type MatchBranch = {
  test: Record<string, unknown> | null;
  body: unknown[];
};
type MatchNode = {
  type: 'TemplateMatch';
  discriminant: Record<string, unknown>;
  discriminantMode: 'inline' | 'hoist';
  tempName?: string;
  branches: MatchBranch[];
  hostElement?: Record<string, unknown>;
};

function matchNodes(root: unknown): MatchNode[] {
  return collectByType(root, 'TemplateMatch') as unknown as MatchNode[];
}

describe('r-match IR shape — Phase 11 (R1)', () => {
  // Member-expression discriminant — `inline` mode, no temp.
  const INLINE_SRC = `<rozie name="MatchProbe">
<data>
{ kind: 'a' }
</data>
<template>
<template r-match="$data.kind">
  <span r-case="'a'">A</span>
  <span r-case="'b'">B</span>
  <span r-default>default</span>
</template>
</template>
</rozie>
`;

  it('produces exactly one TemplateMatch node with branches matching the case/default count', () => {
    const { ir } = lowerSource(INLINE_SRC);
    expect(ir).not.toBeNull();
    const matches = matchNodes(ir!.template);
    expect(matches.length).toBe(1);
    // 2 r-case + 1 r-default = 3 branches.
    expect(matches[0]!.branches.length).toBe(3);
  });

  it('lowers the r-default branch with test === null as the last branch', () => {
    const { ir } = lowerSource(INLINE_SRC);
    const branches = matchNodes(ir!.template)[0]!.branches;
    expect(branches[branches.length - 1]!.test).toBeNull();
    // Non-default branches carry a non-null test.
    expect(branches[0]!.test).not.toBeNull();
  });

  it('marks a member-expression discriminant as discriminantMode "inline"', () => {
    const { ir } = lowerSource(INLINE_SRC);
    expect(matchNodes(ir!.template)[0]!.discriminantMode).toBe('inline');
  });

  it('marks a CallExpression discriminant as discriminantMode "hoist" with a __rozieMatch_ tempName', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ score: 5 }
</data>
<script>
const classify = () => ($data.score > 0 ? 'pos' : 'neg')
</script>
<template>
<template r-match="classify()">
  <span r-case="'pos'">positive</span>
  <span r-default>other</span>
</template>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const match = matchNodes(ir!.template)[0]!;
    expect(match.discriminantMode).toBe('hoist');
    expect(typeof match.tempName).toBe('string');
    expect(match.tempName).toMatch(/^__rozieMatch_/);
  });

  it('allocates two distinct __rozieMatch_ tempNames for nested hoisting matches', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ score: 5 }
</data>
<script>
const outer = () => ($data.score > 0 ? 'pos' : 'neg')
const inner = () => ($data.score > 9 ? 'big' : 'small')
</script>
<template>
<template r-match="outer()">
  <template r-case="'pos'">
    <template r-match="inner()">
      <span r-case="'big'">big</span>
      <span r-default>small</span>
    </template>
  </template>
  <span r-default>other</span>
</template>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const temps = matchNodes(ir!.template)
      .filter((m) => m.discriminantMode === 'hoist')
      .map((m) => m.tempName);
    expect(temps.length).toBe(2);
    expect(new Set(temps).size).toBe(2);
  });

  it('folds a comma r-case to a LogicalExpression with operator ||', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ kind: 'a' }
</data>
<template>
<template r-match="$data.kind">
  <span r-case="'a', 'b'">A or B</span>
  <span r-default>other</span>
</template>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const firstTest = matchNodes(ir!.template)[0]!.branches[0]!.test;
    expect(firstTest).not.toBeNull();
    expect(firstTest!['type']).toBe('LogicalExpression');
    expect(firstTest!['operator']).toBe('||');
  });

  it('folds an r-match="true" r-case to a bare predicate, not a === BinaryExpression', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ count: 3 }
</data>
<template>
<template r-match="true">
  <span r-case="$data.count > 1">many</span>
  <span r-default>few</span>
</template>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const firstTest = matchNodes(ir!.template)[0]!.branches[0]!.test;
    expect(firstTest).not.toBeNull();
    // Bare predicate — the authored `$data.count > 1` expression, NOT a
    // `true === (...)` BinaryExpression wrapper.
    if (firstTest!['type'] === 'BinaryExpression') {
      expect(firstTest!['operator']).not.toBe('===');
    }
  });
});

describe('r-match IR shape — flexible host & multi-root branches (R8)', () => {
  it('carries a defined hostElement for a real-element r-match host', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ status: 'ready' }
</data>
<template>
<div r-match="$data.status" class="host">
  <p r-case="'ready'">ready</p>
  <p r-default>other</p>
</div>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const match = matchNodes(ir!.template)[0]!;
    expect(match.hostElement).toBeDefined();
  });

  it('leaves hostElement undefined for a <template> r-match host', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ status: 'ready' }
</data>
<template>
<template r-match="$data.status">
  <p r-case="'ready'">ready</p>
  <p r-default>other</p>
</template>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const match = matchNodes(ir!.template)[0]!;
    expect(match.hostElement).toBeUndefined();
  });

  it('emits a multi-node branch body for a <template r-case> with multiple children', () => {
    const src = `<rozie name="MatchProbe">
<data>
{ status: 'loading' }
</data>
<template>
<div r-match="$data.status">
  <template r-case="'loading'">
    <span class="label">Loading</span>
    <progress class="bar"></progress>
  </template>
  <p r-default>other</p>
</div>
</template>
</rozie>
`;
    const { ir } = lowerSource(src);
    const match = matchNodes(ir!.template)[0]!;
    // The <template r-case="'loading'"> branch body holds both children
    // (<span> and <progress>) — more than one node.
    const elementBodyCounts = match.branches.map(
      (b) => b.body.filter((n) => (n as { type?: string }).type === 'TemplateElement').length,
    );
    expect(Math.max(...elementBodyCounts)).toBeGreaterThan(1);
  });
});
