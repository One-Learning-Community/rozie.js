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
