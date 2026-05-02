// @rozie/runtime-vue — useOutsideClick unit tests (Phase 3 Plan 04 Task 1).
//
// Per RESEARCH.md Code Example 3 (lines 980-1008): useOutsideClick registers
// a `document` click listener on mount and removes it on unmount. The
// `whenSignal` getter (D-42) gates dispatch — re-evaluated on every event so
// reactive state changes are picked up automatically.
//
// Mounts a tiny Vue component via @vue/test-utils, verifies the document
// listener is added/removed, and asserts the gate semantics.
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, ref, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useOutsideClick } from '../useOutsideClick.js';

describe('useOutsideClick — VUE-03 + MOD-04 contract', () => {
  it('Test 1: registers a document click listener on mount and removes it on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const Comp = defineComponent({
      setup() {
        const elRef = ref<HTMLElement>();
        useOutsideClick(elRef, () => {});
        return () => h('div', { ref: elRef });
      },
    });

    const wrapper = mount(Comp);
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function), true);

    wrapper.unmount();
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function), true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('Test 2: does NOT call cb when click target is inside any of the listed refs; DOES call when outside ALL', async () => {
    const cb = vi.fn();
    const Comp = defineComponent({
      setup() {
        const a = ref<HTMLElement>();
        const b = ref<HTMLElement>();
        useOutsideClick([a, b], cb);
        return () =>
          h('div', [
            h('span', { ref: a, id: 'a' }, 'a'),
            h('span', { ref: b, id: 'b' }, 'b'),
            h('span', { id: 'outside' }, 'outside'),
          ]);
      },
    });

    const wrapper = mount(Comp, { attachTo: document.body });

    // Click inside ref-a — should not call.
    const aEl = wrapper.element.querySelector('#a') as HTMLElement;
    aEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();

    // Click inside ref-b — should not call.
    const bEl = wrapper.element.querySelector('#b') as HTMLElement;
    bEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();

    // Click outside both — should call.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('Test 3: whenSignal === false short-circuits dispatch — cb is never called even on outside clicks', () => {
    const cb = vi.fn();
    const Comp = defineComponent({
      setup() {
        const elRef = ref<HTMLElement>();
        useOutsideClick(elRef, cb, () => false);
        return () => h('div', { ref: elRef }, 'inside');
      },
    });

    const wrapper = mount(Comp, { attachTo: document.body });
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();

    wrapper.unmount();
  });

  it('Test 4: whenSignal is re-evaluated on each event (D-42 reactive gate)', async () => {
    const cb = vi.fn();
    const open = ref(false);

    const Comp = defineComponent({
      setup() {
        const elRef = ref<HTMLElement>();
        useOutsideClick(elRef, cb, () => open.value);
        return () => h('div', { ref: elRef }, 'inside');
      },
    });

    const wrapper = mount(Comp, { attachTo: document.body });

    // open=false → no call.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();

    // Flip open=true; click again → should fire.
    open.value = true;
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);

    // Flip open=false → no further calls.
    open.value = false;
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cb).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });
});
