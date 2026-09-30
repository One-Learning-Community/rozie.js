import type { ReactNode } from 'react';

export interface DynamicSlotsProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'row' | 'total' | 'cellKey' | 'freeSlotName' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  row?: Record<string, unknown>;
  total?: number;
  cellKey?: string;
  freeSlotName?: string;
  slots?: { 'cell-total'?: ((params: { value: any }) => ReactNode) | undefined; [key: `cell-${string}`]: ((params: { row: any; value: any }) => ReactNode) | undefined; [key: `row-${string}`]: (() => ReactNode) | undefined; [key: string]: ((...args: any[]) => ReactNode) | undefined; };
}

declare function DynamicSlots(props: DynamicSlotsProps): JSX.Element;
export default DynamicSlots;
