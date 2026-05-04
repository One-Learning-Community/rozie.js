import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './TodoList.module.css';

interface HeaderCtx { remaining: any; total: any; }

interface ChildrenCtx { item: any; toggle: any; remove: any; }

interface TodoListProps {
  items?: unknown[];
  defaultValue?: unknown[];
  onItemsChange?: (items: unknown[]) => void;
  title?: string;
  onAdd?: (...args: unknown[]) => void;
  onToggle?: (...args: unknown[]) => void;
  onRemove?: (...args: unknown[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: (ctx: ChildrenCtx) => ReactNode;
  renderEmpty?: ReactNode;
}

export default function TodoList(_props: TodoListProps): JSX.Element {
  const props: TodoListProps = {
    ..._props,
    title: _props.title ?? 'Todo',
  };
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultValue ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
  const [draft, setDraft] = useState('');
  const remaining = useMemo(() => items.filter(i => !i.done).length, [items]);

  const { onAdd: _rozieProp_onAdd } = props;
    const add = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setItems([...items, {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    setDraft('');
    _rozieProp_onAdd && _rozieProp_onAdd(text);
  }, [_rozieProp_onAdd, draft, items, setItems]);
  const { onToggle: _rozieProp_onToggle } = props;
    const toggle = useCallback(id => {
    setItems(items.map(i => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    _rozieProp_onToggle && _rozieProp_onToggle(id);
  }, [_rozieProp_onToggle, items, setItems]);
  const { onRemove: _rozieProp_onRemove } = props;
    const remove = useCallback(id => {
    setItems(items.filter(i => i.id !== id));
    _rozieProp_onRemove && _rozieProp_onRemove(id);
  }, [_rozieProp_onRemove, items, setItems]);

  return (
    <>
    <div className={styles["todo-list"]}>
      <header>
        {props.renderHeader ? props.renderHeader({ remaining, total: items.length }) : <h3>{props.title} ({remaining} remaining)</h3>}
      </header>

      <form onSubmit={(e) => { e.preventDefault(); add(e); }}>
        <input placeholder="What needs doing?" value={draft} onChange={e => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim()}>Add</button>
      </form>

      {(items.length > 0) ? <ul>
        {items.map((item) => <li key={item.id} className={clsx({ [styles.done]: item.done })}>
          
          {props.children ? props.children({ item, toggle: () => toggle(item.id), remove: () => remove(item.id) }) : <><label>
              <input type="checkbox" checked={item.done} onChange={(e) => { toggle(item.id); }} />
              <span>{item.text}</span>
            </label><button aria-label="Remove" onClick={(e) => { remove(item.id); }}>×</button></>}
        </li>)}
      </ul> : <p className={styles.empty}>
        {props.renderEmpty ?? "Nothing to do. ✨"}
      </p>}</div>
    </>
  );
}
