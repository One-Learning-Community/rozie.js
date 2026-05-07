import type { ReactNode } from 'react';

export interface TodoListProps {
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (next: unknown[]) => void;
  title?: string;
  onAdd?: (...args: unknown[]) => void;
  onToggle?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  renderHeader?: (params: { remaining: () => void; total: unknown }) => ReactNode;
  children?: ReactNode | ((params: { item: () => void; toggle: unknown; remove: unknown }) => ReactNode);
  renderEmpty?: () => ReactNode;
}

declare function TodoList(props: TodoListProps): JSX.Element;
export default TodoList;
