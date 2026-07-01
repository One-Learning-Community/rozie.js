# @rozie-ui/date-picker-solid

Idiomatic **solid** `DatePicker` — a headless, fully-accessible (WAI-ARIA) single-date calendar (a month grid with leading/trailing spill, prev/next month navigation, `weekStartsOn` rotation, `min`/`max`/`disabledDates` gating, roving keyboard focus, and localized `Intl` labels) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is HEADLESS: accept the default token-themed calendar, or override the month-nav header via the scoped slot. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/date-picker-solid
```

Peer dependencies: `solid-js`. Install them alongside this package.

## Usage

```tsx
import { createSignal } from 'solid-js';
import { DatePicker } from '@rozie-ui/date-picker-solid';

export function Demo() {
  const [date, setDate] = createSignal('');
  return (
    <DatePicker
      value={date()}
      onValueChange={setDate}
      min="2026-01-01"
      onChange={(e) => console.log('picked:', e.value)}
    />
  );
}

// Range selection with presets + a #presets override.
export function RangeDemo() {
  const [range, setRange] = createSignal({ start: '', end: '' });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const presetRanges = [
    { label: 'Q1 2026', range: { start: '2026-01-01', end: '2026-03-31' } },
    { label: 'Last 7 days', range: () => ({ start: iso(new Date(Date.now() - 6 * 864e5)), end: iso(new Date()) }) },
  ];
  return (
    <DatePicker
      selectionMode="range"
      value={range()}
      onValueChange={setRange}
      presetRanges={presetRanges}
      onRangeComplete={(e) => console.log('range:', e.value)}
    >
      {{
        presets: ({ presets, apply }) => (
          <div class="my-presets">
            {presets.map((p) => (
              <button onClick={() => apply(p.range)}>{p.label}</button>
            ))}
          </div>
        ),
      }}
    </DatePicker>
  );
}
```

## Theming

Every visual value is a `--rozie-datepicker-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```tsx
import '@rozie-ui/date-picker-solid/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `value` | `any` | `''` | ✓ |  | The selected value (two-way `r-model`). **Polymorphic** on `selectionMode`: in `single` mode an ISO `YYYY-MM-DD` string (`""` = nothing selected); in `range` mode a `{ start, end }` object of ISO endpoints (`""` = an unset endpoint). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). Selecting a day writes the new value back and emits `change`. **Lit caveat (range mode):** the object form must be delivered via a *property* binding (`.value=${obj}` / `r-model`), never a string `value="..."` attribute — the same rule already in force for `disabledDates`. |
| `selectionMode` | `String` | `"single"` |  |  | Selection mode: `'single'` (the default — `value` is one ISO `YYYY-MM-DD` string, fully backward-compatible) or `'range'` (`value` becomes a `{ start, end }` object selected with two clicks plus a live hover preview, direction-agnostic). In `range` mode a completed selection additionally emits `rangeComplete`. |
| `min` | `String` | `null` |  |  | Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound. |
| `max` | `String` | `null` |  |  | Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound. |
| `disabledDates` | `Array` | `[]` |  |  | An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`. |
| `weekStartsOn` | `Number` | `0` |  |  | The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar). |
| `disabled` | `Boolean` | `false` |  |  | Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state. |
| `locale` | `String` | `"en-US"` |  |  | BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`. |
| `presetRanges` | `Array` | `[]` |  |  | Quick-pick presets for `range` mode — an array of `{ label, range }` where `range` is a literal `{ start, end }` value **or** a `() => { start, end }` thunk (the consumer owns the date math and i18n labels). Renders a default preset rail beneath the grid; the `#presets` slot overrides it. **Lit caveat:** pass via a *property* binding (`.presetRanges=${[…]}`) — thunks inside the array cannot survive a string attribute, same as `disabledDates`. |
| `monthYearNav` | `Boolean` | `true` |  |  | Render the month-year heading as a clickable drill **button** that navigates days → months → years (and a year label that drills months → years). **Capability-on:** this is the documented exception to the boolean-default-`false` rule — the drill navigation is the ergonomic win of this feature, so it defaults to `true`. Set `:month-year-nav="false"` to restore the static heading `<span>` (byte-identical to the pre-navigation output). |
| `numberOfMonths` | `Number` | `1` |  |  | How many month grids to render side by side, anchored at the view month and stepping forward (e.g. `2` for a two-up range calendar). `1` (the default) emits exactly the single-month markup with no extra wrapper element. |
| `showFooter` | `Boolean` | `false` |  |  | Render a Today / Clear footer row beneath the calendar grid. `Today` selects (single mode) or navigates to (range mode) the current date; `Clear` deselects. The `#footer` slot fully overrides the default row, receiving `{ today, clear, todayIso }`. |
| `disabledDaysOfWeek` | `Array` | `[]` |  |  | An array of weekday indices to disable, `Number[]` where `0` = Sunday through `6` = Saturday (e.g. `[0, 6]` disables every weekend). Serializable, so it passes fine as a plain attribute. Threaded through the single gating funnel, so disabled weekdays are non-interactive, non-focusable, and marked `aria-disabled` — in agreement with day cells, drill enablement, and keyboard focus. |
| `isDateDisabled` | `Function` | `null` |  |  | A consumer predicate `(iso: string) => boolean` — return `true` to disable the given ISO `YYYY-MM-DD` date (e.g. custom holiday / blackout rules beyond `disabledDates`/`min`/`max`). Threaded through the single gating funnel so day cells, drill enablement, and focus all agree. **Lit caveat:** pass via a *property* binding (`.isDateDisabled=${fn}`), never a string attribute — a function cannot survive attribute serialization, the same rule already in force for `disabledDates`/`presetRanges`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the selected value changes — selecting a day, applying a preset, or a programmatic `clear()`. Payload `{ value }` — the new value: in `single` mode the selected ISO `YYYY-MM-DD` string (or `""` when cleared); in `range` mode the `{ start, end }` object (an in-progress anchor is `{ start, end: "" }`; cleared is `{ start: "", end: "" }`). Not fired when the picked date equals the current selection. |
| `rangeComplete` | Range mode only. Fired when a range selection **completes** — the second endpoint lands (the two-click commit) or a preset is applied. Payload `{ value }` — the ordered `{ start, end }` object (`start <= end`). NOT fired on the first (anchor-only) click. Per-target consumer prop casing differs: React `onRangeComplete`, Vue `@range-complete`, Svelte `onrangecomplete` (lowercased), Angular `(rangeComplete)`, Solid `onRangeComplete`, Lit `@rangeComplete`. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `focus` | Move keyboard focus into the calendar grid — onto the selected day, else today (when in view), else the first visible day. Useful right after the picker becomes visible. |
| `goToToday` | Swing the displayed month to today's month without changing the selection (a view-only navigation). |
| `clear` | Deselect the current date (sets `value` to `""`). Emits `change` with an empty value unless nothing is selected. |

```tsx
import { DatePicker, type DatePickerHandle } from '@rozie-ui/date-picker-solid';

let handle: DatePickerHandle | undefined;
// The ref callback receives the HANDLE object (not the DOM node).
<DatePicker ref={(h) => (handle = h)} value={date()} />;
handle?.goToToday();
```

## Slots

| Slot | Params |
| --- | --- |
| header | label, prev, next, disabled |
| footer | today, clear, todayIso |
| presets | presets, apply |
