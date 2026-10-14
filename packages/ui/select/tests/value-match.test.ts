/**
 * value-match.test.ts — the pure value-matching helpers Select compares model values
 * and option values with (src/internal/valueMatch.ts, vendored into every leaf).
 */
import { describe, expect, it } from 'vitest';
import { buildMatchIndex, distinctValues, identical, keyBase, sameContent, selectedByIndex, selectedIn, selectionTest, selects, toggleIn, uniqueKeys } from '../src/internal/valueMatch';

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
    expect(sameContent({}, {})).toBe(true);
    expect(sameContent([], [])).toBe(true);
    expect(sameContent([], {})).toBe(false);
    expect(sameContent(Object.create(null), {})).toBe(true); // both plain
  });

  it('primitives only match by identity', () => {
    expect(sameContent(1, '1')).toBe(false);
    expect(sameContent('a', 'a')).toBe(true);
    expect(sameContent(null, {})).toBe(false);
  });

  it('arrays must agree on length, also when sparse or carrying extra keys', () => {
    const holes = new Array(3); // length 3, no own index keys
    expect(sameContent(holes, [])).toBe(false);
    expect(sameContent([], holes)).toBe(false);
    const a = [1, 2];
    const b: unknown[] = [1];
    (b as unknown as Record<string, unknown>).x = 2; // same key COUNT as `a`, different length
    expect(sameContent(a, b)).toBe(false);
    expect(sameContent(b, a)).toBe(false);
  });

  it('anything that is not a plain object or an array matches by identity only — own keys or not', () => {
    class P { constructor(public n: number) {} }
    expect(sameContent(new P(1), new P(1))).toBe(false);
    expect(sameContent(new P(1), { n: 1 })).toBe(false);
    expect(sameContent(new Date(0), new Date(0))).toBe(false);
    expect(sameContent(new Map(), new Map())).toBe(false);
    expect(sameContent(new Set([1]), new Set([1]))).toBe(false);
    // The review repro: two Dates of DIFFERENT times, each given the same own key.
    const d5 = Object.assign(new Date(5), { x: 1 });
    const d6 = Object.assign(new Date(6), { x: 1 });
    expect(sameContent(d5, d6)).toBe(false);
    const e1 = Object.assign(new Error('one'), { code: 1 });
    const e2 = Object.assign(new Error('two'), { code: 1 });
    expect(sameContent(e1, e2)).toBe(false);
    // …nested as well: the wrapper is plain, what it holds is not.
    expect(sameContent({ at: d5 }, { at: d6 })).toBe(false);
    expect(sameContent({ at: d5 }, { at: d5 })).toBe(true);
    const p = new P(1);
    expect(sameContent(p, p)).toBe(true);
  });

  it('a shared sub-object does not make different contents equal (the review repro), either way round', () => {
    const S = { k: 1 };
    const a = { x: S, y: S };
    const b = { x: { k: 1 }, y: { k: 2 } };
    expect(sameContent(a, b)).toBe(false);
    expect(sameContent(b, a)).toBe(false);
    expect(sameContent(a, { x: { k: 1 }, y: { k: 1 } })).toBe(true);
    expect(sameContent({ x: { k: 1 }, y: { k: 1 } }, a)).toBe(true);
  });

  it('is symmetric over a mixed bag of values', () => {
    const S = { k: 1 };
    const cyc: Record<string, unknown> = { v: 1 };
    cyc.self = cyc;
    const bag: unknown[] = [1, 'a', NaN, null, {}, [], { a: 1 }, { a: 2 }, { x: S, y: S }, { x: { k: 1 }, y: { k: 2 } }, cyc, { v: 1, self: { v: 1 } }, new Date(0), new Map(), new Array(2), [undefined, undefined]];
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

  it('reads through a proxy as it reads through the object', () => {
    const raw = { kind: 'box', tags: ['a'] };
    const proxied = new Proxy(raw, {});
    expect(proxied === raw).toBe(false);
    expect(sameContent(proxied, raw)).toBe(true);
    expect(sameContent(raw, proxied)).toBe(true);
  });

  it('is bounded in depth: past 32 levels the values count as different, and 20,000 levels do not overflow the stack', () => {
    const chain = (n: number) => {
      const root: Record<string, unknown> = {};
      let cur = root;
      for (let i = 0; i < n; i++) {
        const next: Record<string, unknown> = {};
        cur.next = next;
        cur = next;
      }
      cur.leaf = 1;
      return root;
    };
    expect(sameContent(chain(10), chain(10))).toBe(true);
    expect(sameContent(chain(30), chain(30))).toBe(true);
    expect(sameContent(chain(40), chain(40))).toBe(false); // equal, but deeper than is compared
    expect(() => sameContent(chain(20_000), chain(20_000))).not.toThrow();
    expect(sameContent(chain(20_000), chain(20_000))).toBe(false);
  });

  it('is bounded in work: a 24-level structure sharing its sub-objects returns quickly', () => {
    const dag = (levels: number) => {
      let node: Record<string, unknown> = { leaf: 1 };
      for (let i = 0; i < levels; i++) node = { l: node, r: node };
      return node;
    };
    const t0 = performance.now();
    const result = sameContent(dag(24), dag(24)); // 2^24 paths if followed naively
    const ms = performance.now() - t0;
    expect(result).toBe(false); // over the work bound: different
    expect(ms).toBeLessThan(200);
    // A small shared structure is still compared in full.
    expect(sameContent(dag(6), dag(6))).toBe(true);
  });
});

