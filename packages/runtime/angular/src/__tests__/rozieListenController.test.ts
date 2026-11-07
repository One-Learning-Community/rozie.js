// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { RozieListenController } from '../rozieListenController';

function tree() {
  const outer = document.createElement('div');
  const inner = document.createElement('button');
  outer.appendChild(inner);
  document.body.appendChild(outer);
  return { outer, inner };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('RozieListenController', () => {
  it('capture: the outer capture listener runs before the target bubble listener', () => {
    const { outer, inner } = tree();
    const order: string[] = [];
    const ctl = new RozieListenController(outer, () => order.push('outer-capture'));
    ctl.set(0, 'click', { capture: true });
    inner.addEventListener('click', () => order.push('inner'));
    const bubbleCtl = new RozieListenController(outer, () => order.push('outer-bubble'));
    bubbleCtl.set(0, 'click', {});
    inner.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(order).toEqual(['outer-capture', 'inner', 'outer-bubble']);
  });

  it('once: fires exactly once, even when re-configured afterwards', () => {
    const { inner } = tree();
    const fired: number[] = [];
    const ctl = new RozieListenController(inner, (slot) => fired.push(slot));
    ctl.set(0, 'click', { once: true });
    // Re-applying identical config (change detection) is a no-op.
    ctl.set(0, 'click', { once: true });
    inner.click();
    inner.click();
    // A spent once-slot is never re-armed, even with new options.
    ctl.set(0, 'click', { once: true, capture: true });
    inner.click();
    expect(fired).toEqual([0]);
  });

  it('non-once: the current fire callback target runs on every event', () => {
    const { inner } = tree();
    let current = (n: number) => n;
    const seen: number[] = [];
    const ctl = new RozieListenController(inner, () => seen.push(current(1)));
    ctl.set(0, 'click', null);
    inner.click();
    current = (n) => n + 10;
    inner.click();
    expect(seen).toEqual([1, 11]);
  });

  it('passive: preventDefault() inside the listener leaves defaultPrevented false', () => {
    const { inner } = tree();
    let prevented: boolean | null = null;
    const ctl = new RozieListenController(inner, (_slot, e) => {
      e.preventDefault();
      prevented = e.defaultPrevented;
    });
    ctl.set(0, 'wheel', { passive: true });
    const ev = new Event('wheel', { cancelable: true });
    inner.dispatchEvent(ev);
    expect(prevented).toBe(false);
    expect(ev.defaultPrevented).toBe(false);

    // Control: without passive the same call does prevent.
    const ctl2 = new RozieListenController(inner, (_slot, e) => e.preventDefault());
    ctl.destroy();
    ctl2.set(0, 'wheel', {});
    const ev2 = new Event('wheel', { cancelable: true });
    inner.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
  });

  it('several slots on one element, same event with different options, each routed to its slot', () => {
    const { outer, inner } = tree();
    const fired: number[] = [];
    const ctl = new RozieListenController(outer, (slot) => fired.push(slot));
    ctl.set(0, 'keydown', { capture: true });
    ctl.set(1, 'keydown', {});
    inner.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    expect(fired).toEqual([0, 1]);
  });

  it('re-configuring a slot to a new event detaches the old listener', () => {
    const { inner } = tree();
    const fired: string[] = [];
    const ctl = new RozieListenController(inner, (_s, e) => fired.push(e.type));
    ctl.set(0, 'click', { capture: true });
    ctl.set(0, 'focus', { capture: true });
    inner.click();
    inner.dispatchEvent(new Event('focus'));
    expect(fired).toEqual(['focus']);
  });

  it('destroy() removes every listener', () => {
    const { outer, inner } = tree();
    const fired: number[] = [];
    const ctl = new RozieListenController(outer, (slot) => fired.push(slot));
    ctl.set(0, 'click', { capture: true });
    ctl.set(1, 'click', { passive: true });
    ctl.destroy();
    inner.click();
    expect(fired).toEqual([]);
  });

  it('a null target (SSR-ish) is a no-op, not a throw', () => {
    const ctl = new RozieListenController(null, () => {});
    expect(() => ctl.set(0, 'click', { once: true })).not.toThrow();
    expect(() => ctl.destroy()).not.toThrow();
  });
});
