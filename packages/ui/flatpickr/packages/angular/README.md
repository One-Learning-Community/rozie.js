# @rozie-ui/flatpickr-angular

Idiomatic **angular** `Flatpickr` — a cross-framework date picker compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [flatpickr](https://flatpickr.js.org/). This package is generated; do not edit `src/` by hand.

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

## Angular forms

The generated class implements `ControlValueAccessor` — the `date` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Flatpickr } from '@rozie-ui/flatpickr-angular';

@Component({
  selector: 'app-birthday-form',
  standalone: true,
  imports: [Flatpickr, ReactiveFormsModule],
  template: `
    <!-- Reactive forms — [formControl] / formControlName bind directly -->
    <Flatpickr [formControl]="birthday" />
  `,
})
export class BirthdayFormComponent {
  birthday = new FormControl('');
}

// Template-driven forms work the same way:
//   <Flatpickr [(ngModel)]="birthday" name="birthday" />
```

The accessor contract: only real user interaction dirties the control — programmatic writes (form `setValue` / `reset`, or the `[(date)]` two-way binding) update the view without echoing back into the form; `writeValue(null)` resets to the prop default (`""`); the control is marked touched on focusout; and `setDisabledState` OR-merges with the `disabled` prop, so either source disables the component.

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

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Flatpickr) fp!: Flatpickr;  // or the viewChild() signal
  open() { this.fp.openPicker(); }
}
```

| Method | Description |
| --- | --- |
| `clear` | Clear the selected date(s) and the bound input. |
| `openPicker` | Open the calendar popover. |
| `closePicker` | Close the calendar popover. |
| `selectDate` | Set the selected date programmatically — `selectDate(date, triggerChange?)`. Pass `true` as the second argument to also fire `change`. |
| `jumpToDate` | Navigate the calendar view to a date — `jumpToDate(date)` — without changing the selection. |
| `getSelectedDates` | Return the currently selected dates as a `Date[]` on demand (the two-way `date` model is a formatted string; the parsed dates are otherwise only on the `change` payload). `[]` before mount. |
| `togglePicker` | Open the calendar if closed, close it if open — `togglePicker()` (single-trigger button). |
| `changeMonth` | Move the calendar by `value` months (or to an absolute month) — `changeMonth(value, isOffset?)` (isOffset defaults to true). |
| `changeYear` | Jump the calendar to an absolute year — `changeYear(year)`. |
