import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { clsx, useControllableState } from '@rozie/runtime-react';
import styles from './TodoList.module.css';

interface HeaderCtx { remaining: any; total: any; }

interface ChildrenCtx { item: any; toggle: any; remove: any; }

interface TodoListProps {
  items?: any[];
  defaultItems?: any[];
  onItemsChange?: (items: any[]) => void;
  title?: string;
  onAdd?: (...args: any[]) => void;
  onToggle?: (...args: any[]) => void;
  onRemove?: (...args: any[]) => void;
  renderHeader?: (ctx: HeaderCtx) => ReactNode;
  children?: ReactNode | ((ctx: ChildrenCtx) => ReactNode);
  renderEmpty?: () => ReactNode;
  slots?: Record<string, () => import('react').ReactNode>;
}

export default function TodoList(_props: TodoListProps): JSX.Element {
  const props: TodoListProps & { title: string } = {
    ..._props,
    title: _props.title ?? 'Todo',
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, title, defaultValue, onItemsChange, defaultItems, ...rest } = _props as TodoListProps & Record<string, unknown>;
    void items; void title; void defaultValue; void onItemsChange; void defaultItems;
    return rest;
  })();
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultItems ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
  const [draft, setDraft] = useState('');
  const remaining = useMemo(() => items.filter((i: any) => !i.done).length, [items]);

  const { onAdd: _rozieProp_onAdd } = props;
    const add = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      text,
      done: false
    }]);
    setDraft('');
    _rozieProp_onAdd && _rozieProp_onAdd(text);
  }, [_rozieProp_onAdd, draft, setItems]);
  const { onToggle: _rozieProp_onToggle } = props;
    const toggle = useCallback((id: any) => {
    setItems(prev => prev.map((i: any) => i.id === id ? {
      ...i,
      done: !i.done
    } : i));
    _rozieProp_onToggle && _rozieProp_onToggle(id);
  }, [_rozieProp_onToggle, setItems]);
  const { onRemove: _rozieProp_onRemove } = props;
    const removeItem = useCallback((id: any) => {
    setItems(prev => prev.filter((i: any) => i.id !== id));
    _rozieProp_onRemove && _rozieProp_onRemove(id);
  }, [_rozieProp_onRemove, setItems]);

  return (
    <>
    <div {...attrs} className={clsx(styles["todo-list"], (attrs.className as string | undefined))} {...attrs} data-rozie-s-52bec3de="">
      <header data-rozie-s-52bec3de="">
        {(props.renderHeader ?? props.slots?.['header']) ? ((props.renderHeader ?? props.slots?.['header']) as Function)({ remaining, total: items.length }) : <h3 data-rozie-s-52bec3de="">{props.title} ({remaining} remaining)</h3>}
      </header>

      <form onSubmit={($event) => { $event.preventDefault(); ((add) as ((...args: any[]) => any))($event); }} data-rozie-s-52bec3de="">
        <input placeholder="What needs doing?" value={draft} onChange={e => setDraft(e.target.value)} data-rozie-s-52bec3de="" />
        <button type="submit" disabled={!draft.trim()} data-rozie-s-52bec3de="">Add</button>
      </form>

      {(items.length > 0) ? <ul data-rozie-s-52bec3de="">
        {items.map((item) => <li key={item.id} className={clsx({ [styles.done]: item.done })} data-rozie-s-52bec3de="">
          
          {typeof (props.children ?? props.slots?.['']) === 'function' ? ((props.children ?? props.slots?.['']) as Function)({ item, toggle: () => toggle(item.id), remove: () => removeItem(item.id) }) : ((props.children ?? props.slots?.['']) ?? <><label data-rozie-s-52bec3de=""><input type="checkbox" checked={item.done} onChange={($event) => { toggle(item.id); }} data-rozie-s-52bec3de="" /><span data-rozie-s-52bec3de="">{item.text}</span></label><button aria-label="Remove" onClick={($event) => { removeItem(item.id); }} data-rozie-s-52bec3de="">×</button></>)}
        </li>)}
      </ul> : <p className={styles.empty} data-rozie-s-52bec3de="">
        {(props.renderEmpty ?? props.slots?.['empty']) ? ((props.renderEmpty ?? props.slots?.['empty']) as Function)() : "Nothing to do. ✨"}
      </p>}</div>
    </>
  );
}
