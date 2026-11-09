import { afterEach, describe, it, expect } from 'vitest';
import {
  canHop,
  composedCompare,
  getKeyboardRegistry,
  isRenderable,
  nextInstructionsId,
  rowLiftable,
  type GroupOption,
  type ListEntry,
} from './keyboardRegistry';

interface FakeOpts {
  label?: string | null;
  enabled?: boolean;
  renderable?: boolean;
}

const cleanups: Array<() => void> = [];

function el(tag = 'div', parent: Node = document.body): HTMLElement {
  const e = document.createElement(tag);
  parent.appendChild(e);
  // happy-dom has no layout: pretend everything renders unless a test overrides.
  (e as any).getClientRects = () => [{}];
  return e;
}

function fakeEntry(node: HTMLElement, group: GroupOption, opts: FakeOpts = {}): ListEntry {
  if (opts.renderable === false) (node as any).getClientRects = () => [];
  return {
    el: node,
    group: () => group,
    label: () => opts.label ?? null,
    keyboardEnabled: () => opts.enabled ?? true,
    items: () => [],
    keyOf: (_i, idx) => String(idx),
    labelOf: (item) => String(item),
    message: () => '',
    onKey: () => false,
    write: () => {},
    setLifted: () => {},
    announce: () => {},
    focusRow: () => {},
    focusNear: () => {},
    rowEl: () => null,
    emit: () => {},
  };
}

function reg(entry: ListEntry) {
  const un = getKeyboardRegistry().register(entry);
  cleanups.push(un);
  return un;
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  getKeyboardRegistry().lift = null;
  document.body.innerHTML = '';
});

describe('canHop', () => {
  it('same string group', () => {
    expect(canHop('a', 'a')).toEqual({ ok: true, copy: false });
  });
  it('different string group', () => {
    expect(canHop('a', 'b').ok).toBe(false);
  });
  it('pull clone', () => {
    expect(canHop({ name: 'a', pull: 'clone', put: true }, 'a')).toEqual({ ok: true, copy: true });
  });
  it('pull false', () => {
    expect(canHop({ name: 'a', pull: false }, 'a').ok).toBe(false);
    expect(canHop({ name: 'a', pull: false }, 'b').ok).toBe(false);
  });
  it('put false', () => {
    expect(canHop('a', { name: 'a', put: false }).ok).toBe(false);
  });
  it('put array of source names', () => {
    expect(canHop('b', { name: 'a', put: ['b'] }).ok).toBe(true);
    expect(canHop('c', { name: 'a', put: ['b'] }).ok).toBe(false);
  });
  it('null group', () => {
    expect(canHop(null, 'a').ok).toBe(false);
    expect(canHop('a', null).ok).toBe(false);
    expect(canHop(undefined, undefined).ok).toBe(false);
  });
  it('function pull or put is unreachable', () => {
    expect(canHop({ name: 'a', pull: () => true }, 'a').ok).toBe(false);
    expect(canHop('a', { name: 'a', put: () => true }).ok).toBe(false);
  });
  it('function on the irrelevant side still hops', () => {
    expect(canHop('a', { name: 'a', pull: () => true }).ok).toBe(true);
    expect(canHop({ name: 'a', put: () => true }, 'a').ok).toBe(true);
  });
});

