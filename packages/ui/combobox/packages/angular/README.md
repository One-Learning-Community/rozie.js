# @rozie-ui/combobox-angular

Idiomatic **angular** `Combobox` — a headless, fully-accessible (WAI-ARIA) combobox / autocomplete: a text input plus a popup listbox with `aria-activedescendant` keyboard navigation (Arrow/Home/End/Enter/Escape), built-in client-side filtering (or async/server-side via the `search` event + `disableFilter`), a custom-option scoped slot, and a two-way `value` binding — compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. There is NO third-party engine; the behaviour is authored once on native DOM. Every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/combobox-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Combobox } from '@rozie-ui/combobox-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Combobox],
  template: `
    <Combobox
      [(value)]="value"
      [options]="frameworks"
      placeholder="Search…"
      ariaLabel="Framework"
      (change)="onChange($event)"
    />
  `,
})
export class DemoComponent {
  value: string | null = null;
  frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
];
  onChange(e: { value: unknown }) {
    console.log('picked:', e.value);
  }
}
```

## Theming

Every visual value is a `--rozie-combobox-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/combobox-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `value` model prop is the control value, so a combobox **is** a form control. It binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Combobox } from '@rozie-ui/combobox-angular';

@Component({
  selector: 'app-combobox-form',
  standalone: true,
  imports: [Combobox, ReactiveFormsModule],
  template: `
    <!-- The combobox selection IS the form control value -->
    <Combobox [formControl]="framework" [options]="frameworks" />
  `,
})
export class ComboboxFormComponent {
  framework = new FormControl<string | null>(null);
  frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
];
}

// Template-driven forms work the same way:
//   <Combobox [(ngModel)]="framework" name="framework" [options]="frameworks" />
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `unknown` | `null` | ✓ |  |
| `options` | `Array` | `[]` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `disableFilter` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `null` |  |  |
| `idBase` | `String` | `"rozie-combobox"` |  |  |
| `inline` | `Boolean` | `false` |  |  |
| `closeOnSelect` | `Boolean` | `true` |  |  |
| `optionLabel` | `Function` | `null` |  |  |
| `optionValue` | `Function` | `null` |  |  |
| `optionDisabled` | `Function` | `null` |  |  |
| `virtual` | `Boolean` | `false` |  |  |
| `estimateRowHeight` | `Number` | `36` |  |  |
| `maxHeight` | `String` | `''` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired when the selected value changes — a user picks an option, or `clear()` resets it. Payload `{ value }` — the newly-selected option value (or `null` after a clear). This is the two-way `value` write-back funneled through one wrapper. |
| `search` | Fired on every keystroke in the input. Payload `{ query }` — the current text. Pair it with `disableFilter` to drive async / server-side filtering: refetch `options` from the query and the popup re-renders the supplied list verbatim. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the text input) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the text input. NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `clear` | Reset the selection: clear `value` (emits `change` with `{ value: null }`) and empty the input text. |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Combobox) cb!: Combobox;   // or the viewChild() signal
  focusIt() { this.cb.focus(); }
  clearIt() { this.cb.clear(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
| option | option, index, active, selected, disabled |
| empty | query |
| option | option, index, active, selected, disabled |
| empty | query |
