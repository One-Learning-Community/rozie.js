// ROZ952 — typo'd colon-form directive did-you-mean.
//
// `r-model` is the only Rozie directive that takes a colon argument
// (`r-model:propName=` consumer-side two-way binding). A colon-form
// directive `r-<base>:<arg>` whose `<base>` is a Levenshtein near-miss of
// `model` (distance <= 2) but not exactly `model` is almost certainly a
// typo. Without ROZ952 the lowerer silently drops it — no directive branch
// matches `r-modle:open`, so the intended two-way binding just vanishes.
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

function withDirective(directive: string): string {
  return `<rozie name="Consumer">
<template>
<div ${directive}="true"></div>
</template>
</rozie>
`;
}

function roz952(diags: Diagnostic[]): Diagnostic[] {
  return diags.filter((d) => d.code === 'ROZ952');
}

describe('ROZ952 — typo\'d colon-form directive did-you-mean', () => {
  // `modle` (e/l transposition, distance 2), `mdoel` (o/d transposition,
  // distance 2), `modal` (a/e substitution, distance 1), `models` (extra s,
  // distance 1) are all near-misses of `model`.
  for (const base of ['modle', 'mdoel', 'modal', 'models']) {
    it(`flags r-${base}:open as a typo of r-model:open`, () => {
      const diags = lowerSource(withDirective(`r-${base}:open`));
      const hits = roz952(diags);
      expect(hits.length, JSON.stringify(hits)).toBe(1);
      expect(hits[0]!.severity).toBe('error');
      expect(hits[0]!.message).toContain(`r-${base}:open`);
      expect(hits[0]!.message).toContain('r-model:open');
    });
  }

  it('does NOT flag the correct r-model:open form', () => {
    const diags = lowerSource(withDirective('r-model:open'));
    expect(roz952(diags)).toEqual([]);
  });

  it('does NOT flag non-model colon directives (r-on:, r-bind: are not near-misses)', () => {
    for (const directive of ['r-on:click', 'r-bind:foo', 'r-slot:header']) {
      const diags = lowerSource(withDirective(directive));
      expect(roz952(diags), `${directive} should not trigger ROZ952`).toEqual([]);
    }
  });

  it('does NOT flag bare directives without a colon (r-show, r-html, r-text)', () => {
    for (const directive of ['r-show', 'r-html', 'r-text', 'r-model']) {
      const diags = lowerSource(withDirective(directive));
      expect(roz952(diags), `${directive} should not trigger ROZ952`).toEqual([]);
    }
  });

  it('carries an accurate byte-offset loc on the typo\'d attribute', () => {
    const src = withDirective('r-modle:open');
    const diags = lowerSource(src);
    const hit = roz952(diags)[0]!;
    expect(hit.loc).toBeDefined();
    expect(src.slice(hit.loc.start, hit.loc.end)).toContain('r-modle:open');
  });
});
