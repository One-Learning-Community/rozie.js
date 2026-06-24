---
title: NumberField — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import NumberField from '@rozie-ui/number-field-vue';

const qty = ref<number | null>(1);
const price = ref<number | null>(9.99);
const lastChange = ref<number | null | string>('—');

const qtyBox = ref();

function onChange(e: { value: number | null }) {
  lastChange.value = e.value;
}
</script>

# NumberField — live demo

This is the **real `@rozie-ui/number-field-vue` package** running on this page (VitePress is itself a Vue app). Type a value (it parses + clamps on blur), use the +/- buttons (hold one to watch the press-and-hold acceleration ramp), or focus the field and press Arrow / PageUp·Down / Home / End. Everything below is driven by the same `NumberField.rozie` source that compiles to all six frameworks, built on a native `<input>` with **no engine and no required CSS** — the platform input behaviour, the clamp/snap math, and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="nf-live">

  <div class="nf-live__cell">
    <div class="nf-live__head">
      <strong>0..10 quantity</strong>
      <span class="nf-live__sep" />
      <button @click="qtyBox?.increment()">increment()</button>
      <button @click="qtyBox?.clear()">clear()</button>
      <button @click="qtyBox?.focus()">focus()</button>
    </div>
    <NumberField
      ref="qtyBox"
      v-model:modelValue="qty"
      :min="0"
      :max="10"
      :step="1"
      aria-label="Quantity"
      @change="onChange"
    />
    <code class="nf-live__readout">modelValue: {{ JSON.stringify(qty) }}</code>
  </div>

  <div class="nf-live__cell">
    <div class="nf-live__head"><strong>Currency</strong> <span class="nf-live__muted">— Intl.NumberFormat, step 0.01</span></div>
    <NumberField
      v-model:modelValue="price"
      :min="0"
      :step="0.01"
      :formatOptions="{ style: 'currency', currency: 'USD' }"
      aria-label="Price"
    />
    <code class="nf-live__readout">modelValue: {{ JSON.stringify(price) }}</code>
  </div>

  <div class="nf-live__cell">
    <div class="nf-live__head"><strong>@change</strong> <span class="nf-live__muted">— fires on every committed change</span></div>
    <code class="nf-live__readout">last change: {{ JSON.stringify(lastChange) }}</code>
  </div>

</div>
</ClientOnly>

`modelValue` is two-way bound with `v-model:modelValue` — the readout updates the instant you commit, and a consumer write flows back in. The value is always clamped to `[min, max]` and snapped to `step`; set `formatOptions` for locale-aware display (currency above), and listen to `@change` for the new value. The **quantity** instance's buttons drive the imperative handle (`increment()`, `clear()`, `focus()`) grabbed through Vue's `ref`. See the [full API](/components/number-field) for every prop, event, and handle verb, plus theming and the keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/number-field/src/NumberField.rozie{html}[NumberField.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/number-field-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/number-field/packages/react/src/NumberField.tsx[React]
<<< ../../packages/ui/number-field/packages/vue/src/NumberField.vue[Vue]
<<< ../../packages/ui/number-field/packages/svelte/src/NumberField.svelte[Svelte]
<<< ../../packages/ui/number-field/packages/angular/src/NumberField.ts[Angular]
<<< ../../packages/ui/number-field/packages/solid/src/NumberField.tsx[Solid]
<<< ../../packages/ui/number-field/packages/lit/src/NumberField.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `change` event, same two-way `modelValue`, same imperative handle — all from the one source above, built on a native `<input>` with no third-party engine behind it.

## See also

- [NumberField — showcase & API](/components/number-field) — install, quick start, theming, accessibility, and the full reference.
- [Headless number-field comparison](/components/number-field-comparison) — how `@rozie-ui/number-field` stacks up against the native `<input type="number">` and the per-framework number-input libraries.

<style scoped>
.nf-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.nf-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.nf-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.nf-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.nf-live__head button {
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
.nf-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.nf-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.nf-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
