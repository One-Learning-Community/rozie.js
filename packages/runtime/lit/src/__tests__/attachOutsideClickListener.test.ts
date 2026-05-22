/**
 * Quick task 260521-qsh — attachOutsideClickListener tests for
 * @rozie/runtime-lit.
 *
 * Mirrors @rozie/runtime-solid's createOutsideClick.test.ts: set
 * `document.body.innerHTML`, dispatch a bubbling MouseEvent so `composedPath()`
 * includes inside elements. WR-01 semantics: `when` (when false) short-circuits
 * the WHOLE handler, including the inside-check.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { attachOutsideClickListener } from '../attachOutsideClickListener.js';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('attachOutsideClickListener — runtime-lit', () => {
  it('fires the handler when the click is outside all refs', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener([() => inside], handler);

    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('does NOT fire when the click path includes a ref (composedPath inside-check)', () => {
    document.body.innerHTML =
      '<div id="inside"><button id="child"></button></div>';
    const inside = document.getElementById('inside')!;
    const child = document.getElementById('child')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener([() => inside], handler);

    // Bubbling click from a descendant — composedPath() includes #inside.
    child.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it('when() returning false suppresses the handler even for an outside click', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener(
      [() => inside],
      handler,
      () => false,
    );

    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
    unsub();
  });

  it('when() returning true allows the handler to run', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener(
      [() => inside],
      handler,
      () => true,
    );

    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });

  it('the returned unsubscribe fn detaches the listener', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener([() => inside], handler);

    unsub();
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });

  it('a ref fn returning null/undefined is skipped without error', () => {
    document.body.innerHTML = '<div id="outside"></div>';
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    const unsub = attachOutsideClickListener(
      [() => null, () => undefined],
      handler,
    );

    // No real refs — every click is "outside".
    expect(() =>
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    ).not.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
    unsub();
  });
});
