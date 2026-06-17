# @rozie-ui/slider-angular

Idiomatic **angular** `Slider` — a headless, fully-accessible (WAI-ARIA) slider / range (single + dual-thumb range, drag + full keyboard navigation, vertical orientation, marks) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input type="range">`; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/slider-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Slider } from '@rozie-ui/slider-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Slider],
  template: `
    <Slider [(value)]="value" [min]="0" [max]="100" [step]="1" ariaLabel="Volume" [showValue]="true" />

    <!-- Range mode: value is a sorted [lo, hi] tuple -->
    <Slider [(value)]="range" [range]="true" [min]="0" [max]="100" ariaLabel="Price range" />
  `,
})
export class DemoComponent {
  value = 50;
  range: [number, number] = [20, 80];
}
```

## Theming

Every visual value is a `--rozie-slider-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/slider-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `value` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive (a scalar AND a range `[lo, hi]` array flow through `writeValue` identically):

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Slider } from '@rozie-ui/slider-angular';

@Component({
  selector: 'app-volume-form',
  standalone: true,
  imports: [Slider, ReactiveFormsModule],
  template: `
    <!-- The slider value IS the form control value -->
    <Slider [formControl]="volume" [min]="0" [max]="100" />
  `,
})
export class VolumeFormComponent {
  volume = new FormControl<number>(50);
}

// Template-driven forms work the same way:
//   <Slider [(ngModel)]="volume" name="volume" [min]="0" [max]="100" />
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `unknown` | `null` | ✓ |  |
| `range` | `Boolean` | `false` |  |  |
| `min` | `Number` | `0` |  |  |
| `max` | `Number` | `100` |  |  |
| `step` | `Number` | `1` |  |  |
| `orientation` | `String` | `"horizontal"` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `marks` | `Array` | `[]` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `pageStep` | `Number` | `null` |  |  |
| `formatValue` | `Function` | `null` |  |  |
| `showValue` | `Boolean` | `false` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired after the value changes (drag, keyboard, or a programmatic `increment`/`decrement` step). Payload `{ value }` — a scalar number in single mode, a sorted `[lo, hi]` array in range mode. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the native range thumb) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the slider thumb (the native range input). NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended (D-05). |
| `increment` | Increase the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `'lo'` or `'hi'` (default `'lo'`). |
| `decrement` | Decrease the (optionally specified) thumb by one `step`, clamped to `[min, max]`. In range mode pass `'lo'` or `'hi'` (default `'lo'`). |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Slider) sl!: Slider;   // or the viewChild() signal
  focusIt() { this.sl.focus(); }
  bumpIt() { this.sl.increment(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| mark | value, label, position |
| bubble | value |
| bubble | value |
| bubble | value |
