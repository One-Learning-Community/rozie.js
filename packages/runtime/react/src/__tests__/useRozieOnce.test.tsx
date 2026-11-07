/**
 * `useRozieOnce` — `.once` on a component event (a callback prop). One hook per listener; each
 * child instance is identified by its enclosing `r-for` keys, so every row fires once, and the
 * state survives re-renders (the wrapper is re-created every render with the current handler).
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRozieOnce } from '../useRozieOnce.js';

describe('useRozieOnce', () => {
  it('runs the handler once and passes its arguments through', () => {
    const { result } = renderHook(() => useRozieOnce());
    const calls: unknown[][] = [];
    const fn = result.current([], (...a: unknown[]) => calls.push(a));
    fn(1, 2);
    fn(3);
    expect(calls).toEqual([[1, 2]]);
  });

  it('stays fired across re-renders, and a later render calls nothing', () => {
    const { result, rerender } = renderHook(() => useRozieOnce());
    let first = 0;
    let second = 0;
    result.current([], () => first++)();
    rerender();
    result.current([], () => second++)();
    expect([first, second]).toEqual([1, 0]);
  });

  it('each loop key fires once on its own, including nested and object keys', () => {
    const { result } = renderHook(() => useRozieOnce());
    const hits: string[] = [];
    const row = { id: 1 };
    for (const keys of [['a'], ['a'], ['b'], ['a', 1], ['a', 1], [row], [row], [{ id: 1 }]]) {
      result.current(keys, () => hits.push(JSON.stringify(keys)))();
    }
    expect(hits).toEqual(['["a"]', '["b"]', '["a",1]', '[{"id":1}]', '[{"id":1}]']);
  });

  it('an undefined handler (optional callback prop) is a no-op that still uses up the once', () => {
    const { result } = renderHook(() => useRozieOnce());
    expect(() => result.current([], undefined)()).not.toThrow();
    let n = 0;
    result.current([], () => n++)();
    expect(n).toBe(0);
  });

  it('separate hook instances (separate listeners or components) do not share state', () => {
    const a = renderHook(() => useRozieOnce());
    const b = renderHook(() => useRozieOnce());
    let n = 0;
    act(() => {
      a.result.current([], () => n++)();
      b.result.current([], () => n++)();
    });
    expect(n).toBe(2);
  });
});
