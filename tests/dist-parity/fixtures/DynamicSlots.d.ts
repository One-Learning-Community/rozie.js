import type { ReactNode } from 'react';

export interface DynamicSlotsProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'columns' | 'row' | 'total' | 'heading' | 'renderHeaderCell' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  columns?: unknown[];
  row?: Record<string, unknown>;
  total?: number;
  heading?: string;
  renderHeaderCell?: (params: { title: string }) => ReactNode;
  slots?: { 'cell-total'?: ((params: { value: any }) => ReactNode) | undefined; [key: `cell-${string}`]: ((params: { row: any; value: any }) => ReactNode) | undefined; [key: string]: ((...args: any[]) => ReactNode) | undefined; };
}

declare function DynamicSlots(props: DynamicSlotsProps): JSX.Element;
export default DynamicSlots;
