# @rozie-ui/flatpickr-lit

Idiomatic **lit** `Flatpickr` — a cross-framework date picker compiled from one [Rozie](https://github.com/) source wrapping [flatpickr](https://flatpickr.js.org/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/flatpickr-lit
```

Peer dependencies: `flatpickr ^4.6` + `lit`. Install them alongside this package, and import flatpickr's stylesheet (`import 'flatpickr/dist/flatpickr.css'`) once in your app.

## Usage

```ts
import '@rozie-ui/flatpickr-lit';
import 'flatpickr/dist/flatpickr.css';

// <rozie-flatpickr> is a custom element. Bind `date` as a property and
// listen for the `date-change` event to receive the formatted string.
const el = document.querySelector('rozie-flatpickr');
el.date = '2026-05-17';
el.addEventListener('date-change', (e) => {
  el.date = e.detail;
});
el.addEventListener('change', (e) => {
  console.log(e.detail.value, e.detail.selectedDates);
});
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `date` | `String` | `""` | ✓ |  |
| `mode` | `String` | `"single"` |  |  |
| `dateFormat` | `String` | `"Y-m-d"` |  |  |
| `altInput` | `Boolean` | `false` |  |  |
| `altFormat` | `String` | `"F j, Y"` |  |  |
| `enableTime` | `Boolean` | `false` |  |  |
| `enableSeconds` | `Boolean` | `false` |  |  |
| `time24hr` | `Boolean` | `false` |  |  |
| `noCalendar` | `Boolean` | `false` |  |  |
| `minDate` | `String` | `null` |  |  |
| `maxDate` | `String` | `null` |  |  |
| `placeholder` | `String` | `"Select a date…"` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `commitOn` | `String` | `"complete"` |  |  |
| `options` | `Object` | `{}` |  |  |
| `name` | `String` | `""` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `staticPosition` | `Boolean` | `false` |  |  |
| `position` | `String` | `"auto"` |  |  |
| `appendTo` | `Object` | `null` |  |  |
| `showMonths` | `Number` | `1` |  |  |
| `weekNumbers` | `Boolean` | `false` |  |  |
| `monthSelectorType` | `String` | `"dropdown"` |  |  |
| `prevArrow` | `String` | `null` |  |  |
| `nextArrow` | `String` | `null` |  |  |
| `allowInput` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired when the selected date(s) change. Payload `{ value, selectedDates }`. In range mode the bound string commits only when the range is complete (2 dates) unless `commitOn: "change"`. |
| `ready` | Fired once the calendar is initialised and mounted. Payload `{ value, selectedDates }`. |
| `open` | Fired when the calendar popover opens. |
| `close` | Fired when the calendar popover closes. |
| `monthChange` | Fired when the displayed month changes. |
| `yearChange` | Fired when the displayed year changes. |
| `valueUpdate` | Fired on every internal value update (including partial range clicks), before the `change` commit. Payload `{ value, selectedDates }`. |
| `dayCreate` | Fired for each day cell as the calendar renders. Payload is the day `HTMLElement`, for per-day decoration. |

## Imperative handle

Beyond props/events, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
// The custom element IS the handle — its exposed methods are public
// element methods.
document.querySelector('rozie-flatpickr').openPicker();
```

| Method | Description |
| --- | --- |
| `clear` | Clear the selected date(s) and the bound input. |
| `openPicker` | Open the calendar popover. |
| `closePicker` | Close the calendar popover. |
| `selectDate` | Set the selected date programmatically — `selectDate(date, triggerChange?)`. Pass `true` as the second argument to also fire `change`. |
| `jumpToDate` | Navigate the calendar view to a date — `jumpToDate(date)` — without changing the selection. |
