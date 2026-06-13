<script setup>
import LineChartDemo from '../../examples/demos/LineChartDemo.rozie';
</script>

# LineChart (Chart.js)

A data-bound port of [Chart.js](https://www.chartjs.org/). Chart.js paints to a `<canvas>` the host framework never touches — and, like flatpickr, it has a wrapper in every framework (`react-chartjs-2`, `vue-chartjs`, `ng2-charts`, `svelte-chartjs`, …), each one a few hundred lines that mostly shuttle a `data` prop into a `new Chart()` call. `LineChart.rozie` collapses all of them into one source.

It is the deepest-reactivity example in the set:

- **One-way reactivity over a deeply-nested prop** — Chart.js's `data` is `{ labels, datasets: [{ data: [...] }] }`. The `$watch` reconciler mutates the *live* `chart.data` arrays in place and calls `chart.update()`, so Chart.js can tween every point from its old value to its new one. Replacing `instance.data` wholesale would sever that point identity and kill the animation.
- **`$snapshot`** — `$snapshot(x)` lowers to `$state.snapshot(x)` on the Svelte target and to plain `x` on the other five. Chart.js calls `Object.defineProperty` on the config object it is handed, which collides with Svelte 5's `$state` proxy; `$snapshot` unwraps the proxy first. It is a no-op everywhere else. Watch for it in the Svelte output below.
- **`$onMount` teardown**, **`$refs`** for the canvas, and a `type`-change `$watch` that *does* re-create the instance — Chart.js has no stable runtime "change chart type" path, so a remount is the honest choice there.

## Live demo

`LineChartDemo.rozie` drives the chart with a simulated live feed: a new data point every 0.8s, reconciled into the running chart with no remount. Toggle the feed off to push points by hand, or switch the chart between Line and Bar.

<div class="rozie-demo">
  <ClientOnly>
    <LineChartDemo />
  </ClientOnly>
</div>

## Source — Chart.rozie (generic Chart.js wrapper)

```rozie-src Chart
```

## Compiled output

::: code-group

```rozie-out Chart vue
```

```rozie-out Chart react
```

```rozie-out Chart svelte
```

```rozie-out Chart angular
```

```rozie-out Chart solid
```

```rozie-out Chart lit
```

:::

## Demo source — LineChartDemo.rozie

```rozie-src LineChartDemo
```
