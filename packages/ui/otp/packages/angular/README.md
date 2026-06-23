# @rozie-ui/otp-angular

Idiomatic **angular** `Otp` — a headless, fully-accessible (WAI-ARIA) one-time-code / PIN input (segmented native cells, paste-to-distribute, full keyboard navigation, `autocomplete="one-time-code"` SMS autofill, and optional masking) compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. The interaction engine IS the browser's native `<input>` cells; every visual value is a CSS custom property, so it re-skins to any design system. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/otp-angular
```

Peer dependencies: `@angular/core + @angular/common + @angular/forms`. Install them alongside this package.

## Usage

```ts
import { Component } from '@angular/core';
import { Otp } from '@rozie-ui/otp-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Otp],
  template: `
    <Otp [(value)]="code" [length]="6" type="numeric" ariaLabel="Verification code" (complete)="onComplete($event)" />

    <!-- Masked (password dots) -->
    <Otp [(value)]="code" [length]="4" [mask]="true" ariaLabel="PIN" />
  `,
})
export class DemoComponent {
  code = '';
  onComplete(e: { value: string }) {
    console.log('code complete:', e.value);
  }
}
```

## Theming

Every visual value is a `--rozie-otp-*` CSS custom property — override any of them at any ancestor scope. Ready-made design-system bridges ship in the package:

```ts
import '@rozie-ui/otp-angular/themes/shadcn.css';    // or material.css, bootstrap.css, base.css
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `value` model prop is the control value, so an OTP **is** a form control. It binds to template-driven and reactive forms directives directly, with no wrapper directive:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Otp } from '@rozie-ui/otp-angular';

@Component({
  selector: 'app-otp-form',
  standalone: true,
  imports: [Otp, ReactiveFormsModule],
  template: `
    <!-- The OTP value IS the form control value -->
    <Otp [formControl]="code" [length]="6" type="numeric" />
  `,
})
export class OtpFormComponent {
  code = new FormControl<string>('');
}

// Template-driven forms work the same way:
//   <Otp [(ngModel)]="code" name="code" [length]="6" />
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `value` | `String` | `''` | ✓ |  |
| `length` | `Number` | `6` |  |  |
| `type` | `String` | `"numeric"` |  |  |
| `mask` | `Boolean` | `false` |  |  |
| `autoFocus` | `Boolean` | `false` |  |  |
| `disabled` | `Boolean` | `false` |  |  |
| `placeholder` | `String` | `''` |  |  |
| `ariaLabel` | `String` | `null` |  |  |

## Events

| Event | Description |
| --- | --- |
| `change` | Fired on every edit (type, paste, backspace, or a programmatic `clear`). Payload `{ value }` — the new contiguous code string (0..`length` chars). |
| `complete` | Fired when the last cell is filled, i.e. the code reaches `length` characters. Payload `{ value }` — the complete code string. Use it to auto-submit a verification flow. |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly. Note: `focus()` deliberately overrides the inherited `HTMLElement.focus` (it focuses the first empty cell) — on the Lit custom element this is an accepted ROZ137 warn-only override, the public `focus()` handle is intended:

| Method | Description |
| --- | --- |
| `focus` | Move DOM focus to the first empty cell (clamped to the last cell when the code is full). NOTE: this deliberately overrides the inherited `HTMLElement.focus` on the Lit custom element (ROZ137 warns, warn-only) — the public `focus()` handle is intended. |
| `clear` | Reset the code to the empty string (emits `change` with `{ value: "" }`) and move focus to the first cell. |

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Otp) otp!: Otp;   // or the viewChild() signal
  focusIt() { this.otp.focus(); }
  clearIt() { this.otp.clear(); }
}
```

## Slots

| Slot | Params |
| --- | --- |
