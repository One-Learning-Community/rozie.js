/**
 * value-match.test.ts — the pure value-matching helpers Select compares model values
 * and option values with (src/internal/valueMatch.ts, vendored into every leaf).
 */
import { describe, expect, it } from 'vitest';
import { identical, matchValues, sameContent } from '../src/internal/valueMatch';

describe('identical — the spine rule (=== / includes)', () => {
  it('is === plus NaN matching NaN', () => {
    expect(identical(1, 1)).toBe(true);
    expect(identical('1', 1)).toBe(false);
    expect(identical(NaN, NaN)).toBe(true);
    expect(identical(0, -0)).toBe(true);
    expect(identical(null, undefined)).toBe(false);
    const o = {};
    expect(identical(o, o)).toBe(true);
    expect(identical({}, {})).toBe(false);
  });
});

describe('sameContent', () => {
  it('equal plain objects and arrays match; different ones do not', () => {
    expect(sameContent({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(sameContent({ a: 1 }, { a: 2 })).toBe(false);
    expect(sameContent({ a: 1 }, { a: 1, b: undefined })).toBe(false);
    expect(sameContent([1, 2], [1, 2])).toBe(true);
    expect(sameContent([1, 2], [2, 1])).toBe(false);
    expect(sameContent({ n: NaN }, { n: NaN })).toBe(true);
  });

  it('primitives only match by identity', () => {
    expect(sameContent(1, '1')).toBe(false);
    expect(sameContent('a', 'a')).toBe(true);
    expect(sameContent(null, {})).toBe(false);
  });

  it('a shared sub-object does not make different contents equal (the review repro), either way round', () => {
    const S = { k: 1 };
    const a = { x: S, y: S };
    const b = { x: { k: 1 }, y: { k: 2 } };
    expect(sameContent(a, b)).toBe(false);
    expect(sameContent(b, a)).toBe(false);
    // …and it does not stop equal contents from matching.
    expect(sameContent(a, { x: { k: 1 }, y: { k: 1 } })).toBe(true);
    expect(sameContent({ x: { k: 1 }, y: { k: 1 } }, a)).toBe(true);
  });

  it('is symmetric over a mixed bag of values', () => {
    const S = { k: 1 };
    const cyc: Record<string, unknown> = { v: 1 };
    cyc.self = cyc;
    const bag: unknown[] = [1, 'a', NaN, null, {}, [], { a: 1 }, { a: 2 }, { x: S, y: S }, { x: { k: 1 }, y: { k: 2 } }, cyc, { v: 1, self: { v: 1 } }, new Date(0), new Map()];
    for (const p of bag) for (const q of bag) expect(sameContent(p, q), `${String(p)} vs ${String(q)}`).toBe(sameContent(q, p));
  });

  it('a cyclic value does not match a different finite one, and matches an equally shaped cycle', () => {
    const a: Record<string, unknown> = { v: 1 };
    a.self = a;
    expect(sameContent(a, { v: 1, self: { v: 1 } })).toBe(false);
    expect(sameContent({ v: 1, self: { v: 1 } }, a)).toBe(false);
    expect(sameContent(a, { v: 1, self: { v: 1, self: { v: 2 } } })).toBe(false);
    const b: Record<string, unknown> = { v: 1 };
    b.self = b;
    expect(sameContent(a, b)).toBe(true);
    const c: Record<string, unknown> = { v: 2 };
    c.self = c;
    expect(sameContent(a, c)).toBe(false);
  });

  it('needs the same prototype; key-less non-plain objects only match by identity', () => {
    class P { constructor(public n: number) {} }
    expect(sameContent(new P(1), new P(1))).toBe(true);
    expect(sameContent(new P(1), { n: 1 })).toBe(false);
    expect(sameContent(new Date(0), new Date(0))).toBe(false);
    expect(sameContent(new Map(), new Map())).toBe(false);
    expect(sameContent({}, {})).toBe(true);
    expect(sameContent([], [])).toBe(true);
    expect(sameContent([], {})).toBe(false);
  });

  it('reads through a proxy as it reads through the object', () => {
    const raw = { kind: 'box', tags: ['a'] };
    const proxied = new Proxy(raw, {});
    expect(proxied === raw).toBe(false);
    expect(sameContent(proxied, raw)).toBe(true);
    expect(sameContent(raw, proxied)).toBe(true);
  });
});

describe('matchValues — identity first, content only when nothing is identical', () => {
  const A = { kind: 'twin' };
  const B = { kind: 'twin' };
  const C = { kind: 'other' };

  it('an identical option wins over an equal-content one', () => {
    const { rows, picked } = matchValues([B], [A, B, C]);
    expect(rows).toEqual([{ value: B, members: [0], at: [1] }]);
    expect(picked).toEqual([false, true, false]);
  });

  it('with no identical option, content decides (every equal-content option matches)', () => {
    const proxy = new Proxy(B, {});
    expect(matchValues([proxy], [A, B, C]).picked).toEqual([true, true, false]);
    expect(matchValues([{ kind: 'other' }], [A, B, C]).picked).toEqual([false, false, true]);
  });

  it('primitives never match by content', () => {
    expect(matchValues(['1'], [1, '1']).picked).toEqual([false, true]);
    expect(matchValues([2], [1, '2']).picked).toEqual([false, false]);
  });

  it('NaN is the same value as NaN', () => {
    const { rows, picked } = matchValues([NaN, NaN], [NaN, 1]);
    expect(picked).toEqual([true, false]);
    expect(rows.map((r) => r.members)).toEqual([[0, 1]]);
  });

  it('a value held more than once is one row; its members are every position', () => {
    const { rows } = matchValues(['a', 'b', 'a'], ['a', 'b']);
    expect(rows.map((r) => [r.value, r.members, r.at])).toEqual([['a', [0, 2], [0]], ['b', [1], [1]]]);
  });

  it('two identical-matched twins in the model stay two rows', () => {
    const { rows, picked } = matchValues([B, A], [A, B, C]);
    expect(rows.map((r) => [r.members, r.at])).toEqual([[[0], [1]], [[1], [0]]]);
    expect(picked).toEqual([true, true, false]);
  });

  it('equal-content model values with no identical option are one row', () => {
    const { rows } = matchValues([{ kind: 'twin' }, { kind: 'twin' }], [A, C]);
    expect(rows.map((r) => [r.members, r.at])).toEqual([[[0, 1], [0]]]);
  });

  it('a value matching nothing keeps a row with no option', () => {
    const { rows, picked } = matchValues(['ghost', { x: 1 }], ['a']);
    expect(rows.map((r) => r.at)).toEqual([[], []]);
    expect(picked).toEqual([false]);
  });

  it('null matches an option whose value is null, as the spine did', () => {
    expect(matchValues([null], [null, 'a']).picked).toEqual([true, false]);
    expect(matchValues([null], ['a']).picked).toEqual([false]);
  });
});
