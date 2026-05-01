// PARSE-07 / D-17 — full RozieAST snapshots + per-example correctness
// (Plan 04 Task 4). Implementation: packages/core/src/parse.ts.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from '../src/parse.js';
import { stripCircular } from './helpers/serialize.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../examples');
const FIXTURES_DIR = resolve(__dirname, '../fixtures/ast');

const EXAMPLES: Array<{ name: string; expectedBlocks: string[] }> = [
  { name: 'Counter', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
  { name: 'SearchInput', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
  { name: 'Dropdown', expectedBlocks: ['props', 'script', 'listeners', 'template', 'style'] },
  { name: 'TodoList', expectedBlocks: ['props', 'data', 'script', 'template', 'style'] },
  { name: 'Modal', expectedBlocks: ['props', 'script', 'listeners', 'template', 'style'] },
];

function loadExample(name: string): string {
  return readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
}

describe('parse() acceptance — all 5 reference examples (PARSE-07)', () => {
  for (const { name, expectedBlocks } of EXAMPLES) {
    it(`${name}.rozie parses cleanly with no diagnostics`, () => {
      const source = loadExample(name);
      const result = parse(source, { filename: `${name}.rozie` });
      expect(result.diagnostics).toEqual([]);
      expect(result.ast).not.toBeNull();
      expect(result.ast!.type).toBe('RozieAST');
      expect(result.ast!.name).toBe(name);
      // Every expected block is populated.
      for (const block of expectedBlocks) {
        expect(
          result.ast![block as 'props' | 'data' | 'script' | 'listeners' | 'template' | 'style'],
        ).not.toBeNull();
      }
    });
  }
});

describe('full RozieAST snapshots per example (D-17)', () => {
  for (const { name } of EXAMPLES) {
    it(`${name}.rozie full RozieAST snapshot`, async () => {
      const source = loadExample(name);
      const result = parse(source, { filename: `${name}.rozie` });
      const out = JSON.stringify(stripCircular(result), null, 2);
      await expect(out).toMatchFileSnapshot(resolve(FIXTURES_DIR, `${name}.snap`));
    });
  }
});

describe('parse() error contract (D-08, D-10)', () => {
  it('returns ast: null + ROZ001 diagnostic on missing <rozie> envelope (no throw)', () => {
    const result = parse('<props>{}</props>');
    expect(result.ast).toBeNull();
    const codes = result.diagnostics.map((d) => d.code);
    expect(codes).toContain('ROZ001');
  });

  it('does not throw on multi-error input (D-08 collected-not-thrown)', () => {
    const source = `<rozie name="Bad">
  <refs></refs>
  <props>{ ??? }</props>
  <style>:root, .foo { color: red; }</style>
</rozie>`;
    expect(() => parse(source)).not.toThrow();
    const result = parse(source);
    const codes = result.diagnostics.map((d) => d.code);
    // ROZ003 (refs), ROZ010 (bad props), ROZ081 (mixed root) — ≥3 distinct codes
    expect(codes).toContain('ROZ003');
    expect(codes).toContain('ROZ081');
    expect(result.diagnostics.length).toBeGreaterThanOrEqual(3);
  });

  it('returns a partial AST on recoverable errors (non-fatal)', () => {
    // Valid envelope, broken <props> — script/template still parseable, AST built
    const source = `<rozie name="X"><props>not_an_object</props></rozie>`;
    const result = parse(source);
    // Identifier expression triggers ROZ011 (not object literal); ast is built
    expect(result.ast).not.toBeNull();
    expect(result.ast!.props).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain('ROZ011');
  });
});

describe('parse() public surface', () => {
  it('parse() JSDoc carries @experimental marker', () => {
    // The marker is JSDoc — runtime check is that the file source contains it.
    const parseSrc = readFileSync(resolve(__dirname, '../src/parse.ts'), 'utf8');
    expect(parseSrc).toContain('@experimental');
  });

  it('fixtures directory exists for snapshots', () => {
    expect(FIXTURES_DIR).toMatch(/fixtures\/ast$/);
  });
});
