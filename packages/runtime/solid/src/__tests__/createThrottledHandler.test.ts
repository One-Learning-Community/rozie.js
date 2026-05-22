/**
 * Quick task 260521-qsh — createThrottledHandler tests for @rozie/runtime-solid.
 *
 * Leading-edge throttle: the first call fires immediately, subsequent calls
 * within the window are dropped, and a single trailing call is scheduled. The
 * helper calls `onCleanup`, so every case runs inside `createRoot`. Fake timers
 * drive the window.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { createThrottledHandler } from '../createThrottledHandler.js';

describe('createThrottledHandler — runtime-solid', () => {
  it('fires immediately on first call, suppresses calls within the window, fires one trailing call', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const throttled = createThrottledHandler(fn, 100);

        throttled(1);
        // Leading-edge immediate fire.
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenLastCalledWith(1);

        // Calls within the window are suppressed; a trailing call is scheduled.
        throttled(2);
        throttled(3);
        expect(fn).toHaveBeenCalledTimes(1);

        // Past the window — exactly one trailing call fires.
        vi.advanceTimersByTime(120);
        expect(fn).toHaveBeenCalledTimes(2);
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second in-window call does not schedule a duplicate trailing timer (timerId guard)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const throttled = createThrottledHandler(fn, 100);

        throttled(1);
        expect(fn).toHaveBeenCalledTimes(1);
        // Two in-window calls — the `timerId === undefined` guard means the
        // second does NOT schedule a second trailing timer.
        throttled(2);
        throttled(3);

        vi.advanceTimersByTime(500);
        // 1 leading + exactly 1 trailing — no duplicate.
        expect(fn).toHaveBeenCalledTimes(2);
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose() cancels a pending trailing timer via onCleanup', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const throttled = createThrottledHandler(fn, 100);
        throttled(1);
        expect(fn).toHaveBeenCalledTimes(1);
        // Schedule a trailing call, then dispose before it fires.
        throttled(2);
        dispose();
      });
      vi.advanceTimersByTime(500);
      // Only the leading-edge fire — the trailing call was cancelled.
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
