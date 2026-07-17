import type { JSX } from 'solid-js';
import { createSignal, mergeProps, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { __rozieInjectStyle, rozieDisplay } from '@rozie/runtime-solid';

__rozieInjectStyle('MemoBasic-fcb74b54', `.probe[data-rozie-s-fcb74b54] {
  display: block;
  padding: 0.5rem;
}`);

interface MemoBasicProps {
  items?: any[];
}

export default function MemoBasic(_props: MemoBasicProps): JSX.Element {
  const _merged = mergeProps({ items: (() => [])() as any[] }, _props);
  const [local, attrs] = splitProps(_merged, ['items']);

  const [query, setQuery] = createSignal('');

  const filteredCache = {
    keys: null as any[] | null,
    val: null as any
  };
  function filtered() {
    const __rozieMemoKey = [local.items, query()];
    const __rozieMemoPrev = filteredCache.keys;
    if (__rozieMemoPrev !== null && __rozieMemoPrev.length === __rozieMemoKey.length && __rozieMemoKey.every((v: any, i: any) => v === __rozieMemoPrev[i])) {
      return filteredCache.val;
    }
    const __rozieMemoVal = local.items.filter((item: any) => item.includes(query()));
    filteredCache.keys = __rozieMemoKey;
    filteredCache.val = __rozieMemoVal;
    return __rozieMemoVal;
  }

  return (
    <>
    <div {...attrs} class={"probe" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-fcb74b54="">
      <input value={query()} onInput={($event: InputEvent & { currentTarget: HTMLInputElement; target: Element }) => { setQuery($event.target.value); }} data-rozie-s-fcb74b54="" />
      <ul data-rozie-s-fcb74b54="">
        <Key each={filtered() as readonly any[]} by={(item) => item}>{(item) => <li data-rozie-s-fcb74b54="">{rozieDisplay(item())}</li>}</Key>
      </ul>
    </div>
    </>
  );
}
