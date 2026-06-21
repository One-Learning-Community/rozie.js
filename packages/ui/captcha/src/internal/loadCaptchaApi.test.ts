/**
 * loadCaptchaApi.test.ts — unit tests for the provider api.js loader.
 *
 * This is the one piece of genuinely branchy, framework-agnostic logic in the
 * Captcha family (inject-once singleton, poll-until-ready, per-provider cache,
 * timeout, script-error path) — a regression here ships SILENTLY (the widget
 * just never loads) past the typecheck/build/surface gates. happy-dom provides
 * `document` + `Event`; vitest fake timers drive the poll/timeout deterministically.
 *
 * We pass a TEST_PROVIDERS map whose `src` is empty so happy-dom does NOT try to
 * fetch/execute a real provider URL (which would throw async). The loader logic
 * under test is independent of the src value; the REAL provider config is
 * asserted separately as pure data.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadCaptchaApi, CAPTCHA_PROVIDERS, LOAD_TIMEOUT_MS, type CaptchaApi, type ProviderConfig } from './loadCaptchaApi';

const G = globalThis as unknown as Record<string, unknown>;
const makeApi = (): CaptchaApi => ({ render: () => 'widget-id' });
const scriptFor = (p: string) => document.head.querySelector(`script[data-rozie-captcha="${p}"]`);

// Empty src → happy-dom does not attempt a real network load. Real globals so the
// singleton cache / poll behave exactly as in production.
const TEST_PROVIDERS: Record<string, ProviderConfig> = {
  recaptcha: { src: '', global: 'grecaptcha' },
  hcaptcha: { src: '', global: 'hcaptcha' },
  turnstile: { src: '', global: 'turnstile' },
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete G.__rozieCaptchaLoaders;
  for (const { global } of Object.values(CAPTCHA_PROVIDERS)) delete G[global];
  document.head.querySelectorAll('script[data-rozie-captcha]').forEach((s) => s.remove());
});

describe('loadCaptchaApi', () => {
  it('exposes a correct real provider config (host + render=explicit + global)', () => {
    expect(CAPTCHA_PROVIDERS.recaptcha).toEqual({
      src: 'https://www.google.com/recaptcha/api.js?render=explicit',
      global: 'grecaptcha',
    });
    expect(CAPTCHA_PROVIDERS.hcaptcha.global).toBe('hcaptcha');
    expect(CAPTCHA_PROVIDERS.turnstile.src).toContain('challenges.cloudflare.com');
    // The original three are explicit-render with NO adapt (identity path).
    for (const name of ['recaptcha', 'hcaptcha', 'turnstile'] as const) {
      expect(CAPTCHA_PROVIDERS[name].src).toContain('render=explicit');
      expect(CAPTCHA_PROVIDERS[name].adapt).toBeUndefined();
    }
  });

  it('exposes a Friendly Captcha provider via a CDN bundle + adapt (NOT render=explicit)', () => {
    const fc = CAPTCHA_PROVIDERS.friendly;
    expect(fc.global).toBe('frcaptcha');
    expect(fc.src).toContain('@friendlycaptcha/sdk@1');
    expect(fc.src).toContain('site.compat.min.js');
    expect(fc.src).not.toContain('render=explicit'); // CDN bundle, not an api.js
    expect(typeof fc.adapt).toBe('function'); // the createWidget→CaptchaApi bridge
  });

  it('rejects an unknown provider without touching the DOM', async () => {
    await expect(loadCaptchaApi('nope', TEST_PROVIDERS)).rejects.toThrow('Unknown captcha provider: nope');
    expect(document.head.querySelector('script[data-rozie-captcha]')).toBeNull();
  });

  it('resolves immediately when the global is already present (no script injected)', async () => {
    const api = makeApi();
    G.grecaptcha = api;
    await expect(loadCaptchaApi('recaptcha', TEST_PROVIDERS)).resolves.toBe(api);
    expect(scriptFor('recaptcha')).toBeNull();
  });

  it('injects the api.js script once, then resolves when the global appears', async () => {
    const p = loadCaptchaApi('recaptcha', TEST_PROVIDERS);
    const el = scriptFor('recaptcha') as HTMLScriptElement | null;
    expect(el).toBeTruthy();
    expect(el!.getAttribute('data-rozie-captcha')).toBe('recaptcha');
    expect(el!.async).toBe(true);

    const api = makeApi();
    G.grecaptcha = api; // SDK finished loading
    await vi.advanceTimersByTimeAsync(60); // one poll tick (50ms)
    await expect(p).resolves.toBe(api);
  });

  it('caches per provider — a second call returns the same promise and injects no second script', async () => {
    const p1 = loadCaptchaApi('recaptcha', TEST_PROVIDERS);
    const p2 = loadCaptchaApi('recaptcha', TEST_PROVIDERS);
    expect(p1).toBe(p2);
    expect(document.head.querySelectorAll('script[data-rozie-captcha="recaptcha"]')).toHaveLength(1);

    G.grecaptcha = makeApi();
    await vi.advanceTimersByTimeAsync(60);
    await p1; // settle to avoid a dangling timer
  });

  it('keeps providers independent (separate cache entries + separate scripts)', async () => {
    const p1 = loadCaptchaApi('recaptcha', TEST_PROVIDERS);
    const p2 = loadCaptchaApi('hcaptcha', TEST_PROVIDERS);
    expect(p1).not.toBe(p2);
    expect(scriptFor('recaptcha')).toBeTruthy();
    expect(scriptFor('hcaptcha')).toBeTruthy();

    G.grecaptcha = makeApi();
    G.hcaptcha = makeApi();
    await vi.advanceTimersByTimeAsync(60);
    await Promise.all([p1, p2]);
  });

  it('rejects when the script fires an error event', async () => {
    const p = loadCaptchaApi('hcaptcha', TEST_PROVIDERS);
    scriptFor('hcaptcha')!.dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow('Failed to load hcaptcha script');
  });

  it('rejects after the load timeout when the global never appears', async () => {
    const p = loadCaptchaApi('turnstile', TEST_PROVIDERS);
    const assertion = expect(p).rejects.toThrow('turnstile script load timeout');
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS + 100);
    await assertion;
  });
});

// ---------------------------------------------------------------------------
// Friendly Captcha — the 4th provider. A different SDK shape (`createWidget`
// returning an event-emitter handle) bridged onto CaptchaApi via `adapt`.
// ---------------------------------------------------------------------------

// A fake FC `createWidget` handle that records construction + dispatches the
// frc:widget.* events to whatever listeners the adapter registered.
interface FakeWidget {
  reset: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  getResponse: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  addEventListener: (type: string, cb: (e: unknown) => void) => void;
  fire: (type: string, detail?: { response?: string }) => void;
}

function makeFakeWidget(): FakeWidget {
  const listeners: Record<string, ((e: unknown) => void)[]> = {};
  return {
    reset: vi.fn(),
    start: vi.fn(),
    getResponse: vi.fn(() => 'fc-token'),
    destroy: vi.fn(),
    addEventListener(type, cb) {
      (listeners[type] ||= []).push(cb);
    },
    fire(type, detail) {
      for (const cb of listeners[type] || []) cb({ detail });
    },
  };
}

// Build the REAL friendly adapt() against a fake `frcaptcha` global so we test
// the shipped bridge (CAPTCHA_PROVIDERS.friendly.adapt), not a re-implementation.
function adaptFriendly(widget: FakeWidget) {
  const global = { createWidget: vi.fn(() => widget) };
  const api = CAPTCHA_PROVIDERS.friendly.adapt!(global) as CaptchaApi;
  return { global, api };
}

describe('loadCaptchaApi — Friendly Captcha adapter', () => {
  it('maps createWidget → CaptchaApi: render builds the widget, verbs delegate to the handle', () => {
    const widget = makeFakeWidget();
    const { global, api } = adaptFriendly(widget);
    const el = document.createElement('div');

    const id = api.render(el, { sitekey: 'sk', theme: 'dark', startMode: 'auto' });
    expect(global.createWidget).toHaveBeenCalledWith({
      element: el,
      sitekey: 'sk',
      theme: 'dark',
      startMode: 'auto',
    });
    expect(id).toBe(widget); // the handle IS the opaque widget id

    api.reset!(id);
    api.execute!(id); // → start()
    api.getResponse!(id);
    api.remove!(id); // → destroy()
    expect(widget.reset).toHaveBeenCalledTimes(1);
    expect(widget.start).toHaveBeenCalledTimes(1);
    expect(widget.getResponse).toHaveBeenCalledTimes(1);
    expect(widget.destroy).toHaveBeenCalledTimes(1);
  });

  it('bridges the frc:widget.* events to callback / expired-callback / error-callback', () => {
    const widget = makeFakeWidget();
    const { api } = adaptFriendly(widget);
    const callback = vi.fn();
    const expired = vi.fn();
    const error = vi.fn();

    api.render(document.createElement('div'), {
      sitekey: 'sk',
      callback,
      'expired-callback': expired,
      'error-callback': error,
    });

    widget.fire('frc:widget.complete', { response: 'tok-123' });
    widget.fire('frc:widget.expire');
    widget.fire('frc:widget.error');
    expect(callback).toHaveBeenCalledWith('tok-123');
    expect(expired).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });

  it('the widened readiness probe accepts a createWidget-only global (no render)', async () => {
    const widget = makeFakeWidget();
    const global = { createWidget: vi.fn(() => widget) };
    G.frcaptcha = global; // FC-shape global already present (no `render` fn)

    const fcProviders: Record<string, ProviderConfig> = {
      friendly: { src: '', global: 'frcaptcha', adapt: CAPTCHA_PROVIDERS.friendly.adapt },
    };
    const api = await loadCaptchaApi('friendly', fcProviders);
    // Resolved value is the ADAPTED CaptchaApi (has render()), not the raw global.
    expect(typeof api.render).toBe('function');
    const id = api.render(document.createElement('div'), { sitekey: 'sk' });
    expect(global.createWidget).toHaveBeenCalledTimes(1);
    expect(id).toBe(widget);

    delete G.frcaptcha;
  });
});
