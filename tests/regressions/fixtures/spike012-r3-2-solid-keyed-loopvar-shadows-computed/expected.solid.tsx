import type { JSX } from 'solid-js';
import { createMemo, createSignal, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieDisplay } from '@rozie/runtime-solid';

interface KeyedLoopVarShadowsComputedProps {}

export default function KeyedLoopVarShadowsComputed(_props: KeyedLoopVarShadowsComputedProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [items, setItems] = createSignal([{
    id: 1
  }, {
    id: 2
  }]);
  const item = createMemo(() => ({
    id: 0
  }));

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-47c616e4="">
      <ul data-rozie-s-47c616e4="">
        <Key each={items() as readonly any[]} by={(item) => item.id}>{(item) => <li data-rozie-s-47c616e4="">{rozieDisplay(item().id)}</li>}</Key>
      </ul>
    </div>
    </>
  );
}