describe('registry', () => {
  it('returns one instance across calls', () => {
    expect(getKeyboardRegistry()).toBe(getKeyboardRegistry());
  });

  it('nextInstructionsId is unique', () => {
    const a = nextInstructionsId();
    const b = nextInstructionsId();
    expect(a).not.toBe(b);
    expect(a.startsWith('rozie-sortable-instructions-')).toBe(true);
    expect(b.startsWith('rozie-sortable-instructions-')).toBe(true);
  });

  it('orderedLists orders by document order', () => {
    const a = el(), b = el(), c = el();
    const ea = fakeEntry(a, 'z'), eb = fakeEntry(b, 'z'), ec = fakeEntry(c, 'z');
    reg(ec); reg(ea); reg(eb);
    expect(getKeyboardRegistry().orderedLists()).toEqual([ea, eb, ec]);
  });

  it('orderedLists orders across shadow roots', () => {
    const hostA = el();
    const sr = hostA.attachShadow({ mode: 'open' });
    const inner = el('div', sr as unknown as Node);
    const after = el();
    const hostB = el();
    const srB = hostB.attachShadow({ mode: 'open' });
    srB.appendChild(document.createElement('slot'));
    const slotted = el('div', hostB);
    const eInner = fakeEntry(inner, 'z'), eAfter = fakeEntry(after, 'z'), eSlotted = fakeEntry(slotted, 'z');
    reg(eSlotted); reg(eAfter); reg(eInner);
    expect(getKeyboardRegistry().orderedLists()).toEqual([eInner, eAfter, eSlotted]);
    expect(composedCompare(inner, after)).toBeLessThan(0);
    expect(composedCompare(after, inner)).toBeGreaterThan(0);
  });

  it('findHopTarget forward/back', () => {
    const [a, b, c] = [el(), el(), el()];
    const ea = fakeEntry(a, 'z'), eb = fakeEntry(b, 'z'), ec = fakeEntry(c, 'z');
    reg(ea); reg(eb); reg(ec);
    const r = getKeyboardRegistry();
    expect(r.findHopTarget(eb, 1)).toBe(ec);
    expect(r.findHopTarget(eb, -1)).toBe(ea);
    expect(r.findHopTarget(ec, 1)).toBeNull();
    expect(r.findHopTarget(ea, -1)).toBeNull();
  });

  it('findHopTarget skips lists of another group', () => {
    const ea = fakeEntry(el(), 'z'), ex = fakeEntry(el(), 'y'), ec = fakeEntry(el(), 'z');
    reg(ea); reg(ex); reg(ec);
    expect(getKeyboardRegistry().findHopTarget(ea, 1)).toBe(ec);
  });

  it('findHopTarget skips non-renderable', () => {
    const ea = fakeEntry(el(), 'z'), eb = fakeEntry(el(), 'z', { renderable: false }), ec = fakeEntry(el(), 'z');
    reg(ea); reg(eb); reg(ec);
    expect(getKeyboardRegistry().findHopTarget(ea, 1)).toBe(ec);
  });

  it('findHopTarget skips keyboard-disabled', () => {
    const ea = fakeEntry(el(), 'z'), eb = fakeEntry(el(), 'z', { enabled: false }), ec = fakeEntry(el(), 'z');
    reg(ea); reg(eb); reg(ec);
    expect(getKeyboardRegistry().findHopTarget(ea, 1)).toBe(ec);
  });

  it('findHopTarget returns null for a pull:false source', () => {
    const ea = fakeEntry(el(), { name: 'z', pull: false });
    const eb = fakeEntry(el(), 'z');
    reg(ea); reg(eb);
    expect(getKeyboardRegistry().findHopTarget(ea, 1)).toBeNull();
  });

  it('findHopTarget skips put:false', () => {
    const ea = fakeEntry(el(), 'z');
    const eb = fakeEntry(el(), { name: 'z', put: false });
    const ec = fakeEntry(el(), 'z');
    reg(ea); reg(eb); reg(ec);
    expect(getKeyboardRegistry().findHopTarget(ea, 1)).toBe(ec);
  });

  it('findHopTarget skips lists inside lift.liftedRowEl', () => {
    const ea = fakeEntry(el(), 'z');
    const row = el();
    const nested = el('div', row);
    const en = fakeEntry(nested, 'z');
    const ec = fakeEntry(el(), 'z');
    reg(ea); reg(en); reg(ec);
    const r = getKeyboardRegistry();
    r.lift = { holder: ea, key: '0', item: null, copy: false, hopped: false, origin: { list: ea, index: 0 }, liftedRowEl: row };
    expect(r.findHopTarget(ea, 1)).toBe(ec);
  });

  it('listName uses label, else position within group', () => {
    const ea = fakeEntry(el(), 'z', { label: 'Top sidebar' });
    const eb = fakeEntry(el(), 'z');
    const ex = fakeEntry(el(), 'y');
    const ec = fakeEntry(el(), 'z');
    reg(ea); reg(eb); reg(ex); reg(ec);
    const r = getKeyboardRegistry();
    expect(r.listName(ea)).toBe('Top sidebar');
    expect(r.listName(eb)).toBe('list 2 of 3');
    expect(r.listName(ex)).toBe('list 1 of 1');
  });

  it('unregister of the holder clears the lift', () => {
    const ea = fakeEntry(el(), 'z');
    const un = reg(ea);
    const r = getKeyboardRegistry();
    r.lift = { holder: ea, key: '0', item: null, copy: false, hopped: false, origin: { list: ea, index: 0 }, liftedRowEl: null };
    un();
    expect(r.lift).toBeNull();
  });

  it('entryFor returns the registered entry for its element and null otherwise', () => {
    const a = el();
    const b = el();
    const stray = el();
    const ea = fakeEntry(a, 'g');
    const eb = fakeEntry(b, 'g');
    const r = getKeyboardRegistry();
    const unA = reg(ea);
    reg(eb);
    expect(r.entryFor(a)).toBe(ea);
    expect(r.entryFor(b)).toBe(eb);
    expect(r.entryFor(stray)).toBeNull();
    unA();
    expect(r.entryFor(a)).toBeNull();
  });
  it('deferEnd runs after a task queued before it; flushEnds runs pending ends once, now', async () => {
    const r = getKeyboardRegistry();
    const order: string[] = [];
    setTimeout(() => order.push('earlier task'), 0);
    r.deferEnd(() => order.push('end1'));
    r.deferEnd(() => order.push('end2'));
    expect(order).toEqual([]);
    await new Promise((res) => setTimeout(res, 5));
    expect(order).toEqual(['earlier task', 'end1', 'end2']);
    r.deferEnd(() => order.push('end3'));
    r.flushEnds();
    expect(order.at(-1)).toBe('end3');
    await new Promise((res) => setTimeout(res, 5));
    expect(order.filter((o) => o === 'end3')).toHaveLength(1);
  });
  it('has() tracks registration; unregister clears the speaker', () => {
    const ea = fakeEntry(el(), 'z');
    const r = getKeyboardRegistry();
    expect(r.has(ea)).toBe(false);
    const un = reg(ea);
    expect(r.has(ea)).toBe(true);
    r.speaker = ea;
    un();
    expect(r.has(ea)).toBe(false);
    expect(r.speaker).toBeNull();
  });

  it('indexOfLift finds the key in holder items, -1 when gone', () => {
    const ea = fakeEntry(el(), 'z');
    ea.items = () => ['p', 'q'];
    ea.keyOf = (it) => String(it);
    reg(ea);
    const r = getKeyboardRegistry();
    r.lift = { holder: ea, key: 'q', item: 'q', copy: false, hopped: false, origin: { list: ea, index: 1 }, liftedRowEl: null };
    expect(r.indexOfLift()).toBe(1);
    r.lift.key = 'gone';
    r.lift.item = 'gone';
    expect(r.indexOfLift()).toBe(-1);
  });
});

