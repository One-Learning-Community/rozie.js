import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
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
  provider?: string;
  sitekey: string;
  token?: string;
  defaultToken?: string;
  onTokenChange?: (token: string) => void;
  theme?: string;
  size?: string;
  tabindex?: (number) | null;
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
  const disposed = useRef(false);
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
    disposed.current = false;
    loadCaptchaApi(props.provider).then((a: any) => {
      if (disposed.current) return;
      api.current = a;
      widgetId.current = api.current.render(widgetEl.current!, buildConfig());
    }).catch((err: any) => {
      props.onError && props.onError({
        provider: props.provider,
        error: err
      });
    });
    return () => {
      disposed.current = true;
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
