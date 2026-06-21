# @rozie-ui/captcha-react

Idiomatic **react** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

This package ships `Captcha` (the default export) alongside `RecaptchaV3` (named export).

## Install

```bash
npm i @rozie-ui/captcha-react
```

Peer dependencies: `react + react-dom`.

## Captcha

### Usage

```tsx
import { useState } from 'react';
import { Captcha } from '@rozie-ui/captcha-react';

export function Demo() {
  const [token, setToken] = useState('');
  return (
    <Captcha
      provider="recaptcha"
      sitekey="your-site-key"
      token={token}
      onTokenChange={setToken}
      onVerify={(e) => console.log('verified', e.token)}
    />
  );
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

```tsx
import { useRef } from 'react';
import { Captcha, type CaptchaHandle } from '@rozie-ui/captcha-react';

const handle = useRef<CaptchaHandle>(null);
// <Captcha ref={handle} provider="recaptcha" sitekey="your-site-key" />
// handle.current?.reset();        // clear + reset the widget
// handle.current?.execute();      // invisible / programmatic challenge
// handle.current?.getResponse();  // read the current token
```

| Method | Description |
| --- | --- |
| `reset` | Reset the widget to its un-challenged state and clear the two-way `token`. |
| `execute` | Programmatically run the challenge — drives invisible widgets (`size="invisible"`). |
| `getResponse` | Return the current response token on demand (e.g. just before form submit). |

## RecaptchaV3

### Usage

```tsx
import { useRef } from 'react';
import { RecaptchaV3, type RecaptchaV3Handle } from '@rozie-ui/captcha-react';

export function SignupForm() {
  const captcha = useRef<RecaptchaV3Handle>(null);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await captcha.current?.execute('signup'); // fresh token for THIS action
    await fetch('/signup', { method: 'POST', body: JSON.stringify({ token }) });
  };
  return (
    <form onSubmit={onSubmit}>
      {/* … fields … */}
      <RecaptchaV3 ref={captcha} sitekey="your-site-key" action="signup" />
      <button type="submit">Sign up</button>
    </form>
  );
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

```tsx
import { useRef } from 'react';
import { RecaptchaV3, type RecaptchaV3Handle } from '@rozie-ui/captcha-react';

const handle = useRef<RecaptchaV3Handle>(null);
// <RecaptchaV3 ref={handle} sitekey="your-site-key" action="submit" />
// const token = await handle.current?.execute();          // uses the action prop
// const token = await handle.current?.execute('login');   // override for this call
```

| Method | Description |
| --- | --- |
| `execute` | Run a v3 challenge for the optional `action` (defaults to the `action` prop) and resolve with a fresh token; also writes the two-way `token` and emits `@verify`. |
