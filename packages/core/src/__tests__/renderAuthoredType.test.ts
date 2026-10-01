import { describe, expect, it } from 'vitest';
import * as t from '@babel/types';
import { parseAuthoredType, printTSType } from '../codegen/renderAuthoredType.js';

describe('parseAuthoredType', () => {
  it.each([
    ['string', 'string'],
    ["'info' | 'warn'", "'info' | 'warn'"],
    ['Row<T>[]', 'Row<T>[]'],
    ['{ a: number; b?: string }', '{\n  a: number;\n  b?: string;\n}'],
    ['(date: DateInput) => void', '(date: DateInput) => void'],
    ['() => Calendar | null', '() => Calendar | null'],
  ])('parses and normalises %s', (src, printed) => {
    const r = parseAuthoredType(src);
    expect('error' in r).toBe(false);
    if ('error' in r) return;
    expect(r.printed).toBe(printed);
    expect(printTSType(r.type)).toBe(printed);
  });
  it.each(['string;', '(x: => void', 'number number', '', 'a; b'])('rejects %j', (src) => {
    expect('error' in parseAuthoredType(src)).toBe(true);
  });
  it('returns a real TSType node', () => {
    const r = parseAuthoredType('() => void');
    expect('error' in r ? null : t.isTSFunctionType(r.type)).toBe(true);
  });
});

// Final fix wave L12: parse errors used to carry Babel's position inside the
// internal `type __RozieAuthored = …;` wrapper ("(1:31)"), which points nowhere
// in the author's string. The position is now relative to the type string.
describe('parseAuthoredType — error positions are relative to the author string (L12)', () => {
  it('single-line: column within the type string, no wrapper "(line:col)"', () => {
    const r = parseAuthoredType('number |');
    expect('error' in r).toBe(true);
    const msg = (r as { error: string }).error;
    expect(msg).not.toMatch(/\(\d+:\d+\)/);
    expect(msg).toMatch(/line 1, column 9 of the type string/);
  });
  it('multi-line: later lines keep their own column', () => {
    const r = parseAuthoredType('{\n  a: number\n  b: ]\n}');
    const msg = (r as { error: string }).error;
    expect(msg).not.toMatch(/\(\d+:\d+\)/);
    expect(msg).toMatch(/line 3, column \d+ of the type string/);
  });
});
