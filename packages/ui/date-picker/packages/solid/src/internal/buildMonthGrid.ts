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

/** Input to {@link resolveRovingIso}: the day-grid gate object (same shape
 * already threaded to {@link isDayDisabled}) plus the roving-specific fields. */
export interface RovingDayInput extends MonthGridInput {
  /** How many month panels are rendered side by side (defaults to 1). */
  numberOfMonths?: number;
  /**
   * The tab-stop candidate to prefer when it is in view: the selected value's
   * ISO in single mode, or the in-progress range anchor in range mode. `''`
   * when there is nothing to prefer.
   */
  anchor: string;
}

/**
 * Resolve the SINGLE roving tabindex tab-stop for the day grid, across one or
 * more rendered month panels. Resolution order: **anchor-in-view → today-in-
 * view → first enabled in-month day (scanning panel 0…N-1) → `''`** (no tab
 * stop at all, which only happens when the whole control is `disabled` — a
 * disabled native control must not be tabbable).
 *
 * Arithmetic only — never rebuilds a grid. Called once per day cell per
 * render (42×N), so it stays O(1) in the anchor/today-hit common case; only
 * the fallback path walks the days of each panel month once.
 */
export function resolveRovingIso(input: RovingDayInput): string {
  if (input.disabled) return '';

  const n = Math.max(1, Math.floor(input.numberOfMonths ?? 1));
  const viewIso = input.viewIso;

  const inView = (iso: string): boolean => {
    if (!isIsoDate(iso)) return false;
    const target = iso.slice(0, 7);
    for (let i = 0; i < n; i++) {
      if (addMonths(viewIso, i).slice(0, 7) === target) return true;
    }
    return false;
  };

  if (input.anchor !== '' && inView(input.anchor)) return input.anchor;
  if (input.today !== '' && inView(input.today)) return input.today;

  // First enabled in-month day, scanning panel 0…N-1. Walks each panel's own
  // days directly (never a leading/trailing spill day from buildMonthGrid).
  for (let i = 0; i < n; i++) {
    const panelIso = addMonths(viewIso, i);
    const t = isoToUtc(panelIso);
    if (t == null) continue;
    const d = new Date(t);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    for (let day = 1; day <= lastDay; day++) {
      const iso = toIso(year, month, day);
      if (!isDayDisabled(iso, input)) return iso;
    }
  }
  return '';
}

/** The minimal cell shape {@link resolveRovingDrillIso} resolves over — both
 * `MonthCell` and `YearCell` already satisfy it structurally. */
export interface RovingDrillCell {
  iso: string;
  selected: boolean;
  current: boolean;
  disabled: boolean;
}

/**
 * Resolve the SINGLE roving tabindex tab-stop for a 12-cell drill panel
 * (months or years). Generic over `{ iso, selected, current, disabled }[]` so
 * one helper serves both `MonthCell[]` and `YearCell[]`. Resolution order:
 * `selected` → `current` → first `!disabled` → `''`.
 */
export function resolveRovingDrillIso<T extends RovingDrillCell>(cells: T[]): string {
  for (const c of cells) if (c.selected) return c.iso;
  for (const c of cells) if (c.current) return c.iso;
  for (const c of cells) if (!c.disabled) return c.iso;
  return '';
}

/** Sentinel returned by {@link resolveRovingDrillIndex} when no cell is
 * selectable (mirrors {@link resolveRovingDrillIso}'s `''` — every cell
 * disabled, and none selected/current). */
export const ROVING_DRILL_NONE = -1;

/**
 * The `r-keynav` grid primitive owns an ACTIVE-INDEX model, not an iso model —
 * this is the thin adapter between the two. Delegates entirely to
 * {@link resolveRovingDrillIso} and looks the winning iso back up in `cells`,
 * so the two resolvers can never disagree (no duplicated selection chain).
 * Returns {@link ROVING_DRILL_NONE} when `resolveRovingDrillIso` returns `''`
 * (every cell disabled, nothing selected/current).
 */
export function resolveRovingDrillIndex<T extends RovingDrillCell>(cells: T[]): number {
  const iso = resolveRovingDrillIso(cells);
  if (iso === '') return ROVING_DRILL_NONE;
  return cells.findIndex((c) => c.iso === iso);
}

/** Sentinel returned by {@link resolveRovingDayIndex} when no cell is
 * selectable (mirrors {@link resolveRovingIso}'s `''` — this only happens
 * when the whole control is `disabled`, or when the flat `cells` array is
 * empty because the days view isn't currently showing). */
