// rovingIndex.test.ts — NEW, deliberately separate from buildMonthGrid.test.ts
// (the phase's unmodified 260802-hla regression net). Covers
// `resolveRovingDrillIndex`, the index-returning adapter that lets the
// `r-keynav:tabindex.grid(3)` primitive's active-index model reuse the same
// iso-based selection chain `resolveRovingDrillIso` already proves — see
// packages/ui/date-picker/src/internal/buildMonthGrid.ts.

import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildMonthGrid,
  resolveRovingDayIndex,
  resolveRovingDrillIndex,
  resolveRovingDrillIso,
  resolveRovingIso,
  ROVING_DAY_NONE,
  ROVING_DRILL_NONE,
  type CalendarDay,
  type RovingDayInput,
  type RovingDrillCell,
} from './buildMonthGrid.js';

/** Mirrors DatePicker.rozie's `allDayCells()`: the flat, render-order
 * concatenation of every rendered panel's day cells (panel, then week, then
 * day), for `numberOfMonths` panels stepping forward from `input.viewIso`. */
function buildFlatCells(input: RovingDayInput): CalendarDay[] {
  const n = Math.max(1, Math.floor(input.numberOfMonths ?? 1));
  const cells: CalendarDay[] = [];
  for (let i = 0; i < n; i++) {
    const grid = buildMonthGrid({ ...input, viewIso: addMonths(input.viewIso, i) });
    for (const week of grid.weeks) for (const day of week) cells.push(day);
  }
  return cells;
}

