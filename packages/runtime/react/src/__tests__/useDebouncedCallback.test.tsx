/**
 * Plan 04-04 Task 1 — useDebouncedCallback behaviour tests.
 *
 * Verify: trailing-edge fire, stable identity, cleanup on unmount,
 * always-fresh fn closure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useDebouncedCallback } from '../useDebouncedCallback.js';

interface HarnessProps {
  fn: (...args: number[]) => void;
  ms: number;
  /** Out-param: latest wrapper identity. */
  wrapperOut: { current: ((...args: number[]) => void) | null };
}

function Harness({ fn, ms, wrapperOut }: HarnessProps) {
  const wrapped = useDebouncedCallback(fn, [], ms);
  wrapperOut.current = wrapped;
  return null;
}

describe('useDebouncedCallback (Plan 04-04 Task 1 / Pattern 10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Test 8 — basic: 5 calls within window → fires ONCE with last args at boundary', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    render(<Harness fn={fn} ms={300} wrapperOut={wrap} />);

    act(() => {
      wrap.current!(1);
      wrap.current!(2);
      wrap.current!(3);
      wrap.current!(4);
      wrap.current!(5);
    });
    expect(fn).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(5);
  });

  it('Test 9 — stable identity across re-renders', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    const { rerender } = render(<Harness fn={fn} ms={300} wrapperOut={wrap} />);
    const first = wrap.current;
    rerender(<Harness fn={fn} ms={300} wrapperOut={wrap} />);
    const second = wrap.current;
    expect(first).toBe(second);
  });

  it('Test 10 — cleanup on unmount: pending fn does NOT fire', () => {
    const fn = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    const { unmount } = render(<Harness fn={fn} ms={300} wrapperOut={wrap} />);
    act(() => {
      wrap.current!(1);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it('always-fresh fn closure: latest fn fires after re-render', () => {
    const fnA = vi.fn();
    const fnB = vi.fn();
    const wrap = { current: null as ((...args: number[]) => void) | null };
    const { rerender } = render(<Harness fn={fnA} ms={300} wrapperOut={wrap} />);
    rerender(<Harness fn={fnB} ms={300} wrapperOut={wrap} />);

    act(() => {
      wrap.current!(7);
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).toHaveBeenCalledWith(7);
  });
});
