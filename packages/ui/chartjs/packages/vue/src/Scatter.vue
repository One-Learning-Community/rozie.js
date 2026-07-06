<template>

<div class="rozie-chart" :style="{ height: props.height + 'px', width: props.width ? props.width + 'px' : undefined }">
  
  <canvas ref="canvasElRef" role="img" :aria-label="props.ariaLabel"><slot name="fallback"></slot></canvas>
</div>



</template>

<script setup lang="ts">
import { Fragment, h, onBeforeUnmount, onMounted, ref, render, useSlots, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /**
     * Chart.js data in its own `{ labels, datasets }` shape. Reconciled **in place** on change — the wrapper mutates `chart.data` and calls `chart.update()` so series tween point-to-point instead of remounting.
     * @example
     * <Chart :data="$data.chartData" type="bar" />
     */
    data?: Record<string, any>;
    /**
     * Chart.js options (scales, legend, plugins config, …). Merged over the wrapper's responsive defaults and reapplied wholesale on change with `update('none')`. A consumer-supplied `options.onClick`/`onHover` is **composed**, not clobbered.
     */
    options?: Record<string, any>;
    /**
     * Chart height in pixels, applied to the wrapper's host box; the canvas fills it responsively.
     */
    height?: number;
    /**
     * Optional fixed chart width in pixels. Omit for the default full-width responsive box.
     */
    width?: number;
    /**
     * Per-instance Chart.js `Plugin[]` — the consumer-extensibility passthrough. Merged into the config; changing the array **re-creates** the instance, since Chart.js has no stable runtime plugin-swap.
     */
    plugins?: any[];
    /**
     * The Chart.js `update` mode string used by the in-place data reconcile (e.g. `none` to skip the animation on every data tick).
     */
    updateMode?: string;
    /**
     * When `true`, a `data` change **re-creates** the chart wholesale instead of reconciling in place — mirrors react-chartjs-2 `redraw` for charts whose plugins do not survive an in-place update.
     */
    redraw?: boolean;
    /**
     * Accessible label applied to the `<canvas role="img">`, since canvas charts are otherwise opaque to assistive tech. For richer fallback content, fill the `fallback` slot.
     */
    ariaLabel?: string;
    /**
     * The dataset-identity key (react-chartjs-2 parity). Across data updates, datasets are matched by `dataset[datasetIdKey]`, falling back to array index when the key is absent, so a stable keyed dataset reconciles onto its prior slot even if its index moved — guarding the "first dataset copied over the others" hazard.
     */
    datasetIdKey?: string;
    /**
     * Milliseconds to defer `chart.destroy()` on unmount so an exit transition can finish (vue-chartjs parity). `0` (the default) destroys immediately.
     */
    destroyDelay?: number;
  }>(),
  { data: () => ({
  labels: [],
  datasets: []
}), options: () => ({}), height: 240, width: undefined, plugins: () => [], updateMode: undefined, redraw: false, ariaLabel: undefined, datasetIdKey: 'label', destroyDelay: 0 }
);

const emit = defineEmits<{
  click: [...args: any[]];
  datasetClick: [...args: any[]];
  hover: [...args: any[]];
}>();

defineSlots<{
  fallback(props: {  }): any;
  tooltip(props: { model: any }): any;
}>();

const slots = useSlots();

const canvasElRef = ref<HTMLElement>();

import { Chart as ChartJS, ScatterController, PointElement, LinearScale, Legend, Tooltip, Colors } from 'chart.js';
// Scatter registers only its own Chart.js controller/element/scale set
// (tree-shakable — importing this component does not pull every controller).
// Scatter registers only its own Chart.js controller/element/scale set
// (tree-shakable — importing this component does not pull every controller).
ChartJS.register(ScatterController, PointElement, LinearScale, Legend, Tooltip, Colors);

// Chart.js v3+ ships with no controllers/elements/scales pre-registered. The
// generic Chart does NOT auto-register — the consumer registers only what they
// use (the tree-shakable Chart.js v3+ idiom every framework wrapper follows), so
// an app that only renders line charts doesn't ship every controller. Two paths:
//   - selective: `import { Chart, LineController, ... } from 'chart.js';
//     Chart.register(LineController, ...)` once at app startup; OR
//   - kitchen sink: import this package's `/auto` entry
//     (`@rozie-ui/chartjs-<fw>/auto`), or `import 'chart.js/auto'`, which
//     registers everything.
// The per-type components (Line/Bar/…) register their own controller set, so
// importing one is tree-shakable by construction.
// Chart.js v3+ ships with no controllers/elements/scales pre-registered. The
// generic Chart does NOT auto-register — the consumer registers only what they
// use (the tree-shakable Chart.js v3+ idiom every framework wrapper follows), so
// an app that only renders line charts doesn't ship every controller. Two paths:
//   - selective: `import { Chart, LineController, ... } from 'chart.js';
//     Chart.register(LineController, ...)` once at app startup; OR
//   - kitchen sink: import this package's `/auto` entry
//     (`@rozie-ui/chartjs-<fw>/auto`), or `import 'chart.js/auto'`, which
//     registers everything.
// The per-type components (Line/Bar/…) register their own controller set, so
// importing one is tree-shakable by construction.

