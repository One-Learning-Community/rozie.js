import type { JSX } from 'solid-js';
import { For, createSignal, splitProps } from 'solid-js';

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
    <ul {...attrs} {...attrs} data-rozie-s-a955b18d="">
      <For each={items()}>{(e) => <li data-rozie-s-a955b18d="">
        <span data-rozie-s-a955b18d="">{e.label}</span>
        
        <button type="button" onClick={($event) => { removeItem(e.id); }} data-rozie-s-a955b18d="">×</button>
      </li>}</For>
    </ul>
    </>
  );
}
