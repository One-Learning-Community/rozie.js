// SEM-02 — reservedIdentifierValidator (ROZ202).
//
// Rozie reserves a fixed set of `$`-prefixed sigils ($el / $props / $data /
// $refs / $slots / $emit / $event) as built-in accessors and emit-scope
// identifiers. A user `<data>` field or `r-for` loop variable that shadows
// one of them would be silently captured by the emitted code — e.g. an
// `r-for` loop var named `$event` shadows the handler closure param. ROZ202
// catches the collision at compile time.
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';
import { RESERVED_SIGILS } from '../../src/semantic/validators/reservedIdentifierValidator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags
        .map((d) => d.message)
        .join(', ')}`,
    );
  }
  return { src: source, ast, ...analyzeAST(ast) };
}

function roz202(diags: { code: string }[]) {
  return diags.filter((d) => d.code === 'ROZ202');
}

describe('reservedIdentifierValidator — ROZ202', () => {
  it('reserved set matches the 15 documented sigils', () => {
    expect([...RESERVED_SIGILS].sort()).toEqual(
      // Phase 14 added `$attrs` — consumer-passed attribute cluster.
      // Phase 15 added `$listeners` — consumer-passed listener cluster.
      // Phase 16 added `$restoreFocus` — keyed-list focus-restoration sigil.
      // Phase 18 added `$model` — producer-side two-way-write sigil.
      // Phase 21 added `$expose` — producer-side imperative-handle sigil.
      // Phase 36 added `$provide` / `$inject` — cross-component context sigils.
      // Phase 45 added `$clone` — target-rewritten deep-clone call-form sigil.
      [
        '$attrs',
        '$clone',
        '$data',
        '$el',
        '$emit',
        '$event',
        '$expose',
        '$inject',
        '$listeners',
        '$model',
        '$props',
        '$provide',
        '$refs',
        '$restoreFocus',
        '$slots',
      ].sort(),
    );
  });

  it('reserves the Phase 36 context sigils ($provide / $inject)', () => {
    expect(RESERVED_SIGILS.has('$provide')).toBe(true);
    expect(RESERVED_SIGILS.has('$inject')).toBe(true);
  });

  it('flags a <data> field that shadows $provide or $inject (ROZ202)', () => {
    for (const sigil of ['$provide', '$inject']) {
      const src = `<rozie name="X">
<data>{ ${JSON.stringify(sigil)}: 0 }</data>
<template><div></div></template>
</rozie>`;
      const { diagnostics } = analyzeSource(src, `data-${sigil}.rozie`);
      const hits = roz202(diagnostics);
      expect(hits.length, `<data> field ${sigil} should emit exactly one ROZ202`).toBe(1);
      expect(hits[0]!.severity).toBe('error');
      expect(hits[0]!.message).toContain(sigil);
    }
  });

  it('flags an r-for loop variable that shadows $provide or $inject (ROZ202)', () => {
    for (const sigil of ['$provide', '$inject']) {
      const src = `<rozie name="X">
<template>
<ul><li r-for="${sigil} in items" :key="${sigil}">x</li></ul>
</template>
</rozie>`;
      const { diagnostics } = analyzeSource(src, `rfor-${sigil}.rozie`);
      const hits = roz202(diagnostics);
      expect(hits.length, `r-for var ${sigil} should emit exactly one ROZ202`).toBe(1);
      expect(hits[0]!.message).toContain('r-for loop variable');
    }
  });

  it('flags a <data> field named $event', () => {
    const src = `<rozie name="X">
<data>{ $event: 0 }</data>
<template><div></div></template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const hits = roz202(diagnostics);
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.severity).toBe('error');
    expect(hits[0]!.message).toContain('$event');
  });

  it('flags a <data> field for every reserved sigil', () => {
    for (const sigil of RESERVED_SIGILS) {
      const src = `<rozie name="X">
<data>{ ${JSON.stringify(sigil)}: 0 }</data>
<template><div></div></template>
</rozie>`;
      const { diagnostics } = analyzeSource(src, `data-${sigil}.rozie`);
      expect(
        roz202(diagnostics).length,
        `<data> field ${sigil} should emit exactly one ROZ202`,
      ).toBe(1);
    }
  });

  it('flags an r-for loop item named $event', () => {
    const src = `<rozie name="X">
<template>
<ul><li r-for="$event in items" :key="$event">x</li></ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const hits = roz202(diagnostics);
    expect(hits.length, JSON.stringify(hits)).toBe(1);
    expect(hits[0]!.message).toContain('r-for loop variable');
  });

  it('flags an r-for index alias named $event (paren form)', () => {
    const src = `<rozie name="X">
<template>
<ul><li r-for="(item, $event) in items" :key="item">x</li></ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(roz202(diagnostics).length).toBe(1);
  });

  it('emits one ROZ202 per distinct collision (data field + r-for var)', () => {
    const src = `<rozie name="X">
<data>{ $data: 1 }</data>
<template>
<ul><li r-for="$el in items" :key="$el">x</li></ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(roz202(diagnostics).length).toBe(2);
  });

  it('does NOT flag ordinary identifiers', () => {
    const src = `<rozie name="X">
<data>{ count: 0, items: [] }</data>
<template>
<ul><li r-for="(item, index) in items" :key="item.id">{{ item.label }}</li></ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(roz202(diagnostics)).toEqual([]);
  });

  it('the 5 reference examples produce zero ROZ202', () => {
    for (const name of ['Counter', 'Dropdown', 'Modal', 'SearchInput', 'TodoList']) {
      const { diagnostics } = analyzeSource(loadExample(name), `${name}.rozie`);
      expect(
        roz202(diagnostics),
        `${name}.rozie produced unexpected ROZ202 diagnostics`,
      ).toEqual([]);
    }
  });

  it('carries an in-bounds byte-offset loc', () => {
    const src = `<rozie name="X">
<template>
<ul><li r-for="$event in items" :key="$event">x</li></ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    const hit = roz202(diagnostics)[0]!;
    expect(hit.loc).toBeDefined();
    expect(hit.loc.start).toBeGreaterThanOrEqual(0);
    expect(hit.loc.end).toBeLessThanOrEqual(src.length);
    expect(hit.loc.end).toBeGreaterThan(hit.loc.start);
  });
});
