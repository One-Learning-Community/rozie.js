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
  /** The global name the script installs (`grecaptcha` / `hcaptcha` / `turnstile` / `frcaptcha`). */
  global: string;
  /**
   * Optional bridge from the raw resolved global to the `CaptchaApi` shape.
   *
   * The original three providers (recaptcha/hcaptcha/turnstile) share the
   * `render(el, cfg)`→id / `reset` / `execute` / `getResponse` surface, so they
   * declare NO `adapt` and resolution is IDENTITY — the raw global IS the
   * `CaptchaApi` unchanged (byte-for-byte the same behavior as before this hook
   * existed). Friendly Captcha exposes a different SDK shape (`createWidget`
   * returning an event-emitter handle), so it supplies an `adapt` that maps
   * that surface onto `CaptchaApi`. When present, `adapt` is applied to the
   * resolved global BEFORE the loader promise resolves / caches, so the cached
   * value is always the adapted `CaptchaApi`, never the raw global.
   */
  adapt?: (global: unknown) => CaptchaApi;
}

/**
 * Bridge Friendly Captcha's `createWidget` SDK (the `@friendlycaptcha/sdk`
 * compat build, loaded from the CDN — NO npm peer dependency) onto `CaptchaApi`.
 *
 * FC has no explicit-`render`/widget-id model: `createWidget({ element, ... })`
 * returns an event-emitter handle (`frc:widget.complete|expire|error`) with
 * `reset()` / `start()` / `getResponse()` / `destroy()`. We treat that handle AS
 * the opaque widget id the rest of the family already threads around. FC also
 * has no `size` concept — `startMode` is the closest analog and rides through
 * the `options` escape hatch (or a `startMode` config key if a consumer passes
 * one directly).
 */
const adaptFriendly = (g: unknown): CaptchaApi => {
  const fc = g as { createWidget: (opts: Record<string, unknown>) => FriendlyWidget };
  return {
    render(el: Element, cfg: Record<string, unknown>) {
      const h = fc.createWidget({
        element: el,
        sitekey: cfg.sitekey,
        theme: cfg.theme,
        startMode: cfg.startMode,
      });
      h.addEventListener('frc:widget.complete', (e: FriendlyEvent) => {
        const cb = cfg.callback as ((token: string) => void) | undefined;
        if (typeof cb === 'function') cb(e.detail?.response ?? '');
      });
      h.addEventListener('frc:widget.expire', () => {
        const cb = cfg['expired-callback'] as (() => void) | undefined;
        if (typeof cb === 'function') cb();
      });
      h.addEventListener('frc:widget.error', () => {
        const cb = cfg['error-callback'] as (() => void) | undefined;
        if (typeof cb === 'function') cb();
      });
      return h;
    },
    reset: (id: unknown) => (id as FriendlyWidget).reset(),
    execute: (id: unknown) => (id as FriendlyWidget).start(),
    getResponse: (id: unknown) => (id as FriendlyWidget).getResponse(),
    remove: (id: unknown) => (id as FriendlyWidget).destroy(),
  };
};

/** The slice of an FC `createWidget` handle this bridge drives. */
interface FriendlyWidget {
  addEventListener: (type: string, cb: (e: FriendlyEvent) => void) => void;
  reset: () => void;
  start: () => void;
  getResponse: () => string;
  destroy: () => void;
}
interface FriendlyEvent {
  detail?: { response?: string };
}

export const CAPTCHA_PROVIDERS: Record<string, ProviderConfig> = {
  recaptcha: { src: 'https://www.google.com/recaptcha/api.js?render=explicit', global: 'grecaptcha' },
  hcaptcha: { src: 'https://js.hcaptcha.com/1/api.js?render=explicit', global: 'hcaptcha' },
  turnstile: { src: 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', global: 'turnstile' },
  // Friendly Captcha — a different SDK shape (`createWidget`), bridged onto
  // CaptchaApi via `adapt`. CDN compat build pinned to the major (`@1`); NO
  // `@friendlycaptcha/sdk` npm dependency (the family's zero-peer-dep design).
  friendly: {
    src: 'https://cdn.jsdelivr.net/npm/@friendlycaptcha/sdk@1/site.compat.min.js',
    global: 'frcaptcha',
    adapt: adaptFriendly,
  },
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

  const win = globalThis as unknown as Record<string, unknown>;
  // A resolved global is "ready" once it exposes EITHER an explicit-render
  // `render()` (recaptcha/hcaptcha/turnstile) OR FC's `createWidget()`. The
  // `adapt` hook (when present) maps whichever shape arrived onto CaptchaApi.
  const ready = (g: unknown): boolean => {
    if (!g) return false;
    const o = g as { render?: unknown; createWidget?: unknown };
    return typeof o.render === 'function' || typeof o.createWidget === 'function';
  };
  // Resolve = the raw global, run through `adapt` when the provider supplies one.
  const resolveApi = (g: unknown): CaptchaApi => (cfg.adapt ? cfg.adapt(g) : (g as CaptchaApi));

  const p = new Promise<CaptchaApi>((resolve, reject) => {
    if (ready(win[cfg.global])) {
      resolve(resolveApi(win[cfg.global]));
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
        resolve(resolveApi(win[cfg.global]));
      } else if (Date.now() - started > LOAD_TIMEOUT_MS) {
        clearInterval(poll);
        reject(new Error(provider + ' script load timeout'));
      }
    }, 50);
  });

  cache[provider] = p;
  return p;
}
