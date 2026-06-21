# Captcha — the cross-framework CAPTCHA widget

Every CAPTCHA provider ships a vanilla-JS widget that does the real work in the browser — but the framework wrappers around them are **fragmented per provider per framework**: `react-google-recaptcha`, `vue-recaptcha`, `svelte-recaptcha-v2`, `ngx-captcha`, `@hcaptcha/react-hcaptcha` plus separate Vue/Svelte hCaptcha wrappers, `react-turnstile`, and so on — *N providers × M frameworks* of independently-maintained, drifting glue. That combinatorial sprawl is exactly what Rozie's write-once-ship-six thesis exists to collapse.

One `Captcha.rozie` source compiles to six idiomatic packages, and a single `provider` prop switches between **Google reCAPTCHA v2**, **hCaptcha**, and **Cloudflare Turnstile** — three widgets that share a near-identical explicit-render API, so one component covers them all.

## The `@rozie-ui/captcha` packages

| Package | Framework | Ships |
| --- | --- | --- |
| `@rozie-ui/captcha-react` | React 18+ | compiled `dist` + source |
| `@rozie-ui/captcha-vue` | Vue 3.4+ | compiled `dist` + `.vue` source |
| `@rozie-ui/captcha-svelte` | Svelte 5+ | compiled `dist` + `.svelte` source |
| `@rozie-ui/captcha-angular` | Angular 19+ | compiled `dist` (APF) + source |
| `@rozie-ui/captcha-solid` | Solid 1.8+ | compiled `dist` + source |
| `@rozie-ui/captcha-lit` | Lit 3+ | compiled custom element + source |

::: tip No engine dependency
Unlike the other `@rozie-ui` engine wrappers, Captcha has **no npm peer to install**. Each provider's `api.js` is injected at runtime — once per provider, shared across every `<Captcha>` on the page via a `globalThis` singleton — straight from the provider's CDN. You only need a **site key** from your provider dashboard.
:::

## Quick start

The verified response is **two-way bound** through the `token` model prop — the widget writes it on success and clears it on expire/reset, so you read it directly for form submission. A `verify` event also fires with `{ token, provider }`; `expire` and `error` cover the failure paths.

> The examples below use Google's universal **test site key** `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`, which always passes — swap in your real key for production.

### React

```tsx
import { useState } from 'react';
import { Captcha } from '@rozie-ui/captcha-react';

export function Demo() {
  const [token, setToken] = useState('');
  return (
    <Captcha
      provider="recaptcha"
      sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
      token={token}
      onTokenChange={setToken}
      onVerify={(e) => console.log('verified', e.token)}
    />
  );
}
```

### Vue

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Captcha from '@rozie-ui/captcha-vue';

const token = ref('');
</script>

<template>
  <Captcha
    provider="hcaptcha"
    sitekey="10000000-ffff-ffff-ffff-000000000001"
    v-model:token="token"
    @verify="(e) => console.log('verified', e.token)"
  />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import Captcha from '@rozie-ui/captcha-svelte';

  let token = $state('');
</script>

<Captcha
  provider="turnstile"
  sitekey="1x00000000000000000000AA"
  bind:token
  onverify={(e) => console.log('verified', e.token)}
/>
```

### Angular

```ts
import { Component } from '@angular/core';
import { Captcha } from '@rozie-ui/captcha-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Captcha],
  template: `
    <Captcha
      provider="recaptcha"
      sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
      [(token)]="token"
      (verify)="onVerify($event)"
    />
  `,
})
export class DemoComponent {
  token = '';
  onVerify(e: { token: string }) { console.log('verified', e.token); }
}
```

Because `token` is the lone two-way model, the Angular component is a real `ControlValueAccessor` — `[(ngModel)]="token"` and reactive `formControl` bindings work out of the box (handy for marking a form invalid until the captcha is solved).

### Solid

```tsx
import { createSignal } from 'solid-js';
import { Captcha } from '@rozie-ui/captcha-solid';

export function Demo() {
  const [token, setToken] = createSignal('');
  return (
    <Captcha
      provider="recaptcha"
      sitekey="6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI"
      token={token()}
      onTokenChange={setToken}
      onVerify={(e) => console.log('verified', e.token)}
    />
  );
}
```

### Lit

```ts
import '@rozie-ui/captcha-lit';

