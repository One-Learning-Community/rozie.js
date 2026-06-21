# @rozie-ui/captcha-angular

Idiomatic **angular** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

This package ships `Captcha` (the default export) alongside `RecaptchaV3` (named export).

## Install

```bash
npm i @rozie-ui/captcha-angular
```

Peer dependencies: `@angular/core + @angular/common`.

## Captcha

### Usage

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

### Angular forms

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

### Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `provider` | `String` | `"recaptcha"` |  |  |
| `sitekey` | `String` | `—` |  | ✓ |
| `token` | `String` | `""` | ✓ |  |
| `theme` | `String` | `"light"` |  |  |
| `size` | `String` | `"normal"` |  |  |
| `tabindex` | `Number` | `null` |  |  |
| `options` | `Object` | `{}` |  |  |

### Events

| Event | Description |
| --- | --- |
| `verify` | Fired when the user completes the challenge. Payload `{ token, provider }`. |
| `expire` | Fired when the verified token expires. Payload `{ provider }`. |
| `error` | Fired on a challenge or script-load failure. Payload `{ provider, error? }`. |

### Imperative handle

This component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

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

## RecaptchaV3

### Usage

```ts
import { Component, viewChild } from '@angular/core';
import { RecaptchaV3 } from '@rozie-ui/captcha-angular';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [RecaptchaV3],
  template: `
    <form (submit)="submit($event)">
      <!-- … fields … -->
      <RecaptchaV3 sitekey="your-site-key" action="signup" />
      <button type="submit">Sign up</button>
    </form>
  `,
})
export class SignupComponent {
  captcha = viewChild(RecaptchaV3);
  async submit(e: Event) {
    e.preventDefault();
    const token = await this.captcha()!.execute('signup'); // fresh token for THIS action
    await fetch('/signup', { method: 'POST', body: JSON.stringify({ token }) });
  }
}
```

### Angular forms

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

### Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `sitekey` | `String` | `—` |  | ✓ |
| `action` | `String` | `"submit"` |  |  |
| `token` | `String` | `""` | ✓ |  |
| `executeOnMount` | `Boolean` | `false` |  |  |

### Events

| Event | Description |
| --- | --- |
| `error` | Fired on a load timeout, script error, or a rejected `execute()`. Payload `{ error? }`. |
| `verify` | Fired on a successful `execute()`. Payload `{ token, action }`. |

### Imperative handle

This component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```ts
@Component({ /* ... */ })
export class DemoComponent {
  handle = viewChild(RecaptchaV3);
  // const token = await this.handle()!.execute('submit');
}
```

| Method | Description |
| --- | --- |
| `execute` | Run a v3 challenge for the optional `action` (defaults to the `action` prop) and resolve with a fresh token; also writes the two-way `token` and emits `@verify`. |
