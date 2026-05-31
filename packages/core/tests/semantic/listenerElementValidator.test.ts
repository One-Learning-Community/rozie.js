// Phase 19 (D-08) — listenerElementValidator (ROZ206).
//
// A <listener> element belongs only inside <listeners>. Placed inside
// <template> it is a misplaced element: `r-if` on a <listener> means
// conditional attach/detach, NOT conditional render. ROZ206 is case-folded so
// both <listener> and PascalCase <Listener> trip it (never routed to component
// resolution / ROZ920).
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return analyzeAST(ast);
}

function roz206(diags: { code: string }[]) {
  return diags.filter((d) => d.code === 'ROZ206');
}

describe('listenerElementValidator — ROZ206', () => {
  it('emits exactly one ROZ206 for a lowercase <listener> inside <template>', () => {
    const src = `<rozie name="Bad">
<template>
  <div>
    <listener :target="document" @keydown="close()" />
  </div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const hits = roz206(diagnostics);
    expect(hits.length).toBe(1);
    // loc points at the misplaced element (non-zero span).
    expect(hits[0]!.loc.end).toBeGreaterThan(hits[0]!.loc.start);
  });

  it('emits exactly one ROZ206 for a PascalCase <Listener> inside <template> (case-fold)', () => {
    const src = `<rozie name="BadPascal">
<template>
  <Listener :target="window" @resize="r()" />
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const hits = roz206(diagnostics);
    expect(hits.length).toBe(1);
    // It must trip ROZ206, NOT be routed to component resolution (no ROZ920).
    expect(diagnostics.some((d) => d.code === 'ROZ920')).toBe(false);
  });

  it('emits zero ROZ206 when no <listener> appears in <template>', () => {
    const src = `<rozie name="Good">
<template>
  <div @click="onClick()">hello</div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(roz206(diagnostics).length).toBe(0);
  });

  it('never throws on a template with deeply nested misplaced listeners', () => {
    const src = `<rozie name="Nested">
<template>
  <div>
    <section>
      <listener :target="document" @keydown="k()" />
      <listener :target="window" @resize="r()" />
    </section>
  </div>
</template>
</rozie>`;
    let threw = false;
    let hits = 0;
    try {
      const { diagnostics } = analyzeSource(src);
      hits = roz206(diagnostics).length;
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // Two misplaced <listener> tags → two ROZ206 (one per element).
    expect(hits).toBe(2);
  });
});
