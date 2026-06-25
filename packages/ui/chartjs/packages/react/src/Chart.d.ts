import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ChartProps {
  /**
   * Chart.js data in its own `{ labels, datasets }` shape. Reconciled **in place** on change — the wrapper mutates `chart.data` and calls `chart.update()` so series tween point-to-point instead of remounting.
   * @example
   * <Chart :data="$data.chartData" type="bar" />
   */
  data?: Record<string, unknown>;
  /**
   * Chart.js options (scales, legend, plugins config, …). Merged over the wrapper's responsive defaults and reapplied wholesale on change with `update('none')`. A consumer-supplied `options.onClick`/`onHover` is **composed**, not clobbered.
   */
  options?: Record<string, unknown>;
  /**
   * The chart kind — any Chart.js controller (`line`/`bar`/`pie`/`doughnut`/`radar`/`polarArea`/`scatter`/`bubble`/…). Changing it **re-creates** the instance, since Chart.js has no stable runtime type-swap.
   */
  type?: string;
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
  plugins?: unknown[];
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
  onClick?: (...args: unknown[]) => void;
  onDatasetClick?: (...args: unknown[]) => void;
  onHover?: (...args: unknown[]) => void;
  renderFallback?: () => ReactNode;
  renderTooltip?: (params: { model: () => void }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface ChartHandle {
  getChart: (...args: any[]) => any;
  updateChart: (...args: any[]) => any;
  resizeChart: (...args: any[]) => any;
  resetChart: (...args: any[]) => any;
  renderChart: (...args: any[]) => any;
  stopChart: (...args: any[]) => any;
  clearChart: (...args: any[]) => any;
  toBase64Image: (...args: any[]) => any;
  setDatasetVisibility: (...args: any[]) => any;
  isDatasetVisible: (...args: any[]) => any;
  hideDataset: (...args: any[]) => any;
  showDataset: (...args: any[]) => any;
  setActiveElements: (...args: any[]) => any;
  getActiveElements: (...args: any[]) => any;
  getDatasetMeta: (...args: any[]) => any;
}

declare const Chart: React.ForwardRefExoticComponent<ChartProps & React.RefAttributes<ChartHandle>>;
export default Chart;
