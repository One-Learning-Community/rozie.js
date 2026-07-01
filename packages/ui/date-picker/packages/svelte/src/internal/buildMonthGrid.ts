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

/**
 * A normalized range value. ISO `YYYY-MM-DD` endpoints; `''` marks an empty
 * (unset) endpoint. After `normalizeRange`, `start <= end` whenever both are set,
 * and a single-set anchor lives in `start` with `end === ''`.
 */
export interface RangeValue {
  /** Ordered range start (ISO) or `''` when unset. */
  start: string;
  /** Ordered range end (ISO) or `''` when unset / anchor-only. */
  end: string;
}

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
  /** `true` when this day === the (ordered) range `start`. */
  rangeStart: boolean;
  /** `true` when this day === the (ordered) range `end`. */
  rangeEnd: boolean;
  /** `true` when this day falls within a COMPLETED range (both endpoints set, inclusive). */
  inRange: boolean;
  /** `true` when this day falls within the live hover-preview band (anchor + `previewEnd`, inclusive, direction-agnostic). */
  inPreview: boolean;
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
  /** Disabled weekdays by UTC index: 0 = Sunday … 6 = Saturday (e.g. `[0, 6]` disables weekends). */
  disabledDaysOfWeek?: number[];
  /**
   * Consumer predicate: return a truthy value to disable the given ISO date. Runs
   * in the consumer's own context (T-70-02 — accepted). Absent / `null` disables
   * nothing. Typed with an `unknown` return (not `boolean`) so the framework-erased
   * `Function`-prop signature each target emits — `(...args: unknown[]) => unknown`
   * on Angular/Solid/Lit, `(...args: any[]) => any` on React/Vue/Svelte — flows in
   * without a per-leaf cast; the value is only ever consumed in a truthy position.
   */
  isDateDisabled?: ((iso: string) => unknown) | null;
  /** First day of the week: 0 = Sunday … 6 = Saturday. */
  weekStartsOn?: number;
  /** Disable every day (the whole control is disabled). */
  disabled?: boolean;
  /**
   * Range-mode selection: a single ISO (anchor-only) or a `{start,end}` object.
   * Normalized internally via `normalizeRange`. Absent in single-date mode — when
   * omitted, all four range flags are `false` (SC-1 backward-compat).
   */
  selection?: string | RangeValue;
  /**
   * The hovered ISO during an in-progress range selection. Combined with the
   * anchor (`selection.start`) it lights the `inPreview` band, direction-agnostic.
   */
  previewEnd?: string;
}

export interface MonthGrid {
  /** Year of the displayed month. */
  year: number;
  /** 0-based month of the displayed month. */
  month: number;
  /** Weeks, each a 7-element row of CalendarDay (always 6 rows for a stable layout). */
  weeks: CalendarDay[][];
}

export interface MonthCell {
  /** First-of-month ISO `YYYY-MM-01` for this cell. */
  iso: string;
  /** Localized short month name (e.g. `'Jan'`). */
  label: string;
  /** `true` when this month === the selected `value`'s month/year. */
  selected: boolean;
  /** `true` when this month === `today`'s month/year. */
  current: boolean;
  /** `true` when the month's entire span falls outside `[min, max]`. */
  disabled: boolean;
}

export interface MonthList {
  /** The anchor year the 12 cells belong to. */
  year: number;
  /** Twelve month cells, January (index 0) → December (index 11). */
  months: MonthCell[];
}

export interface YearCell {
  /** Jan-1 ISO `YYYY-01-01` for this cell. */
  iso: string;
  /** The numeric year. */
  year: number;
  /** `true` when this year === the selected `value`'s year. */
  selected: boolean;
  /** `true` when this year === `today`'s year. */
  current: boolean;
  /** `true` when the whole year falls outside `[min, max]`. */
  disabled: boolean;
}

export interface YearGrid {
  /** Window label like `"2020–2031"` (en-dash). */
  rangeLabel: string;
  /** Twelve year cells spanning the decade-aligned window. */
  years: YearCell[];
}

