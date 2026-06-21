# Captcha libraries comparison

How `@rozie-ui/captcha` compares to the existing CAPTCHA wrappers. Every provider — Google reCAPTCHA, hCaptcha, Cloudflare Turnstile — ships a framework-agnostic vanilla-JS widget; each wrapper exists only to inject the provider script, render the widget into an element, surface its config as props, and forward the `verify`/`expire`/`error` callbacks. Because that glue is rewritten **per provider × per framework**, the ecosystem is a sprawl of small, independently-versioned packages — and crucially, **almost none is multi-provider**: switching from reCAPTCHA to Turnstile means swapping libraries, not flipping a prop.

> Research snapshot: 2026-06. Versions and the wrapper landscape move; treat them as of that date.

## The wrappers at a glance

| Framework | reCAPTCHA | hCaptcha | Turnstile | Friendly | Multi-provider? |
| --- | --- | --- | --- | --- | :---: |
| **React** | `react-google-recaptcha` | `@hcaptcha/react-hcaptcha` | `react-turnstile` / `@marsidev/react-turnstile` | `@friendlycaptcha/react-widget` | ❌ separate libs |
| **Vue** | `vue-recaptcha` / `vue3-recaptcha2` | `@hcaptcha/vue3-hcaptcha` | `vue-turnstile` | *(thin / community)* | ❌ separate libs |
| **Svelte** | `svelte-recaptcha-v2` | *(thin / community)* | `svelte-turnstile` | *(community)* | ❌ separate libs |
| **Angular** | `ngx-captcha` / `ng-recaptcha` | *(community)* | `ngx-turnstile` | *(community)* | ⚠️ partial (`ngx-captcha`) |
| **Solid** | *(community / hand-roll)* | *(none)* | `solid-turnstile` | *(none)* | ❌ mostly absent |
| **Lit** | *(none)* | *(none)* | *(none)* | *(none)* | ❌ nothing |
| **Rozie** | ✅ | ✅ | ✅ | ✅ | ✅ **one `provider` prop** |

The pattern: React, Vue, Svelte, and Angular each have *reasonable* single-provider wrappers, but a developer who wants to **let their app switch providers** — or who simply wants the *same* component API regardless of provider — has to maintain several different dependencies with several different prop shapes and event names. **Solid is sparsely served and Lit has nothing.** Rozie ships one source to all six frameworks, with a single API across all four providers.

For the scoreless, widget-less **reCAPTCHA v3**, Rozie ships a sibling [`RecaptchaV3`](/components/captcha#recaptchav3) component (same package, named export) — an imperative-first `execute(action) → Promise<token>` surface, again one source across all six frameworks.

## Feature matrix

Cell legend: **✅** = documented out-of-the-box · **❌** = not supported · **⚠️** = partial / consumer-glue-required.

| Capability | Per-framework reCAPTCHA wrappers | Per-framework hCaptcha/Turnstile wrappers | **`@rozie-ui/captcha`** |
| --- | :---: | :---: | :---: |
| Inject provider script (singleton) | ✅ | ✅ | ✅ shared `globalThis` loader |
| Render widget into element | ✅ | ✅ | ✅ |
| **Provider-switchable (one component)** | ❌ | ❌ | ✅ `provider` prop (4 providers) |
| Friendly Captcha provider | ⚠️ separate / sparse | ⚠️ separate / sparse | ✅ `provider="friendly"` (CDN, no peer) |
| reCAPTCHA v3 (scoreless) | ⚠️ separate lib | ⚠️ separate lib | ✅ sibling `RecaptchaV3` component |
| Two-way token binding | ⚠️ via `onChange` | ⚠️ via callback | ✅ `token` model |
| `verify` / `expire` / `error` events | ✅ | ✅ | ✅ unified `{ token, provider }` |
| Imperative `reset` / `execute` / `getResponse` | ⚠️ via ref, names vary | ⚠️ via ref, names vary | ✅ uniform handle, all 6 targets |
| Invisible / programmatic challenge | ⚠️ provider-specific | ⚠️ provider-specific | ✅ `size="invisible"` + `execute()` |
| Angular `ControlValueAccessor` | ⚠️ some | ⚠️ some | ✅ automatic (single model) |
| Same API across **all 6 frameworks** | ❌ | ❌ | ✅ one `.rozie` source |
| Same API across **all 3 providers** | ❌ | ❌ | ✅ |

## What Rozie does *not* do

- **It is not a CAPTCHA itself** — it wraps the providers' own widgets, which still do the bot-detection in their iframes. You still need a site key, and you still **verify the token server-side** against the provider's `siteverify` endpoint.
- **[ALTCHA](https://altcha.org)** — the privacy-first, self-hostable alternative — is a **web component**, a different integration shape than the script-tag explicit-render contract here. Cleanly consuming a foreign web component across all six targets needs a compiler capability Rozie does not yet have, so ALTCHA is the **sole remaining deferred provider**.

## Cross-references

- [Captcha — showcase & API](/components/captcha) — props, events, the imperative handle, and gotchas.
- [Features](/guide/features) — the full Rozie author-side API that makes one source compile to six.
