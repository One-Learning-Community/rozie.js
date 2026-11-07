/**
 * `rozieOnceCall` — `.once` on a component event (a callback prop). The emitter binds a named
 * function expression per rendered child and keys the fired state by it; `id` separates `.once`
 * listeners merged into one prop. The handler is a thunk read at call time.
 */
import { describe, expect, it } from 'vitest';
import { rozieOnceCall } from '../rozieOnce.js';

describe('rozieOnceCall', () => {
  it('runs the handler once per owner and passes the arguments through', () => {
    const calls: unknown[][] = [];
    const owner = {};
    const h = () => (...a: unknown[]) => calls.push(a);
    rozieOnceCall(owner, 0, h, [1, 2]);
    rozieOnceCall(owner, 0, h, [3]);
    expect(calls).toEqual([[1, 2]]);
  });

  it('reads the handler when the event fires', () => {
    let current = () => 'old';
    const owner = {};
    const get = () => current;
    current = () => 'new';
    expect(rozieOnceCall(owner, 0, get, [])).toBe('new');
  });

  it('a missing handler (optional callback prop) is a no-op that still uses up the once', () => {
    const owner = {};
    let n = 0;
    rozieOnceCall(owner, 0, () => undefined, []);
    rozieOnceCall(owner, 0, () => () => n++, []);
    expect(n).toBe(0);
  });

  it('separate owners (separate children) and separate ids fire independently', () => {
    let n = 0;
    const a = {};
    const b = {};
    for (const [o, id] of [[a, 0], [b, 0], [a, 1], [a, 0], [b, 0], [a, 1]] as const) {
      rozieOnceCall(o, id, () => () => n++, []);
    }
    expect(n).toBe(3);
  });
});
