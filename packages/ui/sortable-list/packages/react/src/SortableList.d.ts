import type { ReactNode } from 'react';

export interface SortableListProps {
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (next: unknown[]) => void;
  itemKey?: (string) | null;
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
  onChange?: (...args: unknown[]) => void;
  onAdd?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  onStart?: (...args: unknown[]) => void;
  onEnd?: (...args: unknown[]) => void;
  children?: ReactNode | ((params: { item: () => void; index: () => void }) => ReactNode);
  slots?: Record<string, () => ReactNode>;
}

declare function SortableList(props: SortableListProps): JSX.Element;
export default SortableList;
