/**
 * Plan 06.4-01 Task 2 — observeRozieSlotCtx unit tests.
 *
 * Validates the D-LIT-13 scoped-slot context transport:
 *
 *   - Initial JSON.parse of data-rozie-params triggers onChange with parsed ctx.
 *   - Subsequent setAttribute on the slot triggers a second onChange with the
 *     new parsed ctx.
 *   - The returned unsubscribe function stops further callbacks.
 *   - Malformed JSON is silently swallowed (T-06.4-05 mitigation — previous
 *     valid ctx is retained, onChange is NOT invoked on the malformed update).
 */
import { describe, it, expect, vi } from 'vitest';
import { observeRozieSlotCtx } from '../observeRozieSlotCtx.js';

// Flushes microtasks AND a MutationObserver tick. happy-dom queues mutation
// callbacks on the macrotask queue, so a `setTimeout(_, 0)` flush is required.
const flushMutationCallbacks = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

describe('observeRozieSlotCtx', () => {
  it('fires onChange with the initial parsed ctx', () => {
    const slot = document.createElement('slot');
    slot.setAttribute('data-rozie-params', JSON.stringify({ foo: 1 }));
    const onChange = vi.fn();
    const unsub = observeRozieSlotCtx<{ foo: number }>(slot, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual({ foo: 1 });
    unsub();
  });

  it('does NOT fire on construction when the attribute is absent', () => {
    const slot = document.createElement('slot');
    const onChange = vi.fn();
    const unsub = observeRozieSlotCtx(slot, onChange);
    expect(onChange).not.toHaveBeenCalled();
    unsub();
  });

  it('fires onChange a second time when the attribute is mutated', async () => {
    const slot = document.createElement('slot');
    document.body.appendChild(slot);
    slot.setAttribute('data-rozie-params', JSON.stringify({ x: 0 }));
    const onChange = vi.fn();
    const unsub = observeRozieSlotCtx<{ x: number }>(slot, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    slot.setAttribute('data-rozie-params', JSON.stringify({ x: 5 }));
    await flushMutationCallbacks();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls[1][0]).toEqual({ x: 5 });
    unsub();
    slot.remove();
  });

  it('unsubscribe stops further callbacks', async () => {
    const slot = document.createElement('slot');
    document.body.appendChild(slot);
    slot.setAttribute('data-rozie-params', JSON.stringify({ a: 1 }));
    const onChange = vi.fn();
    const unsub = observeRozieSlotCtx(slot, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    unsub();
    slot.setAttribute('data-rozie-params', JSON.stringify({ a: 2 }));
    await flushMutationCallbacks();
    expect(onChange).toHaveBeenCalledTimes(1); // no additional fire
    slot.remove();
  });

  it('malformed JSON is silently swallowed (T-06.4-05)', async () => {
    const slot = document.createElement('slot');
    document.body.appendChild(slot);
    slot.setAttribute('data-rozie-params', JSON.stringify({ ok: true }));
    const onChange = vi.fn();
    const unsub = observeRozieSlotCtx(slot, onChange);
    expect(onChange).toHaveBeenCalledTimes(1);
    // Set to malformed JSON — observer should NOT invoke onChange.
    slot.setAttribute('data-rozie-params', '{not valid json');
    await flushMutationCallbacks();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsub();
    slot.remove();
  });
});
