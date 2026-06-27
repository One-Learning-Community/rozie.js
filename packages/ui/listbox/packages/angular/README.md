# @rozie-ui/listbox-angular

Idiomatic **angular** `Listbox` — a headless, fully-accessible (WAI-ARIA) select-only listbox (single + multi-select, type-ahead, full keyboard navigation) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. No third-party engine; every value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/listbox-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Listbox } from '@rozie-ui/listbox-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Listbox],
  template: `
    <Listbox [(value)]="value" [options]="options" placeholder="Pick a fruit…">
      <ng-template #option let-option="option" let-selected="selected">
        <span [class.selected]="selected">{{ option.label }}</span>
      </ng-template>
    </Listbox>
  `,
})
export class DemoComponent {
  value: string | null = null;
  options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ];
}
```

## Theming

Every visual value is a `--rozie-listbox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/listbox-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `value` model prop is the control value — so it binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Listbox } from '@rozie-ui/listbox-angular';

@Component({
  selector: 'app-pick-form',
  standalone: true,
  imports: [Listbox, ReactiveFormsModule],
  template: `
    <!-- The chosen value IS the form control value -->
    <Listbox [formControl]="fruit" [options]="options" />
  `,
})
export class PickFormComponent {
  fruit = new FormControl<string | null>(null);
  options = [
    { label: 'Apple', value: 'apple' },
    { label: 'Banana', value: 'banana' },
    { label: 'Cherry', value: 'cherry' },
  ];
}

// Template-driven forms work the same way:
//   <Listbox [(ngModel)]="fruit" name="fruit" [options]="options" />
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `options` | `Array` | `[]` |  |  |
| `value` | `unknown` | `null` | ✓ |  |
| `multiple` | `Boolean` | `false` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `closeOnSelect` | `Boolean` | `true` |  |  |
| `optionLabel` | `Function` | `null` |  |  |
| `optionValue` | `Function` | `null` |  |  |
| `optionDisabled` | `Function` | `null` |  |  |
| `id` | `String` | `"rozie-listbox"` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `open-change` | Fired whenever the popup opens or closes. Payload `{ open: boolean }`. |
| `change` | Fired after the selection changes. Payload `{ value, option }` — `value` is the new selected value (an array in multi-select), `option` is the toggled option (`null` when cleared). |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

| Method | Description |
| --- | --- |
| `open` | Open the popup (no-op when disabled or already open). |
| `close` | Close the popup. |
| `toggle` | Toggle the popup open/closed. |
| `clear` | Clear the selection (`null`, or `[]` in multi-select) and reset the combobox query. |
| `focusControl` | Move DOM focus to the control (the combobox input, or the select-only trigger button). |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Listbox) lb!: Listbox;   // or the viewChild() signal
  openIt() { this.lb.open(); }
  clearIt() { this.lb.clear(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| selected | selected, value |
| option | option, index, active, selected, disabled |
| empty | query |