describe('indexOfLift re-syncs the lift', () => {
  it('falls back to the lifted value by reference and re-syncs the key', () => {
    const ea = fakeEntry(el(), 'z');
    const a = { id: 'a' };
    const b = { id: 'b' };
    let items: unknown[] = [a, b];
    ea.items = () => items;
    ea.keyOf = (it: any) => String(it.id);
    reg(ea);
    const r = getKeyboardRegistry();
    r.lift = { holder: ea, key: 'b', item: b, copy: false, hopped: false, origin: { list: ea, index: 1 }, liftedRowEl: null };
    // The consumer re-keyed the lifted object in place.
    b.id = 'b2';
    expect(r.indexOfLift()).toBe(1);
    expect(r.lift!.key).toBe('b2');
    // A new object with the same key: found by key, and `item` follows it.
    const b3 = { id: 'b2' };
    items = [a, b3];
    expect(r.indexOfLift()).toBe(1);
    expect(r.lift!.item).toBe(b3);
    // A new object with a new key: the lift is lost.
    items = [a, { id: 'fresh' }];
    expect(r.indexOfLift()).toBe(-1);
  });
});

describe('singleton key', () => {
  it('lives on globalThis under the versioned Symbol.for key', () => {
    const g = globalThis as any;
    expect(g[Symbol.for('rozie.sortable-list.keyboard.v1')]?.registry).toBe(getKeyboardRegistry());
    expect(g[Symbol.for('rozie.sortable-list.keyboard')]).toBeUndefined();
  });
});

describe('isRenderable', () => {
  it('false when no client rects (display:none)', () => {
    const e = el();
    (e as any).getClientRects = () => [];
    expect(isRenderable(e)).toBe(false);
  });
  it('true for a plain element', () => {
    expect(isRenderable(el())).toBe(true);
  });
  for (const [name, set] of [
    ['[inert]', (n: HTMLElement) => n.setAttribute('inert', '')],
    ['[hidden]', (n: HTMLElement) => n.setAttribute('hidden', '')],
    ['[aria-hidden="true"]', (n: HTMLElement) => n.setAttribute('aria-hidden', 'true')],
  ] as const) {
    it(`false under ${name}`, () => {
      const wrap = el();
      set(wrap);
      const inner = el('div', wrap);
      expect(isRenderable(inner)).toBe(false);
    });
  }
});

