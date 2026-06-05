# @rozie-ui/flatpickr-svelte

Idiomatic **svelte** `Flatpickr` — a cross-framework date picker compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [flatpickr](https://flatpickr.js.org/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/flatpickr-svelte
```

Peer dependencies: `flatpickr ^4.6` + `svelte`. Install them alongside this package, and import flatpickr's stylesheet (`import 'flatpickr/dist/flatpickr.css'`) once in your app.

## Usage

```svelte
<script lang="ts">
  import Flatpickr from '@rozie-ui/flatpickr-svelte';
  import 'flatpickr/dist/flatpickr.css';

  let date = $state('2026-05-17');
</script>

<Flatpickr bind:date onchange={(e) => console.log(e.value, e.selectedDates)} />
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
| `disable` | `Array` | `[]` |  |  |
| `enable` | `Array` | `[]` |  |  |
| `locale` | `Object` | `null` |  |  |
| `firstDayOfWeek` | `Number` | `0` |  |  |
| `parseDate` | `Function` | `null` |  |  |
| `formatDate` | `Function` | `null` |  |  |
| `plugins` | `Array` | `[]` |  |  |

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

```svelte
<script>
  let fp;                  // component instance via bind:this
</script>

<Flatpickr bind:this={fp} />
<button onclick={() => fp.openPicker()}>Open</button>
```

| Method | Description |
| --- | --- |
| `clear` | Clear the selected date(s) and the bound input. |
| `openPicker` | Open the calendar popover. |
| `closePicker` | Close the calendar popover. |
| `selectDate` | Set the selected date programmatically — `selectDate(date, triggerChange?)`. Pass `true` as the second argument to also fire `change`. |
| `jumpToDate` | Navigate the calendar view to a date — `jumpToDate(date)` — without changing the selection. |
