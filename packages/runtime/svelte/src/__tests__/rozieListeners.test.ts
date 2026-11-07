// @vitest-environment happy-dom
/**
 * rozieListeners — Svelte 5 action attaching template `@event` listeners that
 * carry native options (`.capture` / `.passive` / `.once`). Exercised against
 * a real (happy-dom) DOM: capture ordering, passive preventDefault, once
 * across updates, current-handler dispatch, and cleanup on destroy.
 */
import { describe, expect, it, vi } from 'vitest';
import { rozieListeners } from '../rozieListeners.js';

function tree(): { outer: HTMLElement; inner: HTMLElement } {
  const outer = document.createElement('div');
  const inner = document.createElement('span');
  outer.appendChild(inner);
  document.body.appendChild(outer);
  return { outer, inner };
}

describe('rozieListeners (Svelte 5 action)', () => {
  it('capture: the ancestor capture listener runs before the target bubble listener', () => {
    const { outer, inner } = tree();
    const order: string[] = [];
    inner.addEventListener('click', () => order.push('inner'));
    const a = rozieListeners(outer, [['click', () => order.push('outer-capture'), { capture: true }]]);
    const b = rozieListeners(outer, [['click', () => order.push('outer-bubble')]]);
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(order).toEqual(['outer-capture', 'inner', 'outer-bubble']);
    a.destroy();
    b.destroy();
  });

  it('passive: preventDefault() inside the listener leaves defaultPrevented false', () => {
    const { outer } = tree();
    let seen: boolean | undefined;
    const passive = rozieListeners(outer, [
      [
        'wheel',
        (e: Event) => {
          e.preventDefault();
          seen = e.defaultPrevented;
        },
        { passive: true },
      ],
    ]);
    const ev = new Event('wheel', { bubbles: true, cancelable: true });
    outer.dispatchEvent(ev);
    expect(seen).toBe(false);
    expect(ev.defaultPrevented).toBe(false);
    passive.destroy();

    // Control: the same handler without passive does prevent.
    const active = rozieListeners(outer, [['wheel', (e: Event) => e.preventDefault()]]);
    const ev2 = new Event('wheel', { bubbles: true, cancelable: true });
    outer.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
    active.destroy();
  });

  it('once: fires exactly once, even after update() swaps in a new handler', () => {
    const { outer } = tree();
    const first = vi.fn();
    const second = vi.fn();
    const action = rozieListeners(outer, [['click', first, { once: true }]]);
    outer.click();
    outer.click();
    expect(first).toHaveBeenCalledTimes(1);
    action.update([['click', second, { once: true }]]);
    outer.click();
    expect(second).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
    action.destroy();
  });

  it('non-once: always calls the CURRENT handler after update()', () => {
    const { outer } = tree();
    const first = vi.fn();
    const second = vi.fn();
    const action = rozieListeners(outer, [['click', first, { capture: true }]]);
    outer.click();
    action.update([['click', second, { capture: true }]]);
    outer.click();
    outer.click();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    action.destroy();
  });

  it('update() re-attaches when an entry changes event or options', () => {
    const { outer } = tree();
    const fn = vi.fn();
    const action = rozieListeners(outer, [['click', fn, { capture: true }]]);
    action.update([['keydown', fn, { capture: true }]]);
    outer.click();
    expect(fn).not.toHaveBeenCalled();
    outer.dispatchEvent(new KeyboardEvent('keydown'));
    expect(fn).toHaveBeenCalledTimes(1);
    action.update([]);
    outer.dispatchEvent(new KeyboardEvent('keydown'));
    expect(fn).toHaveBeenCalledTimes(1);
    action.destroy();
  });

  it('several entries on one element, including the same event twice, stay independent', () => {
    const { outer } = tree();
    const once = vi.fn();
    const always = vi.fn();
    const action = rozieListeners(outer, [
      ['click', once, { once: true }],
      ['click', always, { capture: true }],
    ]);
    outer.click();
    outer.click();
    expect(once).toHaveBeenCalledTimes(1);
    expect(always).toHaveBeenCalledTimes(2);
    action.destroy();
  });

  it('once is per element: a second element gets its own shot', () => {
    const a = tree().outer;
    const b = tree().outer;
    const fn = vi.fn();
    const actA = rozieListeners(a, [['click', fn, { once: true }]]);
    const actB = rozieListeners(b, [['click', fn, { once: true }]]);
    a.click();
    a.click();
    b.click();
    b.click();
    expect(fn).toHaveBeenCalledTimes(2);
    actA.destroy();
    actB.destroy();
  });

  it('destroy() removes every listener (capture ones included)', () => {
    const { outer } = tree();
    const fn = vi.fn();
    const action = rozieListeners(outer, [
      ['click', fn, { capture: true }],
      ['click', fn, { passive: true }],
      ['keydown', fn],
    ]);
    action.destroy();
    outer.click();
    outer.dispatchEvent(new KeyboardEvent('keydown'));
    expect(fn).not.toHaveBeenCalled();
  });
});
