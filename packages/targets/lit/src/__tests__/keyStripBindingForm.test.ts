/**
 * WR-02 (Quick 260803-ibt) — narrow the Lit `key` strip to the BINDING form.
 *
 * `emitTemplate.ts:1479` previously read `if (attr.name === 'key') continue;`
 * — dropping `key` unconditionally regardless of `attr.kind` (static,
 * interpolated, or binding). The leak that fix addressed
 * (quick 260802-v1v seam 4) was the BINDING shape only (`:key="expr"` on an
 * `r-for` cell, consumed by `repeat()`'s key function) — but the blanket
 * `attr.name === 'key'` also silently swallowed a STATIC `key="literal"`
 * attribute on a plain element, a shape Svelte and Angular both still
 * render (their filters are `attr.kind === 'binding' && attr.name ===
 * 'key'` — `svelte/src/emit/emitTemplateNode.ts:334`,
 * `angular/src/emit/emitTemplateNode.ts:360`).
 *
 * This fixture carries BOTH shapes in one component:
 *   - a static `key="license-key"` attribute on a plain (non-looped)
 *     element — must RENDER as a DOM attribute in the Lit emit.
 *   - an `r-for` cell with a bound `:key="c"` — must still be STRIPPED
 *     (consumed by `repeat()`'s key function), preserving the seam-4 fix.
 */

import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitLit } from '../emitLit.js';

function compile(source: string, filename = 'KeyStripProbe.rozie'): string {
  const { ast } = parse(source, { filename });
  if (!ast) throw new Error('parse failed');
  const { ir } = lowerToIR(ast, { modifierRegistry: createDefaultRegistry() });
  if (!ir) throw new Error('lower failed');
  const { code } = emitLit(ir, { filename, source });
  return code;
}

const SRC = `<rozie name="KeyStripProbe">
<data>{ items: ['a', 'b'] }</data>
<template>
<div>
  <span key="license-key" class="static-key-probe">static</span>
  <i r-for="c in $data.items" :key="c" class="loop-key-probe">{{ c }}</i>
</div>
</template>
</rozie>
`;

describe('Lit key-strip narrowed to the binding form (Quick 260803-ibt WR-02)', () => {
  it('a static key="literal" attribute renders as a DOM attribute', () => {
    const code = compile(SRC);
    // Static attributes are emitted via literal template text, not a
    // `${…}` binding — the raw `key="license-key"` string must survive.
    expect(code).toContain('key="license-key"');
  });

  it("a bound r-for :key is still stripped — consumed by repeat()'s key function, not emitted as a DOM attribute", () => {
    const code = compile(SRC);
    // The loop uses repeat() with the key expression as its second arg;
    // it must NOT also appear as a literal/bound `key=` attribute on the
    // per-iteration <i> element.
    expect(code).toContain("from 'lit/directives/repeat.js'");
    expect(code).not.toMatch(/<i[^>]*\bkey=\$\{/);
    expect(code).not.toMatch(/<i[^>]*\bkey="c"/);
  });
});
