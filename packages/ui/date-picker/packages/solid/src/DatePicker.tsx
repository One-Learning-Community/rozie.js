import type { JSX } from 'solid-js';
import { For, Show, createSignal, mergeProps, onMount, splitProps } from 'solid-js';
import { __rozieInjectStyle, createControllableSignal, rozieAttr, rozieClass, rozieDisplay } from '@rozie/runtime-solid';
import { addDays, addMonths, buildMonthGrid, isDayDisabled, isInRange, isIsoDate, monthLabel, normalizeRange, rangeFromPreset, resolveViewIso, toIso, weekdayLabels } from './internal/buildMonthGrid';

// ---- today (deterministic per-render read) -----------------------------
// Today's ISO, computed from the local clock. A plain function so each call is
// fresh (a date picker open across midnight should follow the wall clock).

__rozieInjectStyle('DatePicker-6800c7a2', `.rozie-datepicker[data-rozie-s-6800c7a2] {
  display: inline-block;
  font: var(--rozie-datepicker-font, inherit);
  color: var(--rozie-datepicker-fg, #1a1a1a);
  background: var(--rozie-datepicker-bg, #fff);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-radius, 10px);
  padding: var(--rozie-datepicker-padding, 0.75rem);
}
.rozie-datepicker-header[data-rozie-s-6800c7a2] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--rozie-datepicker-gap, 0.25rem);
  margin-bottom: var(--rozie-datepicker-header-gap, 0.5rem);
}
.rozie-datepicker-heading[data-rozie-s-6800c7a2] {
  font-weight: var(--rozie-datepicker-heading-weight, 600);
  font-size: var(--rozie-datepicker-heading-size, 0.95rem);
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2] {
  box-sizing: border-box;
  width: var(--rozie-datepicker-nav-size, 2rem);
  height: var(--rozie-datepicker-nav-size, 2rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  color: inherit;
  background: var(--rozie-datepicker-nav-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-nav-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2]:hover {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-nav[data-rozie-s-6800c7a2]:focus-visible,
.rozie-datepicker-day[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-grid[data-rozie-s-6800c7a2] {
  display: grid;
  gap: var(--rozie-datepicker-cell-gap, 0.125rem);
}
.rozie-datepicker-weekdays[data-rozie-s-6800c7a2],
.rozie-datepicker-week[data-rozie-s-6800c7a2] {
  display: grid;
  grid-template-columns: repeat(7, var(--rozie-datepicker-cell-size, 2.25rem));
  gap: var(--rozie-datepicker-cell-gap, 0.125rem);
}
.rozie-datepicker-weekday[data-rozie-s-6800c7a2] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: var(--rozie-datepicker-weekday-height, 1.75rem);
  font-size: var(--rozie-datepicker-weekday-size, 0.72rem);
  font-weight: var(--rozie-datepicker-weekday-weight, 600);
  color: var(--rozie-datepicker-weekday-fg, rgba(0, 0, 0, 0.5));
  text-transform: uppercase;
  user-select: none;
}
.rozie-datepicker-cell[data-rozie-s-6800c7a2] {
  display: inline-flex;
}
.rozie-datepicker-day[data-rozie-s-6800c7a2] {
  box-sizing: border-box;
  width: var(--rozie-datepicker-cell-size, 2.25rem);
  height: var(--rozie-datepicker-cell-size, 2.25rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font: inherit;
  font-size: var(--rozie-datepicker-day-size, 0.85rem);
  color: inherit;
  background: var(--rozie-datepicker-day-bg, transparent);
  border: var(--rozie-datepicker-day-border-width, 1px) solid transparent;
  border-radius: var(--rozie-datepicker-day-radius, 6px);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-day[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-day.is-outside[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-outside-fg, rgba(0, 0, 0, 0.35));
}
.rozie-datepicker-day.is-today[data-rozie-s-6800c7a2]:not(.is-selected[data-rozie-s-6800c7a2]) {
  border-color: var(--rozie-datepicker-today-border, var(--rozie-datepicker-accent, #0066cc));
}
.rozie-datepicker-day.is-selected[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-day.is-in-range[data-rozie-s-6800c7a2] {
  background: var(--rozie-datepicker-range-bg, rgba(0, 102, 204, 0.14));
  border-radius: 0;
}
.rozie-datepicker-day.is-in-preview[data-rozie-s-6800c7a2] {
  background: var(--rozie-datepicker-preview-bg, rgba(0, 102, 204, 0.08));
  border-radius: 0;
}
.rozie-datepicker-day.is-range-start[data-rozie-s-6800c7a2],
.rozie-datepicker-day.is-range-end[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
  border-color: var(--rozie-datepicker-range-endpoint-bg, var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc)));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-day.is-range-start[data-rozie-s-6800c7a2] {
  border-top-left-radius: var(--rozie-datepicker-day-radius, 6px);
  border-bottom-left-radius: var(--rozie-datepicker-day-radius, 6px);
}
.rozie-datepicker-day.is-range-end[data-rozie-s-6800c7a2] {
  border-top-right-radius: var(--rozie-datepicker-day-radius, 6px);
  border-bottom-right-radius: var(--rozie-datepicker-day-radius, 6px);
}
.rozie-datepicker-day[data-rozie-s-6800c7a2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}
.rozie-datepicker--disabled[data-rozie-s-6800c7a2] {
  opacity: var(--rozie-datepicker-disabled-opacity, 0.55);
  pointer-events: none;
}
.rozie-datepicker-presets[data-rozie-s-6800c7a2] {
  display: flex;
  flex-wrap: wrap;
  gap: var(--rozie-datepicker-presets-gap, 0.25rem);
  margin-top: var(--rozie-datepicker-presets-gap-top, 0.5rem);
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2] {
  font: inherit;
  font-size: var(--rozie-datepicker-preset-size, 0.78rem);
  color: var(--rozie-datepicker-preset-fg, inherit);
  background: var(--rozie-datepicker-preset-bg, transparent);
  border: var(--rozie-datepicker-border-width, 1px) solid var(--rozie-datepicker-border, rgba(0, 0, 0, 0.18));
  border-radius: var(--rozie-datepicker-preset-radius, 999px);
  padding: var(--rozie-datepicker-preset-padding, 0.2rem 0.6rem);
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:hover:not([data-rozie-s-6800c7a2]:disabled) {
  background: var(--rozie-datepicker-hover-bg, rgba(0, 0, 0, 0.05));
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:focus-visible {
  outline: var(--rozie-datepicker-ring-width, 2px) solid var(--rozie-datepicker-ring, var(--rozie-datepicker-accent, #0066cc));
  outline-offset: var(--rozie-datepicker-ring-offset, 1px);
}
.rozie-datepicker-preset.is-active[data-rozie-s-6800c7a2] {
  color: var(--rozie-datepicker-selected-fg, #fff);
  background: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  border-color: var(--rozie-datepicker-selected-bg, var(--rozie-datepicker-accent, #0066cc));
  font-weight: var(--rozie-datepicker-selected-weight, 600);
}
.rozie-datepicker-preset[data-rozie-s-6800c7a2]:disabled {
  cursor: not-allowed;
  opacity: var(--rozie-datepicker-disabled-opacity, 0.4);
  pointer-events: none;
}`);

