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
  buildMonthList,
  buildYearGrid,
  dayLabel,
  isDayDisabled,
  isInRange,
  isIsoDate,
  isoToUtc,
  LABEL_DEFAULTS,
  monthLabel,
  normalizeRange,
  rangeFromPreset,
  rangeSpansDisabled,
  resolveLabel,
  resolveRovingDrillIso,
  resolveRovingIso,
  resolveViewIso,
  toIso,
  weekdayLabels,
} from './buildMonthGrid';

const sorted = (a: readonly string[]) => [...a].sort();

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
  it('disables days whose UTC weekday is in disabledDaysOfWeek', () => {
    // 2026-06-06 is a Saturday (6), 2026-06-07 a Sunday (0), 2026-06-05 a Friday (5).
    expect(isDayDisabled('2026-06-06', { ...base, disabledDaysOfWeek: [0, 6] })).toBe(true);
    expect(isDayDisabled('2026-06-07', { ...base, disabledDaysOfWeek: [0, 6] })).toBe(true);
    expect(isDayDisabled('2026-06-05', { ...base, disabledDaysOfWeek: [0, 6] })).toBe(false);
  });
  it('disables a day for which isDateDisabled(iso) returns true', () => {
    const isDateDisabled = (iso: string) => iso === '2026-06-15';
    expect(isDayDisabled('2026-06-15', { ...base, isDateDisabled })).toBe(true);
    expect(isDayDisabled('2026-06-16', { ...base, isDateDisabled })).toBe(false);
  });
  it('leaves days selectable when the new gates are empty / null (backward-compatible)', () => {
    expect(isDayDisabled('2026-06-15', { ...base, disabledDaysOfWeek: [], isDateDisabled: null })).toBe(false);
    expect(isDayDisabled('2026-06-15', { ...base })).toBe(false);
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

describe('buildMonthList', () => {
  it('returns 12 localized month cells anchored on the view year', () => {
    const list = buildMonthList('2025-06-15', {
      min: null,
      max: null,
      value: '2025-03-10',
      today: '2025-06-15',
      locale: 'en-US',
    });
    expect(list.year).toBe(2025);
    expect(list.months.length).toBe(12);
    expect(list.months[0].iso).toBe('2025-01-01');
    expect(list.months[0].label).toBe('Jan');
    expect(list.months[5].iso).toBe('2025-06-01');
    expect(list.months[5].label).toBe('Jun');
    // a fresh object each call
    expect(buildMonthList('2025-06-15', { min: null, max: null, value: '', today: '', locale: 'en-US' }))
      .not.toBe(list);
  });

  it('flags selected + current by month/year', () => {
    const list = buildMonthList('2025-06-15', {
      min: null,
      max: null,
      value: '2025-03-10',
      today: '2025-06-15',
      locale: 'en-US',
    });
    expect(list.months.filter((m) => m.selected).map((m) => m.iso)).toEqual(['2025-03-01']);
    expect(list.months.filter((m) => m.current).map((m) => m.iso)).toEqual(['2025-06-01']);
  });

  it('does not flag selected/current for a different year', () => {
    const list = buildMonthList('2025-06-15', {
      min: null,
      max: null,
      value: '2024-03-10',
      today: '2026-06-15',
      locale: 'en-US',
    });
    expect(list.months.some((m) => m.selected)).toBe(false);
    expect(list.months.some((m) => m.current)).toBe(false);
  });

  it('disables a month ONLY when its entire span is outside [min, max]', () => {
    const list = buildMonthList('2025-06-15', {
      min: '2025-03-01',
      max: '2025-03-31',
      value: '',
      today: '',
      locale: 'en-US',
    });
    expect(list.months[0].disabled).toBe(true); // Jan — entirely below min
    expect(list.months[1].disabled).toBe(true); // Feb — entirely below min
    expect(list.months[2].disabled).toBe(false); // Mar — fully bracketed
    expect(list.months[3].disabled).toBe(true); // Apr — entirely above max
    expect(list.months[11].disabled).toBe(true); // Dec — entirely above max
  });

  it('keeps a partially-overlapping month enabled', () => {
    const list = buildMonthList('2025-06-15', {
      min: '2025-03-15',
      max: null,
      value: '',
      today: '',
      locale: 'en-US',
    });
    expect(list.months[1].disabled).toBe(true); // Feb ends before min
    expect(list.months[2].disabled).toBe(false); // Mar straddles min → enabled
  });
});

describe('buildYearGrid', () => {
  it('returns a deterministic decade-aligned 12-year window + rangeLabel', () => {
    const grid = buildYearGrid('2025-06-15', { min: null, max: null, value: '', today: '2025-06-15' });
    expect(grid.years.length).toBe(12);
    expect(grid.rangeLabel).toBe('2020–2031'); // en-dash
    expect(grid.years[0].year).toBe(2020);
    expect(grid.years[0].iso).toBe('2020-01-01');
    expect(grid.years[11].year).toBe(2031);
    expect(grid.years[11].iso).toBe('2031-01-01');
  });

  it('produces the same window for any viewIso inside the same decade block', () => {
    const a = buildYearGrid('2025-06-15', { min: null, max: null, value: '', today: '' });
    const b = buildYearGrid('2029-11-30', { min: null, max: null, value: '', today: '' });
    expect(b.rangeLabel).toBe(a.rangeLabel);
    expect(b.years[0].year).toBe(a.years[0].year);
    // a fresh object each call
    expect(b).not.toBe(a);
  });

  it('flags selected + current by year', () => {
    const grid = buildYearGrid('2025-06-15', { min: null, max: null, value: '2023-04-01', today: '2025-06-15' });
    expect(grid.years.filter((y) => y.selected).map((y) => y.year)).toEqual([2023]);
    expect(grid.years.filter((y) => y.current).map((y) => y.year)).toEqual([2025]);
  });

  it('disables a year ONLY when the whole year is outside [min, max]', () => {
    const grid = buildYearGrid('2025-06-15', {
      min: '2025-01-01',
      max: '2025-12-31',
      value: '',
      today: '',
    });
    const byYear = (y: number) => grid.years.find((c) => c.year === y)!;
    expect(byYear(2024).disabled).toBe(true); // entirely below min
    expect(byYear(2025).disabled).toBe(false); // fully bracketed
    expect(byYear(2026).disabled).toBe(true); // entirely above max
  });

  it('keeps a partially-overlapping year enabled', () => {
    const grid = buildYearGrid('2025-06-15', { min: '2025-06-15', max: null, value: '', today: '' });
    expect(grid.years.find((c) => c.year === 2024)!.disabled).toBe(true);
    expect(grid.years.find((c) => c.year === 2025)!.disabled).toBe(false); // straddles min
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

describe('normalizeRange', () => {
  it('coerces an empty string into an empty range', () => {
    expect(normalizeRange('')).toEqual({ start: '', end: '' });
  });
  it('coerces a single ISO string into a start-only anchor', () => {
    expect(normalizeRange('2025-06-10')).toEqual({ start: '2025-06-10', end: '' });
  });
  it('coerces a non-ISO string into an empty range', () => {
    expect(normalizeRange('not-a-date')).toEqual({ start: '', end: '' });
  });
  it('orders an object range so start <= end', () => {
    expect(normalizeRange({ start: '2025-06-04', end: '2025-06-01' })).toEqual({
      start: '2025-06-01',
      end: '2025-06-04',
    });
    expect(normalizeRange({ start: '2025-06-01', end: '2025-06-04' })).toEqual({
      start: '2025-06-01',
      end: '2025-06-04',
    });
  });
  it('preserves a single-set anchor (end stays empty)', () => {
    expect(normalizeRange({ start: '2025-06-10', end: '' })).toEqual({
      start: '2025-06-10',
      end: '',
    });
  });
  it('coerces null / undefined into an empty range', () => {
    expect(normalizeRange(null)).toEqual({ start: '', end: '' });
    expect(normalizeRange(undefined)).toEqual({ start: '', end: '' });
  });
});

describe('isInRange', () => {
  it('returns true for an ISO strictly between ordered endpoints', () => {
    expect(isInRange('2025-06-03', '2025-06-01', '2025-06-05')).toBe(true);
  });
  it('is inclusive of both boundary ISOs', () => {
    expect(isInRange('2025-06-01', '2025-06-01', '2025-06-05')).toBe(true);
    expect(isInRange('2025-06-05', '2025-06-01', '2025-06-05')).toBe(true);
  });
  it('returns false outside the band', () => {
    expect(isInRange('2025-05-31', '2025-06-01', '2025-06-05')).toBe(false);
    expect(isInRange('2025-06-06', '2025-06-01', '2025-06-05')).toBe(false);
  });
  it('returns false when either endpoint is empty / malformed', () => {
    expect(isInRange('2025-06-03', '', '2025-06-05')).toBe(false);
    expect(isInRange('2025-06-03', '2025-06-01', '')).toBe(false);
    expect(isInRange('2025-06-03', 'nope', '2025-06-05')).toBe(false);
  });
  it('is order-tolerant: reversed start>end is still inclusive', () => {
    expect(isInRange('2025-06-03', '2025-06-05', '2025-06-01')).toBe(true);
    expect(isInRange('2025-06-05', '2025-06-05', '2025-06-01')).toBe(true);
  });
});

describe('rangeFromPreset', () => {
  it('returns a literal range verbatim (ordered)', () => {
    expect(rangeFromPreset({ range: { start: '2025-06-01', end: '2025-06-04' } })).toEqual({
      start: '2025-06-01',
      end: '2025-06-04',
    });
    // literal ordered too
    expect(rangeFromPreset({ range: { start: '2025-06-04', end: '2025-06-01' } })).toEqual({
      start: '2025-06-01',
      end: '2025-06-04',
    });
  });
  it('calls a thunk and returns its (ordered) result', () => {
    let called = 0;
    const range = () => {
      called++;
      return { start: '2025-06-10', end: '2025-06-03' };
    };
    expect(rangeFromPreset({ range })).toEqual({ start: '2025-06-03', end: '2025-06-10' });
    expect(called).toBe(1);
  });
});

describe('direction-agnostic ordering (SC-3)', () => {
  it('anchor-then-earlier === earlier-then-anchor', () => {
    const anchorThenEarlier = normalizeRange({ start: '2025-06-10', end: '2025-06-03' });
    const earlierThenAnchor = normalizeRange({ start: '2025-06-03', end: '2025-06-10' });
    expect(anchorThenEarlier).toEqual(earlierThenAnchor);
    expect(anchorThenEarlier).toEqual({ start: '2025-06-03', end: '2025-06-10' });
  });
});

describe('buildMonthGrid — range flags', () => {
  const find = (g: ReturnType<typeof buildMonthGrid>, iso: string) =>
    g.weeks.flat().find((d) => d.iso === iso)!;

  it('populates inRange + rangeStart/rangeEnd for a completed selection', () => {
    const g = buildMonthGrid({
      viewIso: '2026-06-15',
      value: '',
      today: '',
      selection: { start: '2025-06-03', end: '2025-06-06' },
    });
    // viewIso is June 2026 — the selection is June 2025, so flags should be
    // exercised on the right month: build the matching view.
    const gv = buildMonthGrid({
      viewIso: '2025-06-15',
      value: '',
      today: '',
      selection: { start: '2025-06-03', end: '2025-06-06' },
    });
    for (const iso of ['2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06']) {
      expect(find(gv, iso).inRange).toBe(true);
    }
    expect(find(gv, '2025-06-03').rangeStart).toBe(true);
    expect(find(gv, '2025-06-06').rangeEnd).toBe(true);
    expect(find(gv, '2025-06-02').inRange).toBe(false);
    expect(find(gv, '2025-06-07').inRange).toBe(false);
    expect(find(gv, '2025-06-04').rangeStart).toBe(false);
    expect(find(gv, '2025-06-05').rangeEnd).toBe(false);
    // the off-month grid touches none of these
    void g;
  });

  it('previews a forward band when previewEnd is set on an anchor', () => {
    const g = buildMonthGrid({
      viewIso: '2025-06-15',
      value: '',
      today: '',
      selection: { start: '2025-06-03', end: '' },
      previewEnd: '2025-06-06',
    });
    for (const iso of ['2025-06-03', '2025-06-04', '2025-06-05', '2025-06-06']) {
      expect(find(g, iso).inPreview).toBe(true);
    }
    expect(find(g, '2025-06-02').inPreview).toBe(false);
    expect(find(g, '2025-06-07').inPreview).toBe(false);
  });

  it('previews BACKWARD when previewEnd is earlier than the anchor (never suppressed)', () => {
    const g = buildMonthGrid({
      viewIso: '2025-06-15',
      value: '',
      today: '',
      selection: { start: '2025-06-10', end: '' },
      previewEnd: '2025-06-05',
    });
    for (const iso of ['2025-06-05', '2025-06-06', '2025-06-07', '2025-06-08', '2025-06-09', '2025-06-10']) {
      expect(find(g, iso).inPreview).toBe(true);
    }
    expect(find(g, '2025-06-11').inPreview).toBe(false);
    expect(find(g, '2025-06-04').inPreview).toBe(false);
  });

  it('SC-1 guard: single-mode output (no selection/previewEnd) is unchanged', () => {
    const g = buildMonthGrid({ viewIso: '2026-06-15', value: '2026-06-15', today: '2026-06-24' });
    const flat = g.weeks.flat();
    expect(flat.filter((d) => d.selected).map((d) => d.iso)).toEqual(['2026-06-15']);
    expect(flat.filter((d) => d.today).map((d) => d.iso)).toEqual(['2026-06-24']);
    // new range flags all false in single mode
    expect(flat.some((d) => d.inRange)).toBe(false);
    expect(flat.some((d) => d.inPreview)).toBe(false);
    expect(flat.some((d) => d.rangeStart)).toBe(false);
    expect(flat.some((d) => d.rangeEnd)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resolveRovingIso / resolveRovingDrillIso — the pure roving-tabindex resolvers
// (D-4). Import failure IS the RED signal until Task 3 adds these exports.
// Expected values below are hand-computed against the real 2025/2026 calendar,
// not copied from any implementation.
// ---------------------------------------------------------------------------
describe('resolveRovingIso', () => {
  it('returns the selection when it is IN VIEW (single mode)', () => {
    // June 2025 view, value === June 15 → in view → the tab stop is the selection.
    expect(
      resolveRovingIso({
        viewIso: '2025-06-01',
        value: '',
        today: '',
        anchor: '2025-06-15',
      }),
    ).toBe('2025-06-15');
  });

  it('falls back to today-in-view, else the first enabled in-month day, when the selection is OFF-VIEW', () => {
    // value 2025-06-15, viewIso July 2025 → selection is off-view. today is far off
    // too → falls all the way to the first enabled day of July: 2025-07-01.
    expect(
      resolveRovingIso({
        viewIso: '2025-07-01',
        value: '2025-06-15',
        today: '2020-01-01',
        anchor: '2025-06-15',
      }),
    ).toBe('2025-07-01');
  });

  it('returns today when today is in view and nothing is selected', () => {
    expect(
      resolveRovingIso({
        viewIso: '2025-06-01',
        value: '',
        today: '2025-06-24',
        anchor: '',
      }),
    ).toBe('2025-06-24');
  });

  it('is multi-panel aware: an anchor living in month 2 of a numberOfMonths:2 view still resolves', () => {
    // viewIso July 2025, numberOfMonths=2 → panels are July + August. The anchor
    // lives in August (panel index 1) — proves the resolver scans every panel, not
    // just panel 0.
    expect(
      resolveRovingIso({
        viewIso: '2025-07-01',
        value: '',
        today: '2020-01-01',
        anchor: '2025-08-10',
        numberOfMonths: 2,
      }),
    ).toBe('2025-08-10');
  });

  it('the first-enabled fallback SKIPS leading disabled days', () => {
    // No selection, no today-in-view. min=2025-07-04 disables July 1-3, so the
    // fallback must land on July 4, NOT July 1.
    expect(
      resolveRovingIso({
        viewIso: '2025-07-01',
        value: '',
        today: '2020-01-01',
        anchor: '',
        min: '2025-07-04',
      }),
    ).toBe('2025-07-04');
  });

  it('returns "" (no tab stop) when the whole control is disabled — preserves the untabbable disabled control', () => {
    expect(
      resolveRovingIso({
        viewIso: '2025-06-01',
        value: '2025-06-15',
        today: '2025-06-15',
        anchor: '2025-06-15',
        disabled: true,
      }),
    ).toBe('');
  });

  it('the fallback never resolves to a SPILL day — the returned ISO always belongs to a rendered panel month', () => {
    const iso = resolveRovingIso({
      viewIso: '2025-07-01',
      value: '',
      today: '2020-01-01',
      anchor: '',
    });
    expect(iso.slice(0, 7)).toBe('2025-07');
  });
});

// ---------------------------------------------------------------------------
// rangeSpansDisabled / dayLabel / weekdayLabels(...,'long') / LABEL_DEFAULTS /
// resolveLabel — quick task 260807-6p8 (D-01, D-02, D-05). Import failure IS
// the RED signal until Task 2 adds these exports. Expected values below are
// hand-computed against the real June 2025 calendar (June 15 2025 is a
// Sunday, confirmed independently by the dayLabel assertions), not copied
// from any implementation.
// ---------------------------------------------------------------------------
describe('rangeSpansDisabled', () => {
  it('returns false with no disabled config at all', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '',
    })).toBe(false);
  });

  it('returns true for a disabledDates entry strictly inside the interior', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-05'],
    })).toBe(true);
  });

  it('returns false for a disabledDates entry that IS one of the two endpoints', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-01'],
    })).toBe(false);
  });

  it('returns false for a disabledDates entry outside the span', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-15'],
    })).toBe(false);
  });

  it('is order-tolerant: reversed argument order gives the same result as forward', () => {
    const input = { viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-05'] };
    expect(rangeSpansDisabled('2025-06-10', '2025-06-01', input)).toBe(
      rangeSpansDisabled('2025-06-01', '2025-06-10', input),
    );
    expect(rangeSpansDisabled('2025-06-10', '2025-06-01', input)).toBe(true);
  });

  it('returns false for the same day and for adjacent days (zero interior)', () => {
    const withDisabled = { viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-05'] };
    expect(rangeSpansDisabled('2025-06-05', '2025-06-05', withDisabled)).toBe(false);
    expect(rangeSpansDisabled('2025-06-05', '2025-06-06', withDisabled)).toBe(false);
  });

  it('disabledDaysOfWeek over a 10-day span (interior >= 7) is true regardless of hit', () => {
    // a=Jun1, b=Jun11 -> interior Jun2..Jun10 = 9 days, >= 7 -> necessarily
    // contains every weekday, so true immediately.
    expect(rangeSpansDisabled('2025-06-01', '2025-06-11', {
      viewIso: '2025-06-01', value: '', today: '', disabledDaysOfWeek: [0],
    })).toBe(true);
  });

  it('disabledDaysOfWeek over a 4-day span whose interior contains no Sunday is false', () => {
    // a=Jun2 (Mon), b=Jun5 (Thu) -> interior Jun3(Tue), Jun4(Wed) -> no Sunday.
    expect(rangeSpansDisabled('2025-06-02', '2025-06-05', {
      viewIso: '2025-06-01', value: '', today: '', disabledDaysOfWeek: [0],
    })).toBe(false);
  });

  it('disabledDaysOfWeek over a 4-day span whose interior DOES contain a Sunday is true', () => {
    // a=Jun6 (Fri), b=Jun9 (Mon) -> interior Jun7(Sat), Jun8(Sun) -> contains Sunday.
    expect(rangeSpansDisabled('2025-06-06', '2025-06-09', {
      viewIso: '2025-06-01', value: '', today: '', disabledDaysOfWeek: [0],
    })).toBe(true);
  });

  it('isDateDisabled predicate hitting an interior day returns true', () => {
    const isDateDisabled = (iso: string) => iso === '2025-06-05';
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', isDateDisabled,
    })).toBe(true);
  });

  it('isDateDisabled predicate hitting only an endpoint returns false', () => {
    const isDateDisabled = (iso: string) => iso === '2025-06-01';
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', isDateDisabled,
    })).toBe(false);
  });

  it('min/max are NOT consulted: both endpoints inside the window never blocks', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', min: '2025-05-01', max: '2025-07-01',
    })).toBe(false);
  });

  it('an interior longer than RANGE_SCAN_MAX_DAYS with isDateDisabled fails OPEN (false)', () => {
    const isDateDisabled = () => true; // would be true for every interior day if walked
    expect(rangeSpansDisabled('2000-01-01', '2020-01-01', {
      viewIso: '2000-01-01', value: '', today: '', isDateDisabled,
    })).toBe(false);
  });

  it('returns false for malformed / empty ISO on either side', () => {
    const withDisabled = { viewIso: '2025-06-01', value: '', today: '', disabledDates: ['2025-06-05'] };
    expect(rangeSpansDisabled('', '2025-06-10', withDisabled)).toBe(false);
    expect(rangeSpansDisabled('2025-06-01', 'not-a-date', withDisabled)).toBe(false);
  });

  it('returns false when the whole control is disabled', () => {
    expect(rangeSpansDisabled('2025-06-01', '2025-06-10', {
      viewIso: '2025-06-01', value: '', today: '', disabled: true, disabledDates: ['2025-06-05'],
    })).toBe(false);
  });
});

