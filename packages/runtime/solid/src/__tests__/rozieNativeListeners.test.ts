/**
 * rozieNativeListeners — real-DOM behaviour of the helper a template `@event.capture` /
 * `.passive` / `.once` lowers to (called from the element's ref).
 */
import { describe, expect, it } from 'vitest';
import { createRoot } from 'solid-js';
import { rozieNativeListeners } from '../rozieNativeListeners.js';

function tree() {
  const outer = document.createElement('div');
  const inner = document.createElement('button');
  outer.appendChild(inner);
  document.body.appendChild(outer);
  return { outer, inner };
}

describe('rozieNativeListeners', () => {
  it('capture: the outer listener runs before the target’s own listener', () => {
    const { outer, inner } = tree();
    const order: string[] = [];
    createRoot(() => {
      rozieNativeListeners(outer, [
        ['click', () => order.push('outer-capture'), { capture: true }],
      ]);
      rozieNativeListeners(outer, [['click', () => order.push('outer-bubble')]]);
    });
    inner.addEventListener('click', () => order.push('target'));
    inner.click();
    expect(order).toEqual(['outer-capture', 'target', 'outer-bubble']);
  });

  it('once: fires exactly once per element', () => {
    const { outer } = tree();
    const other = document.createElement('div');
    let calls = 0;
    createRoot(() => {
      rozieNativeListeners(outer, [['click', () => calls++, { once: true }]]);
      rozieNativeListeners(other, [['click', () => calls++, { once: true }]]);
    });
    outer.click();
    outer.click();
    other.click();
    other.click();
    expect(calls).toBe(2);
  });

  it('passive: preventDefault() inside the listener leaves defaultPrevented false', () => {
    const { outer } = tree();
    let seen: boolean | undefined;
    createRoot(() => {
      rozieNativeListeners(outer, [
        [
          'wheel',
          (e: Event) => {
            e.preventDefault();
            seen = e.defaultPrevented;
          },
          { passive: true },
        ],
      ]);
    });
    const ev = new Event('wheel', { cancelable: true });
    outer.dispatchEvent(ev);
    expect(seen).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('non-passive control: preventDefault() does cancel', () => {
    const { outer } = tree();
    createRoot(() => {
      rozieNativeListeners(outer, [['wheel', (e: Event) => e.preventDefault(), { capture: true }]]);
    });
    const ev = new Event('wheel', { cancelable: true });
    outer.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('passes the event through and supports several listeners, same event, different options', () => {
    const { outer, inner } = tree();
    const got: string[] = [];
    createRoot(() => {
      rozieNativeListeners(outer, [
        ['click', (e: MouseEvent) => got.push(`a:${e.type}`), { capture: true }],
        ['click', () => got.push('b'), { once: true }],
      ]);
    });
    inner.click();
    inner.click();
    expect(got).toEqual(['a:click', 'b', 'a:click']);
  });

  it('cleanup: removes the listeners when the owner is disposed', () => {
    const { outer } = tree();
    let calls = 0;
    const dispose = createRoot((d) => {
      rozieNativeListeners(outer, [
        ['click', () => calls++, { capture: true }],
        ['click', () => calls++, { passive: true }],
      ]);
      return d;
    });
    outer.click();
    expect(calls).toBe(2);
    dispose();
    outer.click();
    expect(calls).toBe(2);
  });

  it('works without a reactive owner (no cleanup registered, no throw)', () => {
    const { outer } = tree();
    let calls = 0;
    rozieNativeListeners(outer, [['click', () => calls++, { capture: true }]]);
    outer.click();
    expect(calls).toBe(1);
  });
});
