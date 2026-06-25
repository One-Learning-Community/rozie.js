/**
 * Unit tests for the pure resize math (the only branchy logic in the family).
 * Vendored alongside resizeMath.ts but EXCLUDED from leaves by copyInternal.
 */
import { describe, it, expect } from 'vitest';
import { clampPercent, percentFromPointer, nudge } from './resizeMath';

describe('clampPercent', () => {
  it('passes a value already in range', () => {
    expect(clampPercent(50, 10, 90)).toBe(50);
  });
  it('clamps below min', () => {
    expect(clampPercent(2, 10, 90)).toBe(10);
  });
  it('clamps above max', () => {
    expect(clampPercent(99, 10, 90)).toBe(90);
  });
  it('returns min on non-finite raw (NaN / Infinity are not finite)', () => {
    expect(clampPercent(NaN, 10, 90)).toBe(10);
    expect(clampPercent(Infinity, 10, 90)).toBe(10);
    expect(clampPercent(-Infinity, 10, 90)).toBe(10);
  });
  it('falls back to 0/100 bounds when min/max are non-finite', () => {
    expect(clampPercent(150, NaN, NaN)).toBe(100);
    expect(clampPercent(-5, NaN, NaN)).toBe(0);
  });
});

describe('percentFromPointer', () => {
  it('maps the leading edge to 0%', () => {
    expect(percentFromPointer(100, 100, 400)).toBe(0);
  });
  it('maps the trailing edge to 100%', () => {
    expect(percentFromPointer(500, 100, 400)).toBe(100);
  });
  it('maps the midpoint to 50%', () => {
    expect(percentFromPointer(300, 100, 400)).toBe(50);
  });
  it('returns 0 for a zero or negative extent', () => {
    expect(percentFromPointer(300, 100, 0)).toBe(0);
    expect(percentFromPointer(300, 100, -10)).toBe(0);
  });
  it('can exceed [0,100] before clamping (caller clamps)', () => {
    expect(percentFromPointer(50, 100, 400)).toBeLessThan(0);
    expect(percentFromPointer(600, 100, 400)).toBeGreaterThan(100);
  });
});

describe('nudge', () => {
  it('grows the first panel by delta and clamps', () => {
    expect(nudge(50, 5, 10, 90)).toBe(55);
    expect(nudge(88, 5, 10, 90)).toBe(90);
  });
  it('shrinks with a negative delta and clamps to min', () => {
    expect(nudge(12, -5, 10, 90)).toBe(10);
  });
  it('falls back to min when size is non-finite', () => {
    expect(nudge(NaN, 5, 10, 90)).toBe(15);
  });
});
