# @rozie-ui/flatpickr-angular

Idiomatic **angular** `Flatpickr` — a cross-framework date picker compiled from one [Rozie](https://github.com/) source wrapping [flatpickr](https://flatpickr.js.org/). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/flatpickr-angular
```

Peer dependencies: `flatpickr ^4.6` + `@angular/core + @angular/common`. Install them alongside this package, and import flatpickr's stylesheet (`import 'flatpickr/dist/flatpickr.css'`) once in your app.

## Usage

```ts
import { Component } from '@angular/core';
import { Flatpickr } from '@rozie-ui/flatpickr-angular';
import 'flatpickr/dist/flatpickr.css';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Flatpickr],
  template: `
    <Flatpickr [(date)]="date" (change)="onChange($event)" />
  `,
})
export class DemoComponent {
  date = '2026-05-17';
  onChange(e: { value: string; selectedDates: Date[] }) {
    console.log(e.value, e.selectedDates);
  }
}
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
