import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';

interface InterpArrowAsCastProps {}

export default function InterpArrowAsCast(_props: InterpArrowAsCastProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [items, setItems] = createSignal([1, 2, 3]);

  function noop(): void {}

  return (
    <>
    <div {...attrs} data-rozie-s-8efa13ea="">{items().filter(x => x as number > 1).length}</div>
    </>
  );
}