describe('dayLabel', () => {
  it('renders a human-readable localized day label', () => {
    const label = dayLabel('2025-06-15', 'en-US');
    expect(label).toContain('Sunday');
    expect(label).toContain('June');
    expect(label).toContain('15');
    expect(label).toContain('2025');
  });

  it('localizes into another locale', () => {
    expect(dayLabel('2025-06-15', 'fr-FR')).toContain('juin');
  });

  it('is UTC-anchored (never slides a day earlier)', () => {
    const label = dayLabel('2025-06-01', 'en-US');
    expect(label).toContain('1');
    expect(label).toContain('June');
    expect(label).not.toContain('May');
  });

  it('is a total function: a malformed iso returns the input string unchanged', () => {
    expect(dayLabel('not-a-date', 'en-US')).toBe('not-a-date');
  });
});

describe('weekdayLabels — long form (third arg)', () => {
  it('returns full weekday names starting from weekStartsOn', () => {
    expect(weekdayLabels(0, 'en-US', 'long')).toEqual([
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ]);
  });

  it('rotates the first label with a Monday start', () => {
    expect(weekdayLabels(1, 'en-US', 'long')[0]).toBe('Monday');
  });

  it('leaves the two-arg (short) form unchanged', () => {
    const sun = weekdayLabels(0, 'en-US');
    expect(sun.length).toBe(7);
    expect(sun[0]).not.toBe('Sunday'); // short form, not the long name
  });
});

