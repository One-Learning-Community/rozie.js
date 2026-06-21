/**
 * Quick task 260620-rta — rozieStyle normalizer tests for @rozie/runtime-svelte.
 *
 * Svelte has no `styleMap`, so the helper serializes an object value to a CSS
 * declaration string. Pure string assertions (no DOM) — mirror the
 * rozieClass.test.ts shape.
 */
import { describe, it, expect } from 'vitest';
import { rozieStyle } from '../rozieStyle.js';

describe('rozieStyle (Svelte)', () => {
  it('serializes a non-empty object to a CSS declaration string (camelCase→kebab)', () => {
    expect(rozieStyle({ color: 'red', fontSize: '12px' })).toBe(
      'color: red; font-size: 12px',
    );
  });

  it('passes a non-empty string through verbatim', () => {
    expect(rozieStyle('opacity: 0.5')).toBe('opacity: 0.5');
  });

  it('emits custom properties verbatim and vendor prefixes kebab-cased', () => {
    expect(rozieStyle({ '--x': '50%', WebkitMask: 'foo' })).toBe(
      '--x: 50%; -webkit-mask: foo',
    );
  });

  it('drops nullish object entries', () => {
    expect(
      rozieStyle({ a: '1', b: null as unknown as string, c: undefined as unknown as string }),
    ).toBe('a: 1');
  });

  it('returns undefined for null / undefined', () => {
    expect(rozieStyle(null)).toBeUndefined();
    expect(rozieStyle(undefined)).toBeUndefined();
  });

  it('returns undefined for an empty / whitespace-only string', () => {
    expect(rozieStyle('')).toBeUndefined();
    expect(rozieStyle('   ')).toBeUndefined();
  });

  it('returns undefined for an empty object (and an all-nullish object)', () => {
    expect(rozieStyle({})).toBeUndefined();
    expect(rozieStyle({ a: null as unknown as string })).toBeUndefined();
  });

  it('is pure/stateless — re-evaluation yields the current string each call', () => {
    let size = '10px';
    const evaluate = () => rozieStyle({ fontSize: size });
    expect(evaluate()).toBe('font-size: 10px');
    size = '20px';
    expect(evaluate()).toBe('font-size: 20px');
  });
});
