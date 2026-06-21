// loadCaptchaApi.ts — provider api.js loader for the Captcha family.
//
// Extracted from Captcha.rozie so the one piece of real branchy logic (inject
// once, poll until ready, cache per provider, timeout, error) is unit-testable
// independent of any framework — the sortable-list `internal/useSortableJS`
// pattern. codegen.mjs vendors this file (minus *.test.ts) into every leaf's
// `src/internal/`, so the `./internal/loadCaptchaApi` import resolves verbatim
// in all six compiled outputs.
//
// Framework-agnostic: touches only `document`, `globalThis`, and timers.

/** The slice of a provider's global SDK this wrapper drives. */
export interface CaptchaApi {
  render: (el: Element, cfg: Record<string, unknown>) => unknown;
  reset?: (id: unknown) => void;
  execute?: (id: unknown) => void;
  getResponse?: (id: unknown) => string;
  remove?: (id: unknown) => void;
}

export interface ProviderConfig {
  /** The api.js URL (`?render=explicit` so we own the render call + widget id). */
  src: string;
  /** The global name the script installs (`grecaptcha` / `hcaptcha` / `turnstile`). */
  global: string;
}

export const CAPTCHA_PROVIDERS: Record<string, ProviderConfig> = {
  recaptcha: { src: 'https://www.google.com/recaptcha/api.js?render=explicit', global: 'grecaptcha' },
  hcaptcha: { src: 'https://js.hcaptcha.com/1/api.js?render=explicit', global: 'hcaptcha' },
  turnstile: { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', global: 'turnstile' },
};

/** How long to poll for the provider global before giving up (ms). */
export const LOAD_TIMEOUT_MS = 20000;

type LoaderCache = Record<string, Promise<CaptchaApi>>;

/**
 * Load a provider's api.js ONCE across the whole document, shared by every
 * `<Captcha>` instance via a `globalThis` singleton (a per-instance cache would
 * re-inject per component). Resolves with the provider global once its
 * `render()` is callable; rejects on an unknown provider, a script load error,
 * or a `LOAD_TIMEOUT_MS` timeout. `providers` is injectable for tests.
 */
export function loadCaptchaApi(
  provider: string,
  providers: Record<string, ProviderConfig> = CAPTCHA_PROVIDERS,
): Promise<CaptchaApi> {
  const cfg = providers[provider];
  if (!cfg) return Promise.reject(new Error('Unknown captcha provider: ' + provider));

  const root = globalThis as unknown as { __rozieCaptchaLoaders?: LoaderCache };
  const cache = (root.__rozieCaptchaLoaders ||= {});
  if (cache[provider]) return cache[provider];

  const win = globalThis as unknown as Record<string, CaptchaApi | undefined>;
  const ready = (g: CaptchaApi | undefined): g is CaptchaApi => !!g && typeof g.render === 'function';

  const p = new Promise<CaptchaApi>((resolve, reject) => {
    if (ready(win[cfg.global])) {
      resolve(win[cfg.global] as CaptchaApi);
      return;
    }
    if (!document.querySelector('script[data-rozie-captcha="' + provider + '"]')) {
      const el = document.createElement('script');
      el.src = cfg.src;
      el.async = true;
      el.defer = true;
      el.setAttribute('data-rozie-captcha', provider);
      el.addEventListener('error', () => reject(new Error('Failed to load ' + provider + ' script')));
      document.head.appendChild(el);
    }
    const started = Date.now();
    const poll = setInterval(() => {
      if (ready(win[cfg.global])) {
        clearInterval(poll);
        resolve(win[cfg.global] as CaptchaApi);
      } else if (Date.now() - started > LOAD_TIMEOUT_MS) {
        clearInterval(poll);
        reject(new Error(provider + ' script load timeout'));
      }
    }, 50);
  });

  cache[provider] = p;
  return p;
}
