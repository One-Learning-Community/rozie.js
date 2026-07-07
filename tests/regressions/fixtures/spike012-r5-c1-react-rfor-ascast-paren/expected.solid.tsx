import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { Key } from '@solid-primitives/keyed';
import { rozieDisplay } from '@rozie/runtime-solid';

interface RforAsCastParenProps {}

export default function RforAsCastParen(_props: RforAsCastParenProps): JSX.Element {
  const [local, attrs] = splitProps(_props, []);

  const [items, setItems] = createSignal([1, 2, 3]);

  function noop(): void {}

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-1453ae2b=""><ul data-rozie-s-1453ae2b=""><Key each={items() as number[] as readonly any[]} by={(it) => it}>{(it) => <li data-rozie-s-1453ae2b="">{rozieDisplay(it())}</li>}</Key></ul></div>
    </>
  );
}
