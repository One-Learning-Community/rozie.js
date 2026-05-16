import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useControllableState } from '@rozie/runtime-react';
import styles from './ScopedSlotContext.module.css';

interface ItemCtx { item: any; remaining: any; }

interface ScopedSlotContextProps {
  items?: unknown[];
  defaultValue?: unknown[];
  onItemsChange?: (items: unknown[]) => void;
  renderItem?: (ctx: ItemCtx) => ReactNode;
}

export default function ScopedSlotContext(props: ScopedSlotContextProps): JSX.Element {
  const [items, setItems] = useControllableState({
    value: props.items,
    defaultValue: props.defaultValue ?? (() => [])(),
    onValueChange: props.onItemsChange,
  });
  const remaining = useMemo(() => items.filter(i => !i.done).length, [items]);

  return (
    <>
    <ul className={styles.list} data-rozie-s-5e6c469d="">
      
      {items.map((item) => <li key={item.id} data-rozie-s-5e6c469d="">
        {props.renderItem ? props.renderItem({ item, remaining }) : item.label}
      </li>)}
    </ul>
    </>
  );
}
