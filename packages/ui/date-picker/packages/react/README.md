# @rozie-ui/date-picker-react

Idiomatic **react** `DatePicker` — a headless, fully-accessible (WAI-ARIA) single-date calendar (a month grid with leading/trailing spill, prev/next month navigation, `weekStartsOn` rotation, `min`/`max`/`disabledDates` gating, roving keyboard focus, and localized `Intl` labels) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. It is HEADLESS: accept the default token-themed calendar, or override the month-nav header via the scoped slot. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/date-picker-react
```

Peer dependencies: `react + react-dom`. Install them alongside this package.

## Usage

```tsx
import { useState } from 'react';
import { DatePicker } from '@rozie-ui/date-picker-react';

export function Demo() {
  const [date, setDate] = useState(''); // ISO YYYY-MM-DD, '' = no selection
  return (
    <DatePicker
      value={date}
      onValueChange={setDate}
      min="2026-01-01"
      onChange={(e) => console.log('picked:', e.value)}
    />
  );
}

// Custom header via the scoped #header slot (render-prop on React).
export function CustomHeaderDemo() {
  const [date, setDate] = useState('');
  return (
    <DatePicker value={date} onValueChange={setDate}>
      {{
        header: ({ label, prev, next }) => (
          <div className="my-header">
            <button onClick={prev}>Prev</button>
            <strong>{label}</strong>
            <button onClick={next}>Next</button>
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
import '@rozie-ui/date-picker-react/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
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

```tsx
import { useRef } from 'react';
import { DatePicker, type DatePickerHandle } from '@rozie-ui/date-picker-react';

const picker = useRef<DatePickerHandle>(null);
// <DatePicker ref={picker} ... />
picker.current?.focus();
picker.current?.goToToday();
picker.current?.clear();
```

## Slots

| Slot | Params |
| --- | --- |
| header | label, prev, next, disabled |
