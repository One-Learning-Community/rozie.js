/**
 * Unit tests for the pure calendar-grid algorithm. These pin the leading/trailing
 * spill, weekStartsOn rotation, min/max/disabledDates gating, month arithmetic,
 * and ISO parsing edge cases with concrete expected values — the branchy logic
 * that the surface gate (which only checks the IR shape) cannot cover.
 *
 * Excluded from the vendored leaf copies (codegen's copyInternal filters
 * `*.test.ts`) — runs only under `pnpm --filter @rozie-ui/date-picker test`.
 */
import { describe, it, expect } from 'vitest';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  isDayDisabled,
  isIsoDate,
  isoToUtc,
  monthLabel,
  resolveViewIso,
  toIso,
  weekdayLabels,
} from './buildMonthGrid';

describe('isIsoDate', () => {
  it('accepts well-formed YYYY-MM-DD', () => {
    expect(isIsoDate('2026-06-24')).toBe(true);
    expect(isIsoDate('0001-01-01')).toBe(true);
  });
  it('rejects malformed / non-string', () => {
    expect(isIsoDate('2026-6-24')).toBe(false);
    expect(isIsoDate('2026/06/24')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260624 as unknown)).toBe(false);
  });
});

describe('isoToUtc', () => {
  it('parses a valid date to UTC-midnight ms', () => {
    expect(isoToUtc('1970-01-01')).toBe(0);
    expect(isoToUtc('1970-01-02')).toBe(86400000);
  });
  it('rejects out-of-range + overflow dates', () => {
    expect(isoToUtc('2026-13-01')).toBe(null);
    expect(isoToUtc('2026-00-10')).toBe(null);
    expect(isoToUtc('2024-02-31')).toBe(null); // would roll into March
    expect(isoToUtc('not-a-date')).toBe(null);
  });
  it('accepts a real leap day', () => {
    expect(isoToUtc('2024-02-29')).not.toBe(null);
    expect(isoToUtc('2025-02-29')).toBe(null); // 2025 is not a leap year
  });
});

describe('toIso', () => {
  it('zero-pads month + day', () => {
    expect(toIso(2026, 0, 5)).toBe('2026-01-05');
    expect(toIso(2026, 11, 31)).toBe('2026-12-31');
  });
  it('normalizes day overflow into the next month', () => {
    expect(toIso(2024, 1, 30)).toBe('2024-03-01'); // Feb 30 2024 → Mar 1
  });
});

describe('addMonths', () => {
  it('advances + retreats whole months', () => {
    expect(addMonths('2026-06-15', 1)).toBe('2026-07-15');
    expect(addMonths('2026-06-15', -1)).toBe('2026-05-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });
  it('clamps the day into a shorter target month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });
});

describe('addDays', () => {
  it('crosses month + year boundaries', () => {
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('isDayDisabled', () => {
  const base = { viewIso: '2026-06-01', value: '', today: '2026-06-24' };
  it('disables outside [min, max]', () => {
    expect(isDayDisabled('2026-06-09', { ...base, min: '2026-06-10' })).toBe(true);
    expect(isDayDisabled('2026-06-10', { ...base, min: '2026-06-10' })).toBe(false);
    expect(isDayDisabled('2026-06-21', { ...base, max: '2026-06-20' })).toBe(true);
    expect(isDayDisabled('2026-06-20', { ...base, max: '2026-06-20' })).toBe(false);
  });
  it('disables explicit disabledDates', () => {
    expect(isDayDisabled('2026-06-15', { ...base, disabledDates: ['2026-06-15'] })).toBe(true);
    expect(isDayDisabled('2026-06-16', { ...base, disabledDates: ['2026-06-15'] })).toBe(false);
  });
  it('disables everything when the control is disabled', () => {
    expect(isDayDisabled('2026-06-15', { ...base, disabled: true })).toBe(true);
  });
});

describe('resolveViewIso', () => {
  it('prefers viewIso, then value, then today', () => {
    expect(resolveViewIso({ viewIso: '2026-06-01', value: '2025-01-01', today: '2024-01-01' })).toBe('2026-06-01');
    expect(resolveViewIso({ viewIso: '', value: '2025-01-01', today: '2024-01-01' })).toBe('2025-01-01');
    expect(resolveViewIso({ viewIso: '', value: '', today: '2024-01-01' })).toBe('2024-01-01');
  });
});

describe('buildMonthGrid', () => {
  it('produces 6 rows of 7 days', () => {
    const g = buildMonthGrid({ viewIso: '2026-06-15', value: '', today: '2026-06-24' });
    expect(g.weeks.length).toBe(6);
    for (const row of g.weeks) expect(row.length).toBe(7);
    expect(g.year).toBe(2026);
    expect(g.month).toBe(5); // 0-based June
  });

  it('leads with the previous month spill (Sunday start, June 2026 starts Mon)', () => {
    // June 1 2026 is a Monday. weekStartsOn=0 (Sun) → one leading spill day (May 31).
    const g = buildMonthGrid({ viewIso: '2026-06-01', value: '', today: '', weekStartsOn: 0 });
    const first = g.weeks[0][0];
    expect(first.iso).toBe('2026-05-31');
    expect(first.inMonth).toBe(false);
    expect(g.weeks[0][1].iso).toBe('2026-06-01');
    expect(g.weeks[0][1].inMonth).toBe(true);
  });

  it('rotates the first column with weekStartsOn=1 (Monday)', () => {
    // June 1 2026 is a Monday → with Monday start it is the first cell, no spill.
    const g = buildMonthGrid({ viewIso: '2026-06-01', value: '', today: '', weekStartsOn: 1 });
    expect(g.weeks[0][0].iso).toBe('2026-06-01');
    expect(g.weeks[0][0].inMonth).toBe(true);
  });

  it('flags the selected + today cells', () => {
    const g = buildMonthGrid({ viewIso: '2026-06-15', value: '2026-06-15', today: '2026-06-24' });
    const flat = g.weeks.flat();
    expect(flat.filter((d) => d.selected).map((d) => d.iso)).toEqual(['2026-06-15']);
    expect(flat.filter((d) => d.today).map((d) => d.iso)).toEqual(['2026-06-24']);
  });

  it('marks min/max/disabledDates cells disabled', () => {
    const g = buildMonthGrid({
      viewIso: '2026-06-15',
      value: '',
      today: '',
      min: '2026-06-10',
      max: '2026-06-20',
      disabledDates: ['2026-06-15'],
    });
    const find = (iso: string) => g.weeks.flat().find((d) => d.iso === iso)!;
    expect(find('2026-06-09').disabled).toBe(true);
    expect(find('2026-06-10').disabled).toBe(false);
    expect(find('2026-06-15').disabled).toBe(true); // explicit
    expect(find('2026-06-20').disabled).toBe(false);
    expect(find('2026-06-21').disabled).toBe(true);
  });
});

describe('monthLabel', () => {
  it('renders a "Month YYYY" label', () => {
    const label = monthLabel('2026-06-15', 'en-US');
    expect(label).toContain('2026');
    expect(label.toLowerCase()).toContain('june');
  });
});

describe('weekdayLabels', () => {
  it('returns 7 labels starting from weekStartsOn', () => {
    const sun = weekdayLabels(0, 'en-US');
    expect(sun.length).toBe(7);
    const mon = weekdayLabels(1, 'en-US');
    expect(mon.length).toBe(7);
    // rotating by one should shift the first label
    expect(mon[0]).not.toBe(sun[0]);
  });
});
