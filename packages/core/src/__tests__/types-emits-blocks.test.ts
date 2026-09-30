import { describe, expect, it } from 'vitest';
import { parse } from '../parse.js';
import { RozieErrorCode } from '../diagnostics/codes.js';

const wrap = (blocks: string) =>
  `<rozie name="Probe">\n${blocks}\n<template>\n<div></div>\n</template>\n</rozie>\n`;

describe('<types> / <emits> blocks', () => {
  it('parses a <types> block with generics (opaque: `<`/`>` do not desync the splitter)', () => {
    const { ast, diagnostics } = parse(
      wrap(`<types>\nimport type { Calendar } from '@fullcalendar/core'\nexport interface Row<T> { value: T; list: Array<Map<string, T>> }\nexport type Tone = 'a' | 'b'\ntype Local = { x: number }\nexport type { Calendar }\n</types>`),
      { filename: 'Probe.rozie' },
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ast!.types!.program.body).toHaveLength(5);
    expect(ast!.template).not.toBeNull();
  });
  it.each([
    ['a value import', `import { Calendar } from '@fullcalendar/core'`],
    ['runtime code', 'const x = 1'],
    ['an enum', 'export enum E { A }'],
    ['declare const', 'declare const x: number'],
    ['a function', 'export function f() {}'],
    ['a value export', 'export { x }'],
    ['an inline type specifier import', `import { type A } from 'a'`],
  ])('ROZ019 for %s', (_l, stmt) => {
    const { diagnostics } = parse(wrap(`<types>\n${stmt}\n</types>`), { filename: 'Probe.rozie' });
    expect(diagnostics.map((d) => d.code)).toContain(RozieErrorCode.TYPES_BLOCK_DISALLOWED_STATEMENT);
  });
  it('ROZ020 for invalid TypeScript', () => {
    const { diagnostics } = parse(wrap('<types>\nexport interface {\n</types>'), { filename: 'Probe.rozie' });
    expect(diagnostics.map((d) => d.code)).toContain(RozieErrorCode.TYPES_BLOCK_PARSE_ERROR);
  });
  it('parses an <emits> object literal', () => {
    const { ast, diagnostics } = parse(
      wrap(`<emits>\n{\n  ping: { payload: 'PingPayload', docs: { description: 'x' } },\n  'row-open': {},\n}\n</emits>`),
      { filename: 'Probe.rozie' },
    );
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(ast!.emits!.expression.properties).toHaveLength(2);
  });
  it('<emits> that is not an object literal is ROZ011', () => {
    const { diagnostics } = parse(wrap('<emits>\n[1]\n</emits>'), { filename: 'Probe.rozie' });
    expect(diagnostics.map((d) => d.code)).toContain(RozieErrorCode.NOT_OBJECT_LITERAL);
  });
  it('the ROZ003 message lists the new blocks', () => {
    const { diagnostics } = parse(wrap('<nope></nope>'), { filename: 'Probe.rozie' });
    const d = diagnostics.find((x) => x.code === RozieErrorCode.UNKNOWN_TOP_LEVEL_BLOCK)!;
    expect(d.message).toContain('<types>');
    expect(d.message).toContain('<emits>');
  });
  it('a component with neither block has null fields (byte-identity precondition)', () => {
    const { ast } = parse(wrap(''), { filename: 'Probe.rozie' });
    expect(ast!.types).toBeNull();
    expect(ast!.emits).toBeNull();
  });
});
