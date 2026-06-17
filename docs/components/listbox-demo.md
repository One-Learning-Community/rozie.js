---
title: Listbox — live demo
---

<script setup lang="ts">
import { ref } from 'vue';
import Listbox from '@rozie-ui/listbox-vue';

const single = ref(null);
const typed = ref(null);
const many = ref([]);

const selectBox = ref();

const FRUITS = [
  { label: 'Apple',      value: 'apple' },
  { label: 'Banana',     value: 'banana' },
  { label: 'Cherry',     value: 'cherry' },
  { label: 'Date',       value: 'date' },
  { label: 'Elderberry', value: 'elderberry', disabled: true },
  { label: 'Fig',        value: 'fig' },
  { label: 'Grape',      value: 'grape' },
];
</script>

# Listbox — live demo

This is the **real `@rozie-ui/listbox-vue` package** running on this page (VitePress is itself a Vue app). Open the select with the keyboard or mouse, type to filter the combobox, toggle options in the multi-select — then watch the two-way bound value update. Everything below is driven by the same `Listbox.rozie` source that compiles to all six frameworks, with **no engine and no required CSS** — the ARIA behaviour and a tokenised skin ship inside the component.

<ClientOnly>
<div class="lb-live">

  <div class="lb-live__cell">
    <div class="lb-live__head">
      <strong>Select</strong>
      <span class="lb-live__sep" />
      <button @click="selectBox?.open()">open()</button>
      <button @click="selectBox?.clear()">clear()</button>
    </div>
    <Listbox
      ref="selectBox"
      v-model:value="single"
      :options="FRUITS"
      id="lb-demo-select"
      aria-label="Pick a fruit"
      placeholder="Pick a fruit…"
    />
    <code class="lb-live__readout">value: {{ JSON.stringify(single) }}</code>
  </div>

  <div class="lb-live__cell">
    <div class="lb-live__head"><strong>Combobox</strong> <span class="lb-live__muted">— type to filter</span></div>
    <Listbox
      v-model:value="typed"
      :options="FRUITS"
      :combobox="true"
      id="lb-demo-combo"
      aria-label="Search fruit"
      placeholder="Search fruit…"
    />
    <code class="lb-live__readout">value: {{ JSON.stringify(typed) }}</code>
  </div>

  <div class="lb-live__cell">
    <div class="lb-live__head"><strong>Multi-select</strong> <span class="lb-live__muted">— combobox + multiple</span></div>
    <Listbox
      v-model:value="many"
      :options="FRUITS"
      :combobox="true"
      :multiple="true"
      id="lb-demo-multi"
      aria-label="Pick several fruit"
      placeholder="Pick several…"
    />
    <code class="lb-live__readout">value: {{ JSON.stringify(many) }}</code>
  </div>

</div>
</ClientOnly>

`value` is two-way bound with `v-model:value` — the readout updates the instant you commit a selection, and a consumer write flows back in. The **Select** instance's buttons drive the imperative handle (`open()`, `clear()`) grabbed through Vue's `ref`. Flip `combobox` for a filterable text input, add `multiple` for array values — the same component, the same surface. See the [full API](/components/listbox) for every prop, event, slot, and handle verb, plus theming and keyboard reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/listbox/src/Listbox.rozie{html}[Listbox.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/listbox-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/listbox/packages/react/src/Listbox.tsx[React]
<<< ../../packages/ui/listbox/packages/vue/src/Listbox.vue[Vue]
<<< ../../packages/ui/listbox/packages/svelte/src/Listbox.svelte[Svelte]
<<< ../../packages/ui/listbox/packages/angular/src/Listbox.ts[Angular]
<<< ../../packages/ui/listbox/packages/solid/src/Listbox.tsx[Solid]
<<< ../../packages/ui/listbox/packages/lit/src/Listbox.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same events, same two-way `value`, same scoped slots, same imperative handle — all from the one source above, with no third-party engine behind it.

## See also

- [Listbox — showcase & API](/components/listbox) — install, quick start, theming, keyboard, and the full reference.
- [Headless select / combobox comparison](/components/listbox-comparison) — how `@rozie-ui/listbox` stacks up against Headless UI, Radix, React Aria, Melt, Kobalte, and the CDK.

<style scoped>
.lb-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.lb-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}
.lb-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.lb-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.lb-live__head button {
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
.lb-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.lb-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.lb-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
</style>
