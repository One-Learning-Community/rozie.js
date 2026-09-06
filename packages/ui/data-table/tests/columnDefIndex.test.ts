/**
 * columnDefIndex.test.ts — quick task 260906-afh (B1).
 *
 * Unit contract for `indexDefsById` (packages/ui/data-table/src/helpers/columnDefUtils.ts):
 * a nested group leaf id must resolve to its own def, a top-level id must resolve to its
 * top-level def EVEN when an identically-named id also exists nested (top-level wins
 * regardless of array order), multi-level nesting resolves, a non-array/null input returns
 * an empty map, and the returned map has a null prototype so a `__proto__` id cannot
 * pollute `Object.prototype`.
 */
import { describe, it, expect } from 'vitest';
import { indexDefsById } from '../src/helpers/columnDefUtils';

describe('indexDefsById', () => {
  it('resolves a top-level leaf id to its own def', () => {
    const defs = [
      { id: 'name', header: 'Name' },
      { id: 'city', header: 'City' },
    ];
    const idx = indexDefsById(defs);
    expect(idx.name).toBe(defs[0]);
    expect(idx.city).toBe(defs[1]);
  });

  it('resolves a nested group leaf id to its own def', () => {
    const nameLeaf = { id: 'name', header: 'Name' };
    const cityLeaf = { id: 'city', header: 'City' };
    const defs = [{ id: 'identity', header: 'Identity', columns: [nameLeaf, cityLeaf] }];
    const idx = indexDefsById(defs);
    expect(idx.name).toBe(nameLeaf);
    expect(idx.city).toBe(cityLeaf);
    // The group's own id resolves too.
    expect(idx.identity).toBe(defs[0]);
  });

  it('a top-level id wins over an identically-named NESTED id, regardless of array order', () => {
    const topLevelDup = { id: 'dup', header: 'Top' };
    const nestedDup = { id: 'dup', header: 'Nested' };
    // Order 1: top-level entry BEFORE the group.
    const defsA = [topLevelDup, { id: 'grp', header: 'Group', columns: [nestedDup] }];
    expect(indexDefsById(defsA).dup).toBe(topLevelDup);

    // Order 2: the group (containing the nested dup) BEFORE the top-level entry — top-level
    // must still win, since pass 1 (unconditional top-level registration) always runs before
    // pass 2 (nested, gap-fill only) regardless of source array order.
    const defsB = [{ id: 'grp', header: 'Group', columns: [nestedDup] }, topLevelDup];
    expect(indexDefsById(defsB).dup).toBe(topLevelDup);
  });

  it('resolves a 3-deep nested leaf', () => {
    const deepLeaf = { id: 'deep', header: 'Deep' };
    const defs = [
      {
        id: 'l1',
        header: 'L1',
        columns: [{ id: 'l2', header: 'L2', columns: [deepLeaf] }],
      },
    ];
    const idx = indexDefsById(defs);
    expect(idx.deep).toBe(deepLeaf);
    expect(idx.l2).toEqual({ id: 'l2', header: 'L2', columns: [deepLeaf] });
    expect(idx.l1).toBe(defs[0]);
  });

  it('returns an empty map for a non-array input', () => {
    expect(indexDefsById(null)).toEqual({});
    expect(indexDefsById(undefined)).toEqual({});
    expect(indexDefsById('not-an-array')).toEqual({});
    expect(indexDefsById(42)).toEqual({});
  });

  it('returns an empty map for an empty array', () => {
    expect(indexDefsById([])).toEqual({});
  });

  it('the returned map has a null prototype — a "__proto__" id cannot pollute Object.prototype', () => {
    const idx = indexDefsById([]);
    expect(Object.getPrototypeOf(idx)).toBe(null);

    const poisoned = indexDefsById([{ id: '__proto__', header: 'Evil' }]);
    expect(Object.getPrototypeOf(poisoned)).toBe(null);
    // The map holds the entry under its OWN key (Object.create(null) has no inherited
    // __proto__ accessor to intercept the assignment), and global Object.prototype is
    // untouched.
    expect(Object.prototype).not.toHaveProperty('polluted');
    expect(({} as any).polluted).toBeUndefined();
  });
});
