import type { JSX } from 'solid-js';
import { mergeProps, onCleanup, onMount, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';
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

interface CaptchaProps {
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
  defaultToken?: string;
  onTokenChange?: (token: string) => void;
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
  options?: Record<string, any>;
  onVerify?: (...args: unknown[]) => void;
  onExpire?: (...args: unknown[]) => void;
  onError?: (...args: unknown[]) => void;
  ref?: (h: CaptchaHandle) => void;
}

export interface CaptchaHandle {
  reset: (...args: any[]) => any;
  execute: (...args: any[]) => any;
  getResponse: (...args: any[]) => any;
}

export default function Captcha(_props: CaptchaProps): JSX.Element {
  const _merged = mergeProps({ provider: 'recaptcha', theme: 'light', size: 'normal', tabindex: null, options: (() => ({}))() }, _props);
  const [local, attrs] = splitProps(_merged, ['provider', 'sitekey', 'token', 'theme', 'size', 'tabindex', 'options', 'ref']);
  onMount(() => { local.ref?.({ reset, execute, getResponse }); });

  const [token, setToken] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'token', '');
  onMount(() => {
    const _cleanup = (() => {
    disposed = false;
    loadCaptchaApi(local.provider).then((a: any) => {
      if (disposed) return;
      api = a;
      widgetId = api.render(widgetElRef, buildConfig());
    }).catch((err: any) => {
      _props.onError?.({
        provider: local.provider,
        error: err
      });
    });
  })() as unknown;
    if (_cleanup) onCleanup(_cleanup as () => void);
    onCleanup(() => {
    disposed = true;
    if (widgetId == null || !api) return;
    // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
    if (typeof api.remove === 'function') api.remove(widgetId);else if (typeof api.reset === 'function') api.reset(widgetId);
  });
  });
  let widgetElRef: HTMLElement | null = null;

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
  function buildConfig() {
    return {
      sitekey: local.sitekey,
      theme: local.theme,
      size: local.size,
      ...(local.tabindex != null ? {
        tabindex: local.tabindex
      } : {}),
      // NB: the param must NOT be named `token` — on Vue, $model.token lowers to a
      // `defineModel('token')` ref named `token`, and a same-named param shadows it
      // (`token.value = token` would write the param, not the model → v-model:token
      // never populates). Vue-only footgun (React/Solid lower to a setToken call).
      callback: (response: any) => {
        setToken(response);
        _props.onVerify?.({
          token: response,
          provider: local.provider
        });
      },
      'expired-callback': () => {
        setToken('');
        _props.onExpire?.({
          provider: local.provider
        });
      },
      'error-callback': () => {
        setToken('');
        _props.onError?.({
          provider: local.provider
        });
      },
      ...local.options
    };
  }
  // Imperative handle. Each guards on a live widget (null before render / after
  // teardown). reset clears the two-way token to match the cleared widget.
  function reset() {
    if (widgetId != null && api && typeof api.reset === 'function') api.reset(widgetId);
    setToken('');
  }
  // Invisible / programmatic challenge (size="invisible"). No-op until rendered.
  function execute() {
    if (widgetId != null && api && typeof api.execute === 'function') api.execute(widgetId);
  }
  // Read the current response token on demand (e.g. just before form submit).
  function getResponse() {
    return widgetId != null && api && typeof api.getResponse === 'function' ? api.getResponse(widgetId) : '';
  }

  return (
    <>
    <div ref={(el) => { widgetElRef = el as HTMLElement; }} {...attrs} class={"rozie-captcha" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-9c7749d4="" />
    </>
  );
}