// <rozie-captcha> is a custom element. Bind `provider`/`sitekey` as properties
// and listen for `verify` (+ the `token-change` two-way channel).
const el = document.querySelector('rozie-captcha');
el.provider = 'turnstile';
el.sitekey = '1x00000000000000000000AA';
el.addEventListener('verify', (e) => console.log('verified', e.detail.token));
```

## API

### Props

`token` is the lone **two-way** model prop (bind with `r-model` / `v-model` / `bind:` / `[(…)]` / `onTokenChange`). Every other prop is **construction-time** — these widgets expose no live `set()` path, so to retune them (switch provider, theme, size, or site key) **re-key the component** (`<Captcha :key="…">`), the same idiom as the other engine wrappers' construction-only options.

| Name | Type | Default | Two-way | Description |
| --- | --- | --- | :---: | --- |
| `provider` | `String` | `"recaptcha"` | | Which widget to render: `'recaptcha'` (Google reCAPTCHA v2), `'hcaptcha'`, or `'turnstile'` (Cloudflare). |
| `sitekey` | `String` | `—` | | **Required.** The public site key from your provider dashboard. |
| `token` | `String` | `""` | ✓ | The verified response token. Written by the widget on success, cleared on expire/reset. Read it for form submission. |
| `theme` | `String` | `"light"` | | `'light'` / `'dark'` (all three) / `'auto'` (Turnstile only). |
| `size` | `String` | `"normal"` | | reCAPTCHA/hCaptcha: `'normal'` / `'compact'` / `'invisible'`. Turnstile: `'normal'` / `'compact'` / `'flexible'`. |
| `tabindex` | `Number` | `null` | | Optional tab index forwarded to the widget (omitted when unset). |
| `options` | `Object` | `{}` | | Escape hatch — provider-specific render options merged last (e.g. Turnstile `action`/`cData`/`retry`, hCaptcha `hl`, reCAPTCHA `badge`). Lets you reach keys not promoted to first-class props. |

### Events

| Event | Payload | Fires when |
| --- | --- | --- |
| `verify` | `{ token, provider }` | The challenge is solved — `token` is the response to send to your server for verification. Also drives the two-way `token` model. |
| `expire` | `{ provider }` | The solved token expired; the user must re-solve. The `token` model is cleared. |
| `error` | `{ provider, error? }` | The widget errored, or the provider script failed to load (`error` carries the load failure). The `token` model is cleared. |

### Imperative handle

Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit element itself) and call:

| Method | Description |
| --- | --- |
| `reset` | Reset the widget to its unsolved state and clear the two-way `token`. Call after a failed server-side verification so the user can retry. |
| `execute` | Programmatically run the challenge — for `size="invisible"` (and Turnstile's `execution: 'execute'` mode), where there is no visible checkbox to click. No-op until the widget has rendered. |
| `getResponse` | Read the current response token on demand (e.g. just before submitting a form). Returns `""` before render or after reset. |

::: tip Why there is no `render` verb
`render()` is a `LitElement` lifecycle method — exposing it would clobber the Lit element's own renderer. The widget render is kept internal; the three handle verbs (`reset`/`execute`/`getResponse`) are collision-free across all six targets (no emit/​model-setter/​Lit-lifecycle clash).
:::

**React example:**

```tsx
import { useRef } from 'react';
import { Captcha, type CaptchaHandle } from '@rozie-ui/captcha-react';

const captcha = useRef<CaptchaHandle>(null);
// <Captcha ref={captcha} provider="recaptcha" sitekey="…" size="invisible" />
captcha.current?.execute();                 // trigger an invisible challenge
const token = captcha.current?.getResponse();
captcha.current?.reset();                    // after a failed verification
```

## Recipes

### Gate a form submit on a solved token

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Captcha from '@rozie-ui/captcha-vue';

const token = ref('');
const submit = () => {
  if (!token.value) return;             // unsolved — block submit
  fetch('/signup', { method: 'POST', body: JSON.stringify({ token: token.value }) });
};
</script>

<template>
  <form @submit.prevent="submit">
    <!-- … fields … -->
    <Captcha provider="recaptcha" sitekey="…" v-model:token="token" />
    <button :disabled="!token">Sign up</button>
  </form>
</template>
```

### Invisible / programmatic challenge

Run the challenge on demand instead of showing a checkbox — solve it as part of your own submit button:

```tsx
const captcha = useRef<CaptchaHandle>(null);
const onSubmit = () => captcha.current?.execute();   // fires `verify` when solved

// <Captcha ref={captcha} provider="recaptcha" sitekey="…" size="invisible"
//   onVerify={(e) => actuallySubmit(e.token)} />
```

### Reset after a failed server check

Your backend verifies the token with the provider's `siteverify` endpoint. If it rejects (stale/replayed token), reset so the user re-solves:

```ts
if (!serverResult.success) captcha.current?.reset();
```

## Gotchas

### The provider script loads from a CDN

Each provider's `api.js` is injected from its CDN at mount. Allow the relevant origins in your **Content-Security-Policy** (`script-src` + `frame-src`):

- reCAPTCHA — `https://www.google.com` `https://www.gstatic.com`
- hCaptcha — `https://js.hcaptcha.com` `https://*.hcaptcha.com`
- Turnstile — `https://challenges.cloudflare.com`

### Construction-time config — re-key to change it

`provider`, `sitekey`, `theme`, and `size` are read once when the widget renders; these APIs have no runtime setter. To switch any of them live, give the component a changing `:key` so it tears down and re-renders. Only `token` (the model) reconciles continuously.

### Test site keys

Each provider ships always-pass keys for local dev: reCAPTCHA `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`, hCaptcha `10000000-ffff-ffff-ffff-000000000001`, Turnstile `1x00000000000000000000AA`. Never ship a test key to production — and always verify the token server-side.

### reCAPTCHA v3 is a separate integration {#why-no-v3}

reCAPTCHA **v3** is scoreless and widget-less — you call `execute(sitekey, { action })` and get a risk score, with no checkbox to render. That is a fundamentally different shape from the explicit-render v2/hCaptcha/Turnstile contract this component unifies, so it is tracked as a follow-on rather than bent into this surface. `size="invisible"` plus the `execute()` handle already cover the no-visible-challenge case for v2-family widgets.

### ALTCHA & Friendly Captcha

The privacy-first, self-hostable alternatives — [ALTCHA](https://altcha.org) (a web component) and [Friendly Captcha](https://friendlycaptcha.com) (an npm SDK) — use different integration shapes than the script-tag explicit-render contract here, and are tracked as a future provider-adapter rather than shipped in this first cut.

## Cross-references

- [Captcha libraries comparison](/components/captcha-comparison) — how `@rozie-ui/captcha` stacks up against the per-provider, per-framework wrappers.
- [Cropper — showcase & API](/components/cropper) — a sibling engine-wrapper port (two-way model + imperative handle pattern).
- [Features](/guide/features) — the full Rozie author-side API.
