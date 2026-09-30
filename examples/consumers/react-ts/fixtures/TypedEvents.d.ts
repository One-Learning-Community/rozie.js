import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export type Count = number;
export interface PingPayload {
  count: Count;
  label: string;
}

export interface TypedEventsProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'tone' | 'onPing' | 'onReset' | 'onSelect' | 'onRowOpen' | 'renderRow' | 'slots' | 'children' | 'dangerouslySetInnerHTML'> {
  tone?: string;
  onPing?: (payload: PingPayload) => void;
  onReset?: () => void;
  onSelect?: (payload: number) => void;
  onRowOpen?: (payload: {
    index: number;
  }) => void;
  renderRow?: (params: { count: Count; tone: string }) => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface TypedEventsHandle {
  bump: () => void;
  clear: (...args: any[]) => any;
  getCount: () => number;
  jump: (to: number) => void;
}

declare const TypedEvents: React.ForwardRefExoticComponent<TypedEventsProps & React.RefAttributes<TypedEventsHandle>>;
export default TypedEvents;
