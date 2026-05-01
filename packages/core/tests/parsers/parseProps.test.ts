// PARSE-02 (props side) — <props> block parser tests.
// Implementation: packages/core/src/parsers/parseProps.ts (Plan 03 Task 1).
// Anchors paths per RESEARCH.md Pitfall 8.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type {
  ObjectProperty,
  ObjectExpression,
  Identifier,
  UnaryExpression,
  ArrowFunctionExpression,
  ArrayExpression,
} from '@babel/types';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseProps } from '../../src/parsers/parseProps.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = resolve(__dirname, '../../../../examples');

function loadExampleProps(name: string) {
  const source = readFileSync(resolve(EXAMPLES_DIR, `${name}.rozie`), 'utf8');
  const blocks = splitBlocks(source, `${name}.rozie`);
  if (!blocks.props) throw new Error(`${name}.rozie has no <props> block`);
  return { source, content: blocks.props.content, contentLoc: blocks.props.contentLoc };
}

/** Walk a properties array and find the ObjectProperty whose key Identifier matches `name`. */
function findKey(obj: ObjectExpression, name: string): ObjectProperty | undefined {
  return obj.properties.find(
    (p): p is ObjectProperty =>
      p.type === 'ObjectProperty' &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name)),
  );
}

describe('parseProps (PARSE-02)', () => {
  it('parses Counter.rozie <props> with Number identifier and -Infinity unary', () => {
    const { source, content, contentLoc } = loadExampleProps('Counter');
    const { node, diagnostics } = parseProps(content, contentLoc, source, 'Counter.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.expression.type).toBe('ObjectExpression');
    expect(node!.expression.properties.length).toBe(4);

    // value: { type: Number, default: 0, model: true }
    const valueProp = findKey(node!.expression, 'value');
    expect(valueProp).toBeDefined();
    expect(valueProp!.value.type).toBe('ObjectExpression');
    const valueInner = valueProp!.value as ObjectExpression;
    const valueTypeProp = findKey(valueInner, 'type');
    expect(valueTypeProp).toBeDefined();
    // `Number` is an Identifier reference — JSON5 cannot parse this.
    expect(valueTypeProp!.value.type).toBe('Identifier');
    expect((valueTypeProp!.value as Identifier).name).toBe('Number');

    // min: { type: Number, default: -Infinity }
    const minProp = findKey(node!.expression, 'min');
    expect(minProp).toBeDefined();
    const minInner = minProp!.value as ObjectExpression;
    const minDefault = findKey(minInner, 'default');
    expect(minDefault).toBeDefined();
    expect(minDefault!.value.type).toBe('UnaryExpression');
    const minUnary = minDefault!.value as UnaryExpression;
    expect(minUnary.operator).toBe('-');
    expect(minUnary.argument.type).toBe('Identifier');
    expect((minUnary.argument as Identifier).name).toBe('Infinity');
  });

  it('parses TodoList.rozie <props> with arrow-function default factory', () => {
    const { source, content, contentLoc } = loadExampleProps('TodoList');
    const { node, diagnostics } = parseProps(content, contentLoc, source, 'TodoList.rozie');
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();

    // items: { type: Array, default: () => [], model: true }
    const itemsProp = findKey(node!.expression, 'items');
    expect(itemsProp).toBeDefined();
    const itemsInner = itemsProp!.value as ObjectExpression;
    const itemsType = findKey(itemsInner, 'type');
    expect((itemsType!.value as Identifier).name).toBe('Array');

    const itemsDefault = findKey(itemsInner, 'default');
    expect(itemsDefault!.value.type).toBe('ArrowFunctionExpression');
    const arrow = itemsDefault!.value as ArrowFunctionExpression;
    expect(arrow.body.type).toBe('ArrayExpression');
    expect((arrow.body as ArrayExpression).elements.length).toBe(0);
  });

  it('threads absolute byte offsets via parserPositionFor (D-11/D-12)', () => {
    // Inner Babel AST nodes carry loc.start.index = absolute offset in the
    // .rozie source, NOT block-relative. Validate by slicing.
    const { source, content, contentLoc } = loadExampleProps('Counter');
    const { node } = parseProps(content, contentLoc, source, 'Counter.rozie');
    const valueProp = findKey(node!.expression, 'value');
    // The Identifier `value` (the key) lives at the absolute offset in source.
    const keyNode = valueProp!.key as Identifier;
    const absStart = keyNode.loc?.start.index ?? keyNode.start;
    expect(typeof absStart).toBe('number');
    // The slice at the absolute offset should start with the literal "value"
    // identifier from Counter.rozie (within the props block).
    expect(source.slice(absStart!, absStart! + 5)).toBe('value');
    // And the absolute offset is well inside the props content range.
    expect(absStart!).toBeGreaterThanOrEqual(contentLoc.start);
    expect(absStart!).toBeLessThan(contentLoc.end);
  });

  it('emits ROZ010 on invalid JS expression', () => {
    const synthetic = '{ value: ??? }';
    const { node, diagnostics } = parseProps(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(node).toBeNull();
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.code).toBe('ROZ010');
  });

  it('emits ROZ011 when block is not an object literal (top-level number)', () => {
    const synthetic = '42';
    const { node, diagnostics } = parseProps(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(node).toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ011')).toBe(true);
  });

  it('emits ROZ011 when block is not an object literal (top-level array)', () => {
    const synthetic = '[1, 2, 3]';
    const { node, diagnostics } = parseProps(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(node).toBeNull();
    expect(diagnostics.some(d => d.code === 'ROZ011')).toBe(true);
  });

  it('does NOT throw on hostile input — D-08 collected-not-thrown contract', () => {
    const synthetic = '{ <<< invalid <<<';
    let threw = false;
    try {
      parseProps(synthetic, { start: 0, end: synthetic.length }, synthetic);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('treats __proto__ key as ordinary ObjectProperty (T-1-03-01 prototype-pollution mitigation)', () => {
    const synthetic = '{ __proto__: { polluted: true } }';
    const { node, diagnostics } = parseProps(synthetic, { start: 0, end: synthetic.length }, synthetic);
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    const proto = node!.expression.properties[0] as ObjectProperty;
    // Key remains a string-shape; no host object is mutated.
    const keyName =
      proto.key.type === 'Identifier'
        ? proto.key.name
        : proto.key.type === 'StringLiteral'
          ? proto.key.value
          : null;
    expect(keyName).toBe('__proto__');
    // Confirm no actual prototype pollution happened on a fresh empty object.
    const fresh = {};
    expect(('polluted' in fresh)).toBe(false);
  });
});
