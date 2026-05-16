import type { JSX } from 'solid-js';
import { For, Show, children, createMemo, createSignal, mergeProps, splitProps } from 'solid-js';
import { createControllableSignal } from '@rozie/runtime-solid';

interface HeaderSlotCtx { remaining: any; total: any; }

interface TodoListProps {
  items?: unknown[];
  defaultItems?: unknown[];
  onItemsChange?: (items: unknown[]) => void;
  title?: string;
  onAdd?: (...args: unknown[]) => void;
  onToggle?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  headerSlot?: (ctx: HeaderSlotCtx) => JSX.Element;
  // D-131: default slot resolved via children() at body top
  children?: JSX.Element;
  emptySlot?: JSX.Element;
}

export default function TodoList(_props: TodoListProps): JSX.Element {
  const _merged = mergeProps({ title: 'Todo' }, _props);
  const [local, rest] = splitProps(_merged, ['items', 'title', 'children']);
  const resolved = children(() => local.children);

  const [items, setItems] = createControllableSignal(_props as Record<string, unknown>, 'items', (() => [])());
  const [draft, setDraft] = createSignal('');
  const remaining = createMemo(() => items().filter(i => !i.done).length);

  const add = () => {
    const text = draft().trim();
    if (!text) return;
    setItems([...items(), {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    setDraft('');
    _props.onAdd?.(text);
  };
  const toggle = id => {
    setItems(items().map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    _props.onToggle?.(id);
  };
  const remove = id => {
    setItems(items().filter(i => i.id !== id));
    _props.onRemove?.(id);
  };

  return (
    <>
    <style>{`.todo-list { font-family: system-ui, sans-serif; }
    ul { list-style: none; padding: 0; }
    li { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; }
    li.done span { text-decoration: line-through; opacity: 0.5; }
    .empty { color: rgba(0, 0, 0, 0.4); font-style: italic; }
    form { display: flex; gap: 0.25rem; margin-block: 0.5rem; }`}</style>
    <>
    <div class={"todo-list"}>
      <header>
        {_props.headerSlot ? _props.headerSlot({ remaining: remaining(), total: items().length }) : <h3>{local.title} ({remaining()} remaining)</h3>}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add(); }}>
        <input placeholder="What needs doing?" value={draft()} onInput={e => setDraft(e.currentTarget.value)} />
        <button type="submit" disabled={!draft().trim()}>Add</button>
      </form>

      {<Show when={items().length > 0} fallback={<p class={"empty"}>
        {_props.emptySlot ?? "Nothing to do. ✨"}
      </p>}><ul>
        <For each={items()}>{(item) => <li classList={{ done: item.done }}>
          
          {resolved() ?? <><label><input type="checkbox" checked={item.done} onChange={(e) => { toggle(item.id); }} /><span>{item.text}</span></label><button aria-label="Remove" onClick={(e) => { remove(item.id); }}>×</button></>}
        </li>}</For>
      </ul></Show>}</div>
    </>
    </>
  );
}
