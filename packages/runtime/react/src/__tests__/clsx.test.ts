/**
 * Plan 04-04 Task 1 — clsx re-export sanity test.
 */
import { describe, it, expect } from 'vitest';
import { clsx } from '../clsx.js';

describe('clsx re-export (Plan 04-04 Task 1)', () => {
  it('joins classes from string and object forms', () => {
    expect(clsx('a', { b: true, c: false })).toBe('a b');
  });
  it('handles arrays + nested falsy', () => {
    expect(clsx(['a', null, undefined, false, 'd'])).toBe('a d');
  });
});
