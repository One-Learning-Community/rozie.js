import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import './Chart.css';
import './Chart.global.css';
import { Chart as ChartJS, BarController, BarElement, LinearScale, CategoryScale, Legend, Tooltip, Colors } from 'chart.js';
// Bar registers only its own Chart.js controller/element/scale set
// (tree-shakable — importing this component does not pull every controller).

interface TooltipCtx { model: any; }

interface BarProps {
  data?: Record<string, any>;
  options?: Record<string, any>;
  height?: number;
  width?: number;
  plugins?: any[];
  updateMode?: string;
  redraw?: boolean;
  ariaLabel?: string;
  datasetIdKey?: string;
  destroyDelay?: number;
  onClick?: (...args: any[]) => void;
  onDatasetClick?: (...args: any[]) => void;
  onHover?: (...args: any[]) => void;
  renderFallback?: () => ReactNode;
  renderTooltip?: (ctx: TooltipCtx) => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export interface BarHandle {
  getChart: (...args: any[]) => any;
  updateChart: (...args: any[]) => any;
  resizeChart: (...args: any[]) => any;
  resetChart: (...args: any[]) => any;
  renderChart: (...args: any[]) => any;
  stopChart: (...args: any[]) => any;
  clearChart: (...args: any[]) => any;
  toBase64Image: (...args: any[]) => any;
}

const Bar = forwardRef<BarHandle, BarProps>(function Bar(_props: BarProps, ref): JSX.Element {
  const portalRoots = useRef<Set<Root>>(new Set());
  const __defaultData = useState(() => (() => ({
    labels: [],
    datasets: []
  }))())[0];
  const __defaultOptions = useState(() => (() => ({}))())[0];
  const __defaultPlugins = useState(() => (() => [])())[0];
  const props: Omit<BarProps, 'data' | 'options' | 'height' | 'width' | 'plugins' | 'updateMode' | 'redraw' | 'ariaLabel' | 'datasetIdKey' | 'destroyDelay'> & { data: Record<string, any>; options: Record<string, any>; height: number; width: number; plugins: any[]; updateMode: string; redraw: boolean; ariaLabel: string; datasetIdKey: string; destroyDelay: number } = {
    ..._props,
    data: _props.data ?? __defaultData,
    options: _props.options ?? __defaultOptions,
    height: _props.height ?? 240,
    width: _props.width ?? undefined,
    plugins: _props.plugins ?? __defaultPlugins,
    updateMode: _props.updateMode ?? undefined,
    redraw: _props.redraw ?? false,
    ariaLabel: _props.ariaLabel ?? undefined,
    datasetIdKey: _props.datasetIdKey ?? 'label',
    destroyDelay: _props.destroyDelay ?? 0,
  };
  const _renderTooltipRef = useRef(props.renderTooltip);
  _renderTooltipRef.current = props.renderTooltip;
  const canvasNode = useRef<any>(null);
  const tooltipEl = useRef<any>(null);
  const tooltipDispose = useRef<any>(null);
  const buildConfig = useRef<any>(null);
  const instance = useRef<any>(null);
  const _dataRef = useRef(props.data);
  _dataRef.current = props.data;
  const _optionsRef = useRef(props.options);
  _optionsRef.current = props.options;
  const _pluginsRef = useRef(props.plugins);
  _pluginsRef.current = props.plugins;
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const _watch1First = useRef(true);
  const _watch2First = useRef(true);

  // Bar registers only its own Chart.js controller/element/scale set
  // (tree-shakable — importing this component does not pull every controller).
  ChartJS.register(BarController, BarElement, LinearScale, CategoryScale, Legend, Tooltip, Colors);

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
  function recreate() {
    if (!buildConfig.current || !canvasNode.current) return;
    instance.current?.destroy();
    instance.current = new ChartJS(canvasNode.current, buildConfig.current());
  }
  // Imperative handle (Phase 21 $expose). The verbs are SUFFIXED with `Chart`
  // because bare `update`/`render` collide with LitElement's reactive-lifecycle
  // methods (`update(changedProperties)` / `render()`) and would shadow them on
  // the Lit leaf; `resize`/`reset`/`stop`/`clear` are suffixed too for a
  // consistent, unambiguous handle. `getChart` returns the live instance for
  // direct API access; `toBase64Image` is the marquee PNG-export capability.
  // Collision-clear: none of the 8 names collide with the 9 props.
  function getChart() {
    return instance.current;
  }
  function updateChart(mode: any) {
    instance.current?.update(mode);
  }
  function resizeChart(w: any, h: any) {
    instance.current?.resize(w, h);
  }
  function resetChart() {
    instance.current?.reset();
  }
  function renderChart() {
    instance.current?.render();
  }
  function stopChart() {
    return instance.current?.stop();
  }
  function clearChart() {
    return instance.current?.clear();
  }
  function toBase64Image(type: any, quality: any) {
    return instance.current ? instance.current.toBase64Image(type, quality) : null;
  }

  useEffect(() => {
    const portals = {
    tooltip: (container: HTMLElement, scope: { model: unknown }): (() => void) => {
      const slot = _renderTooltipRef.current ?? props.slots?.['tooltip'];
      if (typeof slot !== 'function') return () => {};
      // Spike 004: portal-scope attribute injection.
      // Cascades the @portal tooltip { … } selectors from the
      // component's .module.css into the engine-owned subtree.
      container.setAttribute('data-rozie-portal-tooltip', 'ed04b5ca');
      const root = createRoot(container);
      flushSync(() => root.render(slot(scope)));
      portalRoots.current.add(root);
      return () => {
        root.unmount();
        portalRoots.current.delete(root);
      };
    },
  };
    canvasNode.current = canvasEl.current;

    // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
    // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
    // any consumer-supplied handler first (read off $props.options), then emit a
    // structured payload resolving the hit element(s) via getElementsAtEventForMode.
    const composedOnClick = (e: any, activeEls: any, chart: any) => {
      const userOnClick = _optionsRef.current?.onClick;
      if (typeof userOnClick === 'function') userOnClick(e, activeEls, chart);
      const nearest = chart.getElementsAtEventForMode(e, 'nearest', {
        intersect: true
      }, false);
      props.onClick && props.onClick({
        event: e,
        elements: nearest,
        chart
      });
      const dataset = chart.getElementsAtEventForMode(e, 'dataset', {
        intersect: true
      }, false);
      if (dataset.length) {
        props.onDatasetClick && props.onDatasetClick({
          event: e,
          elements: dataset,
          datasetIndex: dataset[0].datasetIndex,
          chart
        });
      }
    };
    const composedOnHover = (e: any, activeEls: any, chart: any) => {
      const userOnHover = _optionsRef.current?.onHover;
      if (typeof userOnHover === 'function') userOnHover(e, activeEls, chart);
      props.onHover && props.onHover({
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
    let tooltipKey = '';
    const tooltipExternal = (context: any) => {
      const {
        chart,
        tooltip
      } = context;
      if (!tooltipEl.current) {
        tooltipEl.current = document.createElement('div');
        tooltipEl.current.className = 'rozie-chart-tooltip';
        tooltipEl.current.style.position = 'absolute';
        tooltipEl.current.style.pointerEvents = 'none';
        tooltipEl.current.style.transition = 'opacity 0.1s ease';
        chart.canvas.parentNode.appendChild(tooltipEl.current);
      }
      if (tooltip.opacity === 0) {
        tooltipEl.current.style.opacity = '0';
        return;
      }
      const title = (tooltip.title || []).join(' ');
      const body = (tooltip.body || []).map((b: any) => b.lines.join(' ')).join(' | ');
      const key = `${title}::${body}`;
      if (key !== tooltipKey) {
        tooltipKey = key;
        tooltipDispose.current?.();
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
        tooltipDispose.current = portals.tooltip(tooltipEl.current, scope);
      }
      const {
        offsetLeft,
        offsetTop
      } = chart.canvas;
      tooltipEl.current.style.opacity = '1';
      tooltipEl.current.style.left = `${offsetLeft + tooltip.caretX}px`;
      tooltipEl.current.style.top = `${offsetTop + tooltip.caretY}px`;
    };

    // ─── config builder ────────────────────────────────────────────────────────
    // $snapshot strips Svelte 5's $state proxy first; Chart.js redefines property
    // descriptors on whatever object it is handed.
    buildConfig.current = () => {
      const userOpts = _optionsRef.current || {};
      const tooltipOpt = (props.renderTooltip ?? props.slots?.["tooltip"]) ? {
        ...(userOpts.plugins?.tooltip || {}),
        enabled: false,
        external: tooltipExternal
      } : userOpts.plugins?.tooltip;
      return {
        type: 'bar',
        data: _dataRef.current,
        // per-instance plugins[] — the consumer-extensibility passthrough.
        plugins: _pluginsRef.current,
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
    instance.current = new ChartJS(canvasNode.current, buildConfig.current());
    return () => {
      for (const root of portalRoots.current) root.unmount();
  portalRoots.current.clear();
      tooltipDispose.current?.();
      tooltipEl.current?.remove();
      // destroyDelay (vue-chartjs parity): defer destroy() so any exit transition
      // can finish. The captured `dying` instance is destroyed after the grace;
      // 0 (default) destroys synchronously.
      const dying = instance.current;
      if (props.destroyDelay > 0) {
        setTimeout(() => dying?.destroy(), props.destroyDelay);
      } else {
        dying?.destroy();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = props.data;
    if (!instance.current) return;
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
    const live = instance.current.data;

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
      instance.current.update(props.updateMode);
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
    instance.current.update(props.updateMode);
  }, [props.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (_watch1First.current) { _watch1First.current = false; return; }
    if (!instance.current || !buildConfig.current) return;
    instance.current.options = buildConfig.current().options;
    instance.current.update('none');
  }, [props.options]);
  useEffect(() => {
    if (_watch2First.current) { _watch2First.current = false; return; }
    recreate();
  }, [props.plugins]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ getChart, updateChart, resizeChart, resetChart, renderChart, stopChart, clearChart, toBase64Image }), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <div className={"rozie-chart"} style={{ height: props.height + 'px', width: props.width ? props.width + 'px' : undefined }} data-rozie-s-ed04b5ca="">
      
      <canvas ref={canvasEl} role="img" aria-label={props.ariaLabel} data-rozie-s-ed04b5ca="">{(props.renderFallback ?? props.slots?.['fallback'])?.()}</canvas>
    </div>


    </>
  );
});
export default Bar;
