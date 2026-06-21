---
title: Captcha — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import Captcha from '@rozie-ui/captcha-vue';

// Always-pass test site keys (per provider). They render a real widget but never
// actually challenge — safe for a public docs page. Swap in your real key in prod.
const TEST_KEYS: Record<string, string> = {
  recaptcha: '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI',
  hcaptcha: '10000000-ffff-ffff-ffff-000000000001',
  turnstile: '1x00000000000000000000AA',
};

const provider = ref('recaptcha');
const token = ref('');
const captcha = ref();

// `provider`/`sitekey` are construction-time — switching providers re-keys the
// component so it tears down and re-renders (the documented :key idiom).
const sitekey = computed(() => TEST_KEYS[provider.value]);
const solved = computed(() => token.value.length > 0);

const reset = () => captcha.value?.reset();
</script>

# Captcha — live demo

This is the **real `@rozie-ui/captcha-vue` package** running on this page (VitePress is itself a Vue app). Pick a provider, solve the widget, and watch the two-way `token` model populate — then **Reset**. It's the same `Captcha.rozie` source that compiles to all six frameworks.

::: warning Loads a third-party widget
This page injects the selected provider's `api.js` from its CDN and renders a live (test-key) challenge. It needs network access and will not render offline.
:::

<ClientOnly>
<div class="captcha-live">
  <div class="captcha-live__controls">
    <label>Provider:
      <select v-model="provider">
        <option value="recaptcha">Google reCAPTCHA v2</option>
        <option value="hcaptcha">hCaptcha</option>
        <option value="turnstile">Cloudflare Turnstile</option>
      </select>
    </label>
    <button @click="reset" :disabled="!solved">Reset</button>
  </div>

  <!-- :key re-mounts on provider switch (construction-time config). -->
  <Captcha
    ref="captcha"
    :key="provider"
    :provider="provider"
    :sitekey="sitekey"
    v-model:token="token"
    @verify="(e) => console.log('verified via', e.provider)"
    @expire="() => console.log('expired')"
    @error="(e) => console.log('error', e)"
  />

  <p class="captcha-live__status">
    Status: <strong>{{ solved ? 'solved ✓' : 'unsolved' }}</strong>
    <code v-if="solved">token: {{ token.slice(0, 24) }}…</code>
  </p>
</div>
</ClientOnly>

<style>
.captcha-live { display: flex; flex-direction: column; gap: 1rem; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; }
.captcha-live__controls { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
.captcha-live__status code { margin-left: 0.5rem; }
</style>

## How it works

The provider dropdown writes `provider`, and the `:key="provider"` binding re-mounts the component on change — because `provider` and `sitekey` are **construction-time** config (the widgets expose no live setter). The solved token flows out through the two-way `token` model (`v-model:token`), and **Reset** calls the exposed `reset()` handle, which clears both the widget and the model. See the [showcase & API](/components/captcha) for the full surface.
