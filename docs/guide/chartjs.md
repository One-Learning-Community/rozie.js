# Chart.js — the cross-framework chart component

`Chart` is Rozie's data-bound port of [Chart.js](https://www.chartjs.org/) — the most-used canvas charting library on the web. One `.rozie` source file ships idiomatic React, Vue, Svelte, Angular, Solid, and Lit consumers from a single wrapper. Every framework today carries its own hand-maintained Chart.js binding ([react-chartjs-2](https://react-chartjs-2.js.org/), [vue-chartjs](https://vue-chartjs.org/), [ng2-charts](https://valor-software.com/ng2-charts/), [svelte-chartjs](https://www.npmjs.com/package/svelte-chartjs)) — each shuttles a `data` prop into a `new Chart()` call and forwards events back out. Rozie collapses all of them (plus the Solid and Lit wrappers that are thinner upstream) into one source.

`Chart` is **generic**: the `type` prop switches the chart kind across the whole Chart.js controller set — `line`, `bar`, `pie`, `doughnut`, `radar`, `polarArea`, `scatter`, `bubble`, and any registerable controller. The wrapper calls `Chart.register(...registerables)` once, so every controller is available; you do not ship a per-type component.

This page is the **show-and-tell**: the API surface, per-framework quick starts, the events, the imperative handle (including PNG export), the consumer-extensible `:plugins` passthrough, and the per-target recipe for the external-HTML `tooltip` portal slot.

The full source for `Chart.rozie` lives in the [`@rozie-ui/chartjs` package](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/src/Chart.rozie).

## The `@rozie-ui/chartjs` packages

`Chart` ships as six pre-compiled, per-framework packages generated from a single `Chart.rozie` source via the package's `codegen.mjs` doc-automation engine. Consumers install only the one for their framework — no Rozie toolchain, no build-time compile step:

| Package | Install | README |
| --- | --- | --- |
| `@rozie-ui/chartjs-react` | `npm i @rozie-ui/chartjs-react` | [react/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/react/README.md) |
| `@rozie-ui/chartjs-vue` | `npm i @rozie-ui/chartjs-vue` | [vue/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/vue/README.md) |
| `@rozie-ui/chartjs-svelte` | `npm i @rozie-ui/chartjs-svelte` | [svelte/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/svelte/README.md) |
| `@rozie-ui/chartjs-angular` | `npm i @rozie-ui/chartjs-angular` | [angular/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/angular/README.md) |
| `@rozie-ui/chartjs-solid` | `npm i @rozie-ui/chartjs-solid` | [solid/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/solid/README.md) |
| `@rozie-ui/chartjs-lit` | `npm i @rozie-ui/chartjs-lit` | [lit/README](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/packages/lit/README.md) |

Each package carries the **`chart.js` engine peer** (`^4`) plus its framework peer (`react + react-dom`, `vue`, `svelte`, `@angular/core + @angular/common`, `solid-js`, or `lit + @lit-labs/preact-signals + @preact/signals-core`). Install the engine peer alongside the framework package:

```bash
npm i @rozie-ui/chartjs-react chart.js
```

Anything the curated prop surface doesn't special-case (scales, legends, custom plugins, per-dataset styling) comes through the `data`/`options` props — Chart.js's own config shapes — and the first-class `:plugins` passthrough for per-instance plugins. The per-leaf READMEs and the **Props** table below are generated from the same IR parse of `Chart.rozie`, so they cannot drift from the compiled output — the package's `codegen.mjs` asserts the structural columns of this page against `ir.props` on every run.

## Quick start

`data` and `options` are Chart.js's own shapes; `type` picks the chart kind. The chart reconciles `data` changes into the live instance (mutating `chart.data` in place and calling `chart.update()`) so series tween point-to-point without a remount.

### React

```tsx
import { Chart } from '@rozie-ui/chartjs-react';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};

export function Demo() {
  return <Chart type="bar" data={data} height={280} onClick={(p) => console.log(p.elements)} />;
}
```

### Vue

```vue
<script setup lang="ts">
import Chart from '@rozie-ui/chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};
</script>

<template>
  <Chart type="bar" :data="data" :height="280" @click="(p) => console.log(p.elements)" />
</template>
```

### Svelte

```svelte
<script lang="ts">
  import Chart from '@rozie-ui/chartjs-svelte';

  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
  };
</script>

<Chart type="bar" {data} height={280} onclick={(p) => console.log(p.elements)} />
```

