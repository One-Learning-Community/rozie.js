import { afterEach, describe, it, expect } from 'vitest';
import {
  canHop,
  composedCompare,
  getKeyboardRegistry,
  isRenderable,
  nextInstructionsId,
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
    onKey: () => false,
    write: () => {},
    setLifted: () => {},
    announce: () => {},
    focusRow: () => {},
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
    r.lift = { holder: ea, key: '0', data: null, copy: false, hopped: false, origin: { list: ea, index: 0 }, liftedRowEl: row };
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
    r.lift = { holder: ea, key: '0', data: null, copy: false, hopped: false, origin: { list: ea, index: 0 }, liftedRowEl: null };
    un();
    expect(r.lift).toBeNull();
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
    r.lift = { holder: ea, key: 'q', data: 'q', copy: false, hopped: false, origin: { list: ea, index: 1 }, liftedRowEl: null };
    expect(r.indexOfLift()).toBe(1);
    r.lift.key = 'gone';
    expect(r.indexOfLift()).toBe(-1);
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