describe('rowLiftable (keyboard honours filter / draggable like SortableJS)', () => {
  function list(html: string): HTMLElement {
    const l = el();
    l.innerHTML = html;
    cleanups.push(() => l.remove());
    return l;
  }

  it('lifts any row when neither filter nor draggable is set', () => {
    const l = list('<div class="rozie-sortable-item"><span>a</span></div>');
    expect(rowLiftable(l.children[0] as HTMLElement, { filter: null, draggable: undefined, sortable: null })).toBe(true);
  });

  it('a selector filter matches the row itself or its slot root (the element covering the row)', () => {
    const l = list(
      '<div class="rozie-sortable-item locked">a</div>' +
        '<div class="rozie-sortable-item"><div class="row" data-locked="true"><span class="grip">g</span></div></div>' +
        '<div class="rozie-sortable-item"><div class="row" data-locked="false">c</div></div>',
    );
    const rows = Array.from(l.children) as HTMLElement[];
    const opts = { filter: ".locked, [data-locked='true']", draggable: undefined, sortable: null };
    expect(rows.map((r) => rowLiftable(r, opts))).toEqual([false, false, true]);
  });

  it('a row whose only match is a control nested inside it stays liftable (SortableJS: closest from the pressed element)', () => {
    const l = list(
      '<div class="rozie-sortable-item"><div class="row"><span>a</span><button class="js-remove">x</button><input /></div></div>',
    );
    const row = l.children[0] as HTMLElement;
    for (const filter of ['.js-remove, .js-edit', 'input']) {
      expect(rowLiftable(row, { filter, draggable: undefined, sortable: null })).toBe(true);
    }
  });

  it('a slot root is read through a <slot> (its assigned elements)', () => {
    const host = el();
    cleanups.push(() => host.remove());
    host.innerHTML = '<div class="row" data-locked="true" slot="r0">a</div>';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<div class="rozie-sortable-list"><div class="rozie-sortable-item"><slot name="r0"></slot></div></div>';
    const row = shadow.querySelector('.rozie-sortable-item') as HTMLElement;
    expect(rowLiftable(row, { filter: '[data-locked="true"]', draggable: undefined, sortable: null })).toBe(false);
  });

  it('a function filter that throws (e.g. reads evt.target) means not filtered', () => {
    const l = list('<div class="rozie-sortable-item">a</div>');
    const row = l.children[0] as HTMLElement;
    const filter = (evt: any) => evt.target.closest('.x') != null;
    expect(rowLiftable(row, { filter, draggable: undefined, sortable: null })).toBe(true);
  });

  it("a selector filter ignores rows of a list nested inside the row", () => {
    const l = list(
      '<div class="rozie-sortable-item"><div class="rozie-sortable-list">' +
        '<div class="rozie-sortable-item" data-locked="true">inner</div></div></div>',
    );
    const outer = l.children[0] as HTMLElement;
    expect(rowLiftable(outer, { filter: '[data-locked]', draggable: undefined, sortable: null })).toBe(true);
    const inner = outer.querySelector('[data-locked]') as HTMLElement;
    expect(rowLiftable(inner, { filter: '[data-locked]', draggable: undefined, sortable: null })).toBe(false);
  });

  it('a function filter is called with a synthetic event, the row and the sortable', () => {
    const l = list('<div class="rozie-sortable-item" data-n="1">a</div><div class="rozie-sortable-item" data-n="2">b</div>');
    const rows = Array.from(l.children) as HTMLElement[];
    const sortable = { tag: 'sortable' };
    const calls: unknown[][] = [];
    const filter = function (this: unknown, evt: unknown, target: HTMLElement, s: unknown) {
      calls.push([this, evt, target, s]);
      return target.getAttribute('data-n') === '2';
    };
    expect(rows.map((r) => rowLiftable(r, { filter, draggable: undefined, sortable }))).toEqual([true, false]);
    expect(calls[0]![0]).toBe(sortable);
    expect(calls[0]![1]).toEqual({});
    expect(calls[0]![2]).toBe(rows[0]);
    expect(calls[0]![3]).toBe(sortable);
  });

  it('only rows matching draggable lift; a leading ">" is SortableJS child syntax', () => {
    const l = list('<div class="rozie-sortable-item can">a</div><div class="rozie-sortable-item">b</div>');
    const rows = Array.from(l.children) as HTMLElement[];
    for (const draggable of ['.can', '>.can']) {
      expect(rows.map((r) => rowLiftable(r, { filter: null, draggable, sortable: null }))).toEqual([true, false]);
    }
  });

  it('an invalid selector neither blocks nor throws', () => {
    const l = list('<div class="rozie-sortable-item">a</div>');
    const row = l.children[0] as HTMLElement;
    expect(rowLiftable(row, { filter: '[[bad', draggable: '[[bad', sortable: null })).toBe(true);
  });
});
