import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface ChartProps {
  data?: Record<string, unknown>;
  options?: Record<string, unknown>;
  type?: string;
  height?: number;
  width?: number;
  plugins?: unknown[];
  updateMode?: string;
  redraw?: boolean;
  ariaLabel?: string;
  onClick?: (...args: unknown[]) => void;
  onDatasetClick?: (...args: unknown[]) => void;
  onHover?: (...args: unknown[]) => void;
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
}

declare const Chart: React.ForwardRefExoticComponent<ChartProps & React.RefAttributes<ChartHandle>>;
export default Chart;
