# @rozie-ui/captcha-angular

Idiomatic **angular** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/captcha-angular
```

Peer dependencies: `@angular/core + @angular/common`.

## Usage

```ts
import { Component } from '@angular/core';
import { Captcha } from '@rozie-ui/captcha-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Captcha],
  template: `<Captcha provider="recaptcha" sitekey="your-site-key" [(token)]="token" (verify)="onVerify($event)" />`,
})
export class DemoComponent {
  token = '';
  onVerify(e: { token: string }) { console.log('verified', e.token); }
}
```

## Angular forms

The generated class implements `ControlValueAccessor` — the `token` model prop is the control value — so it binds to template-driven and reactive forms directives directly:

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { Captcha } from '@rozie-ui/captcha-angular';

@Component({
  selector: 'app-form',
  standalone: true,
  imports: [Captcha, ReactiveFormsModule],
  template: "<Captcha [formControl]=\"ctrl\" />",
})
export class FormComponent {
  ctrl = new FormControl('');
}
```

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `provider` | `String` | `"recaptcha"` |  |  |
| `sitekey` | `String` | `—` |  | ✓ |
| `token` | `String` | `""` | ✓ |  |
| `theme` | `String` | `"light"` |  |  |
| `size` | `String` | `"normal"` |  |  |
| `tabindex` | `Number` | `null` |  |  |
| `options` | `Object` | `{}` |  |  |

## Events

| Event | Description |
| --- | --- |
| `verify` | Fired when the user completes the challenge. Payload `{ token, provider }`. |
| `expire` | Fired when the verified token expires. Payload `{ provider }`. |
| `error` | Fired on a challenge or script-load failure. Payload `{ provider, error? }`. |

## Imperative handle

The component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
@Component({ /* ... */ })
export class DemoComponent {
  @ViewChild(Captcha) handle!: Captcha;
}
```

| Method | Description |
| --- | --- |
| `reset` | Reset the widget to its un-challenged state and clear the two-way `token`. |
| `execute` | Programmatically run the challenge — drives invisible widgets (`size="invisible"`). |
| `getResponse` | Return the current response token on demand (e.g. just before form submit). |
