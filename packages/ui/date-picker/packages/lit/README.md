# @rozie-ui/date-picker-lit

Idiomatic **lit** `DatePicker` — a headless, fully-accessible (WAI-ARIA) single-date calendar (a month grid with leading/trailing spill, prev/next month navigation, `weekStartsOn` rotation, `min`/`max`/`disabledDates` gating, roving keyboard focus, and localized `Intl` labels) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is HEADLESS: accept the default token-themed calendar, or override the month-nav header via the scoped slot. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/date-picker-lit
```

Peer dependencies: `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/date-picker-lit';

// <rozie-date-picker> is a custom element. Bind `value`/`min`/`max` as
// properties and listen for `value-change` (the two-way ISO date) + `change`.
const el = document.querySelector('rozie-date-picker');
el.min = '2026-01-01';
el.value = '';
el.addEventListener('value-change', (e) => {
  el.value = e.detail;
});
el.addEventListener('change', (e) => {
  console.log('picked:', e.detail.value);
});
```

## Theming

Every visual value is a `--rozie-datepicker-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/date-picker-lit/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `value` | `String` | `''` | ✓ |  | The selected date as an ISO `YYYY-MM-DD` string (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a DatePicker **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). An empty string `""` means no date is selected; selecting a day writes the new ISO string back and emits `change`. |
| `min` | `String` | `null` |  |  | Inclusive lower bound as an ISO `YYYY-MM-DD` string. Days before it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no lower bound. |
| `max` | `String` | `null` |  |  | Inclusive upper bound as an ISO `YYYY-MM-DD` string. Days after it are rendered disabled and cannot be selected or focused. `null` (the default) imposes no upper bound. |
| `disabledDates` | `Array` | `[]` |  |  | An array of ISO `YYYY-MM-DD` strings to disable individually (e.g. holidays or already-booked days), in addition to the `min`/`max` bounds. Disabled days are non-interactive and marked `aria-disabled`. |
| `weekStartsOn` | `Number` | `0` |  |  | The first day of the week as a number, `0` = Sunday through `6` = Saturday. Rotates both the weekday header row and the grid columns (e.g. `1` for a Monday-first calendar). |
| `disabled` | `Boolean` | `false` |  |  | Disable the entire control — every day cell and the previous/next month buttons become non-interactive and are marked `aria-disabled`. Also sets the Angular `ControlValueAccessor` disabled state. |
| `locale` | `String` | `"en-US"` |  |  | BCP-47 locale tag used by `Intl.DateTimeFormat` to render the month-year heading and the short weekday header labels (e.g. `"fr-FR"`, `"ja-JP"`). Falls back to English names in a runtime without `Intl`. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired whenever the selected date changes — selecting a day, or a programmatic `clear()`. Payload `{ value }` — the new selected ISO `YYYY-MM-DD` string, or `""` when cleared. Not fired when the picked date equals the current selection. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `focus` | Move keyboard focus into the calendar grid — onto the selected day, else today (when in view), else the first visible day. Useful right after the picker becomes visible. |
| `goToToday` | Swing the displayed month to today's month without changing the selection (a view-only navigation). |
| `clear` | Deselect the current date (sets `value` to `""`). Emits `change` with an empty value unless nothing is selected. |

```ts
// The custom element IS the handle — exposed methods are public element methods.
const el = document.querySelector('rozie-date-picker');
el.focus();
el.goToToday();
el.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| header | label, prev, next, disabled |
