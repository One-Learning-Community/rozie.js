import { Component, ContentChild, DestroyRef, ElementRef, EmbeddedViewRef, TemplateRef, ViewContainerRef, ViewEncapsulation, contentChild, effect, inject, input, output, untracked, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { Chart as ChartJS, RadarController, LineElement, PointElement, RadialLinearScale, Filler, Legend, Tooltip, Colors } from 'chart.js';
// Radar registers only its own Chart.js controller/element/scale set
// (tree-shakable — importing this component does not pull every controller).

interface FallbackCtx {}

interface TooltipCtx {
  $implicit: { model: any };
  model: any;
}

@Component({
  selector: 'rozie-radar',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `

    <div class="rozie-chart" [style]="__style">
      
      <canvas #canvasEl role="img" [attr.aria-label]="ariaLabel()"><ng-container *ngTemplateOutlet="(fallbackTpl ?? templates()?.['fallback'])" /></canvas>
    </div>


    <ng-container #rozie_portalAnchor></ng-container>
  `,
  styles: [`
    .rozie-chart {
      position: relative;
      width: 100%;
    }
    .rozie-chart canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }

    ::ng-deep .rozie-chart .rozie-chart-tooltip {
        background: rgba(0, 0, 0, 0.8);
        color: #fff;
        border-radius: 4px;
        padding: 6px 8px;
        font-size: 12px;
        transform: translate(-50%, calc(-100% - 8px));
        white-space: nowrap;
      }
  `],
})
export class Radar {
  data = input<Record<string, any>>((() => ({
    labels: [],
    datasets: []
  }))());
  options = input<Record<string, any>>((() => ({}))());
  height = input<number>(240);
  width = input<number>(undefined);
  plugins = input<any[]>((() => [])());
  updateMode = input<string>(undefined);
  redraw = input<boolean>(false);
  ariaLabel = input<string>(undefined);
  datasetIdKey = input<string>('label');
  destroyDelay = input<number>(0);
  canvasEl = viewChild<ElementRef<HTMLElement>>('canvasEl');
  click = output<unknown>();
  datasetClick = output<unknown>();
  hover = output<unknown>();
  @ContentChild('fallback', { read: TemplateRef }) fallbackTpl?: TemplateRef<FallbackCtx>;
  @ContentChild('tooltip', { read: TemplateRef }) tooltipTpl?: TemplateRef<TooltipCtx>;
  templates = input<Record<string, TemplateRef<unknown>> | undefined>(undefined);
  private _portalViews = new Set<EmbeddedViewRef<unknown>>();
  private _portalAnchor = viewChild('rozie_portalAnchor', { read: ViewContainerRef });
  private _tooltipTpl = contentChild('tooltip', { read: TemplateRef });
  private __rozieDestroyRef = inject(DestroyRef);
  private __rozieWatchInitial_1 = true;
  private __rozieWatchInitial_2 = true;

  constructor() {
    // Radar registers only its own Chart.js controller/element/scale set
    // (tree-shakable — importing this component does not pull every controller).
    ChartJS.register(RadarController, LineElement, PointElement, RadialLinearScale, Filler, Legend, Tooltip, Colors);

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
    effect(() => { const __watchVal = (() => this.data())(); untracked(() => ((v: any) => {
      const __updateMode = this.updateMode();
      if (!this.instance) return;
      if (this.redraw()) {
        this.recreate();
        return;
      }

      // Reconcile a new data object into the LIVE chart instead of replacing
      // instance.data. Chart.js matches dataset controllers and point elements by
      // array index across an update(), so mutating the existing labels/datasets
      // arrays lets it tween every point from old value to new. Assigning a fresh
      // instance.data severs that identity.
      const next = v;
      const live = this.instance.data;

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
        this.instance.update(__updateMode);
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
      const key = this.datasetIdKey();
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
      this.instance.update(__updateMode);
    })(__watchVal)); });
    effect(() => { const __watchVal = (() => this.options())(); untracked(() => { if (this.__rozieWatchInitial_1) { this.__rozieWatchInitial_1 = false; return; } (() => {
      if (!this.instance || !this.buildConfig) return;
      this.instance.options = this.buildConfig().options;
      this.instance.update('none');
    })(); }); });
    effect(() => { const __watchVal = (() => this.plugins())(); untracked(() => { if (this.__rozieWatchInitial_2) { this.__rozieWatchInitial_2 = false; return; } (() => this.recreate())(); }); });
  }

  ngAfterViewInit() {
    const portals = {
      tooltip: (container: HTMLElement, scope: { model: unknown }): (() => void) => {
        const tpl = this._tooltipTpl();
        const vcr = this._portalAnchor();
        if (!tpl || !vcr) return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-tooltip', '6680f000');
        const view = vcr.createEmbeddedView(tpl, scope as unknown as Record<string, unknown>);
        view.detectChanges();
        for (const node of view.rootNodes as Node[]) container.appendChild(node);
        this._portalViews.add(view as EmbeddedViewRef<unknown>);
        return () => {
          view.destroy();
          this._portalViews.delete(view as EmbeddedViewRef<unknown>);
        };
      },
    };
    this.canvasNode = this.canvasEl()?.nativeElement;

    // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
    // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
    // any consumer-supplied handler first (read off $props.options), then emit a
    // structured payload resolving the hit element(s) via getElementsAtEventForMode.
    // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
    // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
    // any consumer-supplied handler first (read off $props.options), then emit a
    // structured payload resolving the hit element(s) via getElementsAtEventForMode.
    const composedOnClick = (e: any, activeEls: any, chart: any) => {
      const userOnClick = this.options()?.onClick;
      if (typeof userOnClick === 'function') userOnClick(e, activeEls, chart);
      const nearest = chart.getElementsAtEventForMode(e, 'nearest', {
        intersect: true
      }, false);
      this.click.emit({
        event: e,
        elements: nearest,
        chart
      });
      const dataset = chart.getElementsAtEventForMode(e, 'dataset', {
        intersect: true
      }, false);
      if (dataset.length) {
        this.datasetClick.emit({
          event: e,
          elements: dataset,
          datasetIndex: dataset[0].datasetIndex,
          chart
        });
      }
    };
    const composedOnHover = (e: any, activeEls: any, chart: any) => {
      const userOnHover = this.options()?.onHover;
      if (typeof userOnHover === 'function') userOnHover(e, activeEls, chart);
      this.hover.emit({
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
      if (!this.tooltipEl) {
        this.tooltipEl = document.createElement('div');
        this.tooltipEl.className = 'rozie-chart-tooltip';
        this.tooltipEl.style.position = 'absolute';
        this.tooltipEl.style.pointerEvents = 'none';
        this.tooltipEl.style.transition = 'opacity 0.1s ease';
        chart.canvas.parentNode.appendChild(this.tooltipEl);
      }
      if (tooltip.opacity === 0) {
        this.tooltipEl.style.opacity = '0';
        return;
      }
      const title = (tooltip.title || []).join(' ');
      const body = (tooltip.body || []).map((b: any) => b.lines.join(' ')).join(' | ');
      const key = `${title}::${body}`;
      if (key !== tooltipKey) {
        tooltipKey = key;
        this.tooltipDispose?.();
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
        this.tooltipDispose = portals.tooltip(this.tooltipEl, scope);
      }
      const {
        offsetLeft,
        offsetTop
      } = chart.canvas;
      this.tooltipEl.style.opacity = '1';
      this.tooltipEl.style.left = `${offsetLeft + tooltip.caretX}px`;
      this.tooltipEl.style.top = `${offsetTop + tooltip.caretY}px`;
    };

    // ─── config builder ────────────────────────────────────────────────────────
    // $snapshot strips Svelte 5's $state proxy first; Chart.js redefines property
    // descriptors on whatever object it is handed.
    // ─── config builder ────────────────────────────────────────────────────────
    // $snapshot strips Svelte 5's $state proxy first; Chart.js redefines property
    // descriptors on whatever object it is handed.
    this.buildConfig = () => {
      const userOpts = this.options() || {};
      const tooltipOpt = (this.tooltipTpl ?? this.templates()?.['tooltip']) ? {
        ...(userOpts.plugins?.tooltip || {}),
        enabled: false,
        external: tooltipExternal
      } : userOpts.plugins?.tooltip;
      return {
        type: 'radar',
        data: this.data(),
        // per-instance plugins[] — the consumer-extensibility passthrough.
        plugins: this.plugins(),
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
    this.instance = new ChartJS(this.canvasNode, this.buildConfig());
    this.__rozieDestroyRef.onDestroy(() => {
      const __destroyDelay = this.destroyDelay();
      this.tooltipDispose?.();
      this.tooltipEl?.remove();
      // destroyDelay (vue-chartjs parity): defer destroy() so any exit transition
      // can finish. The captured `dying` instance is destroyed after the grace;
      // 0 (default) destroys synchronously.
      const dying = this.instance;
      if (__destroyDelay > 0) {
        setTimeout(() => dying?.destroy(), __destroyDelay);
      } else {
        dying?.destroy();
      }
    });
    this.__rozieDestroyRef.onDestroy(() => {
      for (const view of this._portalViews) view.destroy();
      this._portalViews.clear();
    });
  }

  instance: any = null;
  canvasNode: any = null;
  tooltipEl: any = null;
  tooltipDispose: any = null;
  buildConfig: any = null;
  recreate = () => {
    if (!this.buildConfig || !this.canvasNode) return;
    this.instance?.destroy();
    this.instance = new ChartJS(this.canvasNode, this.buildConfig());
  };
  getChart = () => {
    return this.instance;
  };
  updateChart = (mode: any) => {
    this.instance?.update(mode);
  };
  resizeChart = (w: any, h: any) => {
    this.instance?.resize(w, h);
  };
  resetChart = () => {
    this.instance?.reset();
  };
  renderChart = () => {
    this.instance?.render();
  };
  stopChart = () => {
    return this.instance?.stop();
  };
  clearChart = () => {
    return this.instance?.clear();
  };
  toBase64Image = (type: any, quality: any) => {
    return this.instance ? this.instance.toBase64Image(type, quality) : null;
  };
  setDatasetVisibility = (datasetIndex: any, visible: any) => {
    this.instance?.setDatasetVisibility(datasetIndex, visible);
  };
  isDatasetVisible = (datasetIndex: any) => {
    return this.instance ? this.instance.isDatasetVisible(datasetIndex) : false;
  };
  hideDataset = (datasetIndex: any, dataIndex: any) => {
    this.instance?.hide(datasetIndex, dataIndex);
  };
  showDataset = (datasetIndex: any, dataIndex: any) => {
    this.instance?.show(datasetIndex, dataIndex);
  };
  setActiveElements = (elements: any) => {
    this.instance?.setActiveElements(elements ?? []);
  };
  getActiveElements = () => {
    return this.instance ? this.instance.getActiveElements() : [];
  };
  getDatasetMeta = (datasetIndex: any) => {
    return this.instance ? this.instance.getDatasetMeta(datasetIndex) : null;
  };

  static ngTemplateContextGuard(
    _dir: Radar,
    _ctx: unknown,
  ): _ctx is FallbackCtx | TooltipCtx {
    return true;
  }

  protected get __style() {
      const __width = this.width();
      return { height: this.height() + 'px', width: __width ? __width + 'px' : undefined };
    }
}

export default Radar;