let instance: any = null;
// $refs.canvasEl is read ONLY inside $onMount (ROZ123); re-creates use this
// captured node so no $refs read ever executes outside the mount hook. Named
// `canvasNode` (NOT `canvasEl`) so it does not collide with the template
// `ref="canvasEl"` binding, which the per-target emitters lower to their own
// `canvasEl` ref declaration (a same-name script local double-declares it).
// $refs.canvasEl is read ONLY inside $onMount (ROZ123); re-creates use this
// captured node so no $refs read ever executes outside the mount hook. Named
// `canvasNode` (NOT `canvasEl`) so it does not collide with the template
// `ref="canvasEl"` binding, which the per-target emitters lower to their own
// `canvasEl` ref declaration (a same-name script local double-declares it).
let canvasNode: any = null;
// buildConfig is DEFINED inside $onMount (so its $emit/$portals/$slots
// references are bound in the mount-lifecycle scope the per-target emitters
// provide — mirrors FullCalendar's mount-built opts + CodeMirror's panelExt
// note) and stored here so the top-level re-create $watches can call it.
// buildConfig is DEFINED inside $onMount (so its $emit/$portals/$slots
// references are bound in the mount-lifecycle scope the per-target emitters
// provide — mirrors FullCalendar's mount-built opts + CodeMirror's panelExt
// note) and stored here so the top-level re-create $watches can call it.
let buildConfig: any = null;
// Re-create the live instance. Chart.js exposes no stable runtime type-swap or
// plugin-swap, so `type`/`plugins`/`redraw`-driven changes re-create. Uses the
// captured canvasNode (never re-reads $refs outside $onMount).
const recreate = () => {
  if (!buildConfig || !canvasNode) return;
  instance?.destroy();
  instance = new ChartJS(canvasNode, buildConfig());
};

// Reconcile prop changes. Mutating chart.data in place and calling update() is
// the Chart.js-supported runtime path — re-creating on every data tick would
// flicker and leak. (When `redraw` is set, re-create wholesale instead.)
// Imperative handle (Phase 21 $expose). The lifecycle/redraw verbs are SUFFIXED
// with `Chart` because bare `update`/`render` collide with LitElement's
// reactive-lifecycle methods (`update(changedProperties)` / `render()`) and
// would shadow them on the Lit leaf; `resize`/`reset`/`stop`/`clear` are
// suffixed too for a consistent, unambiguous handle. `getChart` returns the live
// instance for direct API access; `toBase64Image` is the marquee PNG-export.
//
// The visibility + active-element family (added later) is the #1 reason a
// consumer reaches for a chart handle — custom legends, externally-driven
// tooltips/highlights, overlay positioning — none reachable via prop/event:
//   - setDatasetVisibility / isDatasetVisible: drive a custom legend's series
//     show/hide (INSTANT toggle).
//   - hideDataset / showDataset: the ANIMATED hide/show (Chart.js hide()/show()).
//     SUFFIXED with `Dataset` both to dodge inherited HTMLElement-ish ambiguity
//     and to disambiguate the dataset-vs-element overload.
//   - setActiveElements / getActiveElements: programmatically open/read the
//     hovered/active points (sync hover from a table row, a map pin, a sibling
//     chart) — events only REPORT hover, they cannot SET it.
//   - getDatasetMeta: read computed geometry (pixel coords, controller) to
//     position custom overlays/annotations over the canvas.
// Collision-clear: none of the 15 names collide with the 11 props or the 3
// emits (click/datasetClick/hover).
function getChart() {
  return instance;
}
function updateChart(mode: any) {
  instance?.update(mode);
}
function resizeChart(w: any, h: any) {
  instance?.resize(w, h);
}
function resetChart() {
  instance?.reset();
}
function renderChart() {
  instance?.render();
}
function stopChart() {
  return instance?.stop();
}
function clearChart() {
  return instance?.clear();
}
function toBase64Image(type: any, quality: any) {
  return instance ? instance.toBase64Image(type, quality) : null;
}
function setDatasetVisibility(datasetIndex: any, visible: any) {
  instance?.setDatasetVisibility(datasetIndex, visible);
}
function isDatasetVisible(datasetIndex: any) {
  return instance ? instance.isDatasetVisible(datasetIndex) : false;
}
function hideDataset(datasetIndex: any, dataIndex: any) {
  instance?.hide(datasetIndex, dataIndex);
}
function showDataset(datasetIndex: any, dataIndex: any) {
  instance?.show(datasetIndex, dataIndex);
}
function setActiveElements(elements: any) {
  instance?.setActiveElements(elements ?? []);
}
function getActiveElements() {
  return instance ? instance.getActiveElements() : [];
}
function getDatasetMeta(datasetIndex: any) {
  return instance ? instance.getDatasetMeta(datasetIndex) : null;
}

