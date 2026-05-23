/**
 * Plan 15-03 Task 1 — mergeListeners unit tests (React runtime).
 *
 * Covers the Phase 15 SPEC R6 all-fire source-order rule: when multiple
 * partials carry the same key, mergeListeners wraps them into a single
 * dispatcher arrow that invokes each in arrival order. Non-colliding keys
 * pass through verbatim.
 *
 * SECURITY (T-15-V5-03): __proto__ / constructor / prototype keys in any
 * partial must be SKIPPED.
 */
import { describe, it, expect, vi } from 'vitest';
import { mergeListeners } from '../mergeListeners.js';

describe('mergeListeners (React runtime) — Plan 15-03 Task 1', () => {
  it('two partials, same key → single dispatcher calls both in source order', () => {
    const calls: number[] = [];
    const f1 = vi.fn(() => calls.push(1));
    const f2 = vi.fn(() => calls.push(2));
    const out = mergeListeners({ onClick: f1 }, { onClick: f2 });
    expect(typeof out.onClick).toBe('function');
    expect(Object.keys(out)).toEqual(['onClick']);
    (out.onClick as (e: Event) => void)({} as Event);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([1, 2]); // SOURCE ORDER
  });

  it('two partials, disjoint keys → both preserved, no collision', () => {
    const f1 = vi.fn();
    const g = vi.fn();
    const out = mergeListeners({ onClick: f1 }, { onMouseEnter: g });
    expect(out.onClick).toBe(f1);
    expect(out.onMouseEnter).toBe(g);
  });

  it('three+ partials, same key → all called in arrival order', () => {
    const calls: number[] = [];
    const f1 = vi.fn(() => calls.push(1));
    const f2 = vi.fn(() => calls.push(2));
    const f3 = vi.fn(() => calls.push(3));
    const out = mergeListeners(
      { onClick: f1 },
      { onClick: f2 },
      { onClick: f3 },
    );
    (out.onClick as (e: Event) => void)({} as Event);
    expect(calls).toEqual([1, 2, 3]);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
    expect(f3).toHaveBeenCalledTimes(1);
  });

  it('dispatcher forwards the event argument to each wrapped handler', () => {
    const f1 = vi.fn();
    const f2 = vi.fn();
    const out = mergeListeners({ onClick: f1 }, { onClick: f2 });
    const fakeEvent = { type: 'click', target: 'X' } as unknown as Event;
    (out.onClick as (e: Event) => void)(fakeEvent);
    expect(f1).toHaveBeenCalledWith(fakeEvent);
    expect(f2).toHaveBeenCalledWith(fakeEvent);
  });

  it('empty partials list → empty output', () => {
    expect(Object.keys(mergeListeners())).toHaveLength(0);
  });

  it('mix of empty + populated partials → only populated values flow through', () => {
    const f = vi.fn();
    const out = mergeListeners({}, { onClick: f }, {});
    expect(out.onClick).toBe(f);
  });

  it('null / undefined partials are skipped without throwing', () => {
    const f = vi.fn();
    const out = mergeListeners(
      null as unknown as Record<string, unknown>,
      { onClick: f },
      undefined as unknown as Record<string, unknown>,
    );
    expect(out.onClick).toBe(f);
  });

  it('output is built on a null-prototype object (no Object.prototype chain)', () => {
    const out = mergeListeners({ onClick: vi.fn() });
    expect(Object.getPrototypeOf(out)).toBeNull();
  });

  it('SECURITY: __proto__ / constructor / prototype keys are SKIPPED', () => {
    const f = vi.fn();
    const out = mergeListeners(
      JSON.parse('{ "__proto__": { "polluted": true } }') as Record<string, unknown>,
      {
        constructor: 'evil',
        prototype: 'evil',
        onClick: f,
      } as Record<string, unknown>,
    );
    expect(Object.keys(out)).toEqual(['onClick']);
    expect(out.onClick).toBe(f);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('non-function value last-wins (defensive — no wrap)', () => {
    // If the second partial drops a non-function value into a slot already
    // holding a function, replace last-wins (calling a non-function will
    // throw at the host reconciler — fail-loud).
    const f = vi.fn();
    const out = mergeListeners({ onClick: f }, { onClick: undefined });
    expect(out.onClick).toBeUndefined();
  });
});
