# @rozie-ui/captcha-vue

Idiomatic **vue** `Captcha` — Cross-framework CAPTCHA / bot-protection widget wrapping Google reCAPTCHA v2, hCaptcha, and Cloudflare Turnstile. Compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source. This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/captcha-vue
```

Peer dependencies: `vue`.

## Usage

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