export const ROVING_DAY_NONE = -1;

/**
 * The `r-keynav` grid primitive owns an ACTIVE-INDEX model, not an iso
 * model — this is the thin adapter between the two for the DAY grid (mirrors
 * {@link resolveRovingDrillIndex} for the month/year drills). Delegates
 * entirely to {@link resolveRovingIso} and looks the winning iso back up in
 * the flat `cells` array (render order: panel, then week, then day — see
 * `DatePicker.rozie`'s `allDayCells()`), matched against `inMonth` so a
 * duplicate iso rendered as a leading/trailing spill day in a NEIGHBOURING
 * panel is never mistaken for the true owning cell — the exact guard the
 * pre-retrofit `dayTabIndex` used (`day.inMonth && day.iso === rovingDayIso()`).
 * Returns {@link ROVING_DAY_NONE} when `resolveRovingIso` returns `''`, or
 * when no `inMonth` cell in `cells` matches the resolved iso (e.g. `cells`
 * is `[]` because the days view isn't showing).
 */
export function resolveRovingDayIndex(cells: CalendarDay[], input: RovingDayInput): number {
  const iso = resolveRovingIso(input);
  if (iso === '') return ROVING_DAY_NONE;
  return cells.findIndex((c) => c.inMonth && c.iso === iso);
}

const WEEKDAY_NAMES_FALLBACK_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/**
 * The seven weekday header labels, ordered from `weekStartsOn`. Localized via
 * `Intl` with an English fallback. `width` defaults to `'short'` (the
 * existing two-arg call shape and output are byte-unchanged); pass `'long'`
 * for the full weekday name (quick task 260807-6p8, D-01 — the visible header
 * text stays the short label; the long form feeds `aria-label` only).
 */
export function weekdayLabels(
  weekStartsOn: number,
  locale: string,
  width: 'short' | 'long' = 'short',
): string[] {
  const start = ((Math.floor(weekStartsOn ?? 0) % 7) + 7) % 7;
  const out: string[] = [];
  let fmt: Intl.DateTimeFormat | null = null;
  try {
    fmt = new Intl.DateTimeFormat(locale || 'en-US', { weekday: width, timeZone: 'UTC' });
  } catch {
    fmt = null;
  }
  const fallback = width === 'long' ? WEEKDAY_NAMES_FALLBACK_LONG : WEEKDAY_NAMES_FALLBACK;
  for (let i = 0; i < 7; i++) {
    const dow = (start + i) % 7;
    if (fmt) {
      // 2023-01-01 was a Sunday → use it to anchor weekday 0.
      const ms = Date.UTC(2023, 0, 1) + dow * 86400000;
      out.push(fmt.format(new Date(ms)));
    } else {
      out.push(fallback[dow]);
    }
  }
  return out;
}

/**
 * Localized, human-readable full-date label for a day cell's `aria-label`
 * (quick task 260807-6p8, D-01 item 4) — e.g. `"Sunday, June 15, 2025"`
 * instead of the raw ISO string. `timeZone: 'UTC'` is load-bearing: the whole
 * file is UTC-anchored (see the module doc comment), and a local-zone format
 * would slide the announced date by a day near a DST/zone boundary. Mirrors
 * {@link monthLabel}'s total-function discipline — a throw or a malformed iso
 * returns the raw `iso` string unchanged rather than throwing.
 */
export function dayLabel(iso: string, locale: string): string {
  const t = isoToUtc(iso);
  if (t == null) return iso;
  try {
    return new Intl.DateTimeFormat(locale || 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(t));
  } catch {
    return iso;
  }
}

/**
 * The 10 static English "chrome" phrases the DatePicker's `labels` prop can
 * override (quick task 260807-6p8, D-05 discretion resolution). These are
 * NOT Intl-derived — `Intl` localizes DATES, not the English phrase
 * "Previous month" — so a consumer must supply their own translations via
 * `labels` for a fully-localized control. Every key is documented on the
 * `labels` prop in `DatePicker.rozie`.
 */
export type DatePickerLabelKey =
  | 'root'
  | 'previousMonth'
  | 'nextMonth'
  | 'changeMonthYear'
  | 'changeYear'
  | 'chooseMonth'
  | 'chooseYear'
  | 'presets'
  | 'today'
  | 'clear';

