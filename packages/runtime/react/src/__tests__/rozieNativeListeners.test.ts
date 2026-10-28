// @vitest-environment happy-dom
/**
 * rozieNativeListeners — the callback ref the React emitter puts on an element
 * whose template event is not its JSX prop (`@change` on a text control).
 */
import { describe, expect, it, vi } from 'vitest';
import { rozieNativeListeners } from '../rozieNativeListeners.js';

describe('rozieNativeListeners', () => {
  it('attaches on mount and detaches on unmount', () => {
    const el = document.createElement('input');
    const handler = vi.fn();
    const ref = rozieNativeListeners<HTMLInputElement>([['change', handler]]);
    ref(el);
    el.dispatchEvent(new Event('change'));
    expect(handler).toHaveBeenCalledTimes(1);
    ref(null);
    el.dispatchEvent(new Event('change'));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('a re-render swaps in the new handler (old ref detached, new attached)', () => {
    const el = document.createElement('input');
    const first = vi.fn();
    const second = vi.fn();
    const r1 = rozieNativeListeners<HTMLInputElement>([['change', first]]);
    r1(el);
    const r2 = rozieNativeListeners<HTMLInputElement>([['change', second]]);
    r1(null);
    r2(el);
    el.dispatchEvent(new Event('change'));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('forwards the element to an object ref or a callback ref', () => {
    const el = document.createElement('textarea');
    const obj = { current: null as HTMLTextAreaElement | null };
    const fn = vi.fn();
    rozieNativeListeners<HTMLTextAreaElement>([['change', () => {}]], obj)(el);
    rozieNativeListeners<HTMLTextAreaElement>([['change', () => {}]], fn)(el);
    expect(obj.current).toBe(el);
    expect(fn).toHaveBeenCalledWith(el);
  });

  it('honours the capture flag', () => {
    const parent = document.createElement('div');
    const el = document.createElement('input');
    parent.appendChild(el);
    const order: string[] = [];
    el.addEventListener('change', () => order.push('target'));
    rozieNativeListeners<HTMLDivElement>([['change', () => order.push('capture'), true]])(parent);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    expect(order).toEqual(['capture', 'target']);
  });
});

describe('rozieNativeListeners once', () => {
  it('fires a once listener a single time, across re-renders', () => {
    const el = document.createElement('input');
    const handler = vi.fn();
    const r1 = rozieNativeListeners<HTMLInputElement>([['change', handler, { once: true }]]);
    r1(el);
    el.dispatchEvent(new Event('change'));
    // A re-render detaches the old callback and attaches a fresh one.
    const r2 = rozieNativeListeners<HTMLInputElement>([['change', handler, { once: true }]]);
    r1(null);
    r2(el);
    el.dispatchEvent(new Event('change'));
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
