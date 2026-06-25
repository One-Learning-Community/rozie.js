/**
 * buildMonthGrid — the pure calendar-grid model for the DatePicker family.
 *
 * THE branchy core of this no-engine family, extracted to `src/internal/` so it
 * can be unit-tested in isolation (codegen vendors `src/internal/` into every
 * leaf via copyInternal, excluding `*.test.ts`) and imported once from
 * `DatePicker.rozie`'s `<script>` as a set of PLAIN functions — never a
 * `$computed`, since a `$computed` is a value on React but an accessor on Solid,
 * so aliasing the result in script logic diverges across targets. A plain
 * function called `()` everywhere is uniform on all six.
 *
 * All date arithmetic is done on UTC midnight so it is timezone-independent and
 * never drifts a day across DST boundaries: a calendar date `YYYY-MM-DD` is an
 * abstract civil date, not an instant, so we anchor it at `Date.UTC(y, m, d)`
 * and only ever read the UTC components. The returned `weeks` array is FRESH on
 * every call (do not feed it to a reference-equality `$watch` getter).
 *
 * No framework imports, no DOM — pure data in, pure data out.
 */

export interface CalendarDay {
  /** The ISO `YYYY-MM-DD` string for this cell. */
  iso: string;
  /** 1-based day-of-month. */
  day: number;
  /** `true` when the day belongs to the displayed month (vs a leading/trailing spill day). */
  inMonth: boolean;
  /** `true` when this day === the selected `value`. */
  selected: boolean;
  /** `true` when this day === today (the supplied `today` ISO). */
  today: boolean;
  /** `true` when the day is outside `[min, max]`, in `disabledDates`, or the control is disabled. */
  disabled: boolean;
}

export interface MonthGridInput {
  /** The displayed month anchor: any ISO date within the month to render. */
  viewIso: string;
  /** The selected ISO date, or `''` when nothing is selected. */
  value: string;
  /** Today's ISO date (injected so the grid stays deterministic/testable). */
  today: string;
  /** Inclusive lower bound (ISO) or `null`. */
  min?: string | null;
  /** Inclusive upper bound (ISO) or `null`. */
  max?: string | null;
  /** Explicitly disabled ISO dates. */
  disabledDates?: string[];
  /** First day of the week: 0 = Sunday … 6 = Saturday. */
  weekStartsOn?: number;
  /** Disable every day (the whole control is disabled). */
  disabled?: boolean;
}

export interface MonthGrid {
  /** Year of the displayed month. */
  year: number;
  /** 0-based month of the displayed month. */
  month: number;
  /** Weeks, each a 7-element row of CalendarDay (always 6 rows for a stable layout). */
  weeks: CalendarDay[][];
}