### Angular

```ts
import { Component } from '@angular/core';
import { Chart } from '@rozie-ui/chartjs-angular';

@Component({
  selector: 'app-demo',
  standalone: true,
  imports: [Chart],
  template: `
    <Chart type="bar" [data]="data" [height]="280" (click)="onPick($event)" />
  `,
})
export class DemoComponent {
  data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
  };
  onPick(p: { elements: unknown[] }) { console.log(p.elements); }
}
```

### Solid

```tsx
import { Chart } from '@rozie-ui/chartjs-solid';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};

export function Demo() {
  return <Chart type="bar" data={data} height={280} onClick={(p) => console.log(p.elements)} />;
}
```

### Lit

```ts
import '@rozie-ui/chartjs-lit';

// <rozie-chart> is a custom element. Bind `data`/`type` as properties and
// listen for the `click`/`hover`/`dataset-click` events.
const el = document.querySelector('rozie-chart');
el.type = 'bar';
el.data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};
el.addEventListener('click', (e) => console.log(e.detail.elements));
```

## API

### Props

| Name | Type | Default | Runtime-updatable? | Description |
| --- | --- | --- | :---: | --- |
| `data` | `Object` | `{…}` | ✓ | Chart.js data — `{ labels, datasets }`. Reconciled **in place** on change (the wrapper mutates `chart.data` and calls `chart.update()`) so series tween point-to-point instead of remounting. |
| `options` | `Object` | `{}` | ✓ | Chart.js options (scales, legend, plugins config, …). Merged over the wrapper's responsive defaults; reapplied wholesale on change with `update('none')`. A consumer `options.onClick`/`onHover` is **composed**, not clobbered (see [Events](#events)). |
| `type` | `String` | `"line"` | ✓ | The chart kind — any Chart.js controller (`line`/`bar`/`pie`/`doughnut`/`radar`/`polarArea`/`scatter`/`bubble`/…). Changing it **re-creates** the instance (Chart.js has no stable runtime type-swap). |
| `height` | `Number` | `240` | | Chart height in pixels (applied to the wrapper's host box; the canvas fills it responsively). |
| `width` | `Number` | `undefined` | | Optional fixed chart width in pixels. Omit for the default full-width responsive box. |
| `plugins` | `Array` | `[]` | ✓ | Per-instance Chart.js `Plugin[]` — the consumer-extensibility passthrough. Merged into the config; changing the array **re-creates** the instance (Chart.js has no stable runtime plugin-swap). See [Extending with `:plugins`](#extending-with-plugins). |
| `updateMode` | `String` | `undefined` | | The Chart.js [`update` mode](https://www.chartjs.org/docs/latest/developers/api.html#update-mode) string used by the in-place data reconcile (e.g. `"none"` to skip the animation on every data tick). |
| `redraw` | `Boolean` | `false` | | When `true`, a `data` change **re-creates** the chart wholesale instead of reconciling in place — mirrors react-chartjs-2's `redraw` for charts whose plugins don't survive an in-place update. |
| `ariaLabel` | `String` | `undefined` | | Accessible label applied to the `<canvas role="img">` (canvas charts are otherwise opaque to assistive tech). For richer fallback content, fill the [`fallback` slot](#slots). |
| `datasetIdKey` | `String` | `"label"` | | The dataset-identity key. Across data updates, datasets are matched by `dataset[datasetIdKey]` (falling back to array index when absent), so a stable keyed dataset reconciles onto its prior slot even if its index moved — guarding the "first dataset copied over the others" hazard. |
| `destroyDelay` | `Number` | `0` | | Milliseconds to defer `chart.destroy()` on unmount so an exit transition can finish. `0` destroys immediately. |

### Events

Chart.js is event-ful, and the wrapper forwards three structured events. Each composes **over** a consumer-supplied `options.onClick`/`onHover` (the consumer handler runs first, then the event emits) — the wrapper never clobbers your handler.

| Event | Payload | Fires when |
| --- | --- | --- |
| `click` | `{ event, elements, chart }` | The canvas is clicked. `elements` is the nearest-mode hit set (`getElementsAtEventForMode(e, 'nearest', { intersect: true })`). |
| `datasetClick` | `{ event, elements, datasetIndex, chart }` | A dataset element is clicked. Resolved in `'dataset'` mode; fires only when a dataset is hit. |
| `hover` | `{ event, elements, chart }` | The Chart.js hover handler fires; `elements` is the active element set. |

### Imperative handle

Beyond props, the component exposes imperative methods declared once in the Rozie source via `$expose`. Grab a handle with your framework's native ref mechanism (React `useRef` / Vue template ref / Svelte `bind:this` / Angular `viewChild` / Solid callback ref / the Lit custom element itself) and call them directly:

| Method | Description |
| --- | --- |
| `getChart` | Return the underlying Chart.js instance for direct API access (the raw-engine escape hatch). `null` before mount and after destroy. |
| `updateChart` | Re-render after mutating data/options — `updateChart(mode?)` (a Chart.js `update` mode string). |
| `resizeChart` | Resize to the container, or to explicit dimensions — `resizeChart(width?, height?)`. |
| `resetChart` | Reset the chart elements to their initial (pre-animation) state. |
| `renderChart` | Re-render from the current state without recalculating scales. |
| `stopChart` | Stop the current animation loop. |
| `clearChart` | Clear the chart canvas. |
| `toBase64Image` | Export the current canvas as a base64-encoded PNG data URL — `toBase64Image(type?, quality?)`. |

::: tip The verbs are suffixed (`updateChart`, not `update`)
The verb-style passthroughs are named `updateChart`/`renderChart`/… rather than bare `update`/`render`. Bare `update()` and `render()` are LitElement reactive-lifecycle methods — a `$expose({ update, render })` would **shadow** them on the Lit leaf and break it. Suffixing keeps the handle collision-free across all six targets (the Chart.js analog of CodeMirror's `setValue`→`replaceValue` lesson).
:::

**React example:**

```tsx
import { useRef } from 'react';
import { Chart, type ChartHandle } from '@rozie-ui/chartjs-react';

const chart = useRef<ChartHandle>(null);
// <Chart ref={chart} ... />
chart.current?.updateChart();
const png = chart.current?.toBase64Image();   // PNG data URL — download / preview
const live = chart.current?.getChart();        // the raw Chart.js instance
```

## Slots

The wrapper surfaces a **portal** `tooltip` slot — driven by Chart.js's [external tooltip handler](https://www.chartjs.org/docs/latest/configuration/tooltip.html#external-custom-tooltips) — plus a non-portal `fallback` slot for canvas a11y content. Chart.js paints the chart itself to a `<canvas>` the framework never touches, so the tooltip is the one place a consumer's framework-native fragment can render *over* the chart. The tooltip slot is **guarded** — fill it and your fragment renders as an HTML tooltip (the built-in canvas tooltip is disabled); leave it unfilled and Chart.js's default tooltip is used. It receives one scope param, `model` — the live tooltip model (`{ title, body, dataPoints, opacity }`).

| Slot | Mounts via | Renders | Scope param |
| --- | --- | --- | --- |
| `tooltip` | Chart.js `options.plugins.tooltip.external` | An HTML tooltip positioned over the canvas at the active point | `model` |
| `fallback` | Inside the `<canvas>` element | Accessibility fallback content (read by assistive tech / shown when the canvas can't render); Chart.js paints over it | — |

Each target fills `#tooltip` through its native imperative-render API:

**React** (render prop):

```tsx
<Chart
  type="line"
  data={data}
  renderTooltip={({ model }) => (
    <div className="my-tip"><strong>{model.title.join(' ')}</strong>: {model.body.join(', ')}</div>
  )}
/>
```

**Vue** (scoped slot):

```vue
<Chart type="line" :data="data">
  <template #tooltip="{ model }">
    <div class="my-tip"><strong>{{ model.title.join(' ') }}</strong></div>
  </template>
</Chart>
```

**Svelte** (snippet):

```svelte
<Chart type="line" {data}>
  {#snippet tooltip({ model })}
    <div class="my-tip"><strong>{model.title.join(' ')}</strong></div>
  {/snippet}
</Chart>
```

**Angular** (content child `<ng-template>`):

```html
<Chart type="line" [data]="data">
  <ng-template #tooltip let-model="model">
    <div class="my-tip"><strong>{{ model.title.join(' ') }}</strong></div>
  </ng-template>
</Chart>
```

**Solid** (render prop):

```tsx
<Chart
  type="line"
  data={data}
  tooltip={({ model }) => <div class="my-tip"><strong>{model.title.join(' ')}</strong></div>}
/>
```

**Lit** (slot bridge — pass the render callback as a property):

```ts
const el = document.querySelector('rozie-chart');
el.tooltip = ({ model }) => html`<div class="my-tip"><strong>${model.title.join(' ')}</strong></div>`;
```

On every target the wrapper's `$portals.tooltip(node, { model })` closure mounts the consumer's fragment into the wrapper-owned tooltip container and returns a dispose handle the wrapper calls on teardown.

## Recipes

### Switching the chart type at runtime

`type` is generic — bind it reactively and the wrapper re-creates the instance when it changes (Chart.js has no stable runtime type-swap). One component renders every Chart.js kind:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Chart from '@rozie-ui/chartjs-vue';

const data = { labels: ['A', 'B', 'C'], datasets: [{ label: 'n', data: [4, 9, 2] }] };
const type = ref('line');
</script>

<template>
  <button @click="type = 'bar'">Bar</button>
  <button @click="type = 'doughnut'">Doughnut</button>
  <Chart :type="type" :data="data" />
</template>
```

### Extending with `:plugins`

Chart.js plugins (datalabels, annotation, zoom, a custom crosshair, …) are passed per-instance through `:plugins` — the consumer-extensibility passthrough, the Chart.js analog of an options bag. No per-plugin wrapper code, no bundle cost unless you import the plugin:

```bash
npm i chartjs-plugin-datalabels
```

```vue
<script setup lang="ts">
import Chart from '@rozie-ui/chartjs-vue';
import ChartDataLabels from 'chartjs-plugin-datalabels';

const data = { labels: ['A', 'B'], datasets: [{ data: [10, 20] }] };
const plugins = [ChartDataLabels];
</script>

<template>
  <Chart type="bar" :data="data" :plugins="plugins" />
</template>
```

Changing the bound array re-creates the instance (Chart.js has no stable runtime plugin-swap).

### Exporting the chart as a PNG

`toBase64Image` on the handle returns a PNG data URL — the marquee Chart.js export capability. Grab the handle and call it to download or preview the rendered chart:

```tsx
const chart = useRef<ChartHandle>(null);
// <Chart ref={chart} type="bar" data={data} />
function download() {
  const url = chart.current?.toBase64Image();
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.png';
    a.click();
  }
}
```

### Live-updating data

Bind a reactive `data` object and mutate it — the wrapper reconciles into the live chart (no remount), so each point tweens from its old value to its new one. Pass `update-mode="none"` to skip the animation on a fast feed:

```vue
<Chart :data="liveData" update-mode="none" />
```

## Gotchas

### The chart re-creates on `type`, `plugins`, and `redraw`

Chart.js can mutate data and options at runtime, but it has **no stable runtime path** to swap the chart `type` or the per-instance `plugins` array. The wrapper therefore re-creates the instance when `type` or `plugins` changes (and on every `data` change when `redraw` is `true`). Data and options changes reconcile in place. Re-creation is cheap and rare; the in-place data reconcile is what keeps tweening smooth on a live feed.

### Composed event handlers don't clobber your `options.onClick`

If you pass `options.onClick`/`options.onHover` *and* listen to the wrapper's `@click`/`@hover` events, both run — the wrapper composes its emitter over your handler (yours first). You never lose a consumer-supplied Chart.js handler by listening to the Rozie event.

### Svelte and the `$snapshot` discipline

Chart.js calls `Object.defineProperty` on the config object it is handed, which collides with Svelte 5's `$state` proxy. The wrapper `$snapshot`s every object before handing it to the engine — a no-op on the other five targets, and the reason the Svelte output looks slightly different. You don't have to do anything; it's handled inside the wrapper.

### The `tooltip` slot is the only injection surface

Chart.js paints to a `<canvas>`, so unlike DOM-based engines there is exactly one place to inject a framework-native fragment: the external HTML tooltip. v1 ships that one portal slot. Everything else (legends, data labels, annotations) is data/options/plugins configuration, not slotted DOM.

## Cross-references

- [`Chart.rozie` source on GitHub](https://github.com/One-Learning-Community/rozie.js/blob/main/packages/ui/chartjs/src/Chart.rozie) — the canonical wrapper.
- [The portal-slot primitive](/examples/portal-list) — how `<slot name="X" portal />` routes a consumer fragment through each target's imperative-render API.
- [`$expose` and the imperative handle](/guide/features#expose-→-a-consumer-callable-imperative-handle-everywhere)
- [The LineChart example](/examples/line-chart) — a focused single-type walkthrough of the same wrapper.
