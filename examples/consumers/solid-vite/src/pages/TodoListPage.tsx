import { createSignal } from 'solid-js';
import TodoList from '../../../../TodoList.rozie';

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

/**
 * TodoListPage — wraps TodoList.rozie with parent-controlled item array.
 */
export default function TodoListPage() {
  const [items, setItems] = createSignal<TodoItem[]>([
    { id: '1', text: 'Write Phase 06.3 plan', done: true },
    { id: '2', text: 'Implement Solid emitter', done: true },
    { id: '3', text: 'Wire solid-vite demo', done: false },
  ]);

  return (
    <div>
      <h2>TodoList</h2>
      <TodoList
        items={items()}
        onItemsChange={(next: TodoItem[]) => setItems(next)}
        title="My Todos"
      />
    </div>
  );
}
