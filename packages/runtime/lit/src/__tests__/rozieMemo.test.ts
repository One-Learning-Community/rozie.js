/**
 * Quick 260828-sdw — `rozieMemo` unit tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { rozieMemo } from '../rozieMemo.js';

describe('rozieMemo — runtime-lit', () => {
  it('empty deps: repeated calls return the FIRST computed value by identity and compute runs once', () => {
    const host = {};
    const compute = vi.fn(() => ({ nested: () => 1 }));

    const first = rozieMemo(host, 'x', [], compute);
    const second = rozieMemo(host, 'x', [], compute);
    const third = rozieMemo(host, 'x', [], compute);

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('changed dep: a call whose dep differs by Object.is runs compute again and returns the new value', () => {
    const host = {};
    let n = 0;
    const compute = vi.fn(() => ({ n: ++n }));

    const first = rozieMemo(host, 'x', ['a'], compute);
    const second = rozieMemo(host, 'x', ['b'], compute);

    expect(second).not.toBe(first);
    expect(compute).toHaveBeenCalledTimes(2);
    expect((second as { n: number }).n).toBe(2);
  });

  it('unchanged deps: a call whose deps are all Object.is-equal returns the cached value without running compute', () => {
    const host = {};
    const compute = vi.fn(() => ({}));

    const dep = { shared: true };
    const first = rozieMemo(host, 'x', [dep, 1, 'a'], compute);
    const second = rozieMemo(host, 'x', [dep, 1, 'a'], compute);

    expect(second).toBe(first);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('distinct keys on the same host do not share a cache entry', () => {
    const host = {};
    const computeA = vi.fn(() => ({ tag: 'a' }));
    const computeB = vi.fn(() => ({ tag: 'b' }));

    const a = rozieMemo(host, 'a', [], computeA);
    const b = rozieMemo(host, 'b', [], computeB);

    expect(a).not.toBe(b);
    expect(computeA).toHaveBeenCalledTimes(1);
    expect(computeB).toHaveBeenCalledTimes(1);
  });

  it('distinct hosts with the same key do not share a cache entry', () => {
    const hostA = {};
    const hostB = {};
    const compute = vi.fn(() => ({}));

    const a = rozieMemo(hostA, 'x', [], compute);
    const b = rozieMemo(hostB, 'x', [], compute);

    expect(a).not.toBe(b);
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('deps of different length are treated as a miss', () => {
    const host = {};
    const compute = vi.fn(() => ({}));

    const first = rozieMemo(host, 'x', [1, 2], compute);
    const second = rozieMemo(host, 'x', [1, 2, 3], compute);
    const third = rozieMemo(host, 'x', [1], compute);

    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
    expect(compute).toHaveBeenCalledTimes(3);
  });
});
