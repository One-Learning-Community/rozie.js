---
title: Switch — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Switch from '@rozie-ui/switch-vue';

const wifi = ref(false);
const bluetooth = ref(true);
const lastChange = ref<boolean | string>('—');

const wifiBox = ref();

function onChange(e: { checked: boolean }) {
  lastChange.value = e.checked;
}
</script>

# Switch — live demo

This is the **real `@rozie-ui/switch-vue` package** running on this page (VitePress is itself a Vue app). Click a switch, or focus one and press **Space** / **Enter**. Everything below is driven by the same `Switch.rozie` source that compiles to all six frameworks, built on a native focusable element with **no engine and no required CSS** — the toggle behaviour, the ARIA wiring, and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="sw-live">

  <div class="sw-live__cell">
    <div class="sw-live__head">
      <strong>Wi-Fi</strong>
      <span class="sw-live__sep" />
      <button @click="wifiBox?.toggle()">toggle()</button>
      <button @click="wifiBox?.focus()">focus()</button>
    </div>
    <Switch
      ref="wifiBox"
      v-model:modelValue="wifi"
      aria-label="Wi-Fi"
      @change="onChange"
    />
    <code class="sw-live__readout">modelValue: {{ JSON.stringify(wifi) }}</code>
  </div>

  <div class="sw-live__cell">
    <div class="sw-live__head"><strong>Bluetooth</strong> <span class="sw-live__muted">— starts on</span></div>
    <Switch v-model:modelValue="bluetooth" aria-label="Bluetooth" />
    <code class="sw-live__readout">modelValue: {{ JSON.stringify(bluetooth) }}</code>
  </div>

  <div class="sw-live__cell">
    <div class="sw-live__head"><strong>Disabled</strong> <span class="sw-live__muted">— not focusable, not toggleable</span></div>
    <Switch :modelValue="true" :disabled="true" aria-label="Airplane mode (disabled)" />
  </div>

  <div class="sw-live__cell">
    <div class="sw-live__head"><strong>@change</strong> <span class="sw-live__muted">— fires on every toggle</span></div>
    <code class="sw-live__readout">last change: {{ JSON.stringify(lastChange) }}</code>
  </div>

</div>
</ClientOnly>

`modelValue` is two-way bound with `v-model:modelValue` — the readout updates the instant you toggle, and a consumer write flows back in. Listen to `@change` for the new boolean. The **Wi-Fi** instance's buttons drive the imperative handle (`toggle()`, `focus()`) grabbed through Vue's `ref`. See the [full API](/components/switch) for every prop, event, slot, and handle verb, plus theming and the keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/switch/src/Switch.rozie{html}[Switch.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/switch-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/switch/packages/react/src/Switch.tsx[React]
<<< ../../packages/ui/switch/packages/vue/src/Switch.vue[Vue]
<<< ../../packages/ui/switch/packages/svelte/src/Switch.svelte[Svelte]
<<< ../../packages/ui/switch/packages/angular/src/Switch.ts[Angular]
<<< ../../packages/ui/switch/packages/solid/src/Switch.tsx[Solid]
<<< ../../packages/ui/switch/packages/lit/src/Switch.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same prop, same `change` event, same two-way `modelValue`, same scoped slot, same imperative handle — all from the one source above, built on a native focusable element with no third-party engine behind it.

## See also

- [Switch — showcase & API](/components/switch) — install, quick start, theming, accessibility, and the full reference.
- [Headless switch comparison](/components/switch-comparison) — how `@rozie-ui/switch` stacks up against the native checkbox-switch and the per-framework switch libraries.

<style scoped>
.sw-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.sw-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.sw-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.sw-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.sw-live__head button {
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
.sw-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.sw-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.sw-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
