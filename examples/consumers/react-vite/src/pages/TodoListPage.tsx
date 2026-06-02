import { useState } from 'react';
import type { JSX } from 'react';
import TodoList from '../TodoList.rozie';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * TodoListPage — wraps TodoList.rozie with parent-controlled item array. Uses
 * a default slot consumer (children render-prop signature per the React-side
 * scoped-slot contract from Phase 4 / D-67) to verify per-item slot params
 * resolve.
 */
export default function TodoListPage(): JSX.Element {
  const [items, setItems] = useState<TodoItem[]>([
    { id: '1', text: 'Write Phase 4 plan', done: true },
    { id: '2', text: 'Implement React emitter', done: true },
    { id: '3', text: 'Wire react-vite demo', done: false },
  ]);

  return (
    <div>
      <h2>TodoList</h2>
      <TodoList
        items={items}
        // TodoList.rozie types `items` as `type: Array` (no element type), so the
        // sidecar's `onItemsChange` is `(next: unknown[]) => void`. The consumer
        // narrows back to its known `TodoItem[]` shape at the boundary.
        onItemsChange={(next: unknown[]) => setItems(next as TodoItem[])}
        title="My Todos"
      />
    </div>
  );
}