describe('sameContent never throws', () => {
  it('a throwing getter on a plain-object value means "not equal", either way round', () => {
    const bomb = { a: 1, get b(): number { throw new Error('boom'); } };
    const calm = { a: 1, b: 2 };
    expect(() => sameContent(bomb, calm)).not.toThrow();
    expect(sameContent(bomb, calm)).toBe(false);
    expect(sameContent(calm, bomb)).toBe(false);
    expect(sameContent({ x: bomb }, { x: calm })).toBe(false);
    expect(sameContent(bomb, bomb)).toBe(true); // identity needs no reading
    // …and the paths that go through it do not throw either.
    expect(() => distinctValues([bomb], [calm])).not.toThrow();
    expect(distinctValues([bomb], [calm]).map((r) => r.at)).toEqual([-1]);
    const index = buildMatchIndex([bomb], [calm]);
    expect(selectedByIndex(index, [bomb], calm)).toBe(false);
    expect(selectedByIndex(index, [bomb], bomb)).toBe(true);
  });
  it('a proxy whose traps throw is "not equal" too', () => {
    const hostile = new Proxy({ a: 1 }, { ownKeys() { throw new Error('no'); } });
    expect(sameContent(hostile, { a: 1 })).toBe(false);
    expect(sameContent({ a: 1 }, hostile)).toBe(false);
  });
});

describe('buildMatchIndex / selectedByIndex — the same answers as selectedIn, in one pass', () => {
  const A = { kind: 'twin' };
  const B = { kind: 'twin' };
  const C = { kind: 'other' };
  const D = { kind: 'deep', inner: { n: 1 } };
  const date = new Date(5);
  const options: unknown[] = [A, B, C, D, date, 'a', 1, NaN, null, { kind: 'deep', inner: { n: 2 } }];
  const has = (m: unknown) => options.some((v) => identical(v, m));
  const models: unknown[][] = [
    [],
    [B],
    [A, B],
    [new Proxy(B, {})],
    [{ kind: 'twin' }],
    [{ kind: 'deep', inner: { n: 1 } }],
    [{ kind: 'deep', inner: { n: 2 } }, C],
    [new Date(5)],
    [date, 'a', NaN],
    ['a', 'ghost', 1, null],
    [B, { kind: 'twin' }, new Proxy(C, {})],
    [{ kind: 'nothing' }, [1, 2], []],
  ];
  it('agrees with selectedIn for every option, over a spread of models', () => {
    for (const model of models) {
      const index = buildMatchIndex(model, options);
      options.forEach((v, i) => {
        expect(selectedByIndex(index, model, v), `model #${models.indexOf(model)}, option #${i}`).toBe(selectedIn(model, v, has));
      });
    }
  });
  it('a model value identical to an option never selects another option by content', () => {
    const index = buildMatchIndex([B], options);
    expect(index.loose.size).toBe(0);
    expect(selectedByIndex(index, [B], A)).toBe(false);
    expect(selectedByIndex(index, [B], B)).toBe(true);
  });
});

