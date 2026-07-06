import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
// The provider api.js loader (inject-once singleton + poll/timeout/error) lives
// in a vendored internal module so its branchy logic is unit-tested independent
// of any framework (see internal/loadCaptchaApi.test.ts). codegen copies
// src/internal/ into every leaf, so this relative import resolves verbatim ×6.
import { loadCaptchaApi } from './internal/loadCaptchaApi';

// Live widget handle. Top-level lets → React hoists to useRef (setup-once).
// `api`/`widgetId` MUST be top-level — reset()/execute()/getResponse() (the
// $expose'd imperative handle, callable any time) read them outside $onMount.

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
  onVerify?: (...args: any[]) => void;
  onExpire?: (...args: any[]) => void;
  onError?: (...args: any[]) => void;
}

export interface CaptchaHandle {
  reset: (...args: any[]) => any;
  execute: (...args: any[]) => any;
  getResponse: (...args: any[]) => any;
}

const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(_props: CaptchaProps, ref): JSX.Element {
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const props: Omit<CaptchaProps, 'provider' | 'theme' | 'size' | 'tabindex' | 'options'> & { provider: string; theme: string; size: string; tabindex: (number) | null; options: Record<string, any> } = {
    ..._props,
    provider: _props.provider ?? 'recaptcha',
    theme: _props.theme ?? 'light',
    size: _props.size ?? 'normal',
    tabindex: _props.tabindex ?? null,
    options: _props.options ?? __defaultOptions,
  };
  const attrs: Record<string, unknown> = (() => {
    const { provider, sitekey, token, theme, size, tabindex, options, defaultValue, onTokenChange, defaultToken, ...rest } = _props as CaptchaProps & Record<string, unknown>;
    void provider; void sitekey; void token; void theme; void size; void tabindex; void options; void defaultValue; void onTokenChange; void defaultToken;
    return rest;
  })();
  const api = useRef<any>(null);
  const widgetId = useRef<any>(null);
  const [token, setToken] = useControllableState({
    value: props.token,
    defaultValue: props.defaultToken ?? '',
    onValueChange: props.onTokenChange,
  });
  const widgetEl = useRef<HTMLDivElement | null>(null);

  const { onError: _rozieProp_onError, onExpire: _rozieProp_onExpire, onVerify: _rozieProp_onVerify } = props;
    const buildConfig = useCallback(() => ({
    sitekey: props.sitekey,
    theme: props.theme,
    size: props.size,
    ...(props.tabindex != null ? {
      tabindex: props.tabindex
    } : {}),
    // NB: the param must NOT be named `token` — on Vue, $model.token lowers to a
    // `defineModel('token')` ref named `token`, and a same-named param shadows it
    // (`token.value = token` would write the param, not the model → v-model:token
    // never populates). Vue-only footgun (React/Solid lower to a setToken call).
    callback: (response: any) => {
      setToken(response);
      _rozieProp_onVerify && _rozieProp_onVerify({
        token: response,
        provider: props.provider
      });
    },
    'expired-callback': () => {
      setToken('');
      _rozieProp_onExpire && _rozieProp_onExpire({
        provider: props.provider
      });
    },
    'error-callback': () => {
      setToken('');
      _rozieProp_onError && _rozieProp_onError({
        provider: props.provider
      });
    },
    ...props.options
  }), [_rozieProp_onError, _rozieProp_onExpire, _rozieProp_onVerify, props.options, props.provider, props.sitekey, props.size, props.tabindex, props.theme, setToken]);
  // Imperative handle. Each guards on a live widget (null before render / after
  // teardown). reset clears the two-way token to match the cleared widget.
  function reset() {
    if (widgetId.current != null && api.current && typeof api.current.reset === 'function') api.current.reset(widgetId.current);
    setToken('');
  }
  // Invisible / programmatic challenge (size="invisible"). No-op until rendered.
  // Invisible / programmatic challenge (size="invisible"). No-op until rendered.
  function execute() {
    if (widgetId.current != null && api.current && typeof api.current.execute === 'function') api.current.execute(widgetId.current);
  }
  // Read the current response token on demand (e.g. just before form submit).
  // Read the current response token on demand (e.g. just before form submit).
  function getResponse() {
    return widgetId.current != null && api.current && typeof api.current.getResponse === 'function' ? api.current.getResponse(widgetId.current) : '';
  }

  useEffect(() => {
    // Mount-local (not top-level) — read only by this closure's own async
    // .then()/.catch() and the returned teardown below. Emitter-hardening
    // backlog item #2 (project_emitter_hardening_backlog): every target keeps
    // a $onMount setup-local in scope for its own returned teardown, so this
    // no longer needs the prior TOP-LEVEL-`let` workaround (unlike `api`/
    // `widgetId` above, which stay top-level for the unrelated $expose reason).
    let disposed = false;
    loadCaptchaApi(props.provider).then((a: any) => {
      if (disposed) return;
      api.current = a;
      widgetId.current = api.current.render(widgetEl.current!, buildConfig());
    }).catch((err: any) => {
      props.onError && props.onError({
        provider: props.provider,
        error: err
      });
    });
    return () => {
      disposed = true;
      if (widgetId.current == null || !api.current) return;
      // Turnstile fully removes a widget; reCAPTCHA/hCaptcha only reset.
      if (typeof api.current.remove === 'function') api.current.remove(widgetId.current);else if (typeof api.current.reset === 'function') api.current.reset(widgetId.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const _rozieExposeRef = useRef({ reset, execute, getResponse });
  _rozieExposeRef.current = { reset, execute, getResponse };
  useImperativeHandle(ref, () => ({ reset: (...args: Parameters<typeof reset>): ReturnType<typeof reset> => _rozieExposeRef.current.reset(...args), execute: (...args: Parameters<typeof execute>): ReturnType<typeof execute> => _rozieExposeRef.current.execute(...args), getResponse: (...args: Parameters<typeof getResponse>): ReturnType<typeof getResponse> => _rozieExposeRef.current.getResponse(...args) }), []);

  return (
    <>
    <div ref={widgetEl} {...attrs} className={clsx("rozie-captcha", (attrs.className as string | undefined))} data-rozie-s-9c7749d4="" />
    </>
  );
});
export default Captcha;
