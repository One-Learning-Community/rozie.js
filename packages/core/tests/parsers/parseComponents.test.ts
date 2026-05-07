// Phase 06.2 P1 Task 1 — <components> block parser tests.
// Implementation: packages/core/src/parsers/parseComponents.ts.
import { describe, expect, it } from 'vitest';
import type { ObjectExpression, ObjectProperty } from '@babel/types';
import { splitBlocks } from '../../src/splitter/splitBlocks.js';
import { parseComponents } from '../../src/parsers/parseComponents.js';
import { parse } from '../../src/parse.js';

function findKey(obj: ObjectExpression, name: string): ObjectProperty | undefined {
  return obj.properties.find(
    (p): p is ObjectProperty =>
      p.type === 'ObjectProperty' &&
      ((p.key.type === 'Identifier' && p.key.name === name) ||
        (p.key.type === 'StringLiteral' && p.key.value === name)),
  );
}

describe('splitBlocks recognizes <components> (Phase 06.2 P1 Task 1)', () => {
  it('splits a <components> block without ROZ003', () => {
    const src =
      '<rozie name="Foo"><components>{ Bar: "./Bar.rozie" }</components></rozie>';
    const result = splitBlocks(src, 'Foo.rozie');
    // No ROZ003 (UNKNOWN_TOP_LEVEL_BLOCK) for <components>.
    expect(result.diagnostics.find((d) => d.code === 'ROZ003')).toBeUndefined();
    expect(result.components).toBeDefined();
    expect(result.components!.content.trim()).toBe('{ Bar: "./Bar.rozie" }');
    // Byte-accurate: source[loc.start] === '<', source[loc.end - 1] === '>'.
    expect(src[result.components!.loc.start]).toBe('<');
    expect(src[result.components!.loc.end - 1]).toBe('>');
    expect(src.slice(result.components!.contentLoc.start, result.components!.contentLoc.end)).toBe(
      result.components!.content,
    );
  });

  it('emits ROZ004 DUPLICATE_BLOCK on two <components> blocks', () => {
    const src =
      '<rozie name="Foo"><components>{}</components><components>{}</components></rozie>';
    const result = splitBlocks(src, 'Foo.rozie');
    const dups = result.diagnostics.filter((d) => d.code === 'ROZ004');
    expect(dups.length).toBe(1);
  });
});

describe('parseComponents (Phase 06.2 P1 Task 1)', () => {
  it('parses a valid <components> block (2 entries)', () => {
    const synthetic = '{ Modal: "./Modal.rozie", CardHeader: "./CardHeader.rozie" }';
    const { node, diagnostics } = parseComponents(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(diagnostics).toEqual([]);
    expect(node).not.toBeNull();
    expect(node!.type).toBe('ComponentsAST');
    expect(node!.expression.type).toBe('ObjectExpression');
    expect(node!.expression.properties.length).toBe(2);
    const modal = findKey(node!.expression, 'Modal');
    expect(modal).toBeDefined();
    expect(modal!.value.type).toBe('StringLiteral');
    if (modal!.value.type === 'StringLiteral') {
      expect(modal!.value.value).toBe('./Modal.rozie');
    }
  });

  it('emits ROZ011 NOT_OBJECT_LITERAL when block is an array', () => {
    const synthetic = '["Foo", "Bar"]';
    const { node, diagnostics } = parseComponents(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    expect(node).toBeNull();
    expect(diagnostics.some((d) => d.code === 'ROZ011')).toBe(true);
  });

  it('emits ROZ010 INVALID_DECLARATIVE_EXPRESSION on truncated input', () => {
    const synthetic = '{ Modal: ';
    const { diagnostics } = parseComponents(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    // Either ROZ010 from try/catch or lifted Babel errorRecovery errors — both flag ROZ010.
    expect(diagnostics.some((d) => d.code === 'ROZ010')).toBe(true);
  });

  it('emits a structural diagnostic when entry value is not a string literal (Task 1 placeholder)', () => {
    // SomeIdent is an Identifier, not a StringLiteral.
    const synthetic = '{ Modal: SomeIdent }';
    const { diagnostics } = parseComponents(
      synthetic,
      { start: 0, end: synthetic.length },
      synthetic,
    );
    // Task 1 uses ROZ011 placeholder; Task 4 upgrades to ROZ921.
    expect(
      diagnostics.some((d) => d.code === 'ROZ011' || d.code === 'ROZ921'),
    ).toBe(true);
  });

  it('does NOT throw on hostile input (D-08 collected-not-thrown)', () => {
    const synthetic = '{ <<< invalid <<<';
    let threw = false;
    try {
      parseComponents(
        synthetic,
        { start: 0, end: synthetic.length },
        synthetic,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('threads absolute byte offsets via parserPositionFor', () => {
    // Embed the components block in a real <rozie> envelope; the contentLoc
    // start should be non-zero; inner Babel AST node loc.start.index should be
    // an absolute offset in the .rozie source.
    const src = '<rozie name="Foo"><components>{ Modal: "./Modal.rozie" }</components></rozie>';
    const blocks = splitBlocks(src, 'Foo.rozie');
    expect(blocks.components).toBeDefined();
    const { node } = parseComponents(
      blocks.components!.content,
      blocks.components!.contentLoc,
      src,
      'Foo.rozie',
    );
    expect(node).not.toBeNull();
    const modal = findKey(node!.expression, 'Modal');
    expect(modal).toBeDefined();
    const keyNode = modal!.key;
    // The Identifier `Modal` is at an absolute offset in source.
    if (keyNode.type === 'Identifier') {
      const absStart = keyNode.loc?.start.index ?? keyNode.start;
      expect(typeof absStart).toBe('number');
      expect(src.slice(absStart!, absStart! + 5)).toBe('Modal');
    }
  });
});

describe('parse() coordinator wires parseComponents (Phase 06.2 P1 Task 1)', () => {
  it('populates ast.components when <components> block is present', () => {
    const src =
      '<rozie name="Card"><components>{ CardHeader: "./CardHeader.rozie" }</components><template><div></div></template></rozie>';
    const { ast, diagnostics } = parse(src, { filename: 'Card.rozie' });
    expect(ast).not.toBeNull();
    expect(ast!.components).not.toBeNull();
    expect(ast!.components!.expression.type).toBe('ObjectExpression');
    expect(ast!.components!.expression.properties.length).toBe(1);
    expect(ast!.blocks.components).toBeDefined();
    // No errors expected for this canonical shape.
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('keeps ast.components: null when <components> block is absent', () => {
    const src = '<rozie name="Foo"><template><div></div></template></rozie>';
    const { ast } = parse(src, { filename: 'Foo.rozie' });
    expect(ast).not.toBeNull();
    expect(ast!.components).toBeNull();
    expect(ast!.blocks.components).toBeUndefined();
  });
});
