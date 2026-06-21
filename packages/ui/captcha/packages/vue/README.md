# @rozie-ui/captcha-vue

Idiomatic **vue** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

This package ships `Captcha` (the default export) alongside `RecaptchaV3` (named export).

## Install

```bash
npm i @rozie-ui/captcha-vue
```

Peer dependencies: `vue`.

## Captcha

### Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Captcha from '@rozie-ui/captcha-vue';

const token = ref('');
</script>

<template>
  <Captcha
    provider="recaptcha"
    sitekey="your-site-key"
    v-model:token="token"
    @verify="(e) => console.log('verified', e.token)"
  />
</template>
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

```vue
<script setup>
import { ref } from 'vue';
const handle = ref();
</script>

<template>
  <Captcha ref="handle" />
</template>
```

| Method | Description |
| --- | --- |
| `reset` | Reset the widget to its un-challenged state and clear the two-way `token`. |
| `execute` | Programmatically run the challenge — drives invisible widgets (`size="invisible"`). |
| `getResponse` | Return the current response token on demand (e.g. just before form submit). |

## RecaptchaV3

### Usage

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { RecaptchaV3 } from '@rozie-ui/captcha-vue';

const captcha = ref();
const submit = async () => {
  const token = await captcha.value.execute('signup'); // fresh token for THIS action
  await fetch('/signup', { method: 'POST', body: JSON.stringify({ token }) });
};
</script>

<template>
  <form @submit.prevent="submit">
    <!-- … fields … -->
    <RecaptchaV3 ref="captcha" sitekey="your-site-key" action="signup" />
    <button type="submit">Sign up</button>
  </form>
</template>
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

```vue
<script setup>
import { ref } from 'vue';
const handle = ref();
// const token = await handle.value.execute('submit');
</script>

<template>
  <RecaptchaV3 ref="handle" sitekey="your-site-key" />
</template>
```

| Method | Description |
| --- | --- |
| `execute` | Run a v3 challenge for the optional `action` (defaults to the `action` prop) and resolve with a fresh token; also writes the two-way `token` and emits `@verify`. |
