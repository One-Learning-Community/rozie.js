// @rozie/runtime-vue — rozieDeepClone unit tests (Phase 45-07, WR-02 / WR-06).
//
// rozieDeepClone(x) returns an INDEPENDENT deep copy with every Vue reactive
// proxy / ref recursively unwrapped. The previous `$clone` lowering
// (`structuredClone(toRaw(x))`) threw on nested INDEPENDENT reactive proxies /
// refs because `toRaw` only unwraps the top level. These tests pin the new
// helper SAFE on exactly the scenarios the Task-1 probe proved threw before.
import { describe, expect, it } from 'vitest';
import { reactive, ref } from 'vue';
import { rozieDeepClone } from '../rozieDeepClone.js';

describe('rozieDeepClone — recursive proxy-safe deep clone', () => {
  it('S1: clones a plain reactive() tree of plain nested objects, independent of source', () => {
    const state = reactive({ count: 1, nested: { label: 'a', deep: { n: 2 } } });
    const clone = rozieDeepClone(state);
    expect(clone).toEqual({ count: 1, nested: { label: 'a', deep: { n: 2 } } });
    clone.nested.label = 'MUTATED';
    clone.nested.deep.n = 99;
    // Source is untouched — the clone is a fully independent structure.
    expect(state.nested.label).toBe('a');
    expect(state.nested.deep.n).toBe(2);
  });

  it('S2: clones a tree with a nested INDEPENDENT reactive() proxy member (previously THREW)', () => {
    const inner = reactive({ label: 'a', deep: { n: 2 } });
    const state = reactive({ count: 1, box: { inner } });
    let clone!: typeof state;
    expect(() => {
      clone = rozieDeepClone(state);
    }).not.toThrow();
    expect(clone).toEqual({ count: 1, box: { inner: { label: 'a', deep: { n: 2 } } } });
    clone.box.inner.label = 'MUTATED';
    expect(inner.label).toBe('a');
  });

  it('S3: clones a tree with a nested ref() member, unwrapping the ref (previously THREW)', () => {
    const r = ref({ label: 'a' });
    const state = reactive({ count: 1, box: { inner: r } });
    let clone!: { count: number; box: { inner: { label: string } } };
    expect(() => {
      clone = rozieDeepClone(state) as typeof clone;
    }).not.toThrow();
    // The ref is unwrapped to its inner value, not preserved as { value: ... }.
    expect(clone.box.inner).toEqual({ label: 'a' });
    clone.box.inner.label = 'MUTATED';
    expect(r.value.label).toBe('a');
  });

  it('S4: clones an array of independent reactive() items (previously THREW)', () => {
    const state = reactive({ items: [reactive({ id: 1 }), reactive({ id: 2 })] });
    let clone!: typeof state;
    expect(() => {
      clone = rozieDeepClone(state);
    }).not.toThrow();
    expect(clone.items).toEqual([{ id: 1 }, { id: 2 }]);
    clone.items[0]!.id = 99;
    expect(state.items[0]!.id).toBe(1);
  });

  it('S5: clones the FlowCanvas $clone(src.data) shape where src.data is a nested reactive proxy (previously THREW)', () => {
    const srcData = reactive({ label: 'node A', meta: reactive({ tag: 'x' }) });
    let clone!: typeof srcData;
    expect(() => {
      clone = rozieDeepClone(srcData);
    }).not.toThrow();
    expect(clone).toEqual({ label: 'node A', meta: { tag: 'x' } });
    clone.meta.tag = 'MUTATED';
    expect(srcData.meta.tag).toBe('x');
  });

  it('preserves Date, Map, and Set through the clone', () => {
    const state = reactive({
      created: new Date(0),
      map: new Map<string, number>([['a', 1]]),
      set: new Set<number>([1, 2, 3]),
    });
    const clone = rozieDeepClone(state);
    expect(clone.created).toBeInstanceOf(Date);
    expect(clone.created.getTime()).toBe(0);
    expect(clone.map).toBeInstanceOf(Map);
    expect(clone.map.get('a')).toBe(1);
    expect(clone.set).toBeInstanceOf(Set);
    expect([...clone.set]).toEqual([1, 2, 3]);
    // Independence — mutating clone collections does not touch the source.
    clone.map.set('a', 99);
    clone.set.add(4);
    expect(state.map.get('a')).toBe(1);
    expect(state.set.has(4)).toBe(false);
  });

  it('unwraps reactive proxies used as Map keys/values and Set members', () => {
    const keyProxy = reactive({ k: 1 });
    const valProxy = reactive({ v: 2 });
    const memberProxy = reactive({ m: 3 });
    const state = reactive({
      map: new Map<object, object>([[keyProxy, valProxy]]),
      set: new Set<object>([memberProxy]),
    });
    let clone!: typeof state;
    expect(() => {
      clone = rozieDeepClone(state);
    }).not.toThrow();
    const entries = [...clone.map];
    expect(entries).toHaveLength(1);
    const [k, v] = entries[0]!;
    expect(k).toEqual({ k: 1 });
    expect(v).toEqual({ v: 2 });
    expect([...clone.set]).toEqual([{ m: 3 }]);
  });

  it('terminates on cyclic reactive structures', () => {
    const state: Record<string, unknown> = reactive({ name: 'root' });
    state.self = state; // cycle through the proxy
    let clone!: Record<string, unknown>;
    expect(() => {
      clone = rozieDeepClone(state);
    }).not.toThrow();
    expect(clone.name).toBe('root');
    // The cycle is preserved as a self-reference in the clone (structuredClone
    // re-establishes it from the rebuilt cyclic input).
    expect(clone.self).toBe(clone);
  });

  it('passes plain primitive values straight through', () => {
    expect(rozieDeepClone(42)).toBe(42);
    expect(rozieDeepClone('hello')).toBe('hello');
    expect(rozieDeepClone(null)).toBeNull();
    expect(rozieDeepClone(undefined)).toBeUndefined();
    expect(rozieDeepClone(true)).toBe(true);
  });

  it('unwraps a top-level ref() to its inner value', () => {
    const r = ref({ a: { b: 1 } });
    // The static return type is `Ref<...>` (the helper's generic is identity),
    // but at runtime rozieDeepClone unwraps the ref to its inner value — assert
    // the runtime shape via the unwrapped type.
    const clone = rozieDeepClone(r) as unknown as { a: { b: number } };
    expect(clone).toEqual({ a: { b: 1 } });
    clone.a.b = 99;
    expect(r.value.a.b).toBe(1);
  });

  it('still throws on values containing functions (preserved structuredClone semantics)', () => {
    // PRESERVED behavior: $clone is for serializable graph/history state, not
    // function-bearing values — same as the prior structuredClone(toRaw(x))
    // lowering. deepToRaw leaves the function in place; structuredClone rejects it.
    const state = reactive({ ok: 1, fn: () => 7 });
    expect(() => rozieDeepClone(state)).toThrow();
  });
});