export const LABEL_DEFAULTS: Record<DatePickerLabelKey, string> = {
  root: 'Date picker',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  changeMonthYear: 'Change month and year',
  changeYear: 'Change year',
  chooseMonth: 'Choose month',
  chooseYear: 'Choose year',
  presets: 'Date range presets',
  today: 'Today',
  clear: 'Clear',
};

/**
 * Resolve a single chrome label: the consumer's `labels[key]` override when
 * it is a non-empty string, else {@link LABEL_DEFAULTS}`[key]`. `labels` is
 * an untrusted, consumer-supplied prop value (T-6p8-01) — guarded with a
 * truthy + `typeof === 'object'` test so a string/number/null/array `labels`
 * value can never throw; an unknown extra key is silently ignored.
 */
export function resolveLabel(labels: unknown, key: DatePickerLabelKey): string {
  if (labels && typeof labels === 'object') {
    const v = (labels as Record<string, unknown>)[key];
    if (typeof v === 'string' && v !== '') return v;
  }
  return LABEL_DEFAULTS[key];
}

/**
 * Hard cap on the interior-day walk `rangeSpansDisabled` performs for the
 * `isDateDisabled` branch (T-6p8-02, Denial of Service — mitigate). A
 * deliberate fail-OPEN: an interior exceeding this returns `false` rather
 * than walking further — a fail-closed cap would silently forbid a
 * legitimate multi-decade range that has no actually-disabled day in it.
 */
export const RANGE_SCAN_MAX_DAYS = 4000;

/**
 * `true` when the (order-tolerant) span between `a` and `b` crosses a
 * disabled day in its INTERIOR — strictly between the two endpoints,
 * excluding them (quick task 260807-6p8, D-02). Consumed by BOTH the range
 * hover-preview path and the range-commit path in `DatePicker.rozie`, so a
 * preview band and a commit can never disagree about the same span.
 *
 * Checked in this order:
 * 1. The whole control disabled, either ISO unparsable, or a non-positive
 *    interior (same day / adjacent days) → `false`.
 * 2. `disabledDates` — an O(list) scan (not a day walk): any entry whose UTC
 *    ms lies strictly between the two endpoints → `true`.
 * 3. `disabledDaysOfWeek` (non-empty) — an interior of 7 or more days
 *    necessarily contains every weekday, so this returns `true` immediately
 *    without walking; otherwise it walks the (at most 6) interior days and
 *    compares `getUTCDay()`.
 * 4. `isDateDisabled` — the only branch that walks days one at a time,
 *    capped at {@link RANGE_SCAN_MAX_DAYS} (see its own doc comment for the
 *    fail-open rationale).
 *
 * `min`/`max` are deliberately NOT consulted: they define a single
 * CONTIGUOUS window, so if both endpoints already pass the bound test, every
 * interior day between them does too — there is nothing a bounds check could
 * find that isn't already implied by the endpoints themselves.
 */
export function rangeSpansDisabled(a: string, b: string, input: MonthGridInput): boolean {
  if (input.disabled) return false;
  const at = isoToUtc(a);
  const bt = isoToUtc(b);
  if (at == null || bt == null) return false;
  const lo = at <= bt ? at : bt;
  const hi = at <= bt ? bt : at;
  const interiorDays = Math.round((hi - lo) / 86400000) - 1;
  if (interiorDays <= 0) return false;

  const disabledDates = input.disabledDates || [];
  for (let i = 0; i < disabledDates.length; i++) {
    const dt = isoToUtc(disabledDates[i]);
    if (dt != null && dt > lo && dt < hi) return true;
  }

  const blockedDows = input.disabledDaysOfWeek || [];
  if (blockedDows.length > 0) {
    if (interiorDays >= 7) return true;
    for (let ms = lo + 86400000; ms < hi; ms += 86400000) {
      const dow = new Date(ms).getUTCDay();
      for (let i = 0; i < blockedDows.length; i++) if (blockedDows[i] === dow) return true;
    }
  }

  if (input.isDateDisabled) {
    if (interiorDays > RANGE_SCAN_MAX_DAYS) return false;
    for (let ms = lo + 86400000; ms < hi; ms += 86400000) {
      const cd = new Date(ms);
      const iso = toIso(cd.getUTCFullYear(), cd.getUTCMonth(), cd.getUTCDate());
      if (input.isDateDisabled(iso)) return true;
    }
  }

  return false;
}
