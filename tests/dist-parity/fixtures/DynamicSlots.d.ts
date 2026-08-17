import type { ReactNode } from 'react';

export interface DynamicSlotsProps {
  columns?: unknown[];
  row?: Record<string, unknown>;
  total?: number;
  heading?: string;
  renderHeaderCell?: (params: { title: string }) => ReactNode;
  slots?: { 'cell-total'?: ((params: { value: any }) => ReactNode) | undefined; [key: `cell-${string}`]: ((params: { row: any; value: any }) => ReactNode) | undefined; [key: string]: ((...args: any[]) => ReactNode) | undefined; };
}

declare function DynamicSlots(props: DynamicSlotsProps): JSX.Element;
export default DynamicSlots;
