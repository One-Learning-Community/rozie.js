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
 *
 * quick 261019-ti9 (RK-1) — the same holds for a SINGLE-root keyed loop whose only
 * child is one r-if chain or r-match. 9g1 pinned the opposite ("a single-root
 * branch keeps the key") and that was wrong: the 260711-cy1 path already makes a
 * keyed `<Fragment key>` the array item for a mustache body (a conditional always
 * emits a mustache), so the branch elements repeated the key redundantly (TS2367
 * when it re-tests the narrowed discriminant). The array item (the keyed Fragment,
 * or a host-element r-match's host) carries the key exactly once.
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

  const KEY = `item === 'gap' ? 'gap-' + index : item`;
  const count = (jsx: string, needle: string): number => jsx.split(needle).length - 1;

  it('single-root r-if: the Fragment is the keyed array item, the branch element carries no key', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item"><span r-if="item !== 'gap'">{{ item }}</span></template></div>
</template>
</rozie>
`);
    expect(jsx).toContain(`<Fragment key={${KEY}}>`);
    expect(count(jsx, KEY)).toBe(1);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('single-root r-if / r-else chain: one key on the Fragment, none on any branch', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item"><i r-if="item === 'gap'">gap</i><span r-else>{{ item }}</span></template></div>
</template>
</rozie>
`);
    expect(jsx).toContain(`<Fragment key={${KEY}}>`);
    expect(count(jsx, KEY)).toBe(1);
    expect(jsx).not.toMatch(/<i key=/);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('single-root hostless r-match (inline discriminant): one key on the Fragment', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item"><template r-match="item"><i r-case="'gap'">gap</i><span r-default>{{ item }}</span></template></template></div>
</template>
</rozie>
`);
    expect(jsx).toContain(`<Fragment key={${KEY}}>`);
    expect(count(jsx, KEY)).toBe(1);
    expect(jsx).not.toMatch(/<i key=/);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('single-root hostless r-match (hoisted discriminant): one key on the Fragment', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<script>
const kindOf = (v) => v
</script>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item"><template r-match="kindOf(item)"><i r-case="'gap'">gap</i><span r-default>{{ item }}</span></template></template></div>
</template>
</rozie>
`);
    expect(jsx).toContain(`<Fragment key={${KEY}}>`);
    expect(count(jsx, KEY)).toBe(1);
    expect(jsx).not.toMatch(/<i key=/);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('single-root host-element r-match: the host carries the key once, the branches none', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item, index in $data.items" :key="item === 'gap' ? 'gap-' + index : item"><div r-match="item"><i r-case="'gap'">gap</i><span r-default>{{ item }}</span></div></template></div>
</template>
</rozie>
`);
    expect(jsx).toMatch(/<div key=\{item === 'gap' \? 'gap-' \+ index : item\}/);
    expect(count(jsx, KEY)).toBe(1);
    expect(jsx).not.toMatch(/<i key=/);
    expect(jsx).not.toMatch(/<span key=/);
  });

  it('NO-REGRESS: a single-root ELEMENT body still keys the element', () => {
    const { jsx } = emit(`
<rozie name="X">
<data>{ items: [] }</data>
<template>
<div><template r-for="item in $data.items" :key="item.id"><li>{{ item.id }}</li></template></div>
</template>
</rozie>
`);
    expect(jsx).toMatch(/<li key=\{item\.id\}/);
    expect(jsx).not.toContain('<Fragment key=');
  });
});
