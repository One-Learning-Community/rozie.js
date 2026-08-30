import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, rozieAttr, rozieDisplay, useControllableState, useKeynav } from '@rozie/runtime-react';
import './DatePicker.css';
import { addMonths, buildMonthGrid, buildMonthList, buildYearGrid, dayLabel, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, rangeSpansDisabled, resolveLabel, resolveRovingDayIndex, resolveRovingDrillIndex, resolveViewIso, ROVING_DAY_NONE, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

interface HeaderCtx { label: any; prev: any; next: any; disabled: any; openMonths: any; openYears: any; closeDrill: any; viewMode: any; }

interface FooterCtx { today: any; clear: any; todayIso: any; }

interface PresetsCtx { presets: any; apply: any; }

interface DatePickerProps {
  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker value={date} onValueChange={setDate} min={'2026-01-01'} onChange={onPick} />
   */
  value?: string | Record<string, any>;
  defaultValue?: string | Record<string, any>;
  onValueChange?: (value: string | Record<string, any>) => void;
  /**
   * Selection mode: `'single'` (the default — `value` is one ISO `YYYY-MM-DD` string, fully backward-compatible) or `'range'` (`value` becomes a `{ start, end }` object selected with two clicks plus a live hover preview, direction-agnostic). In `range` mode a completed selection additionally emits `rangeComplete`.
   */
  selectionMode?: string;
  /**
   * Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound.
   */
  min?: (string) | null;
  /**
   * Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound.
   */
  max?: (string) | null;
  /**
   * An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`.
   */
  disabledDates?: any[];
  /**
   * The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar).
   */
  weekStartsOn?: number;
  /**
   * Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state.
   */
  disabled?: boolean;
  /**
   * BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`.
   */
  locale?: string;
  /**
   * Optional overrides for the 10 static English "chrome" strings, keyed by `root`, `previousMonth`, `nextMonth`, `changeMonthYear`, `changeYear`, `chooseMonth`, `chooseYear`, `presets`, `today`, `clear` (defaults: `"Date picker"`, `"Previous month"`, `"Next month"`, `"Change month and year"`, `"Change year"`, `"Choose month"`, `"Choose year"`, `"Date range presets"`, `"Today"`, `"Clear"`). **Honest split:** `Intl` is a date/number formatter, not a message catalog — it can localize a DATE but cannot translate the phrase "Previous month". The day-cell accessible name, each multi-month panel's own grid caption, the weekday header long names, and the month-year heading text are already Intl-derived from the `locale` prop and are NOT `labels` keys; the 10 chrome phrases above are English-static and only `labels` can translate them. An empty object (the default) yields the English defaults with zero config. **Lit caveat:** pass via a *property* binding (`.labels=${…}`), never a string attribute — the same rule already in force for `disabledDates`/`presetRanges`.
   * @example
   * <DatePicker labels={{ previousMonth: 'Mois précédent' }} locale="fr-FR" />
   */
  labels?: Record<string, any>;
  /**
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  presetRanges?: any[];
  /**
   * Render the month-year heading as a clickable drill **button** that navigates days → months → years (and a year label that drills months → years). **Capability-on:** this is the documented exception to the boolean-default-`false` rule — the drill navigation is the ergonomic win of this feature, so it defaults to `true`. Set `:month-year-nav="false"` to restore the static heading `<span>` (byte-identical to the pre-navigation output).
   */
  monthYearNav?: boolean;
  /**
   * How many month grids to render side by side, anchored at the view month and stepping forward (e.g. `2` for a two-up range calendar). `1` (the default) emits exactly the single-month markup with no extra wrapper element.
   */
  numberOfMonths?: number;
  /**
   * Render a Today / Clear footer row beneath the calendar grid. `Today` selects (single mode) or navigates to (range mode) the current date; `Clear` deselects. The `#footer` slot fully overrides the default row, receiving `{ today, clear, todayIso }`.
   */
  showFooter?: boolean;
  /**
   * An array of weekday indices to disable, `Number[]` where `0` = Sunday through `6` = Saturday (e.g. `[0, 6]` disables every weekend). Serializable, so it passes fine as a plain attribute. Threaded through the single gating funnel, so disabled weekdays are non-interactive, non-focusable, and marked `aria-disabled` — in agreement with day cells, drill enablement, and keyboard focus.
   */
  disabledDaysOfWeek?: any[];
  /**
   * A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`.
   */
  isDateDisabled?: ((...args: any[]) => any) | null;
  onChange?: (...args: any[]) => void;
  onRangeComplete?: (...args: any[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  renderFooter?: (ctx: FooterCtx) => ReactNode;
  renderPresets?: (ctx: PresetsCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

const DatePicker = forwardRef<DatePickerHandle, DatePickerProps>(function DatePicker(_props: DatePickerProps, ref): JSX.Element {
  const __defaultDisabledDates = useState(() => (() => [])())[0];
  const __defaultLabels = useState(() => (() => ({}))())[0];
  const __defaultPresetRanges = useState(() => (() => [])())[0];
  const __defaultDisabledDaysOfWeek = useState(() => (() => [])())[0];
  const props: Omit<DatePickerProps, 'selectionMode' | 'min' | 'max' | 'disabledDates' | 'weekStartsOn' | 'disabled' | 'locale' | 'labels' | 'presetRanges' | 'monthYearNav' | 'numberOfMonths' | 'showFooter' | 'disabledDaysOfWeek' | 'isDateDisabled'> & { selectionMode: string; min: (string) | null; max: (string) | null; disabledDates: any[]; weekStartsOn: number; disabled: boolean; locale: string; labels: Record<string, any>; presetRanges: any[]; monthYearNav: boolean; numberOfMonths: number; showFooter: boolean; disabledDaysOfWeek: any[]; isDateDisabled: ((...args: any[]) => any) | null } = {
    ..._props,
    selectionMode: _props.selectionMode ?? 'single',
    min: _props.min ?? null,
    max: _props.max ?? null,
    disabledDates: _props.disabledDates ?? __defaultDisabledDates,
    weekStartsOn: _props.weekStartsOn ?? 0,
    disabled: _props.disabled ?? false,
    locale: _props.locale ?? 'en-US',
    labels: _props.labels ?? __defaultLabels,
    presetRanges: _props.presetRanges ?? __defaultPresetRanges,
    monthYearNav: _props.monthYearNav ?? true,
    numberOfMonths: _props.numberOfMonths ?? 1,
    showFooter: _props.showFooter ?? false,
    disabledDaysOfWeek: _props.disabledDaysOfWeek ?? __defaultDisabledDaysOfWeek,
    isDateDisabled: _props.isDateDisabled ?? null,
  };
  const attrs: Record<string, unknown> = (() => {
    const { value, selectionMode, min, max, disabledDates, weekStartsOn, disabled, locale, labels, presetRanges, monthYearNav, numberOfMonths, showFooter, disabledDaysOfWeek, isDateDisabled, defaultValue, onValueChange, onChange, onRangeComplete, ...rest } = _props as DatePickerProps & Record<string, unknown>;
    void value; void selectionMode; void min; void max; void disabledDates; void weekStartsOn; void disabled; void locale; void labels; void presetRanges; void monthYearNav; void numberOfMonths; void showFooter; void disabledDaysOfWeek; void isDateDisabled; void defaultValue; void onValueChange; void onChange; void onRangeComplete;
    return rest;
  })();
  const [value, setValue] = useControllableState({
    value: props.value,
    defaultValue: props.defaultValue ?? '',
    onValueChange: props.onValueChange,
  });
  const [viewIso, setViewIso] = useState('');
  const [hoverIso, setHoverIso] = useState('');
  const [viewMode, setViewMode] = useState('days');
  const [activeDay, setActiveDay] = useState(0);
  const [activeDayReal, setActiveDayReal] = useState(0);
  const [activeMonth, setActiveMonth] = useState(0);
  const [activeYear, setActiveYear] = useState(0);
  const root = useRef<HTMLDivElement | null>(null);

  const { onChange: _rozieProp_onChange } = props;
  // ---- today (deterministic per-render read) -----------------------------
  // Today's ISO, computed from the local clock. A plain function so each call is
  // fresh (a date picker open across midnight should follow the wall clock).
  function todayIso() {
    const d = new Date();
    return toIso(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // ---- derived view (ONE plain function, uniform x6) ---------------------
  // The current selected ISO, normalized to a string. In range mode the value is
  // an object → this returns '' (so the SINGLE-mode grid highlight no-ops there).
  // `$props.value` lowers to an accessor CALL on both Solid (`value()`) and
  // Angular (`this.value()`); both emitters now hoist a local before the
  // `typeof` guard (hoistPolymorphicModelGuards, Solid emitter-hardening backlog
  // item #11 / Angular quick task 260711-v2l), so this inline guard narrows
  // cleanly on all six targets.
  function selected(): string {
    return typeof value === 'string' ? value : '';
  }

  // The RANGE normalization funnel (mirrors selected()): coerce the polymorphic
  // `value` into a canonical ordered { start, end }. ALL range logic reads through
  // this — never $props.value directly — so the polymorph is funneled in one place.
  function readRange() {
    return normalizeRange(value);
  }

  // The resolved month anchor: the local view state, falling back to the selected
  // value, then today. In range mode `selected()` is '' (the value is an object),
  // so fall back to the range's `start` endpoint — a DatePicker opened with a
  // pre-selected range must show that range's month, mirroring how single mode
  // pins the view to its selected ISO (else range mode always opens on today).
  function viewAnchor(): string {
    const s = selected();
    if (s !== '') return s;
    if (props.selectionMode === 'range') return readRange().start;
    return '';
  }
  // `viewIsoOverride` (77-08): callers that just wrote $data.viewIso in the
  // SAME synchronous call (goToMonth/goToToday/selectMonth) can pass the
  // FRESH value directly instead of relying on this function's own
  // $data.viewIso read. This matters because a callback that reads $data.viewIso
  // is a JS CLOSURE captured at a point in time — on React specifically, no
  // amount of setTimeout/rAF deferral makes an ALREADY-CAPTURED closure
  // observe a state write made by the SAME synchronous call that created it
  // (React's setState is async; the closure was bound before that write even
  // scheduled a new render). Passing the value the caller already computed
  // sidesteps the staleness entirely (mirrors 77-07's onMonthCommit/
  // onYearCommit `i`-parameter fix for the identical class of bug). Omitted
  // (undefined) falls back to the live $data.viewIso read — correct for every
  // call site with no fresher value in hand ($onMount, the focus() expose
  // handle, template reads).
  const viewMonthGrid = useCallback((viewIsoOverride?: string) => resolveViewIso({
    viewIso: viewIsoOverride !== undefined ? viewIsoOverride : viewIso,
    value: viewAnchor(),
    today: todayIso()
  }), [todayIso, viewAnchor, viewIso]);
  // The whole render model in a single call: { year, month, weeks }. A PLAIN
  // function (not $computed) so it reads uniformly on all six targets and can be
  // aliased in handlers without the Solid accessor divergence. Returns a FRESH
  // object each call — never feed it to a reference-equality $watch getter. In
  // range mode it additionally passes `selection` (the ordered range) + the live
  // `previewEnd` (the hovered day); in single mode those are omitted (undefined →
  // all range flags false → byte-stable single path).
  function grid() {
    return buildMonthGrid({
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      selection: props.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: props.selectionMode === 'range' ? hoverIso : undefined
    });
  }

  // The multi-month render model: N grids stepping forward from the view month,
  // so `numberOfMonths` renders side by side. A PLAIN function (uniform x6),
  // mirroring grid() exactly but with the view anchor advanced by `i` months.
  // numberOfMonths === 1 yields a one-element array whose single grid === grid().
  // `viewIsoOverride` threads through to viewMonthGrid() — see its own doc
  // comment (77-08 staleness fix).
  function grids(viewIsoOverride?: string) {
    return Array.from({
      length: props.numberOfMonths
    }, (_: any, i: any) => buildMonthGrid({
      viewIso: addMonths(viewMonthGrid(viewIsoOverride), i),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      selection: props.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: props.selectionMode === 'range' ? hoverIso : undefined
    }));
  }

  // ---- drill models (months / years panels) ------------------------------
  // The 12-cell month picker for the 'months' drill view + the 12-cell year
  // picker (decade-aligned) for the 'years' view. PLAIN functions (uniform x6),
  // each a fresh object per call. The gates that matter to a whole month/year span
  // are min/max (buildMonthList/buildYearGrid own the entire-span test); the
  // per-day weekday/predicate gates apply only in the days grid.
  function monthList() {
    return buildMonthList(viewMonthGrid(), {
      min: props.min,
      max: props.max,
      value: selected(),
      today: todayIso(),
      locale: props.locale
    });
  }
  function yearGrid() {
    return buildYearGrid(viewMonthGrid(), {
      min: props.min,
      max: props.max,
      value: selected(),
      today: todayIso()
    });
  }
  // The decade window label (e.g. "2020–2031") shown in the years-panel header.
  function yearRangeLabel() {
    return yearGrid().rangeLabel;
  }

  // The day-grid iterable for the template: the N month grids in the 'days' view,
  // or an empty array in the months/years drill views. Gating the r-for through an
  // EMPTY array (rather than an r-if on the same element) keeps the day-grid
  // element free of an r-if+r-for combo. The panels render inside the ONE
  // layout-neutral `.rozie-datepicker-grids` wrapper (77-08 — the r-keynav day
  // grid's root; `display: contents` in the style block below keeps it out of
  // the render tree, so this stays present regardless of numberOfMonths without
  // perturbing the single-month layout).
  //
  // `viewIsoOverride` threads to viewMonthGrid() (77-08 staleness fix, see its
  // doc comment). `assumeDaysView`, when true, bypasses the showsDaysView()
  // gate — for a caller (selectMonth/exitToDaysView) that just wrote
  // $data.viewMode = 'days' in the SAME synchronous call: reading
  // $data.viewMode back here would observe the PRE-write value for the exact
  // same closure-staleness reason, so the caller that KNOWS it is
  // transitioning into the days view says so explicitly instead.
  function daysGrids(viewIsoOverride?: string, assumeDaysView?: boolean) {
    return assumeDaysView || showsDaysView() ? grids(viewIsoOverride) : [];
  }

  // The flat, render-order concatenation of every rendered panel's day cells
  // (panels in order, weeks in order, days in order) — the r-keynav day grid's
  // `:source` (77-08). Every panel is always exactly 42 cells (6 weeks x 7
  // days), so a cell's flat index is `panelIndex * 42 + weekIndex * 7 +
  // columnIndex` — the day button's own explicit r-keynav-item index expression
  // computes this exactly. Empty while a drill panel is showing, mirroring
  // daysGrids()'s own gate. Both params thread straight through to daysGrids().
  function allDayCells(viewIsoOverride?: string, assumeDaysView?: boolean) {
    return daysGrids(viewIsoOverride, assumeDaysView).flatMap((g: any) => g.weeks.flatMap((row: any) => row));
  }

  // The day grid's roving/active-index resolution input — the SAME shape the
  // pre-retrofit rovingDayIso() built, now feeding resolveRovingDayIndex
  // (buildMonthGrid.ts) instead of resolveRovingIso directly, so the tab stop,
  // entry focus and the focus() expose handle can never disagree (the
  // 260802-hla invariant). `anchor` mirrors the existing viewAnchor() funnel —
  // the selected value in single mode, else the in-progress range anchor — so
  // a range picker gets a tab stop too. `viewIsoOverride` threads to
  // viewMonthGrid() (77-08 staleness fix).
  function rovingDayInput(viewIsoOverride?: string) {
    return {
      viewIso: viewMonthGrid(viewIsoOverride),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled,
      numberOfMonths: props.numberOfMonths,
      anchor: selected() !== '' ? selected() : props.selectionMode === 'range' ? readRange().start : ''
    };
  }

  // Seed $data.activeDay from the SAME anchor-in-view → today-in-view →
  // first-enabled-in-month-day fallback the pre-retrofit tab stop used
  // (resolveRovingDayIndex, buildMonthGrid.ts) — called on mount, after a
  // direct month/today nav, and whenever a drill panel returns to the days
  // view (selectMonth/exitToDaysView). The r-keynav grid controller lands DOM
  // focus itself whenever this value CHANGES — see the day grid's template
  // root. NOT called from onDayPage below, which computes its own precise
  // landing index per SPEC §4.1 instead of this fallback chain.
  //
  // `viewIsoOverride`/`assumeDaysView` thread straight through to
  // allDayCells()/rovingDayInput() — every caller that just wrote
  // $data.viewIso and/or $data.viewMode passes the fresh value(s) it already
  // computed instead of letting this function re-derive them from $data. This
  // is NOT a timing/ordering issue — no amount of setTimeout/rAF deferral
  // fixes it: on React, reading a state variable inside a callback observes
  // whatever that CLOSURE captured at creation time, and a synchronous
  // $data.X = newValue write inside the SAME calling function does not
  // retroactively update a closure that already exists (React's setState is
  // async — the closure calling this was bound BEFORE that write even
  // scheduled a new render). Passing the value the caller already has
  // sidesteps the staleness entirely (mirrors 77-07's onMonthCommit/
  // onYearCommit `i`-parameter fix for the identical class of bug; found via
  // 77-08's real-DOM Docker VR run — "step forward a month" resolved the
  // fallback against the OLD month, and a drill exit resolved against an
  // empty day source because $data.viewMode hadn't "visibly" flipped back to
  // 'days' from this function's point of view). Omitted at a call site with
  // no fresher value in hand (focus() expose handle) falls back to the live
  // $data reads, correctly.
  //
  // The day grid's own root never remounts (unlike the drills' r-if roots,
  // 77-07) — it's the SAME wrapper the whole time, so the controller's own
  // {root,active} diff (its "only re-apply on a genuine change" guard) sees
  // NO change at all when the freshly-resolved index happens to repeat the
  // value $data.activeDay already held, and silently skips re-applying DOM
  // focus. That drops focus continuity on exactly the 260802-hla regression
  // case this retrofit must keep green: drilling into months/years and back
  // out WITHOUT the selection changing (so the day tab stop resolves to the
  // SAME index both times) — meanwhile the day buttons themselves were
  // removed and recreated while the drill panel was showing, so REAL DOM
  // focus has already been lost by the time this runs. Force a genuine
  // change the reactive system actually observes: settle through the
  // ROVING_DAY_NONE sentinel first, then the real value one animation frame
  // later.
  //
  // EVERY write to $data.activeDay below is deferred one animation frame,
  // even in the plain (not-same-value) case — found empirically via 77-08's
  // real-DOM Docker VR run: a synchronous write from a real click handler
  // (not a mount effect, and with a CORRECTLY fresh-computed `next` value —
  // this is NOT the closure-staleness class of bug the viewIsoOverride
  // parameters above fix) still silently failed to reach the template on one
  // target. A single rAF deferral committed correctly every time on every
  // target, with no observable flicker (never a retry loop, and still never
  // queries the DOM or calls .focus() itself — the primitive's own effect
  // keeps owning that once it sees activeDay actually move).
  // [77-09 fix] Resolves the CURRENT day-grid position, safe to call even
  // while a settle is mid-flight (`$data.activeDay === ROVING_DAY_NONE`).
  // `$data.activeDay` is authoritative WHENEVER it holds a real value — this
  // covers every ordinary primitive-driven move (arrows, Home/End, Ctrl+Home/
  // End, pointer clicks, the focusin sync) transparently, since none of those
  // ever write the sentinel; they write straight through the
  // `r-keynav:tabindex.grid(7)="$data.activeDay"` two-way binding. Only when
  // `activeDay` is CURRENTLY the sentinel (a settle this same module started
  // is still in flight) does this fall back to `activeDayReal`, the shadow
  // both seedActiveDay and onDayPage keep pointed at their own last-computed
  // target — see `activeDayReal`'s own <data> doc comment for why a plain
  // `$data.activeDay` read is unsafe in that window.
  function currentActiveDay() {
    return activeDay === ROVING_DAY_NONE ? activeDayReal : activeDay;
  }
  const seedActiveDay = useCallback((viewIsoOverride?: string, assumeDaysView?: boolean) => {
    const next = resolveRovingDayIndex(allDayCells(viewIsoOverride, assumeDaysView), rovingDayInput(viewIsoOverride));
    if (next === currentActiveDay()) {
      setActiveDay(ROVING_DAY_NONE);
    }
    // `activeDayReal` is updated SYNCHRONOUSLY (no rAF defer) — pure
    // bookkeeping, never read for DOM focus/UI, so it must always reflect the
    // latest INTENDED target the instant it's known, not one frame later.
    setActiveDayReal(next);
    requestAnimationFrame(() => {
      setActiveDay(next);
    });
  }, [allDayCells, currentActiveDay, rovingDayInput]);
  // The localized month-year heading. NAMED `monthHeading`, NOT `label` — a bare
  // `label` helper becomes a class field on the Lit custom element and a `title`
  // would collide with the inherited HTMLElement.title; `monthHeading` is clear.
  function monthHeading() {
    return monthLabel(viewMonthGrid(), props.locale);
  }
  // The seven weekday header labels, rotated by weekStartsOn. Visible text —
  // stays the SHORT Intl label (weekdaysLong() below feeds aria-label only).
  function weekdays() {
    return weekdayLabels(props.weekStartsOn, props.locale);
  }

  // ---- labels / a11y (quick task 260807-6p8, D-01, D-05) -----------------
  // labelFor(key) is the ONE resolution site for every chrome aria/visible
  // string — no default is ever duplicated at a call site (resolveLabel funnels
  // $props.labels through the shared LABEL_DEFAULTS table).
  function labelFor(key: any) {
    return resolveLabel(props.labels, key);
  }
  // The day cell's full, localized, human-readable aria-label (e.g. "Sunday,
  // June 15, 2025") — Intl-derived from $props.locale, NOT a `labels` key.
  function dayAria(iso: any) {
    return dayLabel(iso, props.locale);
  }
  // The seven FULL weekday names (Intl 'long'), used only for the column-header
  // aria-label — the visible text stays weekdays()'s short form.
  function weekdaysLong() {
    return weekdayLabels(props.weekStartsOn, props.locale, 'long');
  }
  // Each rendered month panel's OWN localized "Month YYYY" caption (per-panel
  // aria-label on its role="grid") — panel `i` is the view month advanced `i`
  // months, matching how grids() builds the panels.
  function panelHeading(i: any) {
    return monthLabel(addMonths(viewMonthGrid(), i), props.locale);
  }

  // The ten-field gating input shared by isDayDisabled AND rangeSpansDisabled,
  // so day-cell enablement and range-span validation can never disagree about
  // the same gates. ONE definition (was inlined per-call before this task).
  function gateInput() {
    return {
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: props.min,
      max: props.max,
      disabledDates: props.disabledDates,
      disabledDaysOfWeek: props.disabledDaysOfWeek,
      isDateDisabled: props.isDateDisabled,
      weekStartsOn: props.weekStartsOn,
      disabled: props.disabled
    };
  }

  // Whether a given ISO can be selected (the template gates clicks on it too).
  function dayEnabled(iso: any) {
    return !isDayDisabled(iso, gateInput());
  }

  // Whether the (order-tolerant) span between two ISOs crosses a disabled day
  // in its interior (D-02) — consumed by BOTH onDayHover (preview suppression)
  // and commitRange (re-anchor instead of complete) below, one predicate.
  function rangeSpanBlocked(a: any, b: any) {
    return rangeSpansDisabled(a, b, gateInput());
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Select an ISO date: write the model + emit change. NOT named `setValue`
  // (collides with React's generated `value` model setter → ROZ524). A no-op
  // (re-selecting the same date) still re-emits intentionally? No — guard it.
  function commitValue(iso: any) {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    if (iso === selected()) return;
    setValue(iso);
    setViewIso(iso);
    props.onChange && props.onChange({
      value: iso
    });
  }

  // ---- range write funnel (direction-agnostic two-click state machine) ----
  // The anchor IS the partial model's `start` (end ''); there is no separate
  // anchor field. First click (no in-progress range, OR a completed one →
  // restart): write { start: iso, end: '' } + emit change. Second click
  // (anchor set, end empty → completing): write the ORDERED { start, end } +
  // clear the preview + emit change AND rangeComplete. Endpoints are compared by
  // VALUE (never object ===, Pitfall-4).
  // [D-02] The restart branch now ALSO fires when the in-progress span crosses
  // a disabled day (rangeSpanBlocked(r.start, iso)) — a blocked second click
  // RE-ANCHORS at the clicked day instead of completing, reusing this SAME
  // restart branch verbatim (one write path; no second $model.value write site
  // is introduced). Deliberately does NOT clear $data.hoverIso here — the
  // frozen VR phases depend on the restart branch's existing behavior.
  function commitRange(iso: any) {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    const r = readRange();
    if (r.start === '' || r.end !== '' || rangeSpanBlocked(r.start, iso)) {
      // No in-progress selection, a completed one, or a blocked span → (re)start the anchor.
      setValue({
        start: iso,
        end: ''
      });
      setViewIso(iso);
      props.onChange && props.onChange({
        value: {
          start: iso,
          end: ''
        }
      });
    } else {
      // Anchor set, end empty, span not blocked → complete the range (ordered by normalizeRange).
      const next = normalizeRange({
        start: r.start,
        end: iso
      });
      setValue(next);
      setViewIso(iso);
      setHoverIso('');
      props.onChange && props.onChange({
        value: next
      });
      props.onRangeComplete && props.onRangeComplete({
        value: next
      });
    }
  }

  // Hover preview: only meaningful in range mode while a range is in progress
  // (anchor set, end empty). Records the hovered ISO so the grid lights the
  // direction-agnostic preview band. Otherwise a no-op — the early return below
  // is byte-preserved from the pre-260807-6p8 behavior. [D-02] Inside the
  // previewing state, when the hovered day is itself disabled OR the anchor→
  // hovered span crosses a disabled day (rangeSpanBlocked), the band is
  // SUPPRESSED entirely by clearing $data.hoverIso (not merely returning) —
  // clamping would put the visible band somewhere the cursor is not.
  const onDayHover = useCallback((iso: any) => {
    if (props.selectionMode !== 'range') return;
    const r = readRange();
    if (r.start === '' || r.end !== '') return;
    if (!dayEnabled(iso) || rangeSpanBlocked(r.start, iso)) {
      setHoverIso('');
      return;
    }
    setHoverIso(iso);
  }, [dayEnabled, props.selectionMode, rangeSpanBlocked, readRange]);
  // Day-select dispatch: route a click / Enter / Space through the mode-appropriate
  // funnel (range → commitRange, single → commitValue).
  function onDaySelect(iso: any) {
    if (props.selectionMode === 'range') commitRange(iso);else commitValue(iso);
  }

  // ---- month navigation (view-mode-aware ‹ › step) -----------------------
  // The prev/next step advances the view anchor by ONE UNIT of the current drill
  // view: a month in 'days', a year (12 months) in 'months', 12 years (144
  // months) in 'years'. In the default 'days' view the delta is `delta` months —
  // byte-identical to the pre-navigation behavior, so `:month-year-nav="false"`
  // (which can never leave 'days') is unchanged.
  function goToMonth(delta: any) {
    if (props.disabled) return;
    const unit = viewMode === 'years' ? 144 : viewMode === 'months' ? 12 : 1;
    const nextViewIso = addMonths(viewMonthGrid(), delta * unit);
    setViewIso(nextViewIso);
    // The rendered day set changed without going through the r-keynav page
    // mechanism (a direct header nav click) — reseed the tab stop (77-08).
    // Pass the freshly-computed viewIso directly (staleness fix, see
    // seedActiveDay's own doc comment) — $data.viewMode is UNCHANGED by this
    // function, so the live showsDaysView() read stays correct un-overridden.
    seedActiveDay(nextViewIso);
  }
  const goPrevMonth = useCallback(() => goToMonth(-1), [goToMonth]);
  const goNextMonth = useCallback(() => goToMonth(1), [goToMonth]);
  // ---- view-mode drill state machine (mutates $data.viewMode/$data.viewIso
  // ONLY — never $model.value; drilling is a pure VIEW concern) -------------
  // Named boolean guards (never a bare `.length` / bare string compare in an
  // r-if — route through a `(): boolean` so the JSX targets emit a true boolean
  // and no falsy value leaks a text node).
  function showsDaysView(): boolean {
    return viewMode === 'days';
  }
  function showsMonthsView(): boolean {
    return viewMode === 'months';
  }
  function showsYearsView(): boolean {
    return viewMode === 'years';
  }

  // Drill DOWN into the month picker (from the days heading). Seeds
  // $data.activeMonth via resolveRovingDrillIndex (the SAME selection chain
  // resolveRovingDrillIso proves), so the r-keynav grid primitive lands DOM
  // focus on the resolved cell in the same tick the panel first renders — the
  // focus-after-render seam (SPEC §10). No scheduleFocus call: that's now the
  // primitive's job.
  const enterMonthsView = useCallback(() => {
    if (props.disabled) return;
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
    setViewMode('months');
  }, [monthList, props.disabled]);
  // Drill DOWN into the year picker (from the months-panel year label). Mirrors
  // enterMonthsView.
  const enterYearsView = useCallback(() => {
    if (props.disabled) return;
    setActiveYear(resolveRovingDrillIndex(yearGrid().years));
    setViewMode('years');
  }, [props.disabled, yearGrid]);
  // Pick a month → move the view anchor to it, drill back UP toward days, and
  // seed $data.activeDay onto the resolved day tab stop — the r-keynav grid
  // controller lands DOM focus itself once the value changes (77-08; no
  // scheduler needed any more).
  const selectMonth = useCallback((iso: any) => {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!monthEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('days');
    // Both the view anchor AND the days-view transition are fresh in THIS
    // call — pass both explicitly (staleness fix, see seedActiveDay's own doc
    // comment).
    seedActiveDay(iso, true);
  }, [monthEnabled, props.disabled, seedActiveDay]);
  // Pick a year → move the view anchor's year, drill back UP toward months, and
  // re-seed $data.activeMonth (mirrors enterMonthsView — the primitive lands
  // focus, no scheduleFocus needed).
  const selectYear = useCallback((iso: any) => {
    if (props.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!yearEnabled(iso)) return;
    setViewIso(iso);
    setViewMode('months');
    setActiveMonth(resolveRovingDrillIndex(monthList().months));
  }, [monthList, props.disabled, yearEnabled]);
  // Shared Escape-to-days exit for both drill keydown handlers: returns to the
  // days view AND seeds $data.activeDay, so Escape returns focus into the grid
  // (the r-keynav controller lands it) instead of dropping it to <body>. [D-03]
  // Now also reachable via the additive `header` slot `:closeDrill` param —
  // unlike its two existing callers (which already guard on $props.disabled
  // before calling), a consumer-invoked slot callback has no such guard, so a
  // whole-control disabled check is added here (a no-op for both existing call
  // sites, which never call this while disabled).
  function exitToDaysView() {
    if (props.disabled) return;
    setViewMode('days');
    // $data.viewIso is unchanged here (no fresher value to pass), but the
    // days-view transition IS fresh in THIS call — say so explicitly
    // (staleness fix, see seedActiveDay's own doc comment).
    seedActiveDay(undefined, true);
  }

  // ---- day grid r-keynav wiring (77-08 retrofit) --------------------------
  // @keynav-commit fires with the day grid's own active index already resolved
  // by the primitive — read via the handler's OWN `i` parameter (mirrors
  // onMonthCommit/onYearCommit, 77-07 Task 3's real-DOM finding: re-reading
  // $data.activeDay here would see a stale pre-click value on React's async
  // setState). commitValue/commitRange already gate on dayEnabled(iso), so
  // committing a disabled cell stays a safe no-op even though the primitive
  // itself never commits one to begin with (grid mode's inert-by-default
  // contract, SPEC §5).
  const onDayCommit = useCallback((i: any) => {
    const cell = allDayCells()[i];
    if (cell) onDaySelect(cell.iso);
  }, [allDayCells, onDaySelect]);
  // @keynav-page — the retrofit's behavioural heart (SPEC §4.1, §10). The
  // primitive NEVER moves $data.activeDay itself on a page/boundary event; it
  // only reports the attempted move so the author (who owns which month is
  // rendered) can advance the dataset and set the landing index, both in the
  // SAME tick — the focus-after-render seam plan 77-06 proved on all six
  // targets before this retrofit depended on it.
  //
  // 'boundary' (an arrow ran off either end of the WHOLE flat day source, in
  // EITHER axis — a row-end AND a column-end boundary land identically, SPEC
  // §4): swing the view by exactly one month in the event's direction and land
  // at the OPPOSITE edge of the freshly rendered set — forward lands at the
  // first cell (index 0), backward at the last.
  //
  // 'pageup'/'pagedown': swing the view by one month and land on the SAME FLAT
  // INDEX (SPEC §4.1's sameWeekdayIndex illustration, mirroring KeynavGridDemo's
  // own onPage) — every panel is unconditionally 42 cells (6 rows x 7 columns)
  // and numberOfMonths never changes mid-page, so preserving the flat index
  // preserves BOTH the row and the weekday column. [77-09 fix, bug report
  // 2026-08-05] The prior implementation only preserved the COLUMN
  // (`activeDay % 7`), which silently discarded the row and always re-landed
  // on row 0 — visibly "jumping to the top row" on every PageUp/PageDown press
  // whenever the active cell wasn't already there.
  //
  // Reuses addMonths — the family's existing month arithmetic (T-77-08-03: one
  // month per event, no unbounded loop) — no new date math.
  //
  // `allDayCells()` is called AFTER the $data.viewIso write, but ONLY its
  // `.length` is read below — SAFE despite React's async setState (unlike
  // onMonthCommit/onYearCommit's `i`-parameter fix, 77-07 Task 3): every panel
  // is unconditionally 42 cells, so the flat array's length is `numberOfMonths
  // * 42` regardless of WHICH month $data.viewIso currently names — nothing
  // here depends on the just-written value actually having landed yet.
  //
  // [77-09 fix] EVERY write below settles through the ROVING_DAY_NONE sentinel
  // first, then the real landing index one animation frame later — the SAME
  // safety net seedActiveDay uses (see its own doc comment) and for the SAME
  // reason: a page/boundary event always tears down and recreates the day-cell
  // DOM nodes (fresh content-based :key per week/panel for the new month) even
  // when the computed landing INDEX happens to repeat the value activeDay
  // already held (which the fixed 'pageup'/'pagedown' math above now does by
  // design whenever the grid shape is unchanged). When that happens, the
  // per-target controller's own "only re-apply focus on a genuine active-value
  // change" guard sees no change at all and never re-queries the (brand new)
  // DOM for the landing cell — silently dropping focus. This was the exact
  // mechanism behind the reported "second PageUp press loses focus entirely"
  // symptom: the first press (previously) computed a DIFFERENT column-only
  // value than the starting index, so it visibly (if wrongly) refocused; the
  // second press then computed the SAME value as the first, hit the
  // no-genuine-change guard, and focus vanished. Settling through the sentinel
  // forces a genuine reactive change on every press, regardless of whether the
  // computed index happens to repeat.
  //
  // [77-09 fix, real-DOM regression] The landing-index math below reads
  // `currentActiveDay()` (the sentinel-safe resolver), NOT `$data.activeDay`
  // directly. `activeDay` transiently sits at ROVING_DAY_NONE between the
  // synchronous settle-write below and the rAF-deferred real-value write one
  // frame later — a real hazard under RAPID REPEATED presses (PageDown held
  // down; OS key-repeat comfortably outpaces a single animation frame): a
  // second onDayPage call landing inside that transient window would read the
  // SENTINEL as "the current position," permanently corrupting every
  // subsequent landing index to -1 and dropping focus forever (confirmed via
  // real-DOM testing — a fast repeated-PageDown sequence never recovered
  // within a 10s poll). `currentActiveDay()` falls back to `activeDayReal`
  // (kept synchronously current below) ONLY during that window, and is
  // `$data.activeDay` itself the rest of the time — which is what keeps an
  // ORDINARY move (Control+Home, arrows, Home/End — none of which ever write
  // the sentinel) correctly visible here too, rather than a stale shadow from
  // whenever the day grid was last paged.
  const onDayPage = useCallback((detail: any) => {
    setViewIso(addMonths(viewMonthGrid(), detail.direction));
    const nextCells = allDayCells();
    const current = currentActiveDay();
    const next = detail.reason === 'boundary' ? detail.direction > 0 ? 0 : nextCells.length - 1 : Math.min(current, nextCells.length - 1);
    if (next === current) {
      setActiveDay(ROVING_DAY_NONE);
    }
    setActiveDayReal(next);
    requestAnimationFrame(() => {
      setActiveDay(next);
    });
  }, [allDayCells, currentActiveDay, viewMonthGrid]);
  // The native `disabled` attribute is gone from the month/year drill buttons
  // (D-3 — focusable-but-inert, matching the day cells), so selectMonth/
  // selectYear must gate on the cell's own `disabled` flag themselves — today the
  // native attribute was the only guard.
  function monthEnabled(iso: any) {
    const cell = monthList().months.find((m: any) => m.iso === iso);
    return !cell || !cell.disabled;
  }
  function yearEnabled(iso: any) {
    const cell = yearGrid().years.find((y: any) => y.iso === iso);
    return !cell || !cell.disabled;
  }

  // ---- keyboard (77-08: author-owned Space/Escape only, F5) --------------
  // Every other key (arrows, Home/End, PageUp/PageDown, Ctrl+Home/End, Enter)
  // falls through untouched to the primitive's own root-level grid delegation
  // (the day grid's r-keynav wrapper, template below) — the hand-rolled day
  // keydown switch and its moveFocus helper are DELETED (77-08's whole point).
  const onDayCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      onDaySelect(iso);
    } else if (key === 'Escape') {
      // In range mode, cancel an in-progress (anchor-set) selection.
      if (props.selectionMode === 'range') {
        const r = readRange();
        if (r.start !== '' && r.end === '') {
          e.preventDefault();
          setValue({
            start: '',
            end: ''
          });
          setHoverIso('');
          _rozieProp_onChange && _rozieProp_onChange({
            value: {
              start: '',
              end: ''
            }
          });
        }
      }
    }
  }, [_rozieProp_onChange, onDaySelect, props.disabled, props.selectionMode, readRange, setValue]);
  // ---- drill grid (months / years 12-cell r-keynav roots, 77-07) ---------
  // Both drills are 3-column grids — the VERIFIED shared column count (a hand-
  // rolled constant AND the CSS custom property default were both already 3;
  // see the drill-grid CSS comment below for the CSS-custom-property caveat).
  // The primitive's key map (arrows, Home/End, Ctrl+Home/End, Enter) replaces
  // the two deleted hand-rolled per-cell keydown switches entirely; only Space
  // and Escape stay author-owned (P71 §4 boundary — the primitive
  // does not cover either).
  // @keynav-commit fires with the panel's own active index already resolved by
  // the primitive — read via the handler's OWN `i` parameter (the SAME index
  // the primitive just wrote through `r-keynav:tabindex`'s setter), NOT via
  // $data.activeMonth/$data.activeYear: on a POINTER commit (click on a
  // non-active cell) the primitive calls setActive(i) THEN commit(i) in the
  // same synchronous pass, and on React specifically `setState` is
  // async — a handler that re-reads $data.activeMonth here would see the
  // PRE-click value, committing the WRONG cell (found via 77-07 Task 3's
  // real-DOM run). `i` is always correct regardless of target/timing.
  // selectMonth/selectYear already gate on the cell's own `disabled` flag (the
  // pointer-path guard), so committing a disabled cell is a safe no-op even
  // though the primitive itself never commits one to begin with (grid mode's
  // inert-by-default contract, SPEC §5).
  const onMonthCommit = useCallback((i: any) => {
    const cell = monthList().months[i];
    if (cell) selectMonth(cell.iso);
  }, [monthList, selectMonth]);
  const onYearCommit = useCallback((i: any) => {
    const cell = yearGrid().years[i];
    if (cell) selectYear(cell.iso);
  }, [selectYear, yearGrid]);
  // The drills have no pageable dataset (12 fixed cells, never paged) — SPEC
  // §4.1's "if the author ignores the event, boundary/page keys are safe
  // no-ops" clamp-equivalent default. Written explicitly (not omitted) so a
  // reader sees this is deliberate, not a missing handler.
  const onDrillPage = useCallback(() => {}, []);
  // Author-owned Space/Escape only — every other key falls through untouched
  // to the primitive's own root-level grid delegation (the markup below).
  const onMonthCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectMonth(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }, [exitToDaysView, props.disabled, selectMonth]);
  const onYearCellKeydown = useCallback((iso: any, e: any) => {
    if (props.disabled) return;
    const key = e ? e.key : '';
    if (key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      selectYear(iso);
    } else if (key === 'Escape') {
      e.preventDefault();
      exitToDaysView();
    }
  }, [exitToDaysView, props.disabled, selectYear]);
  // ---- presets (range mode) ----------------------------------------------
  // Resolve every consumer preset's `range` (literal or () => RangeValue thunk)
  // into an ordered { label, range } for the rail + the #presets slot. A PLAIN
  // function (uniform x6), called fresh each render.
  function resolvedPresets() {
    return props.presetRanges.map((p: any) => ({
      label: p.label,
      range: rangeFromPreset(p)
    }));
  }

  // Whether a preset rail should render. A BOOLEAN-returning helper, NOT a bare
  // `resolvedPresets().length` r-if: on the JSX targets `r-if` lowers to
  // `cond && <div>`, and a numeric `0` length leaks a literal "0" text node into
  // the DOM (React/Solid render falsy numbers). Even `length > 0` inline is
  // stripped back to `length` by the production minifier in the boolean-`&&`
  // context — routing through a named boolean helper keeps the guard a true
  // boolean through minification (the React falsy-number-in-r-if discipline).
  function hasPresets(): boolean {
    return resolvedPresets().length > 0;
  }

  // Apply a preset = a complete range: write the (ordered) value + clear any
  // in-progress preview + emit change AND rangeComplete. [D-02 discretion,
  // DELIBERATELY NOT range-span-validated] Unlike commitRange, this does NOT
  // consult rangeSpanBlocked: a preset's `range` is a consumer-supplied
  // literal/thunk whose date math the consumer already owns (see the
  // `presetRanges` prop docs), and silently refusing to honor a preset the
  // consumer explicitly configured would be worse than applying it as
  // supplied. Filed as a new explicit re-defer (quick task 260807-6p8 SUMMARY).
  const { onRangeComplete: _rozieProp_onRangeComplete } = props;
    const applyPreset = useCallback((range: any) => {
    if (props.disabled) return;
    const next = normalizeRange(range);
    setValue(next);
    setHoverIso('');
    _rozieProp_onChange && _rozieProp_onChange({
      value: next
    });
    _rozieProp_onRangeComplete && _rozieProp_onRangeComplete({
      value: next
    });
  }, [_rozieProp_onChange, _rozieProp_onRangeComplete, props.disabled, setValue]);
  // Whether a preset matches the current value (ordered endpoint equality), used
  // for aria-pressed / is-active. An empty range never reads active.
  function isPresetActive(range: any) {
    const p = normalizeRange(range);
    if (p.start === '') return false;
    const r = readRange();
    return r.start === p.start && r.end === p.end;
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // Seed the view month from value / today on mount, then seed the day grid's
  // active-index model (77-08) — the SAME resolveRovingDayIndex chain the tab
  // stop uses, so mount, keyboard Tab and this handle can never disagree. The
  // fresh viewIso is passed directly (staleness fix, see seedActiveDay's own
  // doc comment); seedActiveDay() defers its own write internally, so this
  // call is a plain, synchronous fire-and-forget like every other
  // seedActiveDay() call site.
  // focus() — resolve + set $data.activeDay through the SAME roving-tabindex
  // chain the tab stop uses (seedActiveDay/resolveRovingDayIndex), so this
  // handle can never disagree with keyboard Tab — multi-month aware. It does
  // NOT query the DOM itself; the r-keynav grid controller lands DOM focus once
  // the value changes (77-08). DELIBERATELY overrides HTMLElement.focus on Lit
  // (ROZ137 warn, accepted).
  function focus() {
    seedActiveDay();
  }

  // goToToday() — swing the view to the current month (no selection change).
  function goToToday() {
    if (props.disabled) return;
    const nextViewIso = todayIso();
    setViewIso(nextViewIso);
    // Fresh viewIso passed directly (staleness fix, see seedActiveDay's own
    // doc comment); $data.viewMode is unchanged here.
    seedActiveDay(nextViewIso);
  }

  // ---- footer moves (Today / Clear row) ----------------------------------
  // selectToday() — the footer "Today" action. In single mode commit today
  // through the value funnel (write + emit change, gated exactly like a day
  // click); in range mode just swing the view to the current month (goToToday),
  // never mutating the value. Clear reuses the existing clear() funnel unchanged.
  const selectToday = useCallback(() => {
    if (props.disabled) return;
    if (props.selectionMode === 'range') {
      goToToday();
    } else {
      commitValue(todayIso());
    }
  }, [commitValue, goToToday, props.disabled, props.selectionMode, todayIso]);
  // Named boolean guard for the footer r-if (never a bare truthiness in the r-if
  // so the JSX targets emit a real boolean and leak no falsy value).
  function showsFooter(): boolean {
    return !!props.showFooter;
  }

  // clear() — deselect, writing the mode-appropriate empty ('' single /
  // { start:'', end:'' } range) + emit change.
  const clear = useCallback(() => {
    if (props.disabled) return;
    if (props.selectionMode === 'range') {
      const r = readRange();
      if (r.start === '' && r.end === '') return;
      setValue({
        start: '',
        end: ''
      });
      setHoverIso('');
      _rozieProp_onChange && _rozieProp_onChange({
        value: {
          start: '',
          end: ''
        }
      });
    } else {
      if (selected() === '') return;
      setValue('');
      _rozieProp_onChange && _rozieProp_onChange({
        value: ''
      });
    }
  }, [_rozieProp_onChange, props.disabled, props.selectionMode, readRange, selected, setValue]);

  const _seedActiveDayRef = useRef(seedActiveDay);
  _seedActiveDayRef.current = seedActiveDay;
  const _viewMonthGridRef = useRef(viewMonthGrid);
  _viewMonthGridRef.current = viewMonthGrid;
  useEffect(() => {
    const nextViewIso = _viewMonthGridRef.current();
    setViewIso(nextViewIso);
    _seedActiveDayRef.current(nextViewIso);
  }, []);

  const __rozieKeynavRootRef = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId = useId();
  useKeynav(__rozieKeynavRootRef, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (allDayCells()).map((day) => ({ disabled: day.disabled })),
    getActive: () => activeDay,
    setActive: setActiveDay,
    onCommit: (i) => { onDayCommit(i); },
    gridColumns: () => 7,
    onPage: (detail) => { onDayPage(detail); },
    getFocusScope: () => [root.current],
  });
  const __rozieKeynavRootRef1 = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId1 = useId();
  useKeynav(__rozieKeynavRootRef1, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (monthList().months).map((cell) => ({ label: cell.label, disabled: cell.disabled })),
    getActive: () => activeMonth,
    setActive: setActiveMonth,
    onCommit: (i) => { onMonthCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
    getFocusScope: () => [root.current],
  });
  const __rozieKeynavRootRef2 = useRef<HTMLDivElement | null>(null);
  const __rozieKeynavGroupId2 = useId();
  useKeynav(__rozieKeynavRootRef2, {
    config: { focusModel: 'tabindex', orientation: 'vertical', loop: false, typeahead: false, skipDisabled: false },
    getSource: () => (yearGrid().years).map((cell) => ({ label: String(cell.year), disabled: cell.disabled })),
    getActive: () => activeYear,
    setActive: setActiveYear,
    onCommit: (i) => { onYearCommit(i); },
    gridColumns: () => 3,
    onPage: (detail) => { onDrillPage(); },
    getFocusScope: () => [root.current],
  });

  const _rozieExposeRef = useRef({ focus, goToToday, clear });
  _rozieExposeRef.current = { focus, goToToday, clear };
  useImperativeHandle(ref, () => ({ focus: (...args: Parameters<typeof focus>): ReturnType<typeof focus> => _rozieExposeRef.current.focus(...args), goToToday: (...args: Parameters<typeof goToToday>): ReturnType<typeof goToToday> => _rozieExposeRef.current.goToToday(...args), clear: (...args: Parameters<typeof clear>): ReturnType<typeof clear> => _rozieExposeRef.current.clear(...args) }), []);

  return (
    <>
    <div ref={root} role="group" aria-label={rozieAttr(labelFor('root'))} aria-disabled={!!props.disabled} {...attrs} className={clsx(clsx("rozie-datepicker", { "rozie-datepicker--disabled": props.disabled, "rozie-datepicker--multi": props.numberOfMonths > 1 }), (attrs.className as string | undefined))} data-rozie-s-6800c7a2="">
      
      {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!props.disabled, openMonths: enterMonthsView, openYears: enterYearsView, closeDrill: exitToDaysView, viewMode }) : <div className={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label={rozieAttr(labelFor('previousMonth'))} onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          {(props.monthYearNav) ? <button type="button" className={"rozie-datepicker-heading rozie-datepicker-heading-button"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label={rozieAttr(labelFor('changeMonthYear'))} aria-live="polite" onClick={enterMonthsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</button> : <span className={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>}<button type="button" className={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label={rozieAttr(labelFor('nextMonth'))} onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div className={"rozie-datepicker-grids"} ref={__rozieKeynavRootRef} data-rozie-s-6800c7a2="">
        {daysGrids().map((g, gi) => <div key={g.year + '-' + g.month} className={"rozie-datepicker-grid"} role="grid" aria-label={rozieAttr(panelHeading(gi))} onMouseLeave={($event) => { setHoverIso(''); }} data-rozie-s-6800c7a2="">
          <div className={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
            {weekdays().map((wd, wi) => <span key={wi} className={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(weekdaysLong()[wi])} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>)}
          </div>

          {g.weeks.map((week, wk) => <div key={week[0].iso} className={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
            
            {week.map((day, dc) => <span key={day.iso} className={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2="">
              <button type="button" className={clsx("rozie-datepicker-day", { "is-selected": day.selected, "is-today": day.today, "is-outside": !day.inMonth, "is-in-range": day.inRange, "is-range-start": day.rangeStart, "is-range-end": day.rangeEnd, "is-in-preview": day.inPreview })} data-day={rozieAttr(day.iso)} disabled={!!props.disabled} aria-disabled={!!day.disabled} aria-label={rozieAttr(dayAria(day.iso))} aria-current={rozieAttr(day.today ? 'date' : undefined)} onMouseEnter={($event) => { onDayHover(day.iso); }} onFocus={($event) => { onDayHover(day.iso); }} onKeyDown={($event) => { onDayCellKeydown(day.iso, $event); }} id={`${__rozieKeynavGroupId}-item-${gi * 42 + wk * 7 + dc}`} data-rozie-keynav-item={gi * 42 + wk * 7 + dc} data-rozie-keynav-active={activeDay === gi * 42 + wk * 7 + dc ? '' : undefined} tabIndex={activeDay === gi * 42 + wk * 7 + dc ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
            </span>)}
          </div>)}
        </div>)}
      </div>

      
      {!!(showsMonthsView()) && <div className={"rozie-datepicker-months"} data-rozie-s-6800c7a2="">
        <div className={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-drill-label"} disabled={!!props.disabled} aria-disabled={!!props.disabled} aria-label={rozieAttr(labelFor('changeYear'))} onClick={enterYearsView} data-rozie-s-6800c7a2="">{rozieDisplay(monthList().year)}</button>
        </div>
        <div className={"rozie-datepicker-drill-grid"} role="grid" aria-label={rozieAttr(labelFor('chooseMonth'))} ref={__rozieKeynavRootRef1} data-rozie-s-6800c7a2="">
          {monthList().months.map((cell, __rozieKeynavIndex) => <button key={cell.iso} type="button" className={clsx("rozie-datepicker-month", { "is-selected": cell.selected, "is-current": cell.current })} role="gridcell" data-month={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} onClick={($event) => { selectMonth(cell.iso); }} onKeyDown={($event) => { onMonthCellKeydown(cell.iso, $event); }} id={`${__rozieKeynavGroupId1}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={activeMonth === __rozieKeynavIndex ? '' : undefined} tabIndex={activeMonth === __rozieKeynavIndex ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell.label)}</button>)}
        </div>
      </div>}{!!(showsYearsView()) && <div className={"rozie-datepicker-years"} data-rozie-s-6800c7a2="">
        <div className={"rozie-datepicker-drill-header"} data-rozie-s-6800c7a2="">
          <span className={"rozie-datepicker-drill-label"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(yearRangeLabel())}</span>
        </div>
        <div className={"rozie-datepicker-drill-grid"} role="grid" aria-label={rozieAttr(labelFor('chooseYear'))} ref={__rozieKeynavRootRef2} data-rozie-s-6800c7a2="">
          {yearGrid().years.map((cell, __rozieKeynavIndex) => <button key={cell.iso} type="button" className={clsx("rozie-datepicker-year", { "is-selected": cell.selected, "is-current": cell.current })} role="gridcell" data-year={rozieAttr(cell.iso)} aria-disabled={!!cell.disabled} aria-selected={!!cell.selected} onClick={($event) => { selectYear(cell.iso); }} onKeyDown={($event) => { onYearCellKeydown(cell.iso, $event); }} id={`${__rozieKeynavGroupId2}-item-${__rozieKeynavIndex}`} data-rozie-keynav-item={__rozieKeynavIndex} data-rozie-keynav-active={activeYear === __rozieKeynavIndex ? '' : undefined} tabIndex={activeYear === __rozieKeynavIndex ? 0 : -1} data-rozie-s-6800c7a2="">{rozieDisplay(cell.year)}</button>)}
        </div>
      </div>}{(props.renderFooter ?? props.slots?.['footer']) ? ((props.renderFooter ?? props.slots?.['footer']) as Function)({ today: selectToday, clear, todayIso: todayIso() }) : !!(showsFooter()) && <div className={"rozie-datepicker-footer"} data-rozie-s-6800c7a2="">
          <button type="button" className={"rozie-datepicker-footer-btn rozie-datepicker-today"} disabled={!!props.disabled} aria-disabled={!!props.disabled} onClick={selectToday} data-rozie-s-6800c7a2="">{rozieDisplay(labelFor('today'))}</button>
          <button type="button" className={"rozie-datepicker-footer-btn rozie-datepicker-clear"} disabled={!!props.disabled} aria-disabled={!!props.disabled} onClick={clear} data-rozie-s-6800c7a2="">{rozieDisplay(labelFor('clear'))}</button>
        </div>}

      
      {(props.renderPresets ?? props.slots?.['presets']) ? ((props.renderPresets ?? props.slots?.['presets']) as Function)({ presets: resolvedPresets(), apply: applyPreset }) : !!(hasPresets()) && <div className={"rozie-datepicker-presets"} role="group" aria-label={rozieAttr(labelFor('presets'))} data-rozie-s-6800c7a2="">
          {resolvedPresets().map((p) => <button key={p.label} type="button" className={clsx("rozie-datepicker-preset", { "is-active": isPresetActive(p.range) })} aria-pressed={!!isPresetActive(p.range)} disabled={!!props.disabled} onClick={($event) => { applyPreset(p.range); }} data-rozie-s-6800c7a2="">{rozieDisplay(p.label)}</button>)}
        </div>}
    </div>
    </>
  );
});
export default DatePicker;
