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
import { indexDefsById, collectGroupableLeafDefs } from '../src/helpers/columnDefUtils';

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

/**
 * collectGroupableLeafDefs — quick task 260906-cvo (C5+C6). A dedicated depth-first walk
 * (NOT indexDefsById reuse — that map deliberately registers group columns too and orders
 * top-level-first-then-nested): a group entry (`Array.isArray(d.columns)`) is NEVER pushed
 * (recurse into its children only); a leaf is pushed unless `groupable === false`; nesting
 * is flattened depth-first in declaration order.
 */
describe('collectGroupableLeafDefs', () => {
  it('a flat list yields every entry in order', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    expect(collectGroupableLeafDefs([a, b, c])).toEqual([a, b, c]);
  });

  it('a columns: group yields its CHILDREN and never the group\'s own id', () => {
    const child1 = { id: 'age' };
    const child2 = { id: 'note' };
    const group = { id: 'demographics', columns: [child1, child2] };
    const out = collectGroupableLeafDefs([group]);
    expect(out).toEqual([child1, child2]);
    expect(out.some((d) => d.id === 'demographics')).toBe(false);
  });

  it('nesting three deep is flattened depth-first in declaration order', () => {
    const deep = { id: 'deep' };
    const l2 = { id: 'l2', columns: [deep] };
    const l1 = { id: 'l1', columns: [l2] };
    const sibling = { id: 'sibling' };
    expect(collectGroupableLeafDefs([l1, sibling])).toEqual([deep, sibling]);
  });

  it('a leaf with groupable === false is omitted while its siblings remain', () => {
    const a = { id: 'a' };
    const b = { id: 'b', groupable: false };
    const c = { id: 'c' };
    expect(collectGroupableLeafDefs([a, b, c])).toEqual([a, c]);
  });

  it('a group entry carrying an explicit groupable: true is STILL omitted', () => {
    const child = { id: 'child' };
    const group = { id: 'grp', groupable: true, columns: [child] };
    const out = collectGroupableLeafDefs([group]);
    expect(out).toEqual([child]);
  });

  it('a non-array input yields an empty list', () => {
    expect(collectGroupableLeafDefs(null)).toEqual([]);
    expect(collectGroupableLeafDefs(undefined)).toEqual([]);
    expect(collectGroupableLeafDefs('nope')).toEqual([]);
    expect(collectGroupableLeafDefs(42)).toEqual([]);
  });
});