describe('selectionTest — one pass, one index, nothing kept', () => {
  const opts = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it('agrees with selectedIn, and builds the index once, only for object values', () => {
    let builds = 0;
    const model: unknown[] = [opts[1], 'p'];
    const has = (m: unknown) => opts.some((v) => v === m);
    const test = selectionTest(model, () => { builds++; return opts; });
    expect(test('p')).toBe(true);
    expect(test('q')).toBe(false);
    expect(builds).toBe(0); // primitives never build it
    for (const v of opts) expect(test(v)).toBe(selectedIn(model, v, has));
    expect(builds).toBe(1);
  });
  it('a new test after an in-place change sees the change (each pass reads the model anew)', () => {
    const model: unknown[] = [opts[0]];
    expect(selectionTest(model, () => opts)(opts[0])).toBe(true);
    model[0] = opts[1];
    const again = selectionTest(model, () => opts);
    expect(again(opts[0])).toBe(false);
    expect(again(opts[1])).toBe(true);
  });
});

describe('selects / selectedIn — identity first, content only when nothing is identical', () => {
  const A = { kind: 'twin' };
  const B = { kind: 'twin' };
  const C = { kind: 'other' };
  const options = [A, B, C];
  const has = (m: unknown) => options.some((v) => identical(v, m));
  const never = () => { throw new Error('the options must not be scanned here'); };

  it('an identical option wins over an equal-content one', () => {
    expect(selects(B, B, has)).toBe(true);
    expect(selects(B, A, has)).toBe(false); // B is identical to an option, so A is not it
    expect(selectedIn([B], A, has)).toBe(false);
    expect(selectedIn([B], B, has)).toBe(true);
  });

  it('with no identical option, content decides (every equal-content option matches)', () => {
    const proxy = new Proxy(B, {});
    expect(selects(proxy, A, has)).toBe(true);
    expect(selects(proxy, B, has)).toBe(true);
    expect(selects(proxy, C, has)).toBe(false);
    expect(selectedIn([proxy], A, has)).toBe(true);
  });

  it('primitives never match by content and never scan the options', () => {
    expect(selects('1', 1, never)).toBe(false);
    expect(selects(1, 1, never)).toBe(true);
    expect(selects(NaN, NaN, never)).toBe(true);
    expect(selectedIn([1, 'a', NaN], NaN, never)).toBe(true);
    expect(selectedIn([1, 'a'], '1', never)).toBe(false);
    expect(selects({ a: 1 }, 1, never)).toBe(false);
    expect(selects({ a: 1 }, { a: 2 }, never)).toBe(false); // different contents: no scan either
  });
});

describe('toggleIn — the multi-select commit', () => {
  const never = () => { throw new Error('the options must not be scanned here'); };
  it('appends a value the model does not select, as a fresh array', () => {
    const model = ['a'];
    const next = toggleIn(model, 'b', never);
    expect(next).toEqual(['a', 'b']);
    expect(next).not.toBe(model);
  });
  it('removes EVERY occurrence of a value it selects', () => {
    expect(toggleIn(['a', 'b', 'a'], 'a', never)).toEqual(['b']);
    expect(toggleIn([NaN, 1, NaN], NaN, never)).toEqual([1]);
  });
  it('object values: identity first', () => {
    const A = { kind: 'twin' };
    const B = { kind: 'twin' };
    const has = (m: unknown) => [A, B].some((v) => v === m);
    expect(toggleIn([B], A, has)).toEqual([B, A]); // A is not selected by B: added
    expect(toggleIn([B, A], B, has)).toEqual([A]);
    const proxy = new Proxy(B, {});
    expect(toggleIn([proxy], A, has)).toEqual([]); // no identical option: content decides
  });
});

