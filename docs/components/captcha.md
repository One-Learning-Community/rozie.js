# Captcha — the cross-framework CAPTCHA widget

Every CAPTCHA provider ships a vanilla-JS widget that does the real work in the browser — but the framework wrappers around them are **fragmented per provider per framework**: `react-google-recaptcha`, `vue-recaptcha`, `svelte-recaptcha-v2`, `ngx-captcha`, `@hcaptcha/react-hcaptcha` plus separate Vue/Svelte hCaptcha wrappers, `react-turnstile`, and so on — *N providers × M frameworks* of independently-maintained, drifting glue. That combinatorial sprawl is exactly what Rozie's write-once-ship-six thesis exists to collapse.

One `Captcha.rozie` source compiles to six idiomatic packages, and a single `provider` prop switches between **Google reCAPTCHA v2**, **hCaptcha**, **Cloudflare Turnstile**, and **Friendly Captcha** — the first three share a near-identical explicit-render API; Friendly Captcha rides an internal `adapt()` bridge onto the same surface, so one component covers all four.

> Looking for the **scoreless reCAPTCHA v3**? That is a fundamentally different, widget-less integration — it ships as the separate [`RecaptchaV3`](#recaptchav3) component in this same package.

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
| `provider` | `String` | `"recaptcha"` | | Which widget to render: `'recaptcha'` (Google reCAPTCHA v2), `'hcaptcha'`, `'turnstile'` (Cloudflare), or `'friendly'` (Friendly Captcha). |
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
- Friendly Captcha — `script-src https://cdn.jsdelivr.net` (the `@friendlycaptcha/sdk` compat build, loaded from the CDN — no npm peer), plus `connect-src https://api.friendlycaptcha.com https://*.frcapi.com` for its solver API. (Verify the current origins against the [Friendly Captcha docs](https://developer.friendlycaptcha.com/) — they evolve.)

### Construction-time config — re-key to change it

`provider`, `sitekey`, `theme`, and `size` are read once when the widget renders; these APIs have no runtime setter. To switch any of them live, give the component a changing `:key` so it tears down and re-renders. Only `token` (the model) reconciles continuously.

### Test site keys

Each provider ships always-pass keys for local dev: reCAPTCHA `6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI`, hCaptcha `10000000-ffff-ffff-ffff-000000000001`, Turnstile `1x00000000000000000000AA`. Never ship a test key to production — and always verify the token server-side.

### Friendly Captcha {#friendly}

`provider="friendly"` joins `recaptcha` / `hcaptcha` / `turnstile` as a 4th provider. Friendly Captcha's SDK exposes a different shape (`createWidget` returning an event-emitter handle), so an internal `adapt()` bridge maps it onto the same `CaptchaApi` surface — from the consumer's side it behaves like any other provider.

- **CDN-only, no peer dependency.** The `@friendlycaptcha/sdk` compat build is injected from the CDN (`https://cdn.jsdelivr.net`) — there is **no `@friendlycaptcha/sdk` npm peer to install**, consistent with the family's zero-engine-dependency design. Allow its [CSP origins](#the-provider-script-loads-from-a-cdn).
- **`size` is a no-op for Friendly Captcha** — FC has no size concept. Its `startMode` analog (e.g. `'auto'` / `'focus'` / `'none'`) rides through the [`options` escape hatch](#props) instead: `:options="{ startMode: 'auto' }"`.

### reCAPTCHA v3 is a separate component {#why-no-v3}

reCAPTCHA **v3** is scoreless and widget-less — you call `execute(sitekey, { action })` and get a risk score, with no checkbox to render. That is a fundamentally different shape from the explicit-render v2/hCaptcha/Turnstile/Friendly contract `<Captcha>` unifies, so it ships as the separate [`RecaptchaV3`](#recaptchav3) component (same package, named export) rather than being bent into this surface. `size="invisible"` plus the `execute()` handle still cover the no-visible-challenge case for the v2-family widgets here.

### ALTCHA

[ALTCHA](https://altcha.org) — the privacy-first, self-hostable alternative — is a **web component**, a different integration shape than the script-tag explicit-render contract here. Consuming a foreign web component cleanly across all six targets needs a compiler capability Rozie does not yet have, so ALTCHA remains the lone tracked follow-on provider.

## RecaptchaV3 {#recaptchav3}

Google **reCAPTCHA v3** is a fundamentally different integration from the v2-family widgets `<Captcha>` unifies: there is no checkbox, no challenge, and no DOM element — it scores every interaction invisibly and yields a fresh verification token on demand via `grecaptcha.execute(sitekey, { action })`. Bending that into the explicit-render `<Captcha>` surface would distort both, so v3 ships as its own **imperative-first** component, `RecaptchaV3`, alongside `Captcha` in the same package.

```ts
// Named export — ships beside the default Captcha export.
import { RecaptchaV3 } from '@rozie-ui/captcha-react';
```

**Imperative-first.** The primary use is "right before you submit a form, get a fresh token for *this* action": call the exposed `execute(action?)` handle, await the `Promise<token>`, and attach the token to your request. The optional `action` arg overrides the `action` prop for that one call. Load-time auto-execution is opt-in (`executeOnMount`, default `false`) because a v3 token is short-lived (~2 min) — fetching one at mount is usually wasted; fetch it at the moment of submission.

```tsx
import { useRef } from 'react';
import { RecaptchaV3, type RecaptchaV3Handle } from '@rozie-ui/captcha-react';

const captcha = useRef<RecaptchaV3Handle>(null);
// <RecaptchaV3 ref={captcha} sitekey="your-site-key" action="signup" />
const onSubmit = async () => {
  const token = await captcha.current?.execute('signup'); // fresh token for THIS action
  await fetch('/signup', { method: 'POST', body: JSON.stringify({ token }) });
};
```

The same value contract as `<Captcha>`: `token` is **two-way** (written on each successful execute), `@verify` fires `{ token, action }` on success, `@error` fires `{ error? }` on failure (load timeout, script error, or a rejected `execute()`).

::: warning Floating badge & attribution
reCAPTCHA v3 shows a floating badge in the corner of the page. If you hide it, Google requires you to display the [reCAPTCHA branding text](https://developers.google.com/recaptcha/docs/faq#id-like-to-hide-the-recaptcha-badge.-what-is-allowed) in your form instead. And as always: a v3 token is only a *signal* — **verify the score server-side** against `siteverify` and decide your own threshold.
:::

### RecaptchaV3 Props

| Name | Type | Default | Two-way | Description |
| --- | --- | --- | :---: | --- |
| `sitekey` | `String` | `—` | | **Required.** The public reCAPTCHA v3 site key from your Google admin console. |
| `action` | `String` | `"submit"` | | The default action label reported to reCAPTCHA's risk analysis (e.g. `'submit'`, `'login'`). Overridable per call via `execute(action)`. |
| `token` | `String` | `""` | ✓ | The latest verification token. Written on each successful execute — read it for the request via `r-model="token"`. |
| `executeOnMount` | `Boolean` | `false` | | Opt-in: run one `execute()` at mount and emit `@verify` with the initial token. Off by default — v3 is imperative-first (tokens are short-lived). |

### RecaptchaV3 events

| Event | Payload | Fires when |
| --- | --- | --- |
| `verify` | `{ token, action }` | A `execute()` call succeeds — `token` is the fresh response to verify server-side. Also drives the two-way `token` model. |
| `error` | `{ error? }` | The script failed to load (timeout / error) or a `execute()` call rejected. |

### RecaptchaV3 handle

| Method | Description |
| --- | --- |
| `execute` | `execute(action?) → Promise<token>`. Run a v3 challenge for the optional `action` (defaults to the `action` prop), resolve with a fresh token, write the two-way `token`, and emit `@verify`. There is no `render`/`reset`/`getResponse` verb — v3 has nothing to render and no cached widget state. |

## Cross-references

- [Captcha libraries comparison](/components/captcha-comparison) — how `@rozie-ui/captcha` stacks up against the per-provider, per-framework wrappers.
- [Cropper — showcase & API](/components/cropper) — a sibling engine-wrapper port (two-way model + imperative handle pattern).
- [Features](/guide/features) — the full Rozie author-side API.