const portalContainers = new Set<HTMLElement>();
const portals = {
  tooltip: (container: HTMLElement, scope: { model: unknown }): (() => void) => {
    const slotFn = slots.tooltip;
    if (!slotFn) return () => {};
    // Spike 004: portal-scope attribute injection. Cascades the @portal
    // tooltip { … } selectors from the unscoped <style> block below into
    // the engine-owned subtree.
    container.setAttribute('data-rozie-portal-tooltip', 'e7b1d9e8');
    const vnode = h(Fragment, null, slotFn(scope));
    render(vnode, container);
    portalContainers.add(container);
    return () => {
      render(null, container);
      portalContainers.delete(container);
    };
  },
};
onBeforeUnmount(() => {
  for (const container of portalContainers) render(null, container);
  portalContainers.clear();
});

let _cleanup_0: (() => void) | undefined;
onMounted(() => {
  canvasNode = canvasElRef.value;

  // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
  // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
  // any consumer-supplied handler first (read off $props.options), then emit a
  // structured payload resolving the hit element(s) via getElementsAtEventForMode.
  const composedOnClick = (e: any, activeEls: any, chart: any) => {
    const userOnClick = props.options?.onClick;
    if (typeof userOnClick === 'function') userOnClick(e, activeEls, chart);
    const nearest = chart.getElementsAtEventForMode(e, 'nearest', {
      intersect: true
    }, false);
    emit('click', {
      event: e,
      elements: nearest,
      chart
    });
    const dataset = chart.getElementsAtEventForMode(e, 'dataset', {
      intersect: true
    }, false);
    if (dataset.length) {
      emit('datasetClick', {
        event: e,
        elements: dataset,
        datasetIndex: dataset[0].datasetIndex,
        chart
      });
    }
  };
  const composedOnHover = (e: any, activeEls: any, chart: any) => {
    const userOnHover = props.options?.onHover;
    if (typeof userOnHover === 'function') userOnHover(e, activeEls, chart);
    emit('hover', {
      event: e,
      elements: activeEls,
      chart
    });
  };

  // ─── external-HTML tooltip portal slot ─────────────────────────────────────
  // Only active when the consumer fills <slot name="tooltip">. The external
  // handler positions a container over the canvas and mounts the consumer's
  // framework-native fragment through $portals.tooltip(dom, scope). The scope
  // carries the live tooltip model (title/body/dataPoints/position). Chart.js
  // throttles external calls to active-element changes, so the dispose+remount
  // on body-change is cheap. enabled:false suppresses the built-in canvas
  // tooltip when we take over.
  //
  // Mount-locals (not top-level script `let`s) — read only by tooltipExternal
  // and the returned teardown below, both defined in THIS $onMount closure.
  // Emitter-hardening backlog item #2 (project_emitter_hardening_backlog):
  // every target keeps a $onMount setup-local in scope for its own returned
  // teardown, so these no longer need the prior COMPONENT-scope workaround.
  let tooltipEl: any = null;
  let tooltipDispose: any = null;
  let tooltipKey = '';
  const tooltipExternal = (context: any) => {
    const {
      chart,
      tooltip
    } = context;
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'rozie-chart-tooltip';
      tooltipEl.style.position = 'absolute';
      tooltipEl.style.pointerEvents = 'none';
      tooltipEl.style.transition = 'opacity 0.1s ease';
      chart.canvas.parentNode.appendChild(tooltipEl);
    }
    if (tooltip.opacity === 0) {
      tooltipEl.style.opacity = '0';
      return;
    }
    const title = (tooltip.title || []).join(' ');
    const body = (tooltip.body || []).map((b: any) => b.lines.join(' ')).join(' | ');
    const key = `${title}::${body}`;
    if (key !== tooltipKey) {
      tooltipKey = key;
      tooltipDispose?.();
      // The scope MUST match the slot's declared param (`model`): the consumer's
      // <slot name="tooltip"> receives a single `model` scoped value.
      const scope = {
        model: {
          title: tooltip.title || [],
          body: (tooltip.body || []).map((b: any) => b.lines),
          dataPoints: tooltip.dataPoints || [],
          opacity: tooltip.opacity
        }
      };
      tooltipDispose = portals.tooltip(tooltipEl, scope);
    }
    const {
      offsetLeft,
      offsetTop
    } = chart.canvas;
    tooltipEl.style.opacity = '1';
    tooltipEl.style.left = `${offsetLeft + tooltip.caretX}px`;
    tooltipEl.style.top = `${offsetTop + tooltip.caretY}px`;
  };

  // ─── config builder ────────────────────────────────────────────────────────
  // $snapshot strips Svelte 5's $state proxy first; Chart.js redefines property
  // descriptors on whatever object it is handed.
  buildConfig = () => {
    const userOpts = props.options || {};
    const tooltipOpt = slots.tooltip ? {
      ...(userOpts.plugins?.tooltip || {}),
      enabled: false,
      external: tooltipExternal
    } : userOpts.plugins?.tooltip;
    return {
      type: 'scatter',
      data: props.data,
      // per-instance plugins[] — the consumer-extensibility passthrough.
      plugins: props.plugins,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 250
        },
        ...userOpts,
        onClick: composedOnClick,
        onHover: composedOnHover,
        plugins: {
          ...(userOpts.plugins || {}),
          tooltip: tooltipOpt
        }
      }
    };
  };
  instance = new ChartJS(canvasNode, buildConfig());
  _cleanup_0 = () => {
    tooltipDispose?.();
    tooltipEl?.remove();
    // destroyDelay (vue-chartjs parity): defer destroy() so any exit transition
    // can finish. The captured `dying` instance is destroyed after the grace;
    // 0 (default) destroys synchronously.
    const dying = instance;
    if (props.destroyDelay > 0) {
      setTimeout(() => dying?.destroy(), props.destroyDelay);
    } else {
      dying?.destroy();
    }
  };
});
onBeforeUnmount(() => { _cleanup_0?.(); });