describe('LABEL_DEFAULTS', () => {
  it('has exactly the 10 chrome keys, all non-empty strings', () => {
    const keys = [
      'root', 'previousMonth', 'nextMonth', 'changeMonthYear', 'changeYear',
      'chooseMonth', 'chooseYear', 'presets', 'today', 'clear',
    ];
    expect(sorted(Object.keys(LABEL_DEFAULTS))).toEqual(sorted(keys));
    for (const k of keys) {
      expect(typeof (LABEL_DEFAULTS as Record<string, string>)[k]).toBe('string');
      expect((LABEL_DEFAULTS as Record<string, string>)[k].length).toBeGreaterThan(0);
    }
  });
});

describe('resolveLabel', () => {
  it('an override string wins', () => {
    expect(resolveLabel({ root: 'Custom root' }, 'root')).toBe('Custom root');
  });

  it('an empty-string override falls back to the default', () => {
    expect(resolveLabel({ root: '' }, 'root')).toBe(LABEL_DEFAULTS.root);
  });

  it('a non-string override (number / object / null) falls back to the default', () => {
    expect(resolveLabel({ root: 42 as unknown }, 'root')).toBe(LABEL_DEFAULTS.root);
    expect(resolveLabel({ root: {} as unknown }, 'root')).toBe(LABEL_DEFAULTS.root);
    expect(resolveLabel({ root: null as unknown }, 'root')).toBe(LABEL_DEFAULTS.root);
  });

  it('undefined / null / a non-object labels falls back to the default', () => {
    expect(resolveLabel(undefined, 'root')).toBe(LABEL_DEFAULTS.root);
    expect(resolveLabel(null, 'root')).toBe(LABEL_DEFAULTS.root);
    expect(resolveLabel('not-an-object', 'root')).toBe(LABEL_DEFAULTS.root);
  });

  it('an unknown extra key in labels is ignored, never thrown', () => {
    expect(() => resolveLabel({ bogusKey: 'x' }, 'root')).not.toThrow();
    expect(resolveLabel({ bogusKey: 'x' } as never, 'root')).toBe(LABEL_DEFAULTS.root);
  });
});

