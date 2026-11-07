/**
 * `rozieOnce` — `.once` on a component event (a callback prop). The emitter creates one wrapper per
 * child instance and passes the handler as a thunk, read at call time, so the current handler runs
 * and re-creating the handler can't re-arm the wrapper.
 */
import { describe, expect, it } from 'vitest';
import { rozieOnce } from '../rozieOnce.js';

describe('rozieOnce', () => {
  it('runs the handler once and passes its arguments through', () => {
    const calls: unknown[][] = [];
    const fn = rozieOnce(() => (...a: unknown[]) => calls.push(a));
    fn(1, 2);
    fn(3);
    expect(calls).toEqual([[1, 2]]);
  });

  it('reads the handler when the event fires, not when the wrapper is made', () => {
    let current = (_: unknown) => 'old';
    const fn = rozieOnce(() => current);
    current = () => 'new';
    expect(fn(0)).toBe('new');
  });

  it('a missing handler (optional callback prop) is a no-op that still uses up the once', () => {
    let handler: (() => void) | undefined;
    let n = 0;
    const fn = rozieOnce(() => handler);
    fn();
    handler = () => n++;
    fn();
    expect(n).toBe(0);
  });

  it('separate wrappers (separate child instances) fire independently', () => {
    let n = 0;
    const a = rozieOnce(() => () => n++);
    const b = rozieOnce(() => () => n++);
    a();
    b();
    a();
    expect(n).toBe(2);
  });
});
