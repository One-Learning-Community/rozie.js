---
title: Slider — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Slider from '@rozie-ui/slider-vue';

const volume = ref(50);
const price = ref([20, 80]);
const temp = ref(18);

const volBox = ref();
</script>

# Slider — live demo

This is the **real `@rozie-ui/slider-vue` package** running on this page (VitePress is itself a Vue app). Drag a thumb with the mouse or touch, focus it and press the arrow / `Home` / `End` / `PageUp` keys, drag the two range thumbs past each other (they clamp and stay sorted), or tip the vertical one — then watch the two-way bound value update. Everything below is driven by the same `Slider.rozie` source that compiles to all six frameworks, built on the browser's native `<input type="range">` with **no engine and no required CSS** — the platform input behaviour, the cross-browser thumb styling, and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="sl-live">

  <div class="sl-live__cell">
    <div class="sl-live__head">
      <strong>Single</strong>
      <span class="sl-live__sep" />
      <button @click="volBox?.increment()">increment()</button>
      <button @click="volBox?.decrement()">decrement()</button>
      <button @click="volBox?.focus()">focus()</button>
    </div>
    <Slider
      ref="volBox"
      v-model:value="volume"
      :min="0"
      :max="100"
      :step="1"
      aria-label="Volume"
      :show-value="true"
    />
    <code class="sl-live__readout">value: {{ JSON.stringify(volume) }}</code>
  </div>

  <div class="sl-live__cell">
    <div class="sl-live__head"><strong>Range</strong> <span class="sl-live__muted">— two clamped thumbs → sorted [lo, hi]</span></div>
    <Slider
      v-model:value="price"
      :range="true"
      :min="0"
      :max="100"
      :step="5"
      aria-label="Price range"
      :show-value="true"
      :marks="[0, 25, 50, 75, 100]"
    />
    <code class="sl-live__readout">value: {{ JSON.stringify(price) }}</code>
  </div>

  <div class="sl-live__cell sl-live__cell--vert">
    <div class="sl-live__head"><strong>Vertical</strong> <span class="sl-live__muted">— ↑ increases</span></div>
    <Slider
      v-model:value="temp"
      orientation="vertical"
      :min="10"
      :max="30"
      :step="1"
      aria-label="Temperature"
    />
    <code class="sl-live__readout">value: {{ JSON.stringify(temp) }}</code>
  </div>

</div>
</ClientOnly>

`value` is two-way bound with `v-model:value` — the readout updates the instant you commit a value, and a consumer write flows back in. In single mode it's a scalar; with `:range="true"` it's a sorted `[lo, hi]` array (each thumb neighbour-clamped). The **Single** instance's buttons drive the imperative handle (`increment()`, `decrement()`, `focus()`) grabbed through Vue's `ref`. Flip `orientation="vertical"` to rotate the track (up = increase), pass `:marks` for tick marks, or `:show-value` for the value bubble — the same component, the same surface. See the [full API](/components/slider) for every prop, event, slot, and handle verb, plus theming and keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/slider/src/Slider.rozie{html}[Slider.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/slider-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/slider/packages/react/src/Slider.tsx[React]
<<< ../../packages/ui/slider/packages/vue/src/Slider.vue[Vue]
<<< ../../packages/ui/slider/packages/svelte/src/Slider.svelte[Svelte]
<<< ../../packages/ui/slider/packages/angular/src/Slider.ts[Angular]
<<< ../../packages/ui/slider/packages/solid/src/Slider.tsx[Solid]
<<< ../../packages/ui/slider/packages/lit/src/Slider.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `change` event, same two-way `value`, same scoped slots, same imperative handle — all from the one source above, built on the native `<input type="range">` with no third-party engine behind it.

## See also

- [Slider — showcase & API](/components/slider) — install, quick start, theming, keyboard, and the full reference.
- [Headless slider / range comparison](/components/slider-comparison) — how `@rozie-ui/slider` stacks up against React Aria, Radix, Kobalte, Melt, the Angular CDK, and noUiSlider.

<style scoped>
.sl-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.sl-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.sl-live__cell--vert {
  align-items: flex-start;
}
.sl-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.sl-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.sl-live__head button {
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
.sl-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.sl-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.sl-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
