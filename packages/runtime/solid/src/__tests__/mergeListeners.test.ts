/**
 * Plan 15-03 Task 1 — mergeListeners unit tests (Solid runtime).
 *
 * Solid mirrors React: same JSX listener-prop convention, same last-wins
 * behavior to overcome. The merge logic is target-agnostic; tests mirror
 * the React sibling.
 *
 * SECURITY (T-15-V5-03): __proto__ / constructor / prototype keys skipped.
 */
import { describe, it, expect, vi } from 'vitest';
import { mergeListeners } from '../mergeListeners.js';

describe('mergeListeners (Solid runtime) — Plan 15-03 Task 1', () => {
  it('two partials, same key → single dispatcher calls both in source order', () => {
    const calls: number[] = [];
    const f1 = vi.fn(() => calls.push(1));
    const f2 = vi.fn(() => calls.push(2));
    const out = mergeListeners({ onClick: f1 }, { onClick: f2 });
    expect(typeof out.onClick).toBe('function');
    expect(Object.keys(out)).toEqual(['onClick']);
    (out.onClick as (e: Event) => void)({} as Event);
    expect(calls).toEqual([1, 2]);
  });

  it('disjoint keys → both preserved', () => {
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
  });

  it('dispatcher forwards event arg to each handler', () => {
    const f1 = vi.fn();
    const f2 = vi.fn();
    const out = mergeListeners({ onClick: f1 }, { onClick: f2 });
    const fakeEvent = { type: 'click' } as unknown as Event;
    (out.onClick as (e: Event) => void)(fakeEvent);
    expect(f1).toHaveBeenCalledWith(fakeEvent);
    expect(f2).toHaveBeenCalledWith(fakeEvent);
  });

  it('empty partials → empty output', () => {
    expect(Object.keys(mergeListeners())).toHaveLength(0);
  });

  it('null / undefined partials are skipped without throwing', () => {
    const f = vi.fn();
    const out = mergeListeners(
      null as unknown as Record<string, unknown>,
      { onClick: f },
    );
    expect(out.onClick).toBe(f);
  });

  it('output is built on a null-prototype object', () => {
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
  });

  it('non-function value last-wins (no wrap)', () => {
    const f = vi.fn();
    const out = mergeListeners({ onClick: f }, { onClick: undefined });
    expect(out.onClick).toBeUndefined();
  });
});
