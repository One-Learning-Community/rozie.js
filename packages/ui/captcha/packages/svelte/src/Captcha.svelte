<script lang="ts">
import { applyListeners } from '@rozie/runtime-svelte';

import { onMount } from 'svelte';

interface Props {
  provider?: string;
  sitekey: string;
  token?: string;
  theme?: string;
  size?: string;
  tabindex?: (number) | null;
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
// `disposed` MUST be top-level (not declared inside $onMount): the Solid emitter
// extracts the teardown into a separate onCleanup() whose scope can't see a
// mount-body local, so a `let disposed` inside $onMount is out of scope in the
// teardown (TS2304). Top-level — like api/widgetId — is visible to both.
// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `disposed` MUST be top-level (not declared inside $onMount): the Solid emitter
// extracts the teardown into a separate onCleanup() whose scope can't see a
// mount-body local, so a `let disposed` inside $onMount is out of scope in the
// teardown (TS2304). Top-level — like api/widgetId — is visible to both.
let api: any = null;
let widgetId: any = null;
let disposed = false;

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
  disposed = false;
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
