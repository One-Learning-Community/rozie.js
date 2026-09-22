/**
 * dateValue.test.ts — C-07, quick task 260921-tsu.
 *
 * `EditorDate` seeded its native `<input type="date">` with `String($props.value)` while its
 * own `docs:` string — which ships as JSDoc in every leaf `.d.ts` — promised "String-coerced
 * to an ISO `YYYY-MM-DD` string". A native date input accepts ONLY `YYYY-MM-DD` and renders
 * BLANK for anything else, with no error, so every ordinary way of holding a date in a model
 * opened an empty editor. Only a value that was already `YYYY-MM-DD` worked, i.e. the one
 * case that needed no coercion at all.
 *
 * The off-by-one cases are the point of several of these. A midnight-UTC ISO datetime string
 * must keep its written date rather than being re-derived from local parts (which would show
 * the previous day west of UTC), while a `Date` object must be read from LOCAL parts (a
 * calendar control shows a calendar day, and `toISOString()` would shift it the other way).
 *
 * RED before the fix: the helper did not exist.
 */
import { describe, it, expect } from 'vitest';
import { toIsoDateString } from '../src/helpers/dateValue';

describe('toIsoDateString', () => {
  it('passes an already-ISO date through, whitespace tolerated', () => {
    expect(toIsoDateString('2026-09-21')).toBe('2026-09-21');
    expect(toIsoDateString('  2026-09-21  ')).toBe('2026-09-21');
  });

  it('takes the DATE PART of an ISO datetime as written, never re-derived', () => {
    // The whole point: re-parsing and re-formatting from local parts renders the 20th for
    // anyone west of UTC. The written date is the answer.
    expect(toIsoDateString('2026-09-21T00:00:00Z')).toBe('2026-09-21');
    expect(toIsoDateString('2026-09-21T00:00:00.000Z')).toBe('2026-09-21');
    expect(toIsoDateString('2026-09-21T13:45:00+09:00')).toBe('2026-09-21');
  });

  it('formats a Date from its LOCAL parts', () => {
    const d = new Date(2026, 8, 21, 0, 0, 0); // local midnight, 21 Sept 2026
    expect(toIsoDateString(d)).toBe('2026-09-21');
    // Late-evening local time must not roll forward the way a UTC read would.
    expect(toIsoDateString(new Date(2026, 8, 21, 23, 30, 0))).toBe('2026-09-21');
  });

  it('formats an epoch number through the same local path', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0);
    expect(toIsoDateString(d.getTime())).toBe('2026-01-05');
  });

  it('zero-pads month and day', () => {
    expect(toIsoDateString(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });

  it('parses a localised string the platform understands', () => {
    // `new Date('September 21, 2026')` is stable across engines for this spelling.
    expect(toIsoDateString('September 21, 2026')).toBe('2026-09-21');
  });

  it('returns "" for an empty or absent value — what the input shows for "no date"', () => {
    expect(toIsoDateString(null)).toBe('');
    expect(toIsoDateString(undefined)).toBe('');
    expect(toIsoDateString('')).toBe('');
  });

  it('returns "" rather than a broken control for something unreadable', () => {
    expect(toIsoDateString('not a date')).toBe('');
    expect(toIsoDateString(new Date('nonsense'))).toBe('');
    expect(toIsoDateString(Number.NaN)).toBe('');
    expect(toIsoDateString({})).toBe('');
    expect(toIsoDateString(true)).toBe('');
  });
});
