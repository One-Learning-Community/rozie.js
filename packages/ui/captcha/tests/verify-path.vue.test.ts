/**
 * verify-path.vue.test.ts — regression test for the Vue defineModel param-shadow
 * bug (found dogfooding @rozie-ui/captcha-vue@0.1.0).
 *
 * THE BUG: the success callback param was named `token`, the same name as the
 * `defineModel('token')` ref, so the emitted `token.value = token` wrote the
 * string param instead of the model ref → `v-model:token` never populated on
 * solve. It compiles + typechecks clean (a runtime semantic bug), so only a
 * mount-and-drive test catches it. We mount the REAL emitted Captcha.vue, mock
 * the provider SDK so render() hands us its config, then drive callback /
 * expired-callback and assert the two-way `token` model updates.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApp, h, ref } from 'vue';
import Captcha from '../packages/vue/src/Captcha.vue';

const G = globalThis as unknown as Record<string, unknown>;
let lastCfg: Record<string, (...args: unknown[]) => unknown> | undefined;

beforeEach(() => {
  lastCfg = undefined;
  // A fake grecaptcha that's already "ready" — loadCaptchaApi resolves without
  // injecting a script, then the component calls render(el, cfg); we capture cfg.
  G.grecaptcha = {
    render: (_el: Element, cfg: Record<string, (...a: unknown[]) => unknown>) => {
      lastCfg = cfg;
      return 'widget-1';
    },
    reset: () => {},
    getResponse: () => '',
  };
});

afterEach(() => {
  delete G.grecaptcha;
  delete G.__rozieCaptchaLoaders;
});

/** Mount Captcha under a parent that binds v-model:token, returning the live ref. */
function mountCaptcha(extraProps: Record<string, unknown> = {}) {
  const token = ref('');
  const verify: Array<Record<string, unknown>> = [];
  const expire: Array<Record<string, unknown>> = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const app = createApp({
    render: () =>
      h(Captcha, {
        provider: 'recaptcha',
        sitekey: 'site-key',
        token: token.value,
        'onUpdate:token': (v: string) => {
          token.value = v;
        },
        onVerify: (e: Record<string, unknown>) => verify.push(e),
        onExpire: (e: Record<string, unknown>) => expire.push(e),
        ...extraProps,
      }),
  });
  app.mount(host);
  return { app, token, verify, expire };
}

describe('Captcha (vue) verify path — defineModel param-shadow regression', () => {
  it('populates v-model:token and emits verify when the widget solves', async () => {
    const { app, token, verify } = mountCaptcha();
    await vi.waitFor(() => expect(lastCfg).toBeTruthy());

    lastCfg!.callback('tok-123'); // widget solved

    // The bug: token stayed '' (the model ref was shadowed by the param).
    await vi.waitFor(() => expect(token.value).toBe('tok-123'));
    expect(verify.at(-1)).toMatchObject({ token: 'tok-123', provider: 'recaptcha' });
    app.unmount();
  });

  it('clears v-model:token and emits expire on expiry', async () => {
    const { app, token, expire } = mountCaptcha();
    await vi.waitFor(() => expect(lastCfg).toBeTruthy());

    lastCfg!.callback('tok-xyz');
    await vi.waitFor(() => expect(token.value).toBe('tok-xyz'));

    lastCfg!['expired-callback'](); // token expired → must re-block (clear)
    await vi.waitFor(() => expect(token.value).toBe(''));
    expect(expire.length).toBeGreaterThan(0);
    app.unmount();
  });
});
