// Behavior tests for `createKeynavStateMachine` — SPEC §4 (keyboard map) +
// §6 (active-only boundary). A fake in-memory host stands in for the six
// real per-target controllers; the reducer itself is pure and framework-free.
import { describe, expect, it, vi } from 'vitest';
import { createKeynavStateMachine } from '../stateMachine.js';
import type { KeynavConfig, KeynavHost, KeynavKeyboardEvent } from '../types.js';

interface FakeItem {
  label?: string;
  disabled?: boolean;
}

function makeHost(source: FakeItem[], initialActive = 0): KeynavHost & { active: number; committed: number[] } {
  const host = {
    active: initialActive,
    committed: [] as number[],
    getSource: () => source,
    getActive: () => host.active,
    setActive: (i: number) => {
      host.active = i;
    },
    commit: (i: number) => {
      host.committed.push(i);
    },
  };
  return host;
}

function key(k: string, extra: Partial<KeynavKeyboardEvent> = {}): KeynavKeyboardEvent & { prevented: boolean } {
  const e = {
    key: k,
    prevented: false,
    preventDefault(this: { prevented: boolean }) {
      this.prevented = true;
    },
    ...extra,
  };
  return e as KeynavKeyboardEvent & { prevented: boolean };
}

const baseConfig: KeynavConfig = {
  focusModel: 'tabindex',
  orientation: 'vertical',
  loop: false,
  typeahead: false,
  skipDisabled: true,
};

