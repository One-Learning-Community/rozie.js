import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieDisplay } from '@rozie/runtime-solid';

interface EventLoopVarShadowProps {}

export default function EventLoopVarShadow(_props: EventLoopVarShadowProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [items, setItems] = createSignal([{
    id: 'a',
    label: 'A'
  }, {
    id: 'b',
    label: 'B'
  }]);

  function removeItem(id: any) {
    setItems(items().filter((x: any) => x.id !== id));
  }

  return (
    <>
    <ul {...attrs} data-rozie-s-a955b18d="">
      <Key each={items() as readonly any[]} by={(e) => e.id}>{(e) => <li data-rozie-s-a955b18d="">
        <span data-rozie-s-a955b18d="">{rozieDisplay(e().label)}</span>
        
        <button type="button" onClick={($event: MouseEvent) => { removeItem(e().id); }} data-rozie-s-a955b18d="">×</button>
      </li>}</Key>
    </ul>
    </>
  );
}
