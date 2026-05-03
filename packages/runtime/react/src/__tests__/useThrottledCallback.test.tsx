/**
 * Plan 04-04 Task 1 — useThrottledCallback behaviour tests.
 *
 * Verify: leading-edge fire, trailing call at window boundary with last args,
 * stable identity, cleanup on unmount.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useThrottledCallback } from '../useThrottledCallback.js';

interface HarnessProps {
  fn: (...args: number[]) => void;
  ms: number;
  wrapperOut: { current: ((...args: number[]) => void) | null };
}

function Harness({ fn, ms, wrapperOut }: HarnessProps) {
  const wrapped = useThrottledCallback(fn, [], ms);
  wrapperOut.current = wrapped;
  return null;
}

describe('useThrottledCallback (Plan 04-04 Task 1 / Pattern 10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 11 — leading-edge fire then trailing at window boundary', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    render(<Harness fn={fn} ms={100} wrapperOut={wrap} />);

    // First call — leading edge fires immediately
    act(() => {
      wrap.current!(1);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);

    // 4 more rapid calls inside window — should be throttled
    act(() => {
      wrap.current!(2);
      wrap.current!(3);
      wrap.current!(4);
      wrap.current!(5);
    });
    expect(fn).toHaveBeenCalledTimes(1);

    // Trailing call fires at window boundary with LAST args (5)
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn.mock.calls[1]).toEqual([5]);
  });

  it('stable identity across re-renders', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    const { rerender } = render(<Harness fn={fn} ms={100} wrapperOut={wrap} />);
    const first = wrap.current;
    rerender(<Harness fn={fn} ms={100} wrapperOut={wrap} />);
    expect(wrap.current).toBe(first);
  });

  it('cleanup on unmount: trailing call does not fire', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    const { unmount } = render(<Harness fn={fn} ms={100} wrapperOut={wrap} />);
    act(() => {
      wrap.current!(1); // leading fires
      wrap.current!(2); // trailing scheduled
    });
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
