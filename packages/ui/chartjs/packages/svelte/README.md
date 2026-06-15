# @rozie-ui/chartjs-svelte

Idiomatic **svelte** `Chart` — a cross-framework data-visualization component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Chart.js](https://www.chartjs.org/). The `type` prop switches the chart kind across the whole Chart.js controller set (line/bar/pie/doughnut/radar/polarArea/scatter/bubble). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/chartjs-svelte
```

Peer dependencies: the `chart.js` engine (`^4`) + `svelte`. Install them alongside this package.

## Usage

```svelte
<script lang="ts">
  import Chart from '@rozie-ui/chartjs-svelte';

  const data = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
  };
</script>

<Chart type="bar" {data} height={280} />
```

## Registration & per-type components

Chart.js v3+ is tree-shakable: the generic `Chart` does **not** auto-register controllers, so register what you use —

```ts
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale } from 'chart.js';
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale);
```

— or import the kitchen-sink `/auto` entry (`@rozie-ui/chartjs-svelte/auto`, or `import 'chart.js/auto'`) which registers everything.

Or use a **per-type component** — each pins its `type` and registers only its own controller set (so importing one is tree-shakable), with the same props/events/handle as the generic `Chart` (minus `type`): `Line`, `Bar`, `Pie`, `Doughnut`, `PolarArea`, `Radar`, `Scatter`, `Bubble`.

## Props

| Name | Type | Default | Two-way (model) | Required |
| --- | --- | --- | :---: | :---: |
| `data` | `Object` | `{…}` |  |  |
| `options` | `Object` | `{}` |  |  |
| `type` | `String` | `"line"` |  |  |
| `height` | `Number` | `240` |  |  |
| `width` | `Number` | `undefined` |  |  |
| `plugins` | `Array` | `[]` |  |  |
| `updateMode` | `String` | `undefined` |  |  |
| `redraw` | `Boolean` | `false` |  |  |
| `ariaLabel` | `String` | `undefined` |  |  |
| `datasetIdKey` | `String` | `"label"` |  |  |
| `destroyDelay` | `Number` | `0` |  |  |

## Events

| Event | Description |
| --- | --- |
| `click` | |
| `datasetClick` | |
| `hover` | |

## Imperative handle

Beyond props, the component exposes imperative methods (declared once in the Rozie source via `$expose`). Grab a handle with the native ref mechanism and call them directly:

```svelte
<script>
  let chart;                 // component instance via bind:this
</script>

<Chart bind:this={chart} />
<button onclick={() => chart.updateChart()}>Update</button>
```

| Method | Description |
| --- | --- |
| `getChart` | Return the underlying Chart.js instance for direct API access (e.g. `getChart().update()`). |
| `updateChart` | Re-render the chart after mutating its data/options — `updateChart(mode?)` (Chart.js `update` mode string). |
| `resizeChart` | Resize the chart to its container, or to explicit dimensions — `resizeChart(width?, height?)`. |
| `resetChart` | Reset the chart elements to their initial (pre-animation) state. |
| `renderChart` | Re-render the chart from its current state without recalculating the scales. |
| `stopChart` | Stop the current animation loop (returns the instance). |
| `clearChart` | Clear the chart canvas (returns the instance). |
| `toBase64Image` | Export the current canvas as a base64-encoded PNG data URL — `toBase64Image(type?, quality?)`. |
| `setDatasetVisibility` | Set a dataset visible/hidden INSTANTLY — `setDatasetVisibility(datasetIndex, visible)`. Drives a custom external legend. |
| `isDatasetVisible` | Whether a dataset is currently visible — `isDatasetVisible(datasetIndex)`. Pairs with `setDatasetVisibility` for custom-legend styling. |
| `hideDataset` | Hide a dataset (or a single element) with ANIMATION — `hideDataset(datasetIndex, dataIndex?)` (Chart.js `hide`). |
| `showDataset` | Show a previously-hidden dataset (or element) with ANIMATION — `showDataset(datasetIndex, dataIndex?)` (Chart.js `show`). |
| `setActiveElements` | Programmatically set the active/hovered elements (open the tooltip from external interaction) — `setActiveElements([{ datasetIndex, index }])`. |
| `getActiveElements` | Return the currently active/hovered elements (mirror hover state into sibling UI). |
| `getDatasetMeta` | Return a dataset’s computed metadata (pixel geometry, controller) for positioning custom overlays — `getDatasetMeta(datasetIndex)`. |

## Slots

| Slot | Params |
| --- | --- |
| fallback |  |
| tooltip | model |