/** Bounds + flags input for the month/year drill models. */
export interface DrillInput {
  /** Inclusive lower bound (ISO) or `null`. */
  min?: string | null;
  /** Inclusive upper bound (ISO) or `null`. */
  max?: string | null;
  /** The selected ISO date, or `''` when nothing is selected. */
  value: string;
  /** Today's ISO date (injected so the model stays deterministic/testable). */
  today: string;
  /** BCP-47 locale for localized labels; defaults to `en-US`. */
  locale?: string;
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

/**
 * Coerce an untrusted polymorphic value into a canonical, ordered `RangeValue`.
 *
 * - A string: an ISO date → `{ start: iso, end: '' }` (anchor-only); anything
 *   else (incl. `''`) → `{ start: '', end: '' }`.
 * - An object: collect the valid ISO endpoints; two valid → ordered so
 *   `start <= end`; exactly one valid → that one in `start`, `end: ''`
 *   (a single-set anchor is preserved); none valid → empty range.
 * - `null` / `undefined` / anything else → `{ start: '', end: '' }`.
 *
 * Every parse is gated through `isIsoDate` / `isoToUtc` (T-62-01) — never
 * `new Date(str)`.
 */
export function normalizeRange(value: unknown): RangeValue {
  if (typeof value === 'string') {
    return isIsoDate(value) ? { start: value, end: '' } : { start: '', end: '' };
  }
  if (value && typeof value === 'object') {
    const v = value as { start?: unknown; end?: unknown };
    const s = isIsoDate(v.start) ? (v.start as string) : '';
    const e = isIsoDate(v.end) ? (v.end as string) : '';
    if (s !== '' && e !== '') {
      const st = isoToUtc(s) as number;
      const et = isoToUtc(e) as number;
      return st <= et ? { start: s, end: e } : { start: e, end: s };
    }
    // Exactly one (or zero) valid endpoint → anchor lives in `start`.
    const only = s !== '' ? s : e;
    return { start: only, end: '' };
  }
  return { start: '', end: '' };
}

/**
 * Inclusive, order-tolerant membership test: `true` when `iso` lies between
 * `start` and `end` (in either order), all three being valid ISO dates. Any
 * empty / malformed endpoint → `false`.
 */
export function isInRange(iso: unknown, start: unknown, end: unknown): boolean {
  const t = isoToUtc(iso);
  const a = isoToUtc(start);
  const b = isoToUtc(end);
  if (t == null || a == null || b == null) return false;
  const lo = a <= b ? a : b;
  const hi = a <= b ? b : a;
  return t >= lo && t <= hi;
}

/**
 * Resolve a preset's `range` — a literal `RangeValue` OR a `() => RangeValue`
 * thunk (consumer owns the date math + i18n labels). The result is normalized
 * (ordered) via `normalizeRange`. A throwing thunk surfaces synchronously to the
 * consumer (T-62-02 — accepted; the consumer owns the thunk).
 */
export function rangeFromPreset(preset: { range: RangeValue | (() => RangeValue) }): RangeValue {
  return typeof preset.range === 'function'
    ? normalizeRange(preset.range())
    : normalizeRange(preset.range);
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
 * `disabledDates`, its weekday is in `disabledDaysOfWeek`, the `isDateDisabled`
 * predicate rejects it, or the control is globally disabled.
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
  const dow = new Date(t).getUTCDay();
  const blockedDows = input.disabledDaysOfWeek || [];
  for (let i = 0; i < blockedDows.length; i++) if (blockedDows[i] === dow) return true;
  if (input.isDateDisabled && input.isDateDisabled(iso)) return true;
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

  // Range-mode model (additive — empty/absent in single mode → all flags false).
  const range = normalizeRange(input.selection);
  const rangeComplete = range.start !== '' && range.end !== '';
  const previewing =
    range.start !== '' && range.end === '' && isIsoDate(input.previewEnd);

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
        rangeStart: range.start !== '' && iso === range.start,
        rangeEnd: range.end !== '' && iso === range.end,
        inRange: rangeComplete && isInRange(iso, range.start, range.end),
        inPreview: previewing && isInRange(iso, range.start, input.previewEnd),
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
 * Build the 12-cell month-picker model for the drill "months" view. Pure and
 * UTC-safe — a fresh `MonthList` each call, no DOM, no framework. A month cell is
 * `disabled` ONLY when its entire span (`toIso(y,m,1)` … `toIso(y,m+1,0)`) falls
 * outside `[min, max]`; a partial overlap keeps it selectable.
 */
export function buildMonthList(viewIso: string, input: DrillInput): MonthList {
  const anchor = isoToUtc(viewIso);
  const year = (anchor == null ? new Date() : new Date(anchor)).getUTCFullYear();

  const minT = isoToUtc(input.min);
  const maxT = isoToUtc(input.max);

  const valueT = isoToUtc(isIsoDate(input.value) ? input.value : '');
  const todayT = isoToUtc(isIsoDate(input.today) ? input.today : '');
  const valueDate = valueT == null ? null : new Date(valueT);
  const todayDate = todayT == null ? null : new Date(todayT);

  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat(input.locale || 'en-US', { month: 'short', timeZone: 'UTC' });
  } catch {
    fmt = null;
  }

  const months: MonthCell[] = [];
  for (let m = 0; m < 12; m++) {
    const iso = toIso(year, m, 1);
    const first = isoToUtc(iso) as number;
    const last = isoToUtc(toIso(year, m + 1, 0)) as number;
    let disabled = false;
    if (minT != null && last < minT) disabled = true;
    if (maxT != null && first > maxT) disabled = true;
    months.push({
      iso,
      label: fmt ? fmt.format(new Date(first)) : MONTH_NAMES_FALLBACK[m].slice(0, 3),
      selected:
        valueDate != null && valueDate.getUTCFullYear() === year && valueDate.getUTCMonth() === m,
      current:
        todayDate != null && todayDate.getUTCFullYear() === year && todayDate.getUTCMonth() === m,
      disabled,
    });
  }
  return { year, months };
}

/**
 * Build the 12-cell year-picker model for the drill "years" view. The window is
 * decade-aligned (`floor(year/10)*10` … `+11`) so the same `viewIso` always
 * yields the same block and `rangeLabel`. A year cell is `disabled` ONLY when its
 * whole span (`toIso(y,0,1)` … `toIso(y,11,31)`) falls outside `[min, max]`. Pure,
 * UTC-safe, fresh object each call.
 */
export function buildYearGrid(viewIso: string, input: DrillInput): YearGrid {
  const anchor = isoToUtc(viewIso);
  const year = (anchor == null ? new Date() : new Date(anchor)).getUTCFullYear();
  const start = Math.floor(year / 10) * 10;

  const minT = isoToUtc(input.min);
  const maxT = isoToUtc(input.max);

  const valueT = isoToUtc(isIsoDate(input.value) ? input.value : '');
  const todayT = isoToUtc(isIsoDate(input.today) ? input.today : '');
  const valueYear = valueT == null ? null : new Date(valueT).getUTCFullYear();
  const todayYear = todayT == null ? null : new Date(todayT).getUTCFullYear();

  const years: YearCell[] = [];
  for (let i = 0; i < 12; i++) {
    const y = start + i;
    const iso = toIso(y, 0, 1);
    const first = isoToUtc(iso) as number;
    const last = isoToUtc(toIso(y, 11, 31)) as number;
    let disabled = false;
    if (minT != null && last < minT) disabled = true;
    if (maxT != null && first > maxT) disabled = true;
    years.push({
      iso,
      year: y,
      selected: valueYear != null && valueYear === y,
      current: todayYear != null && todayYear === y,
      disabled,
    });
  }
  // U+2013 EN DASH between the window bounds.
  return { rangeLabel: start + '–' + (start + 11), years };
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
