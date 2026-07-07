import type { JSX } from 'solid-js';
import { createSignal, splitProps } from 'solid-js';
import { createControllableSignal, createDebouncedHandler } from '@rozie/runtime-solid';

interface Spike012R5C3Props {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export default function Spike012R5C3(_props: Spike012R5C3Props): JSX.Element {
  const [local, attrs] = splitProps(_props, ['value']);

  const [value, setValue] = createControllableSignal<string>(_props as unknown as Record<string, unknown>, 'value', '');
  const [n, setN] = createSignal(0);
  const [q, setQ] = createSignal('');

  function noop(): void {}

  const _rozieDebouncedHandler0 = createDebouncedHandler(($event: any) => { setValue(($event.currentTarget as HTMLInputElement).value); }, 300);

  return (
    <>
    <div {...attrs} class={"r" + (((attrs as unknown as Record<string, unknown>).class as string | undefined) ? " " + ((attrs as unknown as Record<string, unknown>).class as string | undefined) : "")} data-rozie-s-d6f96745="">
      <button onClick={($event: MouseEvent & { currentTarget: HTMLButtonElement; target: Element }) => { setQ(n() > 0 ? 'a' : 'b'); }} data-rozie-s-d6f96745="">go</button>
      <input onInput={_rozieDebouncedHandler0} data-rozie-s-d6f96745="" />
    </div>
    </>
  );
}