describe('distinctValues — one row per distinct model value', () => {
  const A = { kind: 'twin' };
  const B = { kind: 'twin' };
  const C = { kind: 'other' };

  it('a value held more than once is one row; its members are every position', () => {
    expect(distinctValues(['a', 'b', 'a'], ['a', 'b'])).toEqual([
      { value: 'a', members: [0, 2], at: 0 },
      { value: 'b', members: [1], at: 1 },
    ]);
  });

  it('NaN is the same value as NaN; 1 and "1" are not', () => {
    expect(distinctValues([NaN, NaN, 1, '1'], [NaN, '1'])).toEqual([
      { value: NaN, members: [0, 1], at: 0 },
      { value: 1, members: [2], at: -1 },
      { value: '1', members: [3], at: 1 },
    ]);
  });

  it('identical objects win over equal-content ones; two identical-matched twins stay two rows', () => {
    expect(distinctValues([B, A], [A, B, C]).map((r) => [r.members, r.at])).toEqual([[[0], 1], [[1], 0]]);
  });

  it('with no identical option an object matches the first equal-content option', () => {
    const proxy = new Proxy(B, {});
    expect(distinctValues([proxy], [A, B, C]).map((r) => r.at)).toEqual([0]);
    expect(distinctValues([{ kind: 'other' }], [A, B, C]).map((r) => r.at)).toEqual([2]);
  });

  it('equal-content model values with no identical option are one row', () => {
    expect(distinctValues([{ kind: 'twin' }, { kind: 'twin' }], [A, C]).map((r) => [r.members, r.at])).toEqual([[[0, 1], 0]]);
  });

  it('a value matching nothing keeps a row with no option', () => {
    expect(distinctValues(['ghost', { x: 1 }], ['a']).map((r) => r.at)).toEqual([-1, -1]);
  });

  it('content matches are confirmed in full: values that only LOOK alike at the top level stay apart', () => {
    const opts = [{ a: { x: 2 }, n: 1 }, { a: { x: 1 }, n: 1 }, { a: { x: 1 }, n: 1 }];
    expect(distinctValues([{ a: { x: 1 }, n: 1 }], opts).map((r) => r.at)).toEqual([1]); // not option 0
    expect(distinctValues([{ a: { x: 3 }, n: 1 }], opts).map((r) => r.at)).toEqual([-1]);
    // Two model values alike at the top level but different inside are two rows.
    expect(distinctValues([{ a: { x: 1 }, n: 1 }, { a: { x: 2 }, n: 1 }, { a: { x: 1 }, n: 1 }], opts).map((r) => [r.members, r.at])).toEqual([[[0, 2], 1], [[1], 0]]);
    // Non-plain values are never matched by content.
    const d = new Date(5);
    expect(distinctValues([new Date(5)], [d]).map((r) => r.at)).toEqual([-1]);
    expect(distinctValues([d], [new Date(5), d]).map((r) => r.at)).toEqual([1]);
  });

  it('answers from the arrays as they are NOW (nothing is cached)', () => {
    const model = ['a', 'b'];
    const options = ['a', 'b', 'c'];
    expect(distinctValues(model, options).map((r) => [r.value, r.at])).toEqual([['a', 0], ['b', 1]]);
    model[1] = 'c';
    expect(distinctValues(model, options).map((r) => [r.value, r.at])).toEqual([['a', 0], ['c', 2]]);
    model.reverse();
    expect(distinctValues(model, options).map((r) => [r.value, r.at])).toEqual([['c', 2], ['a', 0]]);
    model.push('d');
    expect(distinctValues(model, options).map((r) => r.at)).toEqual([2, 0, -1]);
    options.push('d');
    expect(distinctValues(model, options).map((r) => r.at)).toEqual([2, 0, 3]);
  });
});

describe('uniqueKeys / keyBase — render keys that cannot collide', () => {
  it('the review repro: values a, a, a#1', () => {
    const keys = uniqueKeys(['a', 'a', 'a#1'].map((v, i) => keyBase(v, i)));
    expect(new Set(keys).size).toBe(3);
  });

  it('no choice of string values can make two keys equal', () => {
    const tricky = ['a', 'a', '1|string:a', '0|string:a', 'a', '1|a', '', '', '|', '0|', 'string:a', 1, '1', NaN, NaN, null, 'null', undefined, 'undefined', true, 'true'];
    const keys = uniqueKeys(tricky.map((v, i) => keyBase(v, i)));
    expect(new Set(keys).size).toBe(tricky.length);
  });

  it('objects are keyed by position, whatever they stringify to', () => {
    const odd = { toString: () => 'string:a' };
    const keys = uniqueKeys([{}, {}, odd, 'a', '@0', '@1'].map((v, i) => keyBase(v, i)));
    expect(new Set(keys).size).toBe(6);
    expect(keys[0]).toBe('0|@0');
    expect(keys[3]).toBe('0|string:a');
  });

  it('a value keeps its key when other values are added after it', () => {
    const before = uniqueKeys(['a', 'b'].map((v, i) => keyBase(v, i)));
    const after = uniqueKeys(['a', 'b', 'a', 'c'].map((v, i) => keyBase(v, i)));
    expect(after.slice(0, 2)).toEqual(before);
  });

  it('even equal bases come out distinct', () => {
    expect(uniqueKeys(['x', 'x', 'x'])).toEqual(['0|x', '1|x', '2|x']);
  });
});
