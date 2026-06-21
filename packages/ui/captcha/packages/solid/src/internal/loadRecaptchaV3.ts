// loadRecaptchaV3.ts — reCAPTCHA v3 api.js loader for the RecaptchaV3 family.
//
// reCAPTCHA v3 is scoreless and widget-less: there is NO render() and no DOM
// element — the script URL carries the sitekey (`?render=SITEKEY`, distinct from
// v2's `?render=explicit`), readiness is gated on `grecaptcha.ready(cb)`, and a
// verification token comes from `grecaptcha.execute(sitekey, { action })`.
//
// Modeled on loadCaptchaApi.ts (same inject-once singleton + poll/timeout/error
// discipline, same framework-agnostic constraint — touches only `document`,
// `globalThis`, and timers), but with TWO v3-specific differences:
//
//   1. The singleton cache is keyed on the SITEKEY, not a provider name. v2 and
//      v3 both install the same `grecaptcha` global, and v3 binds a sitekey at
//      SCRIPT-LOAD time (it is in the URL). Keying on sitekey means two distinct
//      sitekeys get two scripts + two cache entries, while the same sitekey
//      twice shares one — and a v2 `<Captcha>` + a v3 `<RecaptchaV3>` on one page
//      never collide on a single provider-name cache slot.
//   2. Resolution waits for `grecaptcha.ready(cb)` (not just global presence) —
//      v3's execute path is only safe once `ready` has fired.
//
// codegen.mjs vendors this file (minus *.test.ts) into every leaf's
// `src/internal/`, so the `./internal/loadRecaptchaV3` import resolves verbatim
// in all six compiled outputs.

/** The v3 api.js base URL. The sitekey is appended (`render=SITEKEY`) per call. */
export const RECAPTCHA_V3_SRC = 'https://www.google.com/recaptcha/api.js?render=';

/** How long to poll for `grecaptcha` before giving up (ms). */
export const LOAD_TIMEOUT_MS = 20000;

/** The slice of the v3 `grecaptcha` global this loader drives. */
export interface RecaptchaV3Global {
  ready: (cb: () => void) => void;
  execute: (sitekey: string, opts: { action: string }) => Promise<string>;
}

type LoaderCache = Record<string, Promise<RecaptchaV3Global>>;

const getGrecaptcha = (): RecaptchaV3Global | undefined =>
  (globalThis as unknown as { grecaptcha?: RecaptchaV3Global }).grecaptcha;

/**
 * Load reCAPTCHA v3's api.js ONCE per sitekey across the whole document, shared
 * by every `<RecaptchaV3>` instance via a `globalThis` singleton keyed on the
 * sitekey. Resolves with the `grecaptcha` global once `grecaptcha.ready(cb)` has
 * fired; rejects on a script load error or a `LOAD_TIMEOUT_MS` timeout.
 *
 * `srcBase` is injectable for tests (pass `''` so happy-dom does not attempt a
 * real network fetch — mirrors loadCaptchaApi's injectable `providers` seam).
 */
export function loadRecaptchaV3(sitekey: string, srcBase: string = RECAPTCHA_V3_SRC): Promise<RecaptchaV3Global> {
  const root = globalThis as unknown as { __rozieRecaptchaV3Loaders?: LoaderCache };
  const cache = (root.__rozieRecaptchaV3Loaders ||= {});
  if (cache[sitekey]) return cache[sitekey];

  const p = new Promise<RecaptchaV3Global>((resolve, reject) => {
    let settled = false;
    const ready = (g: RecaptchaV3Global) => {
      // Gate on grecaptcha.ready() — v3 execute is only safe afterward.
      g.ready(() => {
        if (settled) return;
        settled = true;
        resolve(g);
      });
    };

    const present = getGrecaptcha();
    if (present && typeof present.ready === 'function') {
      ready(present);
      return;
    }

    if (!document.querySelector('script[data-rozie-recaptcha-v3="' + sitekey + '"]')) {
      const el = document.createElement('script');
      el.src = srcBase + encodeURIComponent(sitekey);
      el.async = true;
      el.defer = true;
      el.setAttribute('data-rozie-recaptcha-v3', sitekey);
      el.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        reject(new Error('Failed to load reCAPTCHA v3 script for sitekey: ' + sitekey));
      });
      document.head.appendChild(el);
    }

    const started = Date.now();
    const poll = setInterval(() => {
      const g = getGrecaptcha();
      if (g && typeof g.ready === 'function') {
        clearInterval(poll);
        ready(g);
      } else if (Date.now() - started > LOAD_TIMEOUT_MS) {
        clearInterval(poll);
        if (settled) return;
        settled = true;
        reject(new Error('reCAPTCHA v3 script load timeout for sitekey: ' + sitekey));
      }
    }, 50);
  });

  cache[sitekey] = p;
  return p;
}

/**
 * Run a v3 challenge for `sitekey` + `action`, returning a fresh token.
 * Delegates to `grecaptcha.execute(sitekey, { action })`. Call AFTER
 * `loadRecaptchaV3(sitekey)` has resolved (the component threads that order).
 */
export function execute(sitekey: string, opts: { action: string }): Promise<string> {
  const g = getGrecaptcha();
  if (!g || typeof g.execute !== 'function') {
    return Promise.reject(new Error('reCAPTCHA v3 not loaded for sitekey: ' + sitekey));
  }
  return g.execute(sitekey, opts);
}
