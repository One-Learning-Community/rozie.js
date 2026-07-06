<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  /**
   * Which widget to render: `recaptcha` (Google reCAPTCHA v2), `hcaptcha`, `turnstile` (Cloudflare), or `friendly` (Friendly Captcha). The first three share a near-identical explicit-render API; Friendly Captcha rides an internal `adapt()` bridge onto the same surface. Construction-time — re-key the component to switch it live.
   */
  provider?: string;
  /**
   * Required. The public site key from your provider dashboard. Identifies your site to the chosen provider.
   */
  sitekey: string;
  /**
   * The verified response token (two-way `r-model`). As the sole `model: true` prop it drives the Angular `ControlValueAccessor`. Written by the widget on success and cleared on expire/reset, so reading it gives you the live response to send to your server for form submission.
   * @example
   * <Captcha r-model:token="token" provider="recaptcha" sitekey="…" />
   */
  token?: string;
  /**
   * Widget color theme: `light` or `dark` (all three core providers), or `auto` (Turnstile only). Construction-time — re-key the component to change it live.
   */
  theme?: string;
  /**
   * Widget size. reCAPTCHA/hCaptcha accept `normal`/`compact`/`invisible`; Turnstile accepts `normal`/`compact`/`flexible`. A no-op for Friendly Captcha (its `startMode` analog rides through the `options` escape hatch instead). Construction-time.
   */
  size?: string;
  /**
   * Optional tab index forwarded to the rendered widget. Omitted from the render config when left unset (`null`).
   */
  tabindex?: (number) | null;
  /**
   * Escape hatch — provider-specific render options merged last (e.g. Turnstile `action`/`cData`/`retry`, hCaptcha `hl`, reCAPTCHA `badge`, Friendly Captcha `startMode`). Lets you reach keys this component does not promote to first-class props.
   */
  options?: any;
  onverify?: (...args: unknown[]) => void;
  onexpire?: (...args: unknown[]) => void;
  onerror?: (...args: unknown[]) => void;
  [key: string]: unknown;
}

let __defaultOptions = (() => ({}))();

let {
  provider = 'recaptcha',
  sitekey,
  token = $bindable(''),
  theme = 'light',
  size = 'normal',
  tabindex = null,
  options = __defaultOptions,
  onverify,
  onexpire,
  onerror,
  ...__rozieAttrs
}: Props = $props();

let widgetEl = $state<HTMLElement | undefined>(undefined);

// The provider api.js loader (inject-once singleton + poll/timeout/error) lives
// in a vendored internal module so its branchy logic is unit-tested independent
// of any framework (see internal/loadCaptchaApi.test.ts). codegen copies
// src/internal/ into every leaf, so this relative import resolves verbatim ×6.
import { loadCaptchaApi } from './internal/loadCaptchaApi';

// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `api`/`widgetId` MUST be top-level — reset()/execute()/getResponse() (the
// $expose'd imperative handle, callable any time) read them outside $onMount.
// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `api`/`widgetId` MUST be top-level — reset()/execute()/getResponse() (the
// $expose'd imperative handle, callable any time) read them outside $onMount.
let api: any = null;
let widgetId: any = null;

// The render config shared across all three providers. The hyphenated
// `expired-callback` / `error-callback` keys are the common option names each
// provider's render() accepts. `tabindex` is omitted unless set; `options`
// (the escape hatch) is merged last so a consumer can override any key.
// The render config shared across all three providers. The hyphenated
// `expired-callback` / `error-callback` keys are the common option names each
// provider's render() accepts. `tabindex` is omitted unless set; `options`
// (the escape hatch) is merged last so a consumer can override any key.
const buildConfig = () => ({
  sitekey: sitekey,
  theme: theme,
  size: size,
  ...(tabindex != null ? {
    tabindex: tabindex
  } : {}),
  // NB: the param must NOT be named `token` — on Vue, $model.token lowers to a
  // `defineModel('token')` ref named `token`, and a same-named param shadows it
  // (`token.value = token` would write the param, not the model → v-model:token
  // never populates). Vue-only footgun (React/Solid lower to a setToken call).
  callback: (response: any) => {
    token = response;
    onverify?.({
      token: response,
      provider: provider
    });
  },
  'expired-callback': () => {
    token = '';
    onexpire?.({
      provider: provider
    });
  },
  'error-callback': () => {
    token = '';
    onerror?.({
      provider: provider
    });
  },
  ...options
});
// Imperative handle. Each guards on a live widget (null before render / after
// teardown). reset clears the two-way token to match the cleared widget.
export function reset() {
  if (widgetId != null && api && typeof api.reset === 'function') api.reset(widgetId);
  token = '';
}
// Invisible / programmatic challenge (size="invisible"). No-op until rendered.
// Invisible / programmatic challenge (size="invisible"). No-op until rendered.
export function execute() {
  if (widgetId != null && api && typeof api.execute === 'function') api.execute(widgetId);
}
// Read the current response token on demand (e.g. just before form submit).
// Read the current response token on demand (e.g. just before form submit).
export function getResponse() {
  return widgetId != null && api && typeof api.getResponse === 'function' ? api.getResponse(widgetId) : '';
}

onMount(() => {
  // Mount-local (not top-level) — read only by this closure's own async
  // .then()/.catch() and the returned teardown below. Emitter-hardening
  // backlog item #2 (project_emitter_hardening_backlog): every target keeps
  // a $onMount setup-local in scope for its own returned teardown, so this
  // no longer needs the prior TOP-LEVEL-`let` workaround (unlike `api`/
  // `widgetId` above, which stay top-level for the unrelated $expose reason).
  let disposed = false;
  loadCaptchaApi(provider).then((a: any) => {
    if (disposed) return;
    api = a;
    widgetId = api.render(widgetEl!, buildConfig());
  }).catch((err: any) => {
    onerror?.({
      provider: provider,
      error: err
    });
  });
  return () => {
    disposed = true;
    if (widgetId == null || !api) return;
    // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
    if (typeof api.remove === 'function') api.remove(widgetId);else if (typeof api.reset === 'function') api.reset(widgetId);
  };
});
</script>

<div bind:this={widgetEl} {...__rozieAttrs} class={["rozie-captcha", (__rozieAttrs)?.class]} use:applyListeners={__rozieAttrs} data-rozie-s-9c7749d4></div>
