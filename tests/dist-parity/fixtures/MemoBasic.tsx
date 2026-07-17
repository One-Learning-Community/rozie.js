import { useMemo, useState } from 'react';
import { clsx, rozieDisplay } from '@rozie/runtime-react';
import './MemoBasic.css';

interface MemoBasicProps {
  items?: any[];
}

export default function MemoBasic(_props: MemoBasicProps): JSX.Element {
  const __defaultItems = useState(() => (() => [])())[0];
  const props: Omit<MemoBasicProps, 'items'> & { items: any[] } = {
    ..._props,
    items: _props.items ?? __defaultItems,
  };
  const attrs: Record<string, unknown> = (() => {
    const { items, ...rest } = _props as MemoBasicProps & Record<string, unknown>;
    void items;
    return rest;
  })();
  const [query, setQuery] = useState('');

  const filteredCache = useMemo(() => ({
    keys: null,
    val: null,
    has: false
  }), []);
  function filtered() {
    const __rozieMemoKey = [props.items, query];
    if (filteredCache.has && filteredCache.keys.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === filteredCache.keys[i])) {
      return filteredCache.val;
    }
    const __rozieMemoVal = props.items.filter((item: any) => item.includes(query));
    filteredCache.keys = __rozieMemoKey;
    filteredCache.val = __rozieMemoVal;
    filteredCache.has = true;
    return __rozieMemoVal;
  }

  return (
    <>
    <div {...attrs} className={clsx("probe", (attrs.className as string | undefined))} data-rozie-s-fcb74b54="">
      <input value={query} onInput={($event) => { setQuery($event.target.value); }} data-rozie-s-fcb74b54="" />
      <ul data-rozie-s-fcb74b54="">
        {filtered().map((item) => <li key={item} data-rozie-s-fcb74b54="">{rozieDisplay(item)}</li>)}
      </ul>
    </div>
    </>
  );
}