/** Pad a 1-or-2-digit number to a 2-char string. */
function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** `true` when `s` is a well-formed `YYYY-MM-DD` string. */
export function isIsoDate(s: unknown): boolean {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Build an ISO `YYYY-MM-DD` from UTC y / 0-based m / 1-based d. */
export function toIso(year: number, month: number, day: number): string {
  const t = Date.UTC(year, month, day);
  const d = new Date(t);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

/** Parse an ISO date to its UTC-midnight epoch ms, or `null` when malformed. */
export function isoToUtc(iso: unknown): number | null {
  if (!isIsoDate(iso)) return null;
  const s = iso as string;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const t = Date.UTC(year, month - 1, day);
  const d = new Date(t);
  // Reject overflow (e.g. 2024-02-31 rolls into March).
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return t;
}

/** The displayed month anchor: `viewIso` when valid, else `value`, else `today`. */
export function resolveViewIso(input: MonthGridInput): string {
  if (isIsoDate(input.viewIso)) return input.viewIso;
  if (isIsoDate(input.value)) return input.value;
  if (isIsoDate(input.today)) return input.today;
  const now = new Date();
  return toIso(now.getUTCFullYear(), now.getUTCMonth(), 1);
}

/** Add `n` whole months to an ISO date, clamping the day into the target month. */
export function addMonths(iso: string, n: number): string {
  const base = isoToUtc(iso);
  const d = base == null ? new Date() : new Date(base);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + n;
  const day = d.getUTCDate();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return toIso(year, month, Math.min(day, lastDay));
}

/** Add `n` days to an ISO date. */
export function addDays(iso: string, n: number): string {
  const base = isoToUtc(iso);
  if (base == null) return iso;
  const d = new Date(base + n * 86400000);
  return toIso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * `true` when the ISO date is NOT selectable: outside `[min, max]`, in
 * `disabledDates`, or the control is globally disabled.
 */
export function isDayDisabled(iso: string, input: MonthGridInput): boolean {
  if (input.disabled) return true;
  const t = isoToUtc(iso);
  if (t == null) return true;
  const minT = isoToUtc(input.min);
  if (minT != null && t < minT) return true;
  const maxT = isoToUtc(input.max);
  if (maxT != null && t > maxT) return true;
  const list = input.disabledDates || [];
  for (let i = 0; i < list.length; i++) if (list[i] === iso) return true;
  return false;
}

/**
 * Build the 6×7 month grid for the resolved view month. Pure: no clamping side
 * effects, no DOM. Leading days come from the previous month and trailing days
 * from the next, so every row is full and the layout never reflows. Six rows are
 * always emitted for a stable height regardless of the month's shape.
 */
export function buildMonthGrid(input: MonthGridInput): MonthGrid {
  const viewIso = resolveViewIso(input);
  const anchor = isoToUtc(viewIso) as number;
  const d = new Date(anchor);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();

  const weekStartsOn = ((Math.floor(input.weekStartsOn ?? 0) % 7) + 7) % 7;
  const value = isIsoDate(input.value) ? input.value : '';
  const today = isIsoDate(input.today) ? input.today : '';

  // The weekday index (0=Sun) of the 1st of the month, shifted by weekStartsOn.
  const firstDow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const lead = (firstDow - weekStartsOn + 7) % 7;

  // First cell = (1st of month) - lead days.
  const startMs = Date.UTC(year, month, 1) - lead * 86400000;

  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: CalendarDay[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const cellMs = startMs + (w * 7 + dow) * 86400000;
      const cd = new Date(cellMs);
      const iso = toIso(cd.getUTCFullYear(), cd.getUTCMonth(), cd.getUTCDate());
      row.push({
        iso,
        day: cd.getUTCDate(),
        inMonth: cd.getUTCMonth() === month,
        selected: value !== '' && iso === value,
        today: today !== '' && iso === today,
        disabled: isDayDisabled(iso, input),
      });
    }
    weeks.push(row);
  }

  return { year, month, weeks };
}

const MONTH_NAMES_FALLBACK = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_NAMES_FALLBACK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Localized "Month YYYY" label for a view ISO. Uses `Intl.DateTimeFormat` when
 * available (every modern target), falling back to an English month name so the
 * function is total even in a minimal runtime.
 */
export function monthLabel(viewIso: string, locale: string): string {
  const t = isoToUtc(viewIso);
  const d = t == null ? new Date() : new Date(t);
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(d);
  } catch {
    return MONTH_NAMES_FALLBACK[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
}

/**
 * The seven weekday header labels, ordered from `weekStartsOn`. Localized via
 * `Intl` (short names) with an English fallback.
 */
export function weekdayLabels(weekStartsOn: number, locale: string): string[] {
  const start = ((Math.floor(weekStartsOn ?? 0) % 7) + 7) % 7;
  const out: string[] = [];
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat(locale || 'en-US', { weekday: 'short', timeZone: 'UTC' });
  } catch {
    fmt = null;
  }
  for (let i = 0; i < 7; i++) {
    const dow = (start + i) % 7;
    if (fmt) {
      // 2023-01-01 was a Sunday → use it to anchor weekday 0.
      const ms = Date.UTC(2023, 0, 1) + dow * 86400000;
      out.push(fmt.format(new Date(ms)));
    } else {
      out.push(WEEKDAY_NAMES_FALLBACK[dow]);
    }
  }
  return out;
}
