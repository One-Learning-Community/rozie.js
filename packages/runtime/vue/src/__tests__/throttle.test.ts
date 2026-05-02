// @rozie/runtime-vue — throttle unit tests (Phase 3 Plan 04 Task 1).
//
// throttle<F>(fn, ms) fires immediately on the first call, then ignores
// invocations until `ms` has elapsed. A pending trailing call is scheduled
// when invocations occur during the window. Auto-cancel on Vue unmount when
// called inside setup (parallel to debounce).
import { describe, expect, it, vi } from 'vitest';
import { throttle } from '../throttle.js';

describe('throttle — D-41 helper contract', () => {
  it('Test 7: fires immediately on first call, then suppresses calls within the throttle window', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled(1);
      // Immediate fire.
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenLastCalledWith(1);

      // Calls within window are suppressed (immediate); a trailing call is
      // pending.
      throttled(2);
      throttled(3);
      expect(fn).toHaveBeenCalledTimes(1);

      // Past the window — trailing call fires.
      vi.advanceTimersByTime(120);
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenLastCalledWith(3);

      // The trailing call reset `last` to its fire time, so we need to
      // advance past the new window before the next immediate-fire eligibility.
      vi.advanceTimersByTime(120);
      throttled(4);
      expect(fn).toHaveBeenCalledTimes(3);
      expect(fn).toHaveBeenLastCalledWith(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
