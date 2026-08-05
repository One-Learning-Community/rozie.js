// rovingIndex.test.ts — NEW, deliberately separate from buildMonthGrid.test.ts
// (the phase's unmodified 260802-hla regression net). Covers
// `resolveRovingDrillIndex`, the index-returning adapter that lets the
// `r-keynav:tabindex.grid(3)` primitive's active-index model reuse the same
// iso-based selection chain `resolveRovingDrillIso` already proves — see
// packages/ui/date-picker/src/internal/buildMonthGrid.ts.

import { describe, expect, it } from 'vitest';
import {
  resolveRovingDrillIndex,
  resolveRovingDrillIso,
  ROVING_DRILL_NONE,
  type RovingDrillCell,
} from './buildMonthGrid.js';

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
