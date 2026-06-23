---
title: Otp — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Otp from '@rozie-ui/otp-vue';

const code = ref('');
const pin = ref('');
const completed = ref<string | null>(null);

const codeBox = ref();

function onComplete(e: { value: string }) {
  completed.value = e.value;
}
</script>

# Otp — live demo

This is the **real `@rozie-ui/otp-vue` package** running on this page (VitePress is itself a Vue app). Type a code, paste one in (it distributes across the cells), backspace through it, or arrow between cells — then watch the two-way bound value update and the `@complete` readout fire when the last cell fills. Everything below is driven by the same `Otp.rozie` source that compiles to all six frameworks, built on native `<input>` cells with **no engine and no required CSS** — the platform input behaviour and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="otp-live">

  <div class="otp-live__cell">
    <div class="otp-live__head">
      <strong>Numeric</strong>
      <span class="otp-live__sep" />
      <button @click="codeBox?.clear()">clear()</button>
      <button @click="codeBox?.focus()">focus()</button>
    </div>
    <Otp
      ref="codeBox"
      v-model:value="code"
      :length="6"
      type="numeric"
      aria-label="Verification code"
      @complete="onComplete"
    />
    <code class="otp-live__readout">value: {{ JSON.stringify(code) }}</code>
  </div>

  <div class="otp-live__cell">
    <div class="otp-live__head"><strong>Masked PIN</strong> <span class="otp-live__muted">— type="password" cells</span></div>
    <Otp
      v-model:value="pin"
      :length="4"
      :mask="true"
      aria-label="PIN"
    />
    <code class="otp-live__readout">value: {{ JSON.stringify(pin) }}</code>
  </div>

  <div class="otp-live__cell">
    <div class="otp-live__head"><strong>@complete</strong> <span class="otp-live__muted">— fires when the numeric code fills</span></div>
    <code class="otp-live__readout">last complete: {{ completed === null ? '—' : JSON.stringify(completed) }}</code>
  </div>

</div>
</ClientOnly>

`value` is two-way bound with `v-model:value` — the readout updates the instant you edit, and a consumer write flows back in. The assembled code is always a contiguous string; flip `:mask="true"` to render the cells as password dots, set `type` to `'numeric'` / `'alphanumeric'` / `'text'` to change the allowed characters and the mobile keyboard, and listen to `@complete` to auto-submit. The **Numeric** instance's buttons drive the imperative handle (`clear()`, `focus()`) grabbed through Vue's `ref`. See the [full API](/components/otp) for every prop, event, and handle verb, plus theming and keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/otp/src/Otp.rozie{html}[Otp.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/otp-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/otp/packages/react/src/Otp.tsx[React]
<<< ../../packages/ui/otp/packages/vue/src/Otp.vue[Vue]
<<< ../../packages/ui/otp/packages/svelte/src/Otp.svelte[Svelte]
<<< ../../packages/ui/otp/packages/angular/src/Otp.ts[Angular]
<<< ../../packages/ui/otp/packages/solid/src/Otp.tsx[Solid]
<<< ../../packages/ui/otp/packages/lit/src/Otp.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `change` / `complete` events, same two-way `value`, same imperative handle — all from the one source above, built on native `<input>` cells with no third-party engine behind it.

## See also

- [Otp — showcase & API](/components/otp) — install, quick start, theming, keyboard, and the full reference.
- [Headless one-time-code input comparison](/components/otp-comparison) — how `@rozie-ui/otp` stacks up against react-otp-input, input-otp, vue3-otp-input, ng-otp-input, and the per-framework OTP libraries.

<style scoped>
.otp-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.otp-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.otp-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.otp-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.otp-live__head button {
  font: inherit;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.otp-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.otp-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.otp-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