describe('resolveRovingDrillIndex', () => {
  it('the selected cell wins over current/first-enabled', () => {
    const cells: RovingDrillCell[] = [
      { iso: 'a', selected: false, current: true, disabled: false },
      { iso: 'b', selected: true, current: false, disabled: false },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIndex(cells)).toBe(1);
  });

  it('falls back to the current cell when nothing is selected', () => {
    const cells: RovingDrillCell[] = [
      { iso: 'a', selected: false, current: false, disabled: false },
      { iso: 'b', selected: false, current: true, disabled: false },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIndex(cells)).toBe(1);
  });

  it('falls back to the first !disabled cell when nothing is selected/current', () => {
    const cells: RovingDrillCell[] = [
      { iso: 'a', selected: false, current: false, disabled: true },
      { iso: 'b', selected: false, current: false, disabled: true },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIndex(cells)).toBe(2);
  });

  it('returns the ROVING_DRILL_NONE sentinel when every cell is disabled and none is selected/current', () => {
    const cells: RovingDrillCell[] = [
      { iso: 'a', selected: false, current: false, disabled: true },
      { iso: 'b', selected: false, current: false, disabled: true },
    ];
    expect(resolveRovingDrillIndex(cells)).toBe(ROVING_DRILL_NONE);
    expect(resolveRovingDrillIndex(cells)).toBe(-1);
  });

  it('agrees with resolveRovingDrillIso on every case above: the index resolves to the SAME cell the iso resolver names', () => {
    const fixtures: RovingDrillCell[][] = [
      [
        { iso: 'a', selected: false, current: true, disabled: false },
        { iso: 'b', selected: true, current: false, disabled: false },
        { iso: 'c', selected: false, current: false, disabled: false },
      ],
      [
        { iso: 'a', selected: false, current: false, disabled: false },
        { iso: 'b', selected: false, current: true, disabled: false },
        { iso: 'c', selected: false, current: false, disabled: false },
      ],
      [
        { iso: 'a', selected: false, current: false, disabled: true },
        { iso: 'b', selected: false, current: false, disabled: true },
        { iso: 'c', selected: false, current: false, disabled: false },
      ],
    ];
    for (const cells of fixtures) {
      const iso = resolveRovingDrillIso(cells);
      const index = resolveRovingDrillIndex(cells);
      expect(cells[index]?.iso).toBe(iso);
    }
  });

  it('agrees with resolveRovingDrillIso on the all-disabled case: both report "no selectable cell"', () => {
    const cells: RovingDrillCell[] = [
      { iso: 'a', selected: false, current: false, disabled: true },
      { iso: 'b', selected: false, current: false, disabled: true },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('');
    expect(resolveRovingDrillIndex(cells)).toBe(ROVING_DRILL_NONE);
  });

  it('the defect case: a value selected in a DIFFERENT year (no selected cell) + today in a DIFFERENT year (no current cell) still returns the index of the first enabled cell, not the sentinel', () => {
    const cells: RovingDrillCell[] = [
      { iso: '2020-01-01', selected: false, current: false, disabled: false },
      { iso: '2021-01-01', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIndex(cells)).toBe(0);
  });
});

// resolveRovingDayIndex — the DAY grid's index-returning adapter over
// resolveRovingIso (77-08 retrofit). June 2025 starts on a Sunday (the SAME
// fixture month date-picker-keyboard.spec.ts's Docker VR fixture uses), so
// its grid has NO leading spill and cells[0] is 2025-06-01.
describe('resolveRovingDayIndex', () => {
  it('resolves the anchor-in-view cell when the anchor (selected value) is in the displayed month', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '2025-06-15',
      today: '2099-01-01',
      anchor: '2025-06-15',
    };
    const cells = buildFlatCells(input);
    const index = resolveRovingDayIndex(cells, input);
    expect(cells[index]?.iso).toBe('2025-06-15');
    expect(cells[index]?.inMonth).toBe(true);
  });

  it('falls back to the today-in-view cell when there is no anchor', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '',
      today: '2025-06-10',
      anchor: '',
    };
    const cells = buildFlatCells(input);
    const index = resolveRovingDayIndex(cells, input);
    expect(cells[index]?.iso).toBe('2025-06-10');
  });

  it('falls back to the first enabled in-month day when neither the anchor nor today is in view', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '',
      today: '2099-01-01',
      anchor: '',
    };
    const cells = buildFlatCells(input);
    const index = resolveRovingDayIndex(cells, input);
    expect(cells[index]?.iso).toBe('2025-06-01');
    expect(cells[index]?.inMonth).toBe(true);
  });

  it('returns the ROVING_DAY_NONE sentinel when the whole control is disabled', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '2025-06-15',
      today: '2025-06-10',
      anchor: '2025-06-15',
      disabled: true,
    };
    const cells = buildFlatCells(input);
    expect(resolveRovingDayIndex(cells, input)).toBe(ROVING_DAY_NONE);
    expect(resolveRovingDayIndex(cells, input)).toBe(-1);
  });

  it('resolves into the SECOND panel in a multi-month view when the anchor lives there', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '2025-07-16',
      today: '2099-01-01',
      anchor: '2025-07-16',
      numberOfMonths: 2,
    };
    const cells = buildFlatCells(input);
    const index = resolveRovingDayIndex(cells, input);
    expect(cells[index]?.iso).toBe('2025-07-16');
    // Every panel is exactly 42 cells (6 rows x 7 cols) — an index >= 42
    // confirms the resolution landed in panel 1 (July), not panel 0 (June).
    expect(index).toBeGreaterThanOrEqual(42);
  });

  it('agrees with resolveRovingIso on every case above: the resolved index names the SAME cell the iso resolver names', () => {
    const fixtures: RovingDayInput[] = [
      { viewIso: '2025-06-01', value: '2025-06-15', today: '2099-01-01', anchor: '2025-06-15' },
      { viewIso: '2025-06-01', value: '', today: '2025-06-10', anchor: '' },
      { viewIso: '2025-06-01', value: '', today: '2099-01-01', anchor: '' },
      {
        viewIso: '2025-06-01',
        value: '2025-07-16',
        today: '2099-01-01',
        anchor: '2025-07-16',
        numberOfMonths: 2,
      },
    ];
    for (const input of fixtures) {
      const cells = buildFlatCells(input);
      const iso = resolveRovingIso(input);
      const index = resolveRovingDayIndex(cells, input);
      expect(cells[index]?.iso).toBe(iso);
    }
  });

  it('agrees with resolveRovingIso on the all-disabled case: both report "no selectable cell"', () => {
    const input: RovingDayInput = {
      viewIso: '2025-06-01',
      value: '',
      today: '',
      anchor: '',
      disabled: true,
    };
    const cells = buildFlatCells(input);
    expect(resolveRovingIso(input)).toBe('');
    expect(resolveRovingDayIndex(cells, input)).toBe(ROVING_DAY_NONE);
  });
});
