# DatePicker Range Support — Design

**Date:** 2026-06-25
**Status:** Approved (design), pending spec review
**Family:** `@rozie-ui/date-picker` (extends existing `DatePicker.rozie` — no new family)

## 1. Summary

Add range selection to the existing single-date `DatePicker` via a `selectionMode`
prop, plus customizable pre-selected ranges ("presets" like *Last 7 Days*, *This
Month*). `selectionMode: 'single'` (default) preserves today's behavior exactly —
full backward compatibility. `selectionMode: 'range'` enables two-endpoint
selection with hover-preview highlighting, **direction-agnostic** anchoring, and an
optional preset rail.

The component stays a pure-Rozie family (no third-party engine). The branchy range
math lives in the existing pure, unit-tested `src/internal/buildMonthGrid.ts` and is
vendored into all six leaves.

## 2. Decisions (locked during brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| Component shape | **`selectionMode` prop on existing DatePicker** (not a separate family) | One package; chosen by user over the separate-family recommendation. |
| Range value shape | **Polymorphic `value: string \| {start, end}`** | More ergonomic on read than an ISO-interval string; user accepted the polymorphic cost. |
| Value type plumbing | **`type: [String, Object]` → `string \| Record<string, any>`** | Union prop types are already supported by all six emitters; Angular CVA bakes the union into `writeValue`. Precise `{start,end}` named type deferred (would need a custom type imported per leaf). |
| Presets API | **`Array<{ label, range }>` where `range` is a literal `RangeValue` OR a `() => RangeValue` thunk** | Literals for fixed ranges; thunks recompute relative ranges ("last 7 days") fresh on click. Consumer owns date math + i18n labels. |
| Interaction | **Two-click with hover preview, direction-agnostic** | First click is an anchor, not a forced start; backward and forward selection are symmetric. |
| `rangeComplete` event + `#presets` slot | **In for v1** | Confirmed by user. |

## 3. Public API additions

```
// props
selectionMode: 'single' | 'range'    default 'single'
value: string | { start, end }        // was string; now type: [String, Object], default ''
presets: Array<{ label: string, range: RangeValue | (() => RangeValue) }>   default () => []

// events
change        { value }   // fires on every model write (anchor-only AND complete)
rangeComplete { value }   // fires only when the second endpoint lands (auto-close hook)

// exposed verbs (unchanged signatures)
focus()       // unchanged
goToToday()   // unchanged
clear()       // writes mode-appropriate empty: '' (single) or {start:'', end:''} (range)

// slots
#header       // unchanged
#presets      // NEW — receives { presets, apply(range) }; default renders a <button> rail
```

`RangeValue = { start: string; end: string }` (ISO `YYYY-MM-DD` strings; `''` = empty endpoint).

## 4. Value model & normalization

- One polymorphic `value` prop. Default stays `''`.
- A normalization funnel `readRange()` coerces reads: in range mode a string value
  (e.g. the unbound default `''`) becomes `{ start: '', end: '' }`. **All** range
  logic reads through `readRange()` — never `$props.value` directly. Mirrors the
  existing `selected()` funnel for single mode.
- Endpoints are always stored ordered (`start ≤ end`) once a range completes.

## 5. Selection state machine (direction-agnostic)

Fully controlled. Exactly **one** new view-only data field: `$data.hoverIso` (a pure
view concern, consistent with the existing `$data.viewIso`). The in-progress anchor
is recoverable as the partial model's `start` slot — no separate anchor field.

- **Click 1** (no range in progress, or restarting): write `{ start: clicked, end: '' }`,
  emit `change`. `start` is the anchor slot, NOT a forced direction.
- **Hover** while in progress (`start` set, `end === ''`): set `$data.hoverIso`. The
  preview band spans `min(anchor, hover) … max(anchor, hover)`. Hovering *before* the
  anchor previews backward; never suppressed.
- **Click 2** at any date: final value is **ordered** —
  `{ start: min(anchor, click2), end: max(anchor, click2) }`. Clear `$data.hoverIso`.
  Emit `change` + `rangeComplete`. Click-today-then-last-week === click-last-week-then-today.
- **Click 3** (both set): restart at the clicked date (`{ start: clicked, end: '' }`).
- **Keyboard**: Enter/Space route through the same commit funnel. `Escape` while
  in-progress cancels back to `{ start: '', end: '' }`.

## 6. Grid model (`src/internal/buildMonthGrid.ts`)

The bulk of the work; stays pure and unit-tested. Additions:

- `CalendarDay` gains: `rangeStart`, `rangeEnd`, `inRange`, `inPreview` (all boolean).
- `MonthGridInput` gains: `selection` (single iso *or* `{start,end}`) and `previewEnd`
  (the hovered iso during in-progress selection).
- New exported pure helpers (each unit-tested): `normalizeRange(value)`,
  `isInRange(iso, start, end)`, `rangeFromPreset(preset)` (resolves literal-or-thunk).

`buildMonthGrid` remains the single `grid()` call the template derives from; it returns
a FRESH object each call (never fed to a reference-equality `$watch`).

## 7. Presets

- `presets` is one array; each entry's `range` is a literal `RangeValue` OR a thunk.
- Resolution: `typeof range === 'function' ? range() : range`. Thunks recompute on
  click (handles relative-range midnight drift); literals used directly.
- Default rail renders below the grid (one `<button>` per preset). The preset whose
  resolved range equals the current value gets `aria-pressed` / `is-active`.
- Overridable via `#presets` slot (receives `presets` + `apply(range)`).
- **Lit caveat:** function-form presets require property binding (same as the existing
  `disabledDates` array prop) — documented, not a new constraint class.

## 8. Authoring / collision risks (the real work surface)

- Polymorphic `value` → loose `string | Record<string, any>` (precise typing deferred).
- New helpers must dodge inherited Lit DOM names AND prop keys: `readRange`,
  `commitRange`, `applyPreset`, `resolvePreset`, `onDayHover` (avoid `start` / `end` /
  `title` / `label`).
- **Sharpest risk — object-payload model round-trip:** confirm the React model setter,
  Vue `update:value`, and Angular CVA round-trip cleanly with an OBJECT payload (the
  accepted polymorphic cost). Worth a quick spike before full build.
- New event (`rangeComplete`) + slot (`#presets`) → regenerate `.d.ts` + all six leaves.

## 9. Testing

- **Unit** (pure helpers): range ordering, `isInRange`, preview band, preset
  resolution (literal + thunk). **Explicit test: both click orders (anchor-then-earlier
  and earlier-then-anchor) yield the identical `{start, end}`.**
- **VR cells ×6** (Linux baselines): range mid-selection with forward hover preview,
  range mid-selection with **backward** hover preview, completed range spanning two
  months, preset-active state.
- Behavior assertions, not snapshot-only (per the snapshot-tests-cement-bugs lesson).

## 10. Effort / files touched

- `src/internal/buildMonthGrid.ts` — extend (pure, testable) + its `.test.ts`.
- `src/DatePicker.rozie` — props, script (range funnel + presets + hover), template
  (range bands, preset rail, `#presets` slot), style (band + rail tokens).
- Regenerate ×6 leaves + `.d.ts`.
- Docs: `date-picker-api.md`, `date-picker-usage.md`, `date-picker-demo.md`.
- VR cells + Linux-rendered baselines.

Backward compatibility: `selectionMode` defaults to `'single'`; the single-date path
is unchanged. Existing consumers see no behavioral or type difference.
