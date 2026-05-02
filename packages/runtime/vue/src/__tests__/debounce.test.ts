// @rozie/runtime-vue — debounce unit tests (Phase 3 Plan 04 Task 1).
//
// Per RESEARCH.md Code Example 4 (lines 1014-1033): debounce<F>(fn, ms) returns
// a stable wrapper that delays invocation until `ms` elapses since the last
// call. Pending timer auto-cancels on Vue unmount when called inside a setup
// context (try/catch defensive — A9: onBeforeUnmount throws outside setup).
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { debounce } from '../debounce.js';

describe('debounce — D-41 helper contract', () => {
  it('Test 5: collapses rapid calls within the window — fn fires only once after the last call', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced(1);
      debounced(2);
      debounced(3);

      // Before window expires — fn not called.
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

  it('Test 6: cancels pending timer on Vue unmount when called inside setup; no-op outside setup (A9)', () => {
    vi.useFakeTimers();
    try {
      const fn = vi.fn();

      const Comp = defineComponent({
        setup() {
          const debounced = debounce(fn, 100);
          debounced('arg');
          return () => h('div');
        },
      });

      const wrapper = mount(Comp);
      // Pending timer is set; before window — no call yet.
      expect(fn).not.toHaveBeenCalled();

      // Unmount BEFORE the window — pending timer should be cleared.
      wrapper.unmount();
      vi.advanceTimersByTime(200);
      expect(fn).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }

    // A9: calling debounce() outside a setup context must not throw.
    expect(() => debounce(() => {}, 100)).not.toThrow();
  });
});
