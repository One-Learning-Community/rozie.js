# @rozie-ui/number-field-angular

Idiomatic **angular** `NumberField` — a headless, fully-accessible (WAI-ARIA `role="spinbutton"`) numeric stepper: clamp to `[min, max]`, step snapping, keyboard (Arrow / PageUp·Down / Home / End), press-and-hold acceleration on the +/- buttons, locale-aware `Intl.NumberFormat` display, optional scrub-on-drag, and a `number | null` two-way value — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input>`; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/number-field-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { NumberField } from '@rozie-ui/number-field-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [NumberField],
  template: `
    <NumberField [(modelValue)]="qty" [min]="0" [max]="10" [step]="1" ariaLabel="Quantity" (change)="onChange($event)" />

    <!-- Locale-aware currency -->
    <NumberField [(modelValue)]="qty" [min]="0" [step]="0.01" [formatOptions]="currency" ariaLabel="Price" />
  `,
})
export class DemoComponent {
  qty: number | null = 1;
  currency = { style: 'currency', currency: 'USD' };
  onChange(e: { value: number | null }) {
    console.log('value:', e.value);
  }
}
```

## Theming

Every visual value is a `--rozie-number-field-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/number-field-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `modelValue` model prop is the control value, so a number field **is** a form control. It binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { NumberField } from '@rozie-ui/number-field-angular';

@Component({
  selector: 'app-number-form',
  standalone: true,
  imports: [NumberField, ReactiveFormsModule],
  template: `
    <!-- The number field value IS the form control value -->
    <NumberField [formControl]="qty" [min]="0" [max]="10" ariaLabel="Quantity" />
  `,
})
export class NumberFormComponent {
  qty = new FormControl<number | null>(1);
}

// Template-driven forms work the same way:
//   <NumberField [(ngModel)]="qty" name="qty" [min]="0" [max]="10" />
```

## Props

| Name | Type | Default | Two-way (model) | Required | Description |
| --- | --- | --- | :---: | :---: | --- |
| `modelValue` | `Number` | `null` | ✓ |  | The numeric value of the field (two-way `r-model`). `null` means the field is empty. As the sole `model: true` prop it drives the Angular `ControlValueAccessor`, so a number field **is** a form control (`[(ngModel)]` / `[formControl]` bind directly). The value is clamped to `[min, max]` and snapped to `step` on every commit. |
| `min` | `Number` | `null` |  |  | Inclusive lower bound. Every commit clamps the value to `>= min`, and the **Home** key jumps to `min`. `null` (the default) means no lower bound. Also emitted as `aria-valuemin`. |
| `max` | `Number` | `null` |  |  | Inclusive upper bound. Every commit clamps the value to `<= max`, and the **End** key jumps to `max`. `null` (the default) means no upper bound. Also emitted as `aria-valuemax`. |
| `step` | `Number` | `1` |  |  | The increment/decrement granularity. **ArrowUp** / **ArrowDown** and the +/- buttons change the value by `step`, and every commit snaps the value to the nearest multiple of `step` measured from `min` (or `0` when `min` is `null`). |
| `largeStep` | `Number` | `10` |  |  | The coarse step applied by **PageUp** / **PageDown**, for fast traversal of a wide range. |
| `formatOptions` | `Object` | `{}` |  |  | Options forwarded to `Intl.NumberFormat` for locale-aware **display** formatting (e.g. `{ style: "currency", currency: "USD" }` or `{ minimumFractionDigits: 2 }`). The displayed text is formatted while the field is unfocused; on commit the formatting is stripped back off and the raw number is parsed. |
| `allowScrub` | `Boolean` | `false` |  |  | Opt in to **scrub-on-drag**: press and drag horizontally on the field to change the value by `step` per few pixels (a power-user affordance). Off by default. |
| `disabled` | `Boolean` | `false` |  |  | Disable the whole control — the input, both steppers, the keyboard, and scrubbing. Also sets the Angular `ControlValueAccessor` disabled state. |
| `readonly` | `Boolean` | `false` |  |  | Make the field read-only — the value is shown and focusable but cannot be changed by typing, the steppers, the keyboard, or scrubbing. |
| `ariaLabel` | `String` | `null` |  |  | Accessible name applied to the `role="spinbutton"` input (`aria-label`). Provide this (or an external `<label>`) so the control is announced. |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired on every committed change — a typed value committed on blur/Enter, a step from the +/- buttons or the keyboard, a Home/End jump, a scrub, or a programmatic `increment`/`decrement`/`clear`. Payload `{ value }` — the new clamped + snapped number, or `null` when the field is empty. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses + selects the input) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the input and select its text. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `increment` | Step the value up by one `step` (clamped to `max`, snapped to `step`). A `null` value seeds from `min` (or `0`). Emits `change`. |
| `decrement` | Step the value down by one `step` (clamped to `min`, snapped to `step`). A `null` value seeds from `min` (or `0`). Emits `change`. |
| `clear` | Set the value to `null` (the empty field) and clear the edit buffer. Emits `change` with `{ value: null }`. |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(NumberField) field!: NumberField;   // or the viewChild() signal
  bump() { this.field.increment(); }
  reset() { this.field.clear(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
