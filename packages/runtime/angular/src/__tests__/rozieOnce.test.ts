/**
 * `RozieOnce` — `.once` on a component event (an Angular output). The emitter puts the directive on
 * the component tag (`rozieOnce #__rozieOnce1="rozieOnce"`), one instance per rendered element (so
 * per `@for` row), and binds `(ping)="__rozieOnce1.take(0) && handler($event)"`.
 */
import { describe, expect, it } from 'vitest';
import { RozieOnce } from '../rozie-once.directive';

describe('RozieOnce', () => {
  it('take(id) is true the first time only', () => {
    const once = new RozieOnce();
    expect([once.take(0), once.take(0), once.take(0)]).toEqual([true, false, false]);
  });

  it('each listener id on one tag is separate', () => {
    const once = new RozieOnce();
    expect([once.take(0), once.take(1), once.take(0), once.take(1)]).toEqual([true, true, false, false]);
  });

  it('instances are independent', () => {
    const a = new RozieOnce();
    const b = new RozieOnce();
    expect([a.take(0), b.take(0), a.take(0), b.take(0)]).toEqual([true, true, false, false]);
  });
});
