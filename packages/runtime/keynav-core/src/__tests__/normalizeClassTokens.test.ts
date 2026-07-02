// Behavior tests for `normalizeClassTokens` — SPEC §9 (Landmine 4
// anti-drift: the shape->token-list step the imperative active-class
// toggle shares with `:class` semantics via `rozieClass`).
import { describe, expect, it } from 'vitest';
import { normalizeClassTokens } from '../normalizeClassTokens.js';

describe('normalizeClassTokens', () => {
  it("normalizeClassTokens('is-active') -> ['is-active']", () => {
    expect(normalizeClassTokens('is-active')).toEqual(['is-active']);
  });

  it("normalizeClassTokens(['is-active','ring']) -> ['is-active','ring']", () => {
    expect(normalizeClassTokens(['is-active', 'ring'])).toEqual(['is-active', 'ring']);
  });

  it("normalizeClassTokens({ 'is-active': true, off: false }) -> ['is-active'] (falsy keys dropped)", () => {
    expect(normalizeClassTokens({ 'is-active': true, off: false })).toEqual(['is-active']);
  });

  it('falsy object values are dropped, matching rozieClass parity — { x: false } -> []', () => {
    expect(normalizeClassTokens({ x: false })).toEqual([]);
  });

  it('nested/mixed args flatten like clsx/rozieClass', () => {
    expect(normalizeClassTokens('a', ['b', { c: true, d: false }], [['e'], 'f'])).toEqual(['a', 'b', 'c', 'e', 'f']);
  });

  it('whitespace-separated string tokens split into individual tokens', () => {
    expect(normalizeClassTokens('is-active ring')).toEqual(['is-active', 'ring']);
  });

  it('empty/nullish input -> []', () => {
    expect(normalizeClassTokens()).toEqual([]);
    expect(normalizeClassTokens(null, undefined, '', false, true)).toEqual([]);
  });

  it('numbers coerce to string tokens; zero is dropped like rozieClass', () => {
    expect(normalizeClassTokens(0, 1, 'a')).toEqual(['1', 'a']);
  });

  it('a literal __proto__ object key never emits a token (prototype-pollution-safe)', () => {
    // Object-literal `__proto__` is spec-special-cased to set [[Prototype]]
    // (a non-object value like `true` is ignored), so it never becomes an
    // own-enumerable key `Object.keys` would iterate — matching rozieClass.
    expect(normalizeClassTokens({ __proto__: true, safe: true })).toEqual(['safe']);
  });
});
