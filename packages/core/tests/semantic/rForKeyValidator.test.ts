// Plan 02-02 Task 3 — live tests for rForKeyValidator (SEM-03).
//
// Walks the template, locates elements with `r-for=...`, and emits:
//   ROZ300 — missing :key
//   ROZ301 — :key is the loop item or loop index variable
//   ROZ302 — :key is a non-primitive expression (object/array literal)
//
// Anchors Pitfall 6: alias detection in `(item, idx) in items` form must
// pick up `idx` as the index alias and warn on `:key="idx"` even when
// the user renamed `index`.
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../../src/parse.js';
import { analyzeAST } from '../../src/semantic/analyze.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const EXAMPLES = resolve(REPO_ROOT, 'examples');
const SYNTHETIC = resolve(__dirname, '../fixtures/synthetic');

function loadExample(name: string): string {
  return fs.readFileSync(resolve(EXAMPLES, `${name}.rozie`), 'utf8');
}

function loadSynthetic(name: string): string {
  return fs.readFileSync(resolve(SYNTHETIC, `${name}.rozie`), 'utf8');
}

function analyzeSource(source: string, filename = 'test.rozie') {
  const { ast, diagnostics: parseDiags } = parse(source, { filename });
  if (!ast) {
    throw new Error(
      `parse() returned null AST for ${filename}: ${parseDiags.map((d) => d.message).join(', ')}`,
    );
  }
  return { src: source, ast, parseDiags, ...analyzeAST(ast) };
}

function filterByCode(diags: { code: string }[], code: string) {
  return diags.filter((d) => d.code === code);
}

function filterByCodeRange(diags: { code: string }[], lo: number, hi: number) {
  return diags.filter((d) => {
    const m = d.code.match(/^ROZ(\d{3})$/);
    if (!m) return false;
    const n = Number(m[1]);
    return n >= lo && n <= hi;
  });
}

describe('rForKeyValidator — ROZ300/ROZ301/ROZ302 (SEM-03)', () => {
  it('TodoList.rozie: zero ROZ300..ROZ399 (uses :key="item.id")', () => {
    const { diagnostics } = analyzeSource(loadExample('TodoList'), 'TodoList.rozie');
    expect(filterByCodeRange(diagnostics, 300, 399)).toEqual([]);
  });

  it('all 5 reference examples: zero ROZ100..ROZ399', () => {
    for (const name of ['Counter', 'Dropdown', 'Modal', 'SearchInput', 'TodoList']) {
      const { diagnostics } = analyzeSource(loadExample(name), `${name}.rozie`);
      const semDiags = filterByCodeRange(diagnostics, 100, 399);
      expect(
        semDiags,
        `${name}.rozie produced unexpected ROZ100..ROZ399 diagnostics: ${JSON.stringify(semDiags)}`,
      ).toEqual([]);
    }
  });

  it('TodoList-no-key.rozie: emits exactly one ROZ300 with loc on the <li> opening tag', () => {
    const { src, diagnostics } = analyzeSource(
      loadSynthetic('TodoList-no-key'),
      'TodoList-no-key.rozie',
    );
    const roz300 = filterByCode(diagnostics, 'ROZ300');
    expect(roz300.length).toBe(1);
    const d = roz300[0]!;
    expect(d.severity).toBe('warning');
    expect(d.message).toMatch(/r-for/i);
    expect(d.message).toMatch(/:key/);
    // Loc should point at a span containing `<li r-for=` from the source.
    const span = src.slice(d.loc.start, d.loc.end);
    expect(span).toContain('r-for');
  });

  it('TodoList-index-key.rozie: emits exactly one ROZ301 with loc on the :key attr value', () => {
    const { src, diagnostics } = analyzeSource(
      loadSynthetic('TodoList-index-key'),
      'TodoList-index-key.rozie',
    );
    const roz301 = filterByCode(diagnostics, 'ROZ301');
    expect(roz301.length).toBe(1);
    const d = roz301[0]!;
    expect(d.severity).toBe('warning');
    // Loc should point at `index` substring of `:key="index"` value.
    const span = src.slice(d.loc.start, d.loc.end);
    expect(span).toContain('index');
  });

  it('synthetic :key="item" (loop variable): emits ROZ301', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="item in items" :key="item">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ301').length).toBe(1);
  });

  it('synthetic :key="{ id: item.id }" (non-primitive object literal): emits ROZ302', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="item in items" :key="{ id: item.id }">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ302').length).toBe(1);
  });

  it('synthetic :key="[item.id]" (non-primitive array literal): emits ROZ302', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="item in items" :key="[item.id]">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ302').length).toBe(1);
  });

  it('does NOT warn on :key="item.id ?? idx" (author-provided fallback per Pitfall 6)', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="(item, idx) in items" :key="item.id ?? idx">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCodeRange(diagnostics, 300, 399)).toEqual([]);
  });

  it('multiple r-for siblings — only the missing-key one emits ROZ300', () => {
    const src = `<rozie name="X">
<template>
<div>
  <ul>
    <li r-for="a in xs" :key="a.id">A</li>
    <li r-for="b in ys">B</li>
  </ul>
</div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ300').length).toBe(1);
  });

  it('r-for on a component element <MyRow> (no :key) — same ROZ300 emission', () => {
    const src = `<rozie name="X">
<template>
<div>
  <MyRow r-for="row in rows" />
</div>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ300').length).toBe(1);
  });

  it('does NOT throw on malformed r-for value (e.g., r-for="garbage") — D-08', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="garbage" :key="x">x</li>
</ul>
</template>
</rozie>`;
    const { ast } = parse(src, { filename: 'malformed.rozie' });
    if (!ast) return;
    expect(() => analyzeAST(ast)).not.toThrow();
  });

  it('alias-form (item, idx) in items + :key="idx" still triggers ROZ301 (Pitfall 6 alias detection)', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="(item, idx) in items" :key="idx">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCode(diagnostics, 'ROZ301').length).toBe(1);
  });

  it('does NOT warn on :key="item.id" (Member expression with id from loop var)', () => {
    const src = `<rozie name="X">
<template>
<ul>
  <li r-for="item in items" :key="item.id">x</li>
</ul>
</template>
</rozie>`;
    const { diagnostics } = analyzeSource(src);
    expect(filterByCodeRange(diagnostics, 300, 399)).toEqual([]);
  });
});
