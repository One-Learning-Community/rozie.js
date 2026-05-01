// PARSE-02 (data side) — <data> block parser tests.
// Implementation: packages/core/src/parsers/parseData.ts (Plan 03 Task 1).
// Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type {
  ObjectProperty,
  ObjectExpression,
  BooleanLiteral,
  StringLiteral,
} from '@babel/types';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseData } from '../../src/parsers/parseData.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadExampleData(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.data) throw new Error(`${name}.rozie has no <data> block`);
  return { source, content: blocks.data.content, contentLoc: blocks.data.contentLoc };
}

function findKey(obj: ObjectExpression, name: string): ObjectProperty | undefined {
  return obj.properties.find(
    (p): p is ObjectProperty =>
      p.type === 'ObjectProperty' &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name)),
  );
}

describe('parseData (PARSE-02)', () => {
  it('parses Counter.rozie <data> { hovering: false }', () => {
    const { source, content, contentLoc } = loadExampleData('Counter');
    const { node, diagnostics } = parseData(content, contentLoc, source, 'Counter.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.expression.type).toBe('ObjectExpression');
    expect(node!.expression.properties.length).toBe(1);
    const hovering = findKey(node!.expression, 'hovering');
    expect(hovering).toBeDefined();
    expect(hovering!.value.type).toBe('BooleanLiteral');
    expect((hovering!.value as BooleanLiteral).value).toBe(false);
  });

  it("parses TodoList.rozie <data> { draft: '' } as StringLiteral", () => {
    const { source, content, contentLoc } = loadExampleData('TodoList');
    const { node, diagnostics } = parseData(content, contentLoc, source, 'TodoList.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    const draft = findKey(node!.expression, 'draft');
    expect(draft).toBeDefined();
    expect(draft!.value.type).toBe('StringLiteral');
    expect((draft!.value as StringLiteral).value).toBe('');
  });

  it("parses SearchInput.rozie <data> { query: '' }", () => {
    const { source, content, contentLoc } = loadExampleData('SearchInput');
    const { node, diagnostics } = parseData(content, contentLoc, source, 'SearchInput.rozie');
    expect(diagnostics).toEqual([]);
    const query = findKey(node!.expression, 'query');
    expect(query!.value.type).toBe('StringLiteral');
    expect((query!.value as StringLiteral).value).toBe('');
  });

  it('emits ROZ010 on invalid JS expression in <data>', () => {
    const synthetic = '{ ??? }';
    const { node, diagnostics } = parseData(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(node).toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ010')).toBe(true);
  });

  it('emits ROZ011 when <data> block is not an object literal', () => {
    const synthetic = '"a string"';
    const { node, diagnostics } = parseData(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(node).toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ011')).toBe(true);
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown', () => {
    const synthetic = '<<<<';
    let threw = false;
    try {
      parseData(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});