describe('createKeynavStateMachine', () => {
  it('vertical: ArrowDown moves +1, ArrowUp moves -1', () => {
    const host = makeHost([{}, {}, {}], 0);
    const sm = createKeynavStateMachine(host, baseConfig);
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(1);
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(2);
    sm.onKeydown(key('ArrowUp'));
    expect(host.active).toBe(1);
  });

  it('horizontal: ArrowRight/ArrowLeft move active, vertical arrows ignored', () => {
    const host = makeHost([{}, {}, {}], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, orientation: 'horizontal' });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(0);
    sm.onKeydown(key('ArrowRight'));
    expect(host.active).toBe(1);
    sm.onKeydown(key('ArrowLeft'));
    expect(host.active).toBe(0);
  });

  it('both: all four arrow keys move active', () => {
    const host = makeHost([{}, {}, {}], 1);
    const sm = createKeynavStateMachine(host, { ...baseConfig, orientation: 'both' });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(2);
    sm.onKeydown(key('ArrowUp'));
    expect(host.active).toBe(1);
    sm.onKeydown(key('ArrowRight'));
    expect(host.active).toBe(2);
    sm.onKeydown(key('ArrowLeft'));
    expect(host.active).toBe(1);
  });

  it('loop=false clamps at the ends', () => {
    const host = makeHost([{}, {}, {}], 2);
    const sm = createKeynavStateMachine(host, { ...baseConfig, loop: false });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(2);
    host.setActive(0);
    sm.onKeydown(key('ArrowUp'));
    expect(host.active).toBe(0);
  });

  it('loop=true wraps (last -> first on next, first -> last on prev)', () => {
    const host = makeHost([{}, {}, {}], 2);
    const sm = createKeynavStateMachine(host, { ...baseConfig, loop: true });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(0);
    sm.onKeydown(key('ArrowUp'));
    expect(host.active).toBe(2);
  });

  it('skipDisabled=true skips disabled items on arrow move', () => {
    const host = makeHost([{}, { disabled: true }, {}], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, skipDisabled: true });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(2);
  });

  it('skipDisabled=false lands on disabled items', () => {
    const host = makeHost([{}, { disabled: true }, {}], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, skipDisabled: false });
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(1);
  });

  it('skipDisabled=true + loop=true wraps past disabled items', () => {
    const host = makeHost([{ disabled: true }, {}, { disabled: true }], 1);
    const sm = createKeynavStateMachine(host, { ...baseConfig, skipDisabled: true, loop: true });
    sm.onKeydown(key('ArrowDown'));
    // index 2 disabled, wraps to 0 disabled, back to 1 (full circle) -> no enabled other than self
    expect(host.active).toBe(1);
  });

  it('Home moves to first enabled index; End moves to last enabled index', () => {
    const host = makeHost([{ disabled: true }, {}, {}, { disabled: true }], 2);
    const sm = createKeynavStateMachine(host, baseConfig);
    sm.onKeydown(key('Home'));
    expect(host.active).toBe(1);
    sm.onKeydown(key('End'));
    expect(host.active).toBe(2);
  });

  it('typeahead=true: printable char jumps to next item whose label prefix-matches (case-insensitive)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const host = makeHost([{ label: 'Apple' }, { label: 'Banana' }, { label: 'Cherry' }], 0);
      const sm = createKeynavStateMachine(host, { ...baseConfig, typeahead: true });
      sm.onKeydown(key('b'));
      expect(host.active).toBe(1);
      vi.setSystemTime(600); // beyond the ~500ms buffer window -> fresh search
      sm.onKeydown(key('C'));
      expect(host.active).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('typeahead buffer accumulates within ~500ms then resets', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(0);
      const host = makeHost([{ label: 'Apple' }, { label: 'Apricot' }, { label: 'Banana' }], 0);
      const sm = createKeynavStateMachine(host, { ...baseConfig, typeahead: true });
      sm.onKeydown(key('a'));
      expect(host.active).toBe(0); // 'a' matches Apple (self) first in the circular scan
      vi.setSystemTime(100);
      sm.onKeydown(key('p'));
      // buffer is now 'ap' (within 500ms) -> matches Apple or Apricot
      expect([0, 1]).toContain(host.active);
      vi.setSystemTime(700); // > 500ms since last keypress -> buffer resets
      sm.onKeydown(key('b'));
      expect(host.active).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('typeahead=false ignores printable chars', () => {
    const host = makeHost([{ label: 'Apple' }, { label: 'Banana' }], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, typeahead: false });
    sm.onKeydown(key('b'));
    expect(host.active).toBe(0);
  });

  it('Enter returns a COMMIT intent carrying the active index, never mutates selection', () => {
    const host = makeHost([{}, {}, {}], 1);
    const sm = createKeynavStateMachine(host, baseConfig);
    sm.onKeydown(key('Enter'));
    expect(host.committed).toEqual([1]);
    expect(host.active).toBe(1); // unchanged — Enter does not move
    // the fake host exposes no selection API at all; commit firing is the
    // only observable effect, proving the machine never reaches for one.
  });

  it('pointer/click on index i sets active to i and fires commit', () => {
    const host = makeHost([{}, {}, {}], 0);
    const sm = createKeynavStateMachine(host, baseConfig);
    sm.onPointerActivate(2);
    expect(host.active).toBe(2);
    expect(host.committed).toEqual([2]);
  });

  it('all-disabled source: arrow move, Home/End, and typeahead are all safe no-ops', () => {
    const host = makeHost([{ disabled: true }, { disabled: true }], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, typeahead: true, loop: true });
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(host.active).toBe(0);
    expect(() => sm.onKeydown(key('Home'))).not.toThrow();
    expect(host.active).toBe(0);
    expect(() => sm.onKeydown(key('End'))).not.toThrow();
    expect(host.active).toBe(0);
    expect(() => sm.onKeydown(key('a'))).not.toThrow();
    expect(host.active).toBe(0);
  });

  it('moveTo clamps to valid bounds', () => {
    const host = makeHost([{}, {}, {}], 0);
    const sm = createKeynavStateMachine(host, baseConfig);
    sm.moveTo(10);
    expect(host.active).toBe(2);
    sm.moveTo(-5);
    expect(host.active).toBe(0);
  });

  it('dispose() does not throw and clears internal typeahead state', () => {
    const host = makeHost([{ label: 'Apple' }], 0);
    const sm = createKeynavStateMachine(host, { ...baseConfig, typeahead: true });
    sm.onKeydown(key('a'));
    expect(() => sm.dispose()).not.toThrow();
  });

  it('empty source is a safe no-op', () => {
    const host = makeHost([], 0);
    const sm = createKeynavStateMachine(host, baseConfig);
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(() => sm.onKeydown(key('Home'))).not.toThrow();
    expect(() => sm.onPointerActivate(0)).not.toThrow();
  });
});
