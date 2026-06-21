import type { ReactNode } from 'react';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type * as React from 'react';

export interface SortableListProps {
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (next: unknown[]) => void;
  itemKey?: (string | ((...args: unknown[]) => unknown)) | null;
  handle?: (string) | null;
  group?: (string) | null;
  animation?: number;
  disabled?: boolean;
  options?: Record<string, unknown>;
  labelFor?: ((...args: unknown[]) => unknown) | null;
  ghostClass?: (string) | null;
  chosenClass?: (string) | null;
  dragClass?: (string) | null;
  filter?: (string) | null;
  easing?: (string) | null;
  forceFallback?: boolean;
  swapThreshold?: number;
  cloneable?: boolean;
  listClass?: string | unknown[] | Record<string, unknown>;
  itemClass?: string | unknown[] | Record<string, unknown> | ((...args: unknown[]) => unknown);
  itemStyle?: (string | Record<string, unknown> | ((...args: unknown[]) => unknown)) | null;
  onChange?: (...args: unknown[]) => void;
  onAdd?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  onStart?: (...args: unknown[]) => void;
  onEnd?: (...args: unknown[]) => void;
  renderHeader?: () => ReactNode;
  children?: ReactNode | ((params: { item: () => void; index: () => void }) => ReactNode);
  renderFooter?: () => ReactNode;
  slots?: Record<string, () => ReactNode>;
}

export interface SortableListHandle {
  getInstance: (...args: any[]) => any;
  toArray: (...args: any[]) => any;
  sort: (...args: any[]) => any;
  option: (...args: any[]) => any;
}

declare const SortableList: React.ForwardRefExoticComponent<SortableListProps & React.RefAttributes<SortableListHandle>>;
export default SortableList;
