/**
 * Quick task 260620-kby — rozieClass normalizer tests for @rozie/runtime-lit.
 *
 * runtime-solid/svelte/lit each ship a colocated, identical clsx-style
 * `rozieClass` (per the distribution model — no shared cross-package import);
 * this suite is mirrored verbatim across the three packages.
 */
import { describe, it, expect } from 'vitest';
import { rozieClass } from '../rozieClass.js';

describe('rozieClass', () => {
  it('passes a plain string through unchanged', () => {
    expect(rozieClass('a b')).toBe('a b');
    expect(rozieClass('solo')).toBe('solo');
  });

  it('flattens arrays, including nested arrays', () => {
    expect(rozieClass(['a', 'b'])).toBe('a b');
    expect(rozieClass(['a', ['b', 'c']])).toBe('a b c');
    expect(rozieClass(['a', ['b', ['c', 'd']]])).toBe('a b c d');
  });

  it('includes only truthy object keys', () => {
    expect(rozieClass({ a: true, b: false, c: 1 })).toBe('a c');
    expect(rozieClass({ a: 0, b: '', c: null, d: undefined, e: 'x' })).toBe('e');
  });

  it('merges all argument shapes with single spaces', () => {
    expect(rozieClass('base', ['x'], { y: true })).toBe('base x y');
    expect(rozieClass('base', ['x'], { y: false })).toBe('base x');
  });

  it('drops all falsy entries', () => {
    expect(rozieClass('a', null, undefined, false, '', 0)).toBe('a');
    expect(rozieClass(true, false, null, undefined)).toBe('');
  });

  it('returns an empty string for empty / nullish inputs', () => {
    expect(rozieClass({})).toBe('');
    expect(rozieClass([])).toBe('');
    expect(rozieClass(undefined)).toBe('');
    expect(rozieClass()).toBe('');
  });

  it('emits non-zero numeric tokens but drops 0', () => {
    expect(rozieClass(1, 2)).toBe('1 2');
    expect(rozieClass(0)).toBe('');
    expect(rozieClass([0, 1])).toBe('1');
  });

  it('never emits a token for a non-enumerable __proto__ literal key (prototype-pollution-safe)', () => {
    const obj = { active: true, __proto__: { polluted: true } } as Record<string, unknown>;
    expect(rozieClass(obj)).toBe('active');
    expect(rozieClass({ a: true })).toBe('a');
  });

  it('is pure/stateless — re-evaluation with different inputs yields the current string each call', () => {
    let cond = false;
    const evaluate = () => rozieClass(['a', cond && 'b']);
    expect(evaluate()).toBe('a');
    cond = true;
    expect(evaluate()).toBe('a b');
    cond = false;
    expect(evaluate()).toBe('a');
  });
});
