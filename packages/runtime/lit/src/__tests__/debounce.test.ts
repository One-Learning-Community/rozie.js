/**
 * Quick task 260521-qsh — debounce timer-logic tests for @rozie/runtime-lit.
 *
 * Mirrors @rozie/runtime-vue's debounce.test.ts: fake timers in a try/finally.
 * Lit's debounce has no framework cleanup hook — the caller drains `.cancel()`
 * — so coverage is purely timer logic plus `.cancel()`.
 */
import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../debounce.js';

describe('debounce — runtime-lit', () => {
  it('collapses rapid calls into one fire with the latest args after ms', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced(1);
      debounced(2);
      debounced(3);

      // Before the window expires — fn not called.
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      // Past the window — fn fires once with the LATEST args.
      vi.advanceTimersByTime(60);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('calling again before ms resets the timer (clearTimeout reset branch)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('a');
      vi.advanceTimersByTime(80);
      // Re-call before the first window elapses — resets the timer.
      debounced('b');
      vi.advanceTimersByTime(80);
      // 160ms total elapsed but only 80ms since the reset — no fire yet.
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(30);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('b');
    } finally {
      vi.useRealTimers();
    }
  });

  it('.cancel() clears a pending timer — fn never fires', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced('x');
      debounced.cancel();
      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('.cancel() is a safe no-op when nothing is pending', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      // No prior call — cancel must not throw.
      expect(() => debounced.cancel()).not.toThrow();
      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
