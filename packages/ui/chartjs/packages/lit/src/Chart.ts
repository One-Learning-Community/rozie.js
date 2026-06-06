import { LitElement, css, html, nothing, render } from 'lit';
import { customElement, property, query, queryAssignedElements, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import { styleMap } from 'lit/directives/style-map.js';
import { Chart as ChartJS, registerables } from 'chart.js';

// Chart.js v3+ ships with no controllers/elements/scales pre-registered;
// the consumer has to opt in. registerables is the "kitchen sink" bundle —
// every controller, so the `type` prop can switch to any chart kind.

interface RozieTooltipSlotCtx {
  model: unknown;
}

@customElement('rozie-chart')
export default class Chart extends SignalWatcher(LitElement) {
  static styles = css`
.rozie-chart[data-rozie-s-2228fabc] {
  position: relative;
  width: 100%;
}
.rozie-chart[data-rozie-s-2228fabc] canvas[data-rozie-s-2228fabc] {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.rozie-chart[data-rozie-s-2228fabc] [data-rozie-s-2228fabc]:global(.rozie-chart-tooltip) {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  transform: translate(-50%, calc(-100% - 8px));
  white-space: nowrap;
}
`;

  @property({ type: Object }) data: any = {
  labels: [],
  datasets: []
};
  @property({ type: Object }) options: any = {};
  @property({ type: String, reflect: true }) type: string = 'line';
  @property({ type: Number, reflect: true }) height: number = 240;
  @property({ type: Number, reflect: true }) width: number = undefined;
  @property({ type: Array }) plugins: any[] = [];
  @property({ type: String, reflect: true }) updateMode: string = undefined;
  @property({ type: Boolean, reflect: true }) redraw: boolean = false;
  @property({ type: String, reflect: true }) ariaLabel: string = undefined;
  @query('[data-rozie-ref="canvasEl"]') private _refCanvasEl!: HTMLElement;
private __rozieFirstUpdateDone = false;
private _portalContainers = new Set<HTMLElement>();

  @state() private _hasSlotTooltip = false;
  @queryAssignedElements({ slot: 'tooltip', flatten: true }) private _slotTooltipElements!: Element[];
  @property({ attribute: false }) tooltip?: (scope: { model: unknown }) => unknown;

  private _disconnectCleanups: Array<() => void> = [];
  // Re-parenting guard: set true once the deferred teardown has actually
  // run (a genuine un-mount), so a subsequent reconnect knows to re-arm.
  private _rozieTornDown = false;

  private _armListeners(): void {
    {
      const slotEl = this.shadowRoot?.querySelector('slot[name="tooltip"]');
      if (slotEl !== null && slotEl !== undefined) {
        const update = () => { this._hasSlotTooltip = this._slotTooltipElements.length > 0; };
        slotEl.addEventListener('slotchange', update);
        // CR-05 fix: push cleanup so the listener is removed on disconnectedCallback.
        this._disconnectCleanups.push(() => slotEl.removeEventListener('slotchange', update));
        update();
      }
    }
  }

  connectedCallback(): void {
    // Phase 07.3.1 D-LIT-15 — pre-seed _hasSlot<X> from light DOM so first render isn't deadlocked.
    this._hasSlotTooltip = Array.from(this.children).some((el) => el.getAttribute('slot') === 'tooltip');
    super.connectedCallback();
    if (this.hasUpdated && this._rozieTornDown) { this._rozieTornDown = false; this._armListeners(); }
  }

  firstUpdated(): void {
    this._armListeners();

    const portals = {
      tooltip: (container: HTMLElement, scope: { model: unknown }): (() => void) => {
        const tpl = this.tooltip;
        if (typeof tpl !== 'function') return () => {};
        // Spike 004: portal-scope attribute injection.
        container.setAttribute('data-rozie-portal-tooltip', '2228fabc');
        render(tpl(scope), container);
        this._portalContainers.add(container);
        return () => {
          render(nothing, container);
          this._portalContainers.delete(container);
        };
      },
    };

    // Chart.js v3+ ships with no controllers/elements/scales pre-registered;
    // the consumer has to opt in. registerables is the "kitchen sink" bundle —
    // every controller, so the `type` prop can switch to any chart kind.
    ChartJS.register(...registerables);

    this._disconnectCleanups.push((() => {
      this.tooltipDispose?.();
      this.tooltipEl?.remove();
      this.instance?.destroy();
    }));

    this.canvasNode = this._refCanvasEl;

    // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
    // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
    // any consumer-supplied handler first (read off $props.options), then emit a
    // structured payload resolving the hit element(s) via getElementsAtEventForMode.
    // ─── @click / @hover / @datasetClick — composed, never clobbering ──────────
    // Chart.js calls onClick/onHover with (event, activeElements, chart). We call
    // any consumer-supplied handler first (read off $props.options), then emit a
    // structured payload resolving the hit element(s) via getElementsAtEventForMode.
    const composedOnClick = (e: any, activeEls: any, chart: any) => {
      const userOnClick = this.options?.onClick;
      if (typeof userOnClick === 'function') userOnClick(e, activeEls, chart);
      const nearest = chart.getElementsAtEventForMode(e, 'nearest', {
        intersect: true
      }, false);
      this.dispatchEvent(new CustomEvent("click", {
        detail: {
          event: e,
          elements: nearest,
          chart
        },
        bubbles: true,
        composed: true
      }));
      const dataset = chart.getElementsAtEventForMode(e, 'dataset', {
        intersect: true
      }, false);
      if (dataset.length) {
        this.dispatchEvent(new CustomEvent("datasetClick", {
          detail: {
            event: e,
            elements: dataset,
            datasetIndex: dataset[0].datasetIndex,
            chart
          },
          bubbles: true,
          composed: true
        }));
      }
    };
    const composedOnHover = (e: any, activeEls: any, chart: any) => {
      const userOnHover = this.options?.onHover;
      if (typeof userOnHover === 'function') userOnHover(e, activeEls, chart);
      this.dispatchEvent(new CustomEvent("hover", {
        detail: {
          event: e,
          elements: activeEls,
          chart
        },
        bubbles: true,
        composed: true
      }));
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
      const userOpts = this.options || {};
      const tooltipOpt = this.tooltip !== undefined ? {
        ...(userOpts.plugins?.tooltip || {}),
        enabled: false,
        external: tooltipExternal
      } : userOpts.plugins?.tooltip;
      return {
        type: this.type,
        data: this.data,
        // per-instance plugins[] — the consumer-extensibility passthrough.
        plugins: this.plugins,
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
  }

  updated(changedProperties: Map<string, unknown>): void {
    if (changedProperties.has('data')) { const __watchVal = (() => this.data)(); ((v: any) => {
      if (!this.instance) return;
      if (this.redraw) {
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
      live.labels ??= [];
      live.labels.length = 0;
      live.labels.push(...(next.labels ?? []));
      live.datasets ??= [];
      const nextSets = next.datasets ?? [];
      nextSets.forEach((ds: any, i: any) => {
        if (live.datasets[i]) Object.assign(live.datasets[i], ds);else live.datasets[i] = ds;
      });
      live.datasets.length = nextSets.length;
      this.instance.update(this.updateMode);
    })(__watchVal); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('options'))) { const __watchVal = (() => this.options)(); (() => {
      if (!this.instance || !this.buildConfig) return;
      this.instance.options = this.buildConfig().options;
      this.instance.update('none');
    })(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('type'))) { const __watchVal = (() => this.type)(); (() => this.recreate())(); }
    if (this.__rozieFirstUpdateDone && (changedProperties.has('plugins'))) { const __watchVal = (() => this.plugins)(); (() => this.recreate())(); }
    this.__rozieFirstUpdateDone = true;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    queueMicrotask(() => {
      if (this.isConnected || this._rozieTornDown) return;
      this._rozieTornDown = true;
      for (const container of this._portalContainers) render(nothing, container);
      this._portalContainers.clear();
      for (const fn of this._disconnectCleanups) fn();
      this._disconnectCleanups = [];
    });
  }

  render() {
    return html`
<div class="rozie-chart" style=${styleMap({ height: this.height + 'px', width: this.width ? this.width + 'px' : undefined })} data-rozie-s-2228fabc>
  <canvas role="img" aria-label=${this.ariaLabel} data-rozie-ref="canvasEl" data-rozie-s-2228fabc></canvas>
</div>

<slot name="tooltip"></slot>
`;
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

  getChart() {
    return this.instance;
  }

  updateChart(mode: any) {
    this.instance?.update(mode);
  }

  resizeChart(w: any, h: any) {
    this.instance?.resize(w, h);
  }

  resetChart() {
    this.instance?.reset();
  }

  renderChart() {
    this.instance?.render();
  }

  stopChart() {
    return this.instance?.stop();
  }

  clearChart() {
    return this.instance?.clear();
  }

  toBase64Image(type: any, quality: any) {
    return this.instance ? this.instance.toBase64Image(type, quality) : null;
  }
}