describe('resolveRovingDrillIso', () => {
  it('the selected cell wins over current/first-enabled', () => {
    const cells = [
      { iso: 'a', selected: false, current: true, disabled: false },
      { iso: 'b', selected: true, current: false, disabled: false },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('b');
  });

  it('falls back to the current cell when nothing is selected', () => {
    const cells = [
      { iso: 'a', selected: false, current: false, disabled: false },
      { iso: 'b', selected: false, current: true, disabled: false },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('b');
  });

  it('falls back to the first !disabled cell when nothing is selected/current', () => {
    const cells = [
      { iso: 'a', selected: false, current: false, disabled: true },
      { iso: 'b', selected: false, current: false, disabled: true },
      { iso: 'c', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('c');
  });

  it('returns "" when every cell is disabled and none is selected/current', () => {
    const cells = [
      { iso: 'a', selected: false, current: false, disabled: true },
      { iso: 'b', selected: false, current: false, disabled: true },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('');
  });

  it('the defect case: a value selected in a DIFFERENT year (no selected cell) + today in a DIFFERENT year (no current cell) still returns the first enabled cell, not ""', () => {
    // Mirrors buildMonthList/buildYearGrid output for a decade window that
    // contains neither the selected year nor today's year.
    const cells = [
      { iso: '2020-01-01', selected: false, current: false, disabled: false },
      { iso: '2021-01-01', selected: false, current: false, disabled: false },
    ];
    expect(resolveRovingDrillIso(cells)).toBe('2020-01-01');
  });
});
