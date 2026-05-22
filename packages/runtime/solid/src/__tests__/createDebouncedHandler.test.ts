/**
 * Quick task 260521-qsh — createDebouncedHandler tests for @rozie/runtime-solid.
 *
 * The helper calls `onCleanup` from solid-js, so every case is wrapped in
 * `createRoot((dispose) => { ... })`. Fake timers drive the debounce window.
 * Cancellation is via the reactive scope's `onCleanup` (no `.cancel()` method).
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { createDebouncedHandler } from '../createDebouncedHandler.js';

describe('createDebouncedHandler — runtime-solid', () => {
  it('collapses rapid calls into one fire after ms with the latest args', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const debounced = createDebouncedHandler(fn, 100);
        debounced(1);
        debounced(2);
        debounced(3);

        vi.advanceTimersByTime(50);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(60);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith(3);
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('a second call before ms resets the timer (clearTimeout reset branch)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const debounced = createDebouncedHandler(fn, 100);
        debounced('a');
        vi.advanceTimersByTime(80);
        // Re-call before the first window elapses — resets the timer.
        debounced('b');
        vi.advanceTimersByTime(80);
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(30);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('b');
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('dispose() before the window elapses cancels the pending timer via onCleanup', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const debounced = createDebouncedHandler(fn, 100);
        debounced('x');
        // Dispose the reactive scope before the window — onCleanup clears it.
        dispose();
      });
      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('default ms = 0 fires on the next timer tick', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      createRoot((dispose) => {
        const debounced = createDebouncedHandler(fn);
        debounced('zero');
        expect(fn).not.toHaveBeenCalled();
        vi.advanceTimersByTime(0);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith('zero');
        dispose();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
