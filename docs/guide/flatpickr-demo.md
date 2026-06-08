---
title: Flatpickr — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import Flatpickr from '@rozie-ui/flatpickr-vue';
import 'flatpickr/dist/flatpickr.css';

// A fixed, in-memory seed date — network-free (so the demo works offline and in
// CI). flatpickr renders its calendar into the document; no external assets.
const SEED = '2026-05-17';

const picker = ref();
const date = ref(SEED);
const mode = ref<'single' | 'range'>('single');
const lastEvent = ref('');

// `inline` is a construction-time-only flatpickr option — re-key the component
// on it so the framework reconciler rebuilds the engine instance when toggled.
const inline = ref(false);
const pickerKey = computed(() => `${inline.value}`);

const onChange = (e: { value: string; selectedDates: Date[] }) => {
  lastEvent.value = `change → "${e.value}" (${e.selectedDates.length} date${e.selectedDates.length === 1 ? '' : 's'})`;
};
</script>

# Flatpickr — live demo

This is the **real `@rozie-ui/flatpickr-vue` package** running on this page (VitePress is itself a Vue app). Pick a date, switch to range mode, toggle the inline calendar — then drive the imperative handle with the toolbar. Everything below is the same `Flatpickr.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="flatpickr-live">
  <div class="flatpickr-live__controls">
    <button @click="picker?.openPicker()">Open</button>
    <button @click="picker?.closePicker()">Close</button>
    <button @click="date = new Date().toISOString().slice(0, 10)">Today</button>
    <button @click="picker?.jumpToDate(date)">Jump to value</button>
    <span class="flatpickr-live__sep" />
    <button :class="{ 'flatpickr-live__active': mode === 'single' }" @click="mode = 'single'">Single</button>
    <button :class="{ 'flatpickr-live__active': mode === 'range' }" @click="mode = 'range'">Range</button>
    <span class="flatpickr-live__sep" />
    <button :class="{ 'flatpickr-live__active': inline }" @click="inline = !inline">Inline</button>
    <button class="flatpickr-live__danger" @click="picker?.clear()">Clear</button>
  </div>

  <div class="flatpickr-live__stage">
    <Flatpickr
      :key="pickerKey"
      ref="picker"
      v-model:date="date"
      :mode="mode"
      :inline="inline"
      placeholder="Pick a date…"
      @change="onChange"
      style="max-width: 16rem;"
    />
  </div>

  <div class="flatpickr-live__readout">
    <code>date = "{{ date }}"</code>
    <code v-if="lastEvent" class="flatpickr-live__event">{{ lastEvent }}</code>
  </div>
</div>
</ClientOnly>

The selected value is two-way bound with `v-model:date` — the readout above updates live as you pick, and the toolbar drives the imperative handle (`openPicker`, `closePicker`, `jumpToDate`, `clear`) plus reactive props (`mode`, `inline`). The reactive `mode` change reconciles into the live picker via flatpickr's `set()`; `inline` is construction-time, so the demo re-keys the component to rebuild the engine. See the [full API](/guide/flatpickr) for the complete prop/event/handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/flatpickr/src/Flatpickr.rozie{html}[Flatpickr.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/flatpickr-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/flatpickr/packages/react/src/Flatpickr.tsx[React]
<<< ../../packages/ui/flatpickr/packages/vue/src/Flatpickr.vue[Vue]
<<< ../../packages/ui/flatpickr/packages/svelte/src/Flatpickr.svelte[Svelte]
<<< ../../packages/ui/flatpickr/packages/angular/src/Flatpickr.ts[Angular]
<<< ../../packages/ui/flatpickr/packages/solid/src/Flatpickr.tsx[Solid]
<<< ../../packages/ui/flatpickr/packages/lit/src/Flatpickr.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component with a `ControlValueAccessor`, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, all from the one source above.

## See also

- [Flatpickr — showcase & API](/guide/flatpickr) — install, quick starts for all six frameworks, and the full reference.
- [Flatpickr example & per-target output](/examples/flatpickr) — the live source plus compiled React/Vue/Svelte/Angular/Solid/Lit output side by side.

<style scoped>
.flatpickr-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.flatpickr-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.flatpickr-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.flatpickr-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.flatpickr-live__controls button.flatpickr-live__active {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
}
.flatpickr-live__controls button.flatpickr-live__danger:hover {
  border-color: var(--vp-c-danger-1, #e25555);
  color: var(--vp-c-danger-1, #e25555);
}
.flatpickr-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.flatpickr-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.85rem;
}
.flatpickr-live__readout {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
}
.flatpickr-live__readout code {
  font-size: 0.8rem;
}
.flatpickr-live__event {
  color: var(--vp-c-brand-1);
}
</style>
