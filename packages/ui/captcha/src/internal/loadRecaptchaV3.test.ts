/**
 * loadRecaptchaV3.test.ts — unit tests for the reCAPTCHA v3 api.js loader.
 *
 * v3 is scoreless / widget-less: the script URL carries the sitekey
 * (`?render=SITEKEY`, NOT `?render=explicit`), readiness is gated on
 * `grecaptcha.ready(cb)`, and verification is `grecaptcha.execute(sitekey,
 * { action }) → Promise<token>`. The one branchy, framework-agnostic piece
 * (inject-once-per-sitekey singleton, ready-gate, timeout, script-error) is
 * unit-tested here independent of any framework — mirroring loadCaptchaApi.test.ts.
 *
 * Critically the cache is keyed on SITEKEY, not a provider name, so a v2 widget
 * and a v3 call sharing the `grecaptcha` global on one page do NOT collide.
 *
 * happy-dom provides `document` + `Event`; vitest fake timers drive the
 * poll/ready/timeout deterministically. The `src` is empty in tests so happy-dom
 * does not attempt a real network load.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadRecaptchaV3, execute, RECAPTCHA_V3_SRC, LOAD_TIMEOUT_MS } from './loadRecaptchaV3';

const G = globalThis as unknown as Record<string, unknown>;
const scriptFor = (sk: string) => document.head.querySelector(`script[data-rozie-recaptcha-v3="${sk}"]`);

// A `data:` base → happy-dom resolves it inline and does NOT fire a network
// error (an empty/relative src would: happy-dom appends the sitekey so the src
// is never the literal `''` that suppresses fetch in loadCaptchaApi's tests).
// The loader's poll/ready/timeout/error logic is independent of the src value;
// the real URL shape is asserted separately against RECAPTCHA_V3_SRC.
const TEST_SRC = 'data:text/javascript,//render=';
const load = (sk: string) => loadRecaptchaV3(sk, TEST_SRC);

// A fake grecaptcha v3 global: ready(cb) fires cb on the next microtask;
// execute(sitekey,{action}) resolves with a deterministic token.
function makeGrecaptcha(token = 'v3-token') {
  return {
    ready: vi.fn((cb: () => void) => {
      Promise.resolve().then(cb);
    }),
    execute: vi.fn((_sitekey: string, _opts: { action: string }) => Promise.resolve(token)),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete G.__rozieRecaptchaV3Loaders;
  delete G.grecaptcha;
  document.head.querySelectorAll('script[data-rozie-recaptcha-v3]').forEach((s) => s.remove());
});

describe('loadRecaptchaV3', () => {
  it('exposes the v3 api.js base URL (render-in-url form, not render=explicit)', () => {
    expect(RECAPTCHA_V3_SRC).toContain('https://www.google.com/recaptcha/api.js');
    expect(RECAPTCHA_V3_SRC).toContain('render=');
    expect(RECAPTCHA_V3_SRC).not.toContain('render=explicit');
  });

  it('injects the script once with the sitekey IN the url + marker attr + async', async () => {
    const p = load('SITE_A'); // TEST_SRC carries the `render=` shape
    const el = scriptFor('SITE_A') as HTMLScriptElement | null;
    expect(el).toBeTruthy();
    expect(el!.src).toContain('render=SITE_A'); // sitekey is in the URL
    expect(el!.getAttribute('data-rozie-recaptcha-v3')).toBe('SITE_A');
    expect(el!.async).toBe(true);

    G.grecaptcha = makeGrecaptcha();
    await vi.advanceTimersByTimeAsync(60); // one poll tick
    await p; // settle
  });

  it('caches per SITEKEY — same sitekey twice → one promise + one script', async () => {
    const p1 = load('SITE_A');
    const p2 = load('SITE_A');
    expect(p1).toBe(p2);
    expect(document.head.querySelectorAll('script[data-rozie-recaptcha-v3="SITE_A"]')).toHaveLength(1);

    G.grecaptcha = makeGrecaptcha();
    await vi.advanceTimersByTimeAsync(60);
    await p1;
  });

  it('keys on sitekey not provider — two sitekeys → distinct promises + two scripts (v2/v3 collision-safe)', async () => {
    const pA = load('SITE_A');
    const pB = load('SITE_B');
    expect(pA).not.toBe(pB);
    expect(scriptFor('SITE_A')).toBeTruthy();
    expect(scriptFor('SITE_B')).toBeTruthy();

    G.grecaptcha = makeGrecaptcha();
    await vi.advanceTimersByTimeAsync(60);
    await Promise.all([pA, pB]);
  });

  it('gates resolution on grecaptcha.ready(cb)', async () => {
    const grecaptcha = makeGrecaptcha();
    const p = load('SITE_A');
    // No grecaptcha yet → unresolved.
    G.grecaptcha = grecaptcha;
    await vi.advanceTimersByTimeAsync(60); // poll sees grecaptcha → calls ready()
    await p;
    expect(grecaptcha.ready).toHaveBeenCalledTimes(1);
  });

  it('execute(sitekey,{action}) delegates to grecaptcha.execute and returns the token', async () => {
    const grecaptcha = makeGrecaptcha('the-token');
    G.grecaptcha = grecaptcha;
    await expect(execute('SITE_A', { action: 'login' })).resolves.toBe('the-token');
    expect(grecaptcha.execute).toHaveBeenCalledWith('SITE_A', { action: 'login' });
  });

  it('rejects when the script fires an error event', async () => {
    const p = load('SITE_A');
    scriptFor('SITE_A')!.dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow(/recaptcha v3/i);
  });

  it('rejects after the load timeout when grecaptcha never appears', async () => {
    const p = load('SITE_A');
    const assertion = expect(p).rejects.toThrow(/timeout/i);
    await vi.advanceTimersByTimeAsync(LOAD_TIMEOUT_MS + 100);
    await assertion;
  });
});
