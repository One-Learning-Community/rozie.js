// Phase 11 — r-match construct diagnostics (R6/R7).
//
// The `r-match`/`r-case`/`r-default` trio has six malformed-usage compile
// errors (ROZ953..ROZ958) plus one duplicate-literal-case WARNING (ROZ959).
// All seven are collected, never thrown — the malformed-source inputs below
// directly verify the collected-not-thrown invariant from plan 11-01
// (threat T-11-02-01).
//
// SEQUENCING NOTE: the match-grouping branch + the ROZ953..ROZ959 codes ship
// in plan 11-01 (same wave). Until 11-01 merges, these `it()` cases are RED
// — that is expected and documented in 11-02-PLAN.md. The orchestrator
// re-runs this suite after the wave-1 worktrees merge.
//
// Harness copied verbatim from lowerTemplate-two-way-typo.test.ts.
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parse.js';
import { lowerToIR } from '../../src/ir/lower.js';
import { createDefaultRegistry } from '../../src/modifiers/registerBuiltins.js';
import type { Diagnostic } from '../../src/diagnostics/Diagnostic.js';

function lowerSource(src: string): Diagnostic[] {
  const result = parse(src, { filename: 'consumer.rozie' });
  if (!result.ast) {
    throw new Error(
      `parse() returned null AST: ${result.diagnostics.map((d) => d.message).join(', ')}`,
    );
  }
  const { diagnostics } = lowerToIR(result.ast, {
    modifierRegistry: createDefaultRegistry(),
  });
  return diagnostics;
}

/** Wrap a `<template>` body fragment into a complete .rozie source. */
function rozie(templateBody: string, dataBlock = '{ k: 1 }'): string {
  return `<rozie name="MatchProbe">
<data>
${dataBlock}
</data>
<template>
${templateBody}
</template>
</rozie>
`;
}

function byCode(diags: Diagnostic[], code: string): Diagnostic[] {
  return diags.filter((d) => d.code === code);
}

describe('r-match diagnostics — ROZ953..ROZ959 (R6/R7)', () => {
  // ROZ953 — empty r-match (no discriminant value).
  it('ROZ953 — flags <template r-match> with no value', () => {
    const diags = lowerSource(
      rozie(`<template r-match>
  <span r-case="1">one</span>
  <span r-default>other</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ953');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ROZ954 — a direct child of an r-match host that is neither r-case nor
  // r-default.
  it('ROZ954 — flags a stray non-case child of an r-match host', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-case="1">one</span>
  <span class="stray">not a case</span>
  <span r-default>other</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ954');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ROZ955 — a valueless r-case (message nudges toward r-default).
  it('ROZ955 — flags a valueless r-case', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-case>missing value</span>
  <span r-default>other</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ955');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ROZ956 — r-case and r-for on the same element.
  it('ROZ956 — flags r-case + r-for on the same element', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-case="1" r-for="x in [1, 2]" :key="x">{{ x }}</span>
  <span r-default>other</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ956');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ROZ957 — r-default is not the last branch.
  it('ROZ957 — flags r-default that is not the last branch', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-default>other</span>
  <span r-case="1">one</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ957');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
  });

  // ROZ958 — more than one r-default.
  it('ROZ958 — flags more than one r-default', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-case="1">one</span>
  <span r-default>first default</span>
  <span r-default>second default</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ958');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    // WR-01 — a pure duplicate-default input must emit ONLY ROZ958. The
    // second r-default that is itself the last branch is a duplicate, not
    // "not last": ROZ957 (MATCH_DEFAULT_NOT_LAST) must NOT fire here.
    const misorder = byCode(diags, 'ROZ957');
    expect(misorder.length, JSON.stringify(misorder)).toBe(0);
  });

  // ROZ959 — duplicate literal r-case value (WARNING, first wins) — and the
  // source still COMPILES (no error diagnostics).
  it('ROZ959 — warns on a duplicate literal r-case value and still compiles', () => {
    const diags = lowerSource(
      rozie(`<template r-match="$data.k">
  <span r-case="1">one</span>
  <span r-case="1">one again</span>
  <span r-default>other</span>
</template>`),
    );
    const hits = byCode(diags, 'ROZ959');
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('warning');
    // ROZ959 is non-fatal — compilation still succeeds.
    expect(diags.filter((d) => d.severity === 'error')).toEqual([]);
  });
});
