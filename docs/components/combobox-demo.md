---
title: Combobox — live demo
---

<script setup lang="ts">
import { ref, computed } from 'vue';
import Combobox from '@rozie-ui/combobox-vue';

const frameworks = [
  { value: 'react', label: 'React' },
  { value: 'vue', label: 'Vue' },
  { value: 'svelte', label: 'Svelte' },
  { value: 'solid', label: 'Solid' },
  { value: 'angular', label: 'Angular' },
  { value: 'lit', label: 'Lit' },
];

const countries = [
  { value: 'au', label: 'Australia' },
  { value: 'br', label: 'Brazil' },
  { value: 'ca', label: 'Canada' },
  { value: 'de', label: 'Germany' },
  { value: 'in', label: 'India' },
  { value: 'jp', label: 'Japan' },
  { value: 'ke', label: 'Kenya' },
  { value: 'mx', label: 'Mexico' },
  { value: 'us', label: 'United States' },
];

const framework = ref<string | null>(null);
const country = ref<string | null>(null);
const lastQuery = ref<string | null>(null);

const frameworkBox = ref();

const frameworkLabel = computed(
  () => frameworks.find((o) => o.value === framework.value)?.label ?? '—',
);

function onSearch(e: { query: string }) {
  lastQuery.value = e.query;
}
</script>

# Combobox — live demo

This is the **real `@rozie-ui/combobox-vue` package** running on this page (VitePress is itself a Vue app). Type to filter, use the arrow keys to move the highlight, press `Enter` to pick, or click an option — then watch the two-way bound `value` update. Everything below is driven by the same `Combobox.rozie` source that compiles to all six frameworks, built on native DOM with **no engine and no required CSS** — the WAI-ARIA behaviour and a tokenised skin all ship inside the component.

<ClientOnly>
<div class="cb-live">

  <div class="cb-live__cell">
    <div class="cb-live__head">
      <strong>Framework picker</strong>
      <span class="cb-live__sep" />
      <button @click="frameworkBox?.clear()">clear()</button>
      <button @click="frameworkBox?.focus()">focus()</button>
    </div>
    <Combobox
      ref="frameworkBox"
      v-model:value="framework"
      :options="frameworks"
      placeholder="Search a framework…"
      aria-label="Framework"
    />
    <code class="cb-live__readout">value: {{ JSON.stringify(framework) }} → {{ frameworkLabel }}</code>
  </div>

  <div class="cb-live__cell">
    <div class="cb-live__head"><strong>Country picker</strong> <span class="cb-live__muted">— custom #option slot</span></div>
    <Combobox
      v-model:value="country"
      :options="countries"
      placeholder="Search a country…"
      aria-label="Country"
      id-base="cb-country"
      @search="onSearch"
    >
      <template #option="{ option, selected }">
        <span class="cb-opt">
          <span class="cb-opt__dot" :class="{ 'cb-opt__dot--on': selected }" />
          {{ option.label }}
        </span>
      </template>
    </Combobox>
    <code class="cb-live__readout">value: {{ JSON.stringify(country) }} · last query: {{ lastQuery === null ? '—' : JSON.stringify(lastQuery) }}</code>
  </div>

</div>
</ClientOnly>

`value` is two-way bound with `v-model:value` — the readout updates the instant you commit a selection, and a consumer write flows back in. The **Framework picker**'s buttons drive the imperative handle (`clear()`, `focus()`) grabbed through Vue's `ref`. The **Country picker** supplies a custom `#option` template (the scoped slot exposes `{ option, active, selected }`) and listens to `@search` to surface the typed query — the same hook you would use for async / server-side filtering (set `disableFilter` and refetch `options` from the query). See the [full API](/components/combobox) for every prop, event, slot, and handle verb, plus filtering, theming, keyboard, and accessibility reference.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/combobox/src/Combobox.rozie{html}[Combobox.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/combobox-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/combobox/packages/react/src/Combobox.tsx[React]
<<< ../../packages/ui/combobox/packages/vue/src/Combobox.vue[Vue]
<<< ../../packages/ui/combobox/packages/svelte/src/Combobox.svelte[Svelte]
<<< ../../packages/ui/combobox/packages/angular/src/Combobox.ts[Angular]
<<< ../../packages/ui/combobox/packages/solid/src/Combobox.tsx[Solid]
<<< ../../packages/ui/combobox/packages/lit/src/Combobox.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineModel`, Svelte 5 runes, an Angular standalone component (with `ControlValueAccessor`), a Solid component, and a Lit custom element. Same props, same `change` / `search` events, same two-way `value`, same `#option` scoped slot, same imperative handle — all from the one source above, built on native DOM with no third-party engine behind it.

## See also

- [Combobox — showcase & API](/components/combobox) — install, quick start, filtering, theming, keyboard, and the full reference.
- [Headless combobox / autocomplete comparison](/components/combobox-comparison) — how `@rozie-ui/combobox` stacks up against Headless UI, Radix + cmdk, downshift, vue-select, and the Angular CDK/Material autocomplete.

<style scoped>
.cb-live {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.5rem;
  margin: 1.5rem 0;
  padding: 1.25rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.cb-live__cell {
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.cb-live__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
}
.cb-live__muted {
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}
.cb-live__head button {
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
.cb-live__head button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.cb-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.2rem;
  background: var(--vp-c-divider);
}
.cb-live__readout {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  word-break: break-all;
}
.cb-opt {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.cb-opt__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--vp-c-divider);
}
.cb-opt__dot--on {
  background: var(--vp-c-brand-1);
}
</style>
