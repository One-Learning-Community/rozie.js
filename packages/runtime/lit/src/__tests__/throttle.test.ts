/**
 * Quick task 260521-qsh — throttle timer-logic tests for @rozie/runtime-lit.
 *
 * Mirrors @rozie/runtime-vue's throttle.test.ts: leading-edge throttle with a
 * single trailing call, fake timers in a try/finally. Lit's throttle has no
 * framework cleanup hook — coverage is timer logic plus `.cancel()`.
 */
import { describe, it, expect, vi } from 'vitest';
import { throttle } from '../throttle.js';

describe('throttle — runtime-lit', () => {
  it('fires immediately on first call, suppresses calls within the window, trailing call fires with latest args', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1);
      // Leading-edge immediate fire.
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith(1);

      // Calls within the window are suppressed; a trailing call is pending.
      throttled(2);
      throttled(3);
      expect(fn).toHaveBeenCalledTimes(1);

      // Past the window — trailing call fires with the most-recent args.
      vi.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('.cancel() clears the pending trailing timer — trailing call never fires', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1);
      expect(fn).toHaveBeenCalledTimes(1);
      // Schedule a trailing call, then cancel before it fires.
      throttled(2);
      throttled.cancel();
      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('.cancel() is a safe no-op when no trailing timer is pending', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      // Leading-edge fire only, no pending trailing call.
      throttled(1);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(() => throttled.cancel()).not.toThrow();
      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