interface HeaderSlotCtx { label: any; prev: any; next: any; disabled: any; }

interface PresetsSlotCtx { presets: any; apply: any; }

interface DatePickerProps {
  /**
   * The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`.
   * @example
   * <DatePicker r-model:value="date" :min="'2026-01-01'" @change="onPick" />
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
   * Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`.
   */
  presetRanges?: any[];
  onChange?: (...args: unknown[]) => void;
  onRangeComplete?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  presetsSlot?: (ctx: PresetsSlotCtx) => JSX.Element;
  slots?: Record<string, (ctx: any) => JSX.Element>;
  ref?: (h: DatePickerHandle) => void;
}

export interface DatePickerHandle {
  focus: (...args: any[]) => any;
  goToToday: (...args: any[]) => any;
  clear: (...args: any[]) => any;
}

export default function DatePicker(_props: DatePickerProps): JSX.Element {
  const _merged = mergeProps({ selectionMode: 'single', min: null, max: null, disabledDates: (() => [])(), weekStartsOn: 0, disabled: false, locale: 'en-US', presetRanges: (() => [])() }, _props);
  const [local, attrs] = splitProps(_merged, ['value', 'selectionMode', 'min', 'max', 'disabledDates', 'weekStartsOn', 'disabled', 'locale', 'presetRanges', 'ref']);
  onMount(() => { local.ref?.({ focus, goToToday, clear }); });

  const [value, setValue] = createControllableSignal<string | Record<string, any>>(_props as unknown as Record<string, unknown>, 'value', '');
  const [viewIso, setViewIso] = createSignal('');
  const [hoverIso, setHoverIso] = createSignal('');
  onMount(() => {
    setViewIso(viewMonthGrid());
  });
  let rootRef: HTMLElement | null = null;

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
  // CAPTURE the polymorphic value into a local const BEFORE the typeof guard so
  // the narrowing flows uniformly on all six targets — on Solid `$props.value`
  // lowers to the accessor CALL `value()`, and TS does NOT narrow across two
  // separate `value()` calls (`typeof value() === 'string' ? value()` keeps the
  // union → TS2322 where it feeds the string grid params). A local const narrows
  // identically on Solid (accessor call), React (variable), Vue/Lit (property).
  function selected(): string {
    const v = value();
    return typeof v === 'string' ? v : '';
  }

  // The RANGE normalization funnel (mirrors selected()): coerce the polymorphic
  // `value` into a canonical ordered { start, end }. ALL range logic reads through
  // this — never $props.value directly — so the polymorph is funneled in one place.
  function readRange() {
    return normalizeRange(value());
  }

  // The resolved month anchor: the local view state, falling back to the selected
  // value, then today. In range mode `selected()` is '' (the value is an object),
  // so fall back to the range's `start` endpoint — a DatePicker opened with a
  // pre-selected range must show that range's month, mirroring how single mode
  // pins the view to its selected ISO (else range mode always opens on today).
  function viewAnchor(): string {
    const s = selected();
    if (s !== '') return s;
    if (local.selectionMode === 'range') return readRange().start;
    return '';
  }
  function viewMonthGrid() {
    return resolveViewIso({
      viewIso: viewIso(),
      value: viewAnchor(),
      today: todayIso()
    });
  }

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
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled,
      selection: local.selectionMode === 'range' ? readRange() : undefined,
      previewEnd: local.selectionMode === 'range' ? hoverIso() : undefined
    });
  }

  // Roving-tabindex value for a day cell: the selected day (or today, when nothing
  // is selected) is the single tab stop (0), the rest are -1. The return type is
  // annotated `number | undefined` ON PURPOSE — the React emitter wraps every
  // numeric `:attr` binding in `(expr) ?? undefined`, and a PROVABLY non-null
  // value (a bare `0`/`-1` ternary) trips TS2869 "right operand of ?? is
  // unreachable". Routing tabindex through this nullable-typed helper keeps the
  // `?? undefined` reachable (the pagination `tabIndexFor` precedent).
  function dayTabIndex(day: any): number | undefined {
    return day.selected || selected() === '' && day.today ? 0 : -1;
  }

  // The localized month-year heading. NAMED `monthHeading`, NOT `label` — a bare
  // `label` helper becomes a class field on the Lit custom element and a `title`
  // would collide with the inherited HTMLElement.title; `monthHeading` is clear.
  function monthHeading() {
    return monthLabel(viewMonthGrid(), local.locale);
  }
  // The seven weekday header labels, rotated by weekStartsOn.
  function weekdays() {
    return weekdayLabels(local.weekStartsOn, local.locale);
  }

  // Whether a given ISO can be selected (the template gates clicks on it too).
  function dayEnabled(iso: any) {
    return !isDayDisabled(iso, {
      viewIso: viewMonthGrid(),
      value: selected(),
      today: todayIso(),
      min: local.min,
      max: local.max,
      disabledDates: local.disabledDates,
      weekStartsOn: local.weekStartsOn,
      disabled: local.disabled
    });
  }

  // ---- write funnel (single $emit site) ----------------------------------
  // Select an ISO date: write the model + emit change. NOT named `setValue`
  // (collides with React's generated `value` model setter → ROZ524). A no-op
  // (re-selecting the same date) still re-emits intentionally? No — guard it.
  function commitValue(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    if (iso === selected()) return;
    setValue(iso);
    setViewIso(iso);
    _props.onChange?.({
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
  function commitRange(iso: any) {
    if (local.disabled) return;
    if (!isIsoDate(iso)) return;
    if (!dayEnabled(iso)) return;
    const r = readRange();
    if (r.start === '' || r.end !== '') {
      // No in-progress selection, or a completed one → (re)start the anchor.
      setValue({
        start: iso,
        end: ''
      });
      setViewIso(iso);
      _props.onChange?.({
        value: {
          start: iso,
          end: ''
        }
      });
    } else {
      // Anchor set, end empty → complete the range (ordered by normalizeRange).
      const next = normalizeRange({
        start: r.start,
        end: iso
      });
      setValue(next);
      setViewIso(iso);
      setHoverIso('');
      _props.onChange?.({
        value: next
      });
      _props.onRangeComplete?.({
        value: next
      });
    }
  }

  // Hover preview: only meaningful in range mode while a range is in progress
  // (anchor set, end empty). Records the hovered ISO so the grid lights the
  // direction-agnostic preview band. Otherwise a no-op.
  function onDayHover(iso: any) {
    if (local.selectionMode !== 'range') return;
    const r = readRange();
    if (r.start !== '' && r.end === '') setHoverIso(iso);
  }

  // Day-select dispatch: route a click / Enter / Space through the mode-appropriate
  // funnel (range → commitRange, single → commitValue).
  function onDaySelect(iso: any) {
    if (local.selectionMode === 'range') commitRange(iso);else commitValue(iso);
  }

  // ---- month navigation --------------------------------------------------
  function goToMonth(delta: any) {
    if (local.disabled) return;
    setViewIso(addMonths(viewMonthGrid(), delta));
  }
  function goPrevMonth() {
    return goToMonth(-1);
  }
  function goNextMonth() {
    return goToMonth(1);
  }

  // ---- focus choreography (container ref, post-mount only) ---------------
  // Read $refs.root only here / in handlers / in $expose verbs (all post-mount →
  // ROZ123-safe). querySelectorAll reaches the day cells inside Lit's shadow root
  // too. Focus a day by its ISO; the [data-day] attribute carries the iso.
  function dayCells() {
    const root = rootRef;
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-day]')) as HTMLElement[];
  }
  function focusDayIso(iso: any) {
    const cells = dayCells();
    for (let i = 0; i < cells.length; i++) {
      if (cells[i].getAttribute('data-day') === iso) {
        cells[i].focus();
        return;
      }
    }
  }

  // Move the roving focus by `days`, crossing into an adjacent month when the
  // target leaves the displayed grid. Skips nothing — disabled days are still
  // focusable (standard grid pattern) but not selectable.
  function moveFocus(fromIso: any, days: any) {
    if (local.disabled) return;
    const next = addDays(fromIso, days);
    const g = grid();
    // If `next` is not in the rendered weeks, swing the view to its month first.
    const present = g.weeks.some((row: any) => row.some((d: any) => d.iso === next));
    if (!present) setViewIso(next);
    focusDayIso(next);
  }

  // ---- keyboard ----------------------------------------------------------
  // Arrow keys move a day, Home/End to the week bounds, PageUp/PageDown change the
  // month, Enter/Space select. The focused day's iso rides on [data-day].
  function onDayKeydown(iso: any, e: any) {
    if (local.disabled) return;
    const key = e ? e.key : '';
    if (key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus(iso, -1);
    } else if (key === 'ArrowRight') {
      e.preventDefault();
      moveFocus(iso, 1);
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(iso, -7);
    } else if (key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(iso, 7);
    } else if (key === 'Home') {
      e.preventDefault();
      moveFocus(iso, -weekdayOffset(iso));
    } else if (key === 'End') {
      e.preventDefault();
      moveFocus(iso, 6 - weekdayOffset(iso));
    } else if (key === 'PageUp') {
      e.preventDefault();
      moveFocus(iso, 0 - daysInMonthSpan(iso, -1));
    } else if (key === 'PageDown') {
      e.preventDefault();
      moveFocus(iso, daysInMonthSpan(iso, 1));
    } else if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      e.preventDefault();
      onDaySelect(iso);
    } else if (key === 'Escape') {
      // In range mode, cancel an in-progress (anchor-set) selection.
      if (local.selectionMode === 'range') {
        const r = readRange();
        if (r.start !== '' && r.end === '') {
          e.preventDefault();
          setValue({
            start: '',
            end: ''
          });
          setHoverIso('');
          _props.onChange?.({
            value: {
              start: '',
              end: ''
            }
          });
        }
      }
    }
  }

  // Column index (0..6) of `iso` within its rendered week, honoring weekStartsOn.
  function weekdayOffset(iso: any) {
    const g = grid();
    for (const row of g.weeks as any) {
      for (let c = 0; c < row.length; c++) {
        if (row[c].iso === iso) return c;
      }
    }
    return 0;
  }

  // The day-delta to the same column one month away (PageUp/PageDown). Computed as
  // the difference between `iso` and `addMonths(iso, dir)` so the focus lands on
  // the clamped same-day-of-month.
  function daysInMonthSpan(iso: any, dir: any) {
    const a = isoToMs(iso);
    const b = isoToMs(addMonths(iso, dir));
    return Math.round((b - a) / 86400000);
  }
  function isoToMs(iso: any) {
    const t = isIsoDate(iso) ? Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : 0;
    return t;
  }

  // ---- presets (range mode) ----------------------------------------------
  // Resolve every consumer preset's `range` (literal or () => RangeValue thunk)
  // into an ordered { label, range } for the rail + the #presets slot. A PLAIN
  // function (uniform x6), called fresh each render.
  function resolvedPresets() {
    return local.presetRanges.map((p: any) => ({
      label: p.label,
      range: rangeFromPreset(p)
    }));
  }

  // Apply a preset = a complete range: write the (ordered) value + clear any
  // in-progress preview + emit change AND rangeComplete.
  function applyPreset(range: any) {
    if (local.disabled) return;
    const next = normalizeRange(range);
    setValue(next);
    setHoverIso('');
    _props.onChange?.({
      value: next
    });
    _props.onRangeComplete?.({
      value: next
    });
  }

  // Whether a preset matches the current value (ordered endpoint equality), used
  // for aria-pressed / is-active. An empty range never reads active.
  function isPresetActive(range: any) {
    const p = normalizeRange(range);
    if (p.start === '') return false;
    const r = readRange();
    return r.start === p.start && r.end === p.end;
  }

  // ---- lifecycle + imperative handle -------------------------------------
  // Seed the view month from value / today on mount.

  // focus() — focus the selected day, or today, or the first day of the view.
  // DELIBERATELY overrides HTMLElement.focus on Lit (ROZ137 warn, accepted).
  function focus() {
    const sel = selected();
    const t = todayIso();
    const g = grid();
    const present = (iso: any) => g.weeks.some((row: any) => row.some((d: any) => d.iso === iso));
    if (sel && present(sel)) {
      focusDayIso(sel);
    } else if (present(t)) {
      focusDayIso(t);
    } else {
      const first = g.weeks[0] && g.weeks[0][0] ? g.weeks[0][0].iso : '';
      if (first) focusDayIso(first);
    }
  }

  // goToToday() — swing the view to the current month (no selection change).
  function goToToday() {
    if (local.disabled) return;
    setViewIso(todayIso());
  }

  // clear() — deselect, writing the mode-appropriate empty ('' single /
  // { start:'', end:'' } range) + emit change.
  function clear() {
    if (local.disabled) return;
    if (local.selectionMode === 'range') {
      const r = readRange();
      if (r.start === '' && r.end === '') return;
      setValue({
        start: '',
        end: ''
      });
      setHoverIso('');
      _props.onChange?.({
        value: {
          start: '',
          end: ''
        }
      });
    } else {
      if (selected() === '') return;
      setValue('');
      _props.onChange?.({
        value: ''
      });
    }
  }

  return (
    <>
    <div ref={(el) => { rootRef = el as HTMLElement; }} role="group" aria-label="Date picker" aria-disabled={!!local.disabled} {...attrs} class={"rozie-datepicker" + " " + rozieClass({ 'rozie-datepicker--disabled': local.disabled }) + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-6800c7a2="">
      
      {(_props.headerSlot ?? _props.slots?.['header'])?.({ label: monthHeading(), prev: goPrevMonth, next: goNextMonth, disabled: !!local.disabled }) ?? <div class={"rozie-datepicker-header"} data-rozie-s-6800c7a2="">
          <button type="button" aria-disabled={!!local.disabled} aria-label="Previous month" class={"rozie-datepicker-nav rozie-datepicker-prev"} disabled={!!local.disabled} onClick={goPrevMonth} data-rozie-s-6800c7a2="">‹</button>
          <span class={"rozie-datepicker-heading"} aria-live="polite" data-rozie-s-6800c7a2="">{rozieDisplay(monthHeading())}</span>
          <button type="button" aria-disabled={!!local.disabled} aria-label="Next month" class={"rozie-datepicker-nav rozie-datepicker-next"} disabled={!!local.disabled} onClick={goNextMonth} data-rozie-s-6800c7a2="">›</button>
        </div>}

      
      <div role="grid" class={"rozie-datepicker-grid"} onMouseLeave={($event) => { setHoverIso(''); }} data-rozie-s-6800c7a2="">
        <div class={"rozie-datepicker-weekdays"} role="row" data-rozie-s-6800c7a2="">
          <For each={weekdays()}>{(wd, wi) => <span class={"rozie-datepicker-weekday"} role="columnheader" aria-label={rozieAttr(wd)} data-rozie-s-6800c7a2="">{rozieDisplay(wd)}</span>}</For>
        </div>

        <For each={grid().weeks}>{(week, wk) => <div class={"rozie-datepicker-week"} role="row" data-rozie-s-6800c7a2="">
          <For each={week}>{(day) => <span class={"rozie-datepicker-cell"} role="gridcell" aria-selected={!!(day.selected || day.rangeStart || day.rangeEnd)} data-rozie-s-6800c7a2="">
            <button type="button" data-day={rozieAttr(day.iso)} aria-disabled={!!day.disabled} aria-label={rozieAttr(day.iso)} aria-current={rozieAttr(day.today ? 'date' : null)} class={"rozie-datepicker-day" + " " + rozieClass({ 'is-selected': day.selected, 'is-today': day.today, 'is-outside': !day.inMonth, 'is-in-range': day.inRange, 'is-range-start': day.rangeStart, 'is-range-end': day.rangeEnd, 'is-in-preview': day.inPreview })} tabIndex={rozieAttr(dayTabIndex(day))} disabled={!!day.disabled} onClick={($event) => { onDaySelect(day.iso); }} onMouseEnter={($event) => { onDayHover(day.iso); }} onFocus={($event) => { onDayHover(day.iso); }} onKeyDown={($event) => { onDayKeydown(day.iso, $event); }} data-rozie-s-6800c7a2="">{rozieDisplay(day.day)}</button>
          </span>}</For>
        </div>}</For>
      </div>

      
      {(_props.presetsSlot ?? _props.slots?.['presets'])?.({ presets: resolvedPresets(), apply: applyPreset }) ?? <Show when={resolvedPresets().length}><div class={"rozie-datepicker-presets"} role="group" aria-label="Date range presets" data-rozie-s-6800c7a2="">
          <For each={resolvedPresets()}>{(p) => <button type="button" aria-pressed={!!isPresetActive(p.range)} class={"rozie-datepicker-preset" + " " + rozieClass({ 'is-active': isPresetActive(p.range) })} disabled={!!local.disabled} onClick={($event) => { applyPreset(p.range); }} data-rozie-s-6800c7a2="">{rozieDisplay(p.label)}</button>}</For>
        </div></Show>}
    </div>
    </>
  );
}
