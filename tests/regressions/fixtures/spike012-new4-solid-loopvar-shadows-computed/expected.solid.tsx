import type { JSX } from 'solid-js';
import { For, createMemo, createSignal, splitProps } from 'solid-js';
import { rozieDisplay } from '@rozie/runtime-solid';

interface LoopVarShadowsComputedProps {}

export default function LoopVarShadowsComputed(_props: LoopVarShadowsComputedProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [items, setItems] = createSignal([1, 2, 3]);
  const item = createMemo(() => 'c');

  return (
    <>
    <ul {...attrs} class={"list" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-f8e0ec33="">
      <For each={items()}>{(item) => <li data-rozie-s-f8e0ec33="">{rozieDisplay(item)}</li>}</For>
      <li class={"computed"} data-rozie-s-f8e0ec33="">{rozieDisplay(item())}</li>
    </ul>
    </>
  );
}
