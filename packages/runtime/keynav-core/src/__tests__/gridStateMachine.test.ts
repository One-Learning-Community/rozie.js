// Behavior tests for the 2D grid branch of `createKeynavStateMachine` (SPEC
// §4 key map, §4.1 machine-never-lands, §4.2 disabled interaction, §4.3
// ragged last row, §5 inert-by-default). Mirrors the fake-host/fake-event
// harness conventions of `stateMachine.test.ts` (that file is NOT modified —
// this suite proves the grid branch stands alone and the 1D suite is
// untouched).
import { describe, expect, it } from 'vitest';
import { createKeynavStateMachine } from '../stateMachine.js';
import type { KeynavConfig, KeynavHost, KeynavKeyboardEvent, KeynavPageDetail } from '../types.js';

interface FakeItem {
  label?: string;
  disabled?: boolean;
}

interface FakeGridHost extends KeynavHost {
  active: number;
  committed: number[];
  paged: KeynavPageDetail[];
}

function makeGridHost(source: FakeItem[], initialActive = 0, opts: { withPage?: boolean } = {}): FakeGridHost {
  const paged: KeynavPageDetail[] = [];
  const host: FakeGridHost = {
    active: initialActive,
    committed: [],
    paged,
    getSource: () => source,
    getActive: () => host.active,
    setActive: (i: number) => {
      host.active = i;
    },
    commit: (i: number) => {
      host.committed.push(i);
    },
  };
  if (opts.withPage !== false) {
    host.page = (detail: KeynavPageDetail) => {
      paged.push(detail);
    };
  }
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

function makeGridConfig(columns: number | (() => number), overrides: Partial<KeynavConfig> = {}): KeynavConfig {
  const columnsFn = typeof columns === 'function' ? columns : () => columns;
  return {
    focusModel: 'tabindex',
    orientation: 'both',
    loop: false,
    typeahead: false,
    skipDisabled: false,
    grid: { columns: columnsFn },
    ...overrides,
  };
}

// Canonical ragged fixture: 7 columns, 31 items = 4 full rows (0-27) plus a
// trailing row of 3 (28-30). Row map:
//   row0: 0-6   row1: 7-13   row2: 14-20   row3: 21-27   row4: 28-30 (ragged)
const RAGGED_COLUMNS = 7;
const RAGGED_COUNT = 31;

function makeRaggedItems(disabledIndices: number[] = []): FakeItem[] {
  return Array.from({ length: RAGGED_COUNT }, (_, i) => ({
    label: `item-${i}`,
    disabled: disabledIndices.includes(i),
  }));
}

describe('createKeynavStateMachine — grid branch', () => {
  it('horizontal continuity: ArrowRight/ArrowLeft flow across row ends', () => {
    const host = makeGridHost(makeRaggedItems(), 6); // row0 last cell
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('ArrowRight'));
    expect(host.active).toBe(7); // row1 first cell
    expect(host.paged).toEqual([]);
    sm.onKeydown(key('ArrowLeft'));
    expect(host.active).toBe(6);
  });

  it('vertical stride: ArrowDown/ArrowUp move by the column count', () => {
    const host = makeGridHost(makeRaggedItems(), 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(7);
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(14);
    sm.onKeydown(key('ArrowUp'));
    expect(host.active).toBe(7);
  });

  it('horizontal boundary: ArrowLeft at 0 and ArrowRight at the last index page without moving', () => {
    const hostLeft = makeGridHost(makeRaggedItems(), 0);
    const smLeft = createKeynavStateMachine(hostLeft, makeGridConfig(RAGGED_COLUMNS));
    smLeft.onKeydown(key('ArrowLeft'));
    expect(hostLeft.active).toBe(0);
    expect(hostLeft.paged).toEqual([{ direction: -1, reason: 'boundary', axis: 'row' }]);

    const hostRight = makeGridHost(makeRaggedItems(), RAGGED_COUNT - 1);
    const smRight = createKeynavStateMachine(hostRight, makeGridConfig(RAGGED_COLUMNS));
    smRight.onKeydown(key('ArrowRight'));
    expect(hostRight.active).toBe(RAGGED_COUNT - 1);
    expect(hostRight.paged).toEqual([{ direction: 1, reason: 'boundary', axis: 'row' }]);
  });

  it('vertical boundary: ArrowUp from row 0 and ArrowDown past the end page on the column axis', () => {
    const hostUp = makeGridHost(makeRaggedItems(), 3); // row0
    const smUp = createKeynavStateMachine(hostUp, makeGridConfig(RAGGED_COLUMNS));
    smUp.onKeydown(key('ArrowUp'));
    expect(hostUp.active).toBe(3);
    expect(hostUp.paged).toEqual([{ direction: -1, reason: 'boundary', axis: 'column' }]);

    const hostDown = makeGridHost(makeRaggedItems(), 25); // row3 col4 -> 25+7=32, out of range
    const smDown = createKeynavStateMachine(hostDown, makeGridConfig(RAGGED_COLUMNS));
    smDown.onKeydown(key('ArrowDown'));
    expect(hostDown.active).toBe(25);
    expect(hostDown.paged).toEqual([{ direction: 1, reason: 'boundary', axis: 'column' }]);
  });

  it('ragged last row: ArrowDown from the second-to-last row into a missing trailing cell is a column-axis boundary', () => {
    const host = makeGridHost(makeRaggedItems(), 24); // row3 col3 -> 24+7=31, missing (row4 only has cols 0-2)
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(24);
    expect(host.paged).toEqual([{ direction: 1, reason: 'boundary', axis: 'column' }]);
  });

  it('Home/End resolve within the active row', () => {
    const host = makeGridHost(makeRaggedItems(), 16); // row2 col2
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('Home'));
    expect(host.active).toBe(14); // row2 first cell
    host.setActive(16);
    sm.onKeydown(key('End'));
    expect(host.active).toBe(20); // row2 last cell
  });

  it('End on the ragged trailing row resolves to the last existing cell, not rowStart + columns - 1', () => {
    const host = makeGridHost(makeRaggedItems(), 29); // row4 col1
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('End'));
    expect(host.active).toBe(30); // last EXISTING cell, not 28 + 6 = 34
    host.setActive(29);
    sm.onKeydown(key('Home'));
    expect(host.active).toBe(28); // row4 first cell
  });

  it('Ctrl+Home / Ctrl+End resolve to the first/last cell of the whole grid', () => {
    const host = makeGridHost(makeRaggedItems(), 16);
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('Home', { ctrlKey: true }));
    expect(host.active).toBe(0);
    host.setActive(16);
    sm.onKeydown(key('End', { ctrlKey: true }));
    expect(host.active).toBe(RAGGED_COUNT - 1);
    host.setActive(16);
    sm.onKeydown(key('End', { metaKey: true }));
    expect(host.active).toBe(RAGGED_COUNT - 1);
  });

  it('PageUp/PageDown never move active and always page with reason pageup/pagedown, axis column', () => {
    const host = makeGridHost(makeRaggedItems(), 10);
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('PageUp'));
    expect(host.active).toBe(10);
    expect(host.paged).toEqual([{ direction: -1, reason: 'pageup', axis: 'column' }]);
    sm.onKeydown(key('PageDown'));
    expect(host.active).toBe(10);
    expect(host.paged).toEqual([
      { direction: -1, reason: 'pageup', axis: 'column' },
      { direction: 1, reason: 'pagedown', axis: 'column' },
    ]);
  });

  it('inert default: an arrow move lands on a disabled cell rather than skipping it', () => {
    const host = makeGridHost(makeRaggedItems([8]), 7); // ArrowRight from 7 -> 8 (disabled)
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onKeydown(key('ArrowRight'));
    expect(host.active).toBe(8);
  });

  it('inert commit: Enter on a disabled active cell does not commit; Enter on an enabled cell does', () => {
    const items = makeRaggedItems([8]);
    const hostDisabled = makeGridHost(items, 8);
    const smDisabled = createKeynavStateMachine(hostDisabled, makeGridConfig(RAGGED_COLUMNS));
    smDisabled.onKeydown(key('Enter'));
    expect(hostDisabled.committed).toEqual([]);

    const hostEnabled = makeGridHost(items, 7);
    const smEnabled = createKeynavStateMachine(hostEnabled, makeGridConfig(RAGGED_COLUMNS));
    smEnabled.onKeydown(key('Enter'));
    expect(hostEnabled.committed).toEqual([7]);
  });

  it('pointer activation on a disabled index sets active but does not commit', () => {
    const host = makeGridHost(makeRaggedItems([8]), 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    sm.onPointerActivate(8);
    expect(host.active).toBe(8);
    expect(host.committed).toEqual([]);
    sm.onPointerActivate(9);
    expect(host.active).toBe(9);
    expect(host.committed).toEqual([9]);
  });

  it('skipDisabled walks by the stride past disabled cells (horizontal)', () => {
    const items: FakeItem[] = Array.from({ length: 10 }, (_, i) => ({ disabled: i === 2 }));
    const host = makeGridHost(items, 1);
    const sm = createKeynavStateMachine(host, makeGridConfig(5, { skipDisabled: true }));
    sm.onKeydown(key('ArrowRight'));
    expect(host.active).toBe(3); // skipped disabled index 2
  });

  it('skipDisabled walks by the column stride past disabled cells (vertical)', () => {
    const items: FakeItem[] = Array.from({ length: 9 }, (_, i) => ({ disabled: i === 4 }));
    const host = makeGridHost(items, 1); // row0 col1
    const sm = createKeynavStateMachine(host, makeGridConfig(3, { skipDisabled: true }));
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(7); // skipped disabled index 4 (row1 col1), landed row2 col1
  });

  it('an all-disabled skipDisabled walk is a safe no-op — no move, no commit, no throw', () => {
    const items: FakeItem[] = Array.from({ length: 4 }, () => ({ disabled: true }));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(2, { skipDisabled: true }));
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(host.active).toBe(0);
    expect(host.committed).toEqual([]);
    expect(() => sm.onKeydown(key('ArrowRight'))).not.toThrow();
    expect(host.active).toBe(0);
    expect(host.committed).toEqual([]);
  });

  it('a dynamic columns() getter changes the vertical stride on the NEXT keydown without re-instantiating', () => {
    let cols = 3;
    const items: FakeItem[] = Array.from({ length: 12 }, () => ({}));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(() => cols));
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(3);
    cols = 4;
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(7); // re-read the getter, uses the NEW stride
  });

  it('degenerate columns() (zero) clamps to a positive integer stride and never throws', () => {
    const items: FakeItem[] = Array.from({ length: 6 }, () => ({}));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(() => 0));
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(Number.isInteger(host.active)).toBe(true);
  });

  it('degenerate columns() (negative) clamps to a positive integer stride and never throws', () => {
    const items: FakeItem[] = Array.from({ length: 6 }, () => ({}));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(() => -3));
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(Number.isInteger(host.active)).toBe(true);
  });

  it('degenerate columns() (NaN) clamps to a positive integer stride and never throws', () => {
    const items: FakeItem[] = Array.from({ length: 6 }, () => ({}));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(() => Number.NaN));
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(Number.isInteger(host.active)).toBe(true);
  });

  it('degenerate columns() (fractional) floors to an integer stride and never throws', () => {
    const items: FakeItem[] = Array.from({ length: 20 }, () => ({}));
    const host = makeGridHost(items, 0);
    const sm = createKeynavStateMachine(host, makeGridConfig(() => 7.5));
    expect(() => sm.onKeydown(key('ArrowDown'))).not.toThrow();
    expect(Number.isInteger(host.active)).toBe(true);
  });

  it('a host WITHOUT page survives every boundary/page key without throwing', () => {
    const host = makeGridHost(makeRaggedItems(), 0, { withPage: false });
    expect(host.page).toBeUndefined();
    const sm = createKeynavStateMachine(host, makeGridConfig(RAGGED_COLUMNS));
    expect(() => sm.onKeydown(key('ArrowLeft'))).not.toThrow();
    expect(() => sm.onKeydown(key('ArrowUp'))).not.toThrow();
    expect(() => sm.onKeydown(key('PageUp'))).not.toThrow();
    expect(() => sm.onKeydown(key('PageDown'))).not.toThrow();
  });

  it('a config without grid reproduces existing 1D arrow/Home/End behavior', () => {
    const host = makeGridHost([{}, {}, {}], 0);
    const config: KeynavConfig = {
      focusModel: 'tabindex',
      orientation: 'vertical',
      loop: false,
      typeahead: false,
      skipDisabled: true,
    };
    const sm = createKeynavStateMachine(host, config);
    sm.onKeydown(key('ArrowDown'));
    expect(host.active).toBe(1);
    sm.onKeydown(key('Home'));
    expect(host.active).toBe(0);
    sm.onKeydown(key('End'));
    expect(host.active).toBe(2);
  });
});
