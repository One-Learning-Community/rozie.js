/**
 * quick 261019-9g1 (orchestrator add-on A) — a keyed multi-root `<template r-for>`
 * carries the key on the enclosing `<Fragment key={...}>`; it must NOT repeat the
 * key on the branches of a conditional (r-if / r-else-if / r-else) or r-match
 * child.
 *
 * The repeated key is redundant (the Fragment already keys the row) and, when the
 * key expression re-tests the discriminant an r-if narrows
 * (`:key="item === 'gap' ? 'gap-' + index : item"`), it is a strict-tsc TS2367 in
 * the narrowed branch ("This comparison appears to be unintentional because the
 * types 'number' and '"gap"' have no overlap"). Element children keep their key
 * (unchanged output for every existing leaf).
 */
import type { IRComponent } from '@rozie/core';
import { createDefaultRegistry, lowerToIR, parse } from '@rozie/core';
import { describe, expect, it } from 'vitest';
import { emitTemplate } from '../emit/emitTemplate.js';
import {
  ReactImportCollector,
  RuntimeReactImportCollector,
} from '../rewrite/collectReactImports.js';

function lowerInline(rozie: string): IRComponent {
  const result = parse(rozie, { filename: 'inline.rozie' });
  if (!result.ast) throw new Error('parse failed');
  const lowered = lowerToIR(result.ast, { modifierRegistry: createDefaultRegistry() });
  if (!lowered.ir) throw new Error('lower failed');
  return lowered.ir;
}

function emit(rozie: string) {
  const collectors = {
    react: new ReactImportCollector(),
    runtime: new RuntimeReactImportCollector(),
  };
  return emitTemplate(lowerInline(rozie), collectors, createDefaultRegistry());
}

describe('keyed multi-root loop — conditional children do not repeat the key', () => {
  it('two r-if children: the Fragment is keyed, the branch elements are not', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item">
  <span r-if="item === 'gap'">gap</span>
  <span r-if="item !== 'gap'">{{ item }}</span>
</template></div>
</template>
</rozie>
`);
    expect(jsx).toContain(`<Fragment key={item === 'gap' ? 'gap-' + index : item}>`);
    // Exactly ONE occurrence of the key expression: the Fragment's.
    expect(jsx.split(`item === 'gap' ? 'gap-' + index : item`).length - 1).toBe(1);
    expect(jsx).toMatch(/!!\(item === 'gap'\) && <span[^>]*>gap<\/span>/);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('r-if / r-else chain child: the else branch element carries no key either', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item in $data.items" :key="item.id">
  <b>{{ item.id }}</b>
  <i r-if="item.ok">ok</i>
  <u r-else>no</u>
</template></div>
</template>
</rozie>
`);
    expect(jsx).toContain('<Fragment key={item.id}>');
    // The element child keeps its key (unchanged behaviour); the chain branches do not.
    expect(jsx).toMatch(/<b key=\{item\.id\}/);
    expect(jsx).not.toMatch(/<i key=/);
    expect(jsx).not.toMatch(/<u key=/);
  });

  it('NO-REGRESS: a single-root loop whose body is one r-if keeps the key on the branch element', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item in $data.items" :key="item.id"><span r-if="item.ok">ok</span></template></div>
</template>
</rozie>
`);
    expect(jsx).toMatch(/<span key=\{item\.id\}/);
  });
});
