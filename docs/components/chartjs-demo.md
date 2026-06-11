---
title: Chart.js — live demo
---

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import Chart from '@rozie-ui/chartjs-vue';
import { Chart as ChartJS, registerables } from 'chart.js';

// The generic `Chart` does NOT auto-register controllers (Chart.js v3+ ships
// tree-shakable, with nothing pre-registered). A consumer registers what they
// use once at startup — here the kitchen-sink set, so every `type` below works.
// (A real app could instead import `@rozie-ui/chartjs-vue/auto`, which does this
// for you, or register only the controllers it renders.)
ChartJS.register(...registerables);

// A self-contained, network-free dataset — no external assets, fonts, or feeds.
// Everything below lives in memory, so the demo works offline and in CI.
const LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const data = reactive({
  labels: LABELS,
  datasets: [
    { label: 'Revenue', data: [12, 19, 8, 15, 22, 17] },
    { label: 'Costs', data: [7, 11, 5, 9, 13, 10] },
  ],
});

const type = ref('bar');
const TYPES = ['bar', 'line', 'pie', 'doughnut', 'radar', 'polarArea'];

const chart = ref();
const png = ref('');

// Deterministic, in-handler pseudo-random shuffle. We seed off a counter (NOT a
// module-top Math.random) so the first render is stable, then perturb the bound
// arrays in place — the wrapper reconciles the change into the live chart and
// tweens each point from its old value to its new one (no remount).
let seed = 1;
const nextRand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const randomize = () => {
  for (const ds of data.datasets) {
    ds.data = ds.data.map(() => Math.round(2 + nextRand() * 24));
  }
};

const exportPng = () => { png.value = chart.value?.toBase64Image() ?? ''; };

const values = computed(() =>
  data.datasets.map((d) => `${d.label}: [${d.data.join(', ')}]`).join('  ·  ')
);
</script>

# Chart.js — live demo

This is the **real `@rozie-ui/chartjs-vue` package** running on this page (VitePress is itself a Vue app). Switch the chart kind, randomize the data and watch the series tween point-to-point, then **Export** the canvas as a PNG. Everything below is driven by the same `Chart.rozie` source that compiles to all six frameworks.

<ClientOnly>
<div class="chart-live">
  <div class="chart-live__controls">
    <button
      v-for="t in TYPES"
      :key="t"
      :class="{ 'chart-live__active': type === t }"
      @click="type = t"
    >{{ t }}</button>
    <span class="chart-live__sep" />
    <button @click="randomize">⟳ Randomize data</button>
    <button class="chart-live__primary" @click="exportPng">Export PNG ▸</button>
  </div>

  <div class="chart-live__stage">
    <Chart
      ref="chart"
      :type="type"
      :data="data"
      aria-label="Live demo chart"
      style="width: 100%; height: 320px;"
    />
  </div>

  <div class="chart-live__readout">
    <code>type <strong>{{ type }}</strong> · {{ values }}</code>
  </div>

  <div v-if="png" class="chart-live__output">
    <strong>Exported PNG</strong>
    <img :src="png" alt="exported chart" />
  </div>
</div>
</ClientOnly>

The `type` prop is bound reactively — flipping it re-creates the instance (Chart.js has no stable runtime type-swap), while **Randomize** mutates the bound `data` object so the wrapper reconciles it into the live chart in place. The **Export PNG** button drives the imperative handle (`toBase64Image`). See the [full API](/components/chartjs) for the complete prop / event / handle surface.

## One source, six outputs

You author the component **once** as a `.rozie` file:

<<< ../../packages/ui/chartjs/src/Chart.rozie{html}[Chart.rozie — the single source]

…and Rozie compiles it to six idiomatic, framework-native components. Switch the tabs to see the **actual generated output** for each target (this is exactly what ships in `@rozie-ui/chartjs-{react,vue,svelte,angular,solid,lit}`):

::: code-group

<<< ../../packages/ui/chartjs/packages/react/src/Chart.tsx[React]
<<< ../../packages/ui/chartjs/packages/vue/src/Chart.vue[Vue]
<<< ../../packages/ui/chartjs/packages/svelte/src/Chart.svelte[Svelte]
<<< ../../packages/ui/chartjs/packages/angular/src/Chart.ts[Angular]
<<< ../../packages/ui/chartjs/packages/solid/src/Chart.tsx[Solid]
<<< ../../packages/ui/chartjs/packages/lit/src/Chart.ts[Lit]

:::

Each is a real, idiomatic component for its framework — React `forwardRef` + hooks, Vue `<script setup>` + `defineExpose`, Svelte 5 runes, an Angular standalone component, a Solid component, and a Lit custom element. Same props, same events, same imperative handle, all from the one source above.

## See also

- [Chart.js — showcase & API](/components/chartjs) — install, quick starts for all six frameworks, per-type components, and the full reference.
- [The LineChart example](/examples/line-chart) — a focused single-type walkthrough of the same wrapper.

<style scoped>
.chart-live {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.chart-live__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.85rem;
}
.chart-live__controls button {
  font: inherit;
  font-size: 0.82rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  text-transform: capitalize;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.chart-live__controls button:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
.chart-live__controls button.chart-live__active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}
.chart-live__controls button.chart-live__primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: #fff;
  font-weight: 600;
  text-transform: none;
}
.chart-live__sep {
  width: 1px;
  align-self: stretch;
  margin: 0 0.3rem;
  background: var(--vp-c-divider);
}
.chart-live__stage {
  background: var(--vp-c-bg);
  border-radius: 8px;
  padding: 0.5rem;
}
.chart-live__readout {
  min-height: 1.4rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
  color: var(--vp-c-text-2);
  overflow-x: auto;
}
.chart-live__output {
  margin-top: 0.85rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--vp-c-divider);
}
.chart-live__output img {
  display: block;
  margin-top: 0.5rem;
  max-width: 100%;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: #fff;
}
</style>
