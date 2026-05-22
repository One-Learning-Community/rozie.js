// @rozie/runtime-vue — throttle unit tests (Phase 3 Plan 04 Task 1).
//
// throttle<F>(fn, ms) fires immediately on the first call, then ignores
// invocations until `ms` has elapsed. A pending trailing call is scheduled
// when invocations occur during the window. Auto-cancel on Vue unmount when
// called inside setup (parallel to debounce).
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
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

  // Quick task 260521-qsh — mirror debounce.test.ts Test 6: cancels the pending
  // trailing call on Vue unmount when called inside setup; no-op outside setup.
  // Closes the throttle.ts onBeforeUnmount registered-callback + catch-arm gap.
  it('Test 8: cancels pending trailing call on Vue unmount when called inside setup; no-op outside setup (A9)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();

      const Comp = defineComponent({
        setup() {
          const throttled = throttle(fn, 100);
          // Leading-edge fire, then an in-window call schedules a trailing call.
          throttled('lead');
          throttled('trail');
          return () => h('div');
        },
      });

      const wrapper = mount(Comp);
      // Leading-edge fired once; the trailing call is still pending.
      expect(fn).toHaveBeenCalledTimes(1);

      // Unmount BEFORE the window — onBeforeUnmount clears the pending timer.
      wrapper.unmount();
      vi.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }

    // A9: calling throttle() outside a setup context must not throw — the
    // onBeforeUnmount call lands in the defensive catch arm.
    expect(() => throttle(() => {}, 100)).not.toThrow();
  });

  // Quick task 260521-qsh — close the onBeforeUnmount `if (pendingTimer)`
  // FALSE arm: unmount a component whose throttle has no pending trailing call.
  it('Test 9: unmount with no pending trailing call — onBeforeUnmount falsy-timer arm', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();

      const Comp = defineComponent({
        setup() {
          // Created inside setup but never invoked — no timer is ever scheduled.
          throttle(fn, 100);
          return () => h('div');
        },
      });

      const wrapper = mount(Comp);
      // Unmount with no pending timer — onBeforeUnmount runs, `pendingTimer`
      // is undefined, so the clearTimeout is skipped (the falsy arm).
      expect(() => wrapper.unmount()).not.toThrow();
      vi.advanceTimersByTime(500);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
