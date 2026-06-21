# @rozie-ui/captcha-svelte

Idiomatic **svelte** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

This package ships `Captcha` (the default export) alongside `RecaptchaV3` (named export).

## Install

```bash
npm i @rozie-ui/captcha-svelte
```

Peer dependencies: `svelte`.

## Captcha

### Usage

```svelte
<script lang="ts">
  import Captcha from '@rozie-ui/captcha-svelte';
  let token = $state('');
</script>

<Captcha
  provider="turnstile"
  sitekey="your-site-key"
  bind:token
  onverify={(e) => console.log('verified', e.token)}
/>
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

```svelte
<script>
  let handle;
</script>

<Captcha bind:this={handle} />
```

| Method | Description |
| --- | --- |
| `reset` | Reset the widget to its un-challenged state and clear the two-way `token`. |
| `execute` | Programmatically run the challenge — drives invisible widgets (`size="invisible"`). |
| `getResponse` | Return the current response token on demand (e.g. just before form submit). |

## RecaptchaV3

### Usage

```svelte
<script lang="ts">
  import { RecaptchaV3 } from '@rozie-ui/captcha-svelte';
  let captcha;
  const submit = async () => {
    const token = await captcha.execute('signup'); // fresh token for THIS action
    await fetch('/signup', { method: 'POST', body: JSON.stringify({ token }) });
  };
</script>

<form on:submit|preventDefault={submit}>
  <!-- … fields … -->
  <RecaptchaV3 bind:this={captcha} sitekey="your-site-key" action="signup" />
  <button type="submit">Sign up</button>
</form>
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

```svelte
<script>
  let handle;
  // const token = await handle.execute('submit');
</script>

<RecaptchaV3 bind:this={handle} sitekey="your-site-key" />
```

| Method | Description |
| --- | --- |
| `execute` | Run a v3 challenge for the optional `action` (defaults to the `action` prop) and resolve with a fresh token; also writes the two-way `token` and emits `@verify`. |