watch(() => props.data, (v: any) => {
  if (!instance) return;
  if (props.redraw) {
    recreate();
    return;
  }

  // Reconcile a new data object into the LIVE chart instead of replacing
  // instance.data. Chart.js matches dataset controllers and point elements by
  // array index across an update(), so mutating the existing labels/datasets
  // arrays lets it tween every point from old value to new. Assigning a fresh
  // instance.data severs that identity.
  const next = v;
  const live = instance.data;

  // Aliasing guard. On identity-$snapshot targets (React / Solid / Lit) $snapshot
  // returns its argument unchanged, and Chart.js stores config.data by reference,
  // so a freshly-constructed chart has `instance.data === $props.data === next`.
  // The in-place `live.labels.length = 0` below would then empty the very array we
  // read from on the next line (`next.labels` IS `live.labels`), wiping the labels
  // → cartesian charts lose their category axis and render an empty plot (the
  // doughnut, being radial, survives — it doesn't position by label). When live and
  // next alias there is nothing to reconcile: the chart already holds this data, so
  // just repaint. (Vue/Angular never hit this — their immediate $watch runs before
  // $onMount, when instance is still null.)
  if (live === next) {
    instance.update(props.updateMode);
    return;
  }
  live.labels ??= [];
  live.labels.length = 0;
  live.labels.push(...(next.labels ?? []));

  // Datasets are matched by `ds[datasetIdKey]` (default 'label') so a stable
  // keyed dataset reconciles onto its prior slot even if its array index moved —
  // this guards the "first dataset copied over the others" hazard react-chartjs-2
  // documents. Datasets without the key fall back to positional (index) matching.
  live.datasets ??= [];
  const nextSets = next.datasets ?? [];
  const key = props.datasetIdKey;
  const prev = live.datasets.slice();
  const byKey = new Map();
  prev.forEach((ds: any, i: any) => {
    if (ds && ds[key] != null) byKey.set(ds[key], ds);
  });
  const merged = nextSets.map((ds: any, i: any) => {
    const match = ds && ds[key] != null && byKey.get(ds[key]) || prev[i];
    if (match) {
      Object.assign(match, ds);
      return match;
    }
    return ds;
  });
  live.datasets.length = 0;
  live.datasets.push(...merged);
  instance.update(props.updateMode);
}, { immediate: true });
watch(() => props.options, () => {
  if (!instance || !buildConfig) return;
  instance.options = buildConfig().options;
  instance.update('none');
});
watch(() => props.plugins, () => recreate());

defineExpose({ getChart, updateChart, resizeChart, resetChart, renderChart, stopChart, clearChart, toBase64Image, setDatasetVisibility, isDatasetVisible, hideDataset, showDataset, setActiveElements, getActiveElements, getDatasetMeta });
</script>

<style scoped>
.rozie-chart {
  position: relative;
  width: 100%;
}
.rozie-chart canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
</style>

<style>
.rozie-chart .rozie-chart-tooltip {
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
    transform: translate(-50%, calc(-100% - 8px));
    white-space: nowrap;
  }
</style>
