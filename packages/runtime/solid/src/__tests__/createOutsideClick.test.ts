/**
 * createOutsideClick unit tests (D-136).
 * Tests 5-8 from Plan 06.3-01 Task 1 behavior spec.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { createOutsideClick } from '../createOutsideClick.js';

describe('createOutsideClick', () => {
  it('Test 5: fires when click target is outside all refs', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    createRoot((dispose) => {
      createOutsideClick([() => inside], handler);
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler).toHaveBeenCalledOnce();
      dispose();
    });
  });

  it('Test 6: does NOT fire when click target is inside a ref', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const handler = vi.fn();
    createRoot((dispose) => {
      createOutsideClick([() => inside], handler);
      inside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('Test 7: does NOT fire when when() returns false', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();
    createRoot((dispose) => {
      createOutsideClick([() => inside], handler, () => false);
      outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handler).not.toHaveBeenCalled();
      dispose();
    });
  });

  it('Test 8: onCleanup detaches listener when reactive scope disposes', () => {
    document.body.innerHTML = '<div id="inside"></div><div id="outside"></div>';
    const inside = document.getElementById('inside')!;
    const outside = document.getElementById('outside')!;
    const handler = vi.fn();

    let outerDispose: (() => void) | null = null;
    let outerSet: ((v: boolean) => void) | null = null;

    createRoot((dispose) => {
      outerDispose = dispose;
      // Set up outer scope
      createOutsideClick([() => inside], handler);
      dispose();
    });

    // After dispose, click should NOT invoke handler
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});
