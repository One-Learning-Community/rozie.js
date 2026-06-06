# @rozie-ui/chartjs-lit

Idiomatic **lit** `Chart` — a cross-framework data-visualization component compiled from one [Rozie](https://github.com/One-Learning-Community/rozie.js) source wrapping [Chart.js](https://www.chartjs.org/). The `type` prop switches the chart kind across the whole Chart.js controller set (line/bar/pie/doughnut/radar/polarArea/scatter/bubble). This package is generated; do not edit `src/` by hand.

## Install

```bash
npm i @rozie-ui/chartjs-lit
```

Peer dependencies: the `chart.js` engine (`^4`) + `lit + @lit-labs/preact-signals + @preact/signals-core`. Install them alongside this package.

## Usage

```ts
import '@rozie-ui/chartjs-lit';

// <rozie-chart> is a custom element. Bind `data`/`type` as properties.
const el = document.querySelector('rozie-chart');
el.type = 'bar';
el.data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
};
el.addEventListener('click', (e) => console.log(e.detail.elements));
```

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

```ts
// The custom element IS the handle — its exposed methods are public
// element methods.
const el = document.querySelector('rozie-chart');
el.updateChart();
const png = el.toBase64Image();
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

## Slots

| Slot | Params |
| --- | --- |
| fallback |  |
| tooltip | model |
